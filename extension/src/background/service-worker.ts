import { exactSearch } from './search-engine'
import { searchHistory } from './history-search'
import { initTabIndexer, isSearchableUrl, TAB_CACHE_TTL_MS } from './tab-indexer'
import { logEvent, getStoredLogs, formatLogsForReport, clearLogs } from './error-logger'
import {
  getCachedTabText,
  setCachedTabText,
  setActiveResults,
  clearActiveResults,
  getRecentSearches,
  getRecentClicks,
  getPinnedSearches,
  pushRecentSearch,
  pushRecentClick,
  clearRecentSearches,
  clearRecentClicks,
  pinSearch,
  unpinSearch,
  getSettings,
  saveSettings,
} from './storage'
import {
  getAvailableFeatures,
  enforceFeatureLimits,
} from './licensing'
import type {
  TabSearchResult,
  HistorySearchResult,
  SearchResults,
  SearchProgressMessage,
  SearchScope,
  Settings,
} from '../types'
import { HIGHLIGHT_PRESETS } from '../types'

const BATCH_SIZE = 8
const MAX_INDEXED_TEXT_CHARS = 500000

// ---------------------------------------------------------------------------
// First install — open onboarding to request host permissions
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason === 'install') {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('src/onboarding/index.html'),
    })
  }
})

// When the user grants <all_urls> permission (from onboarding),
// immediately inject the content script into all currently open tabs
// so they are searchable without a reload.
chrome.permissions.onAdded.addListener(async permissions => {
  if (permissions.origins?.includes('<all_urls>')) {
    await injectContentScriptIntoAllTabs()
    initTabIndexer()
  }
})

// ---------------------------------------------------------------------------
// Initialise tab indexer only if permission already granted
// ---------------------------------------------------------------------------

async function maybeInitTabIndexer(): Promise<void> {
  const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] })
  if (granted) initTabIndexer()
}
maybeInitTabIndexer()

// ---------------------------------------------------------------------------
// Context menu for auto-search on selected text
// ---------------------------------------------------------------------------

let contextMenuCreated = false

// Update context menu based on settings
const updateContextMenu = async () => {
  const rawSettings = await getSettings()
  const settings = await enforceFeatureLimits(rawSettings)
  
  // Remove existing context menu if it exists
  try {
    await chrome.contextMenus.remove('powersearch-auto-search')
  } catch (e) {
    // Menu doesn't exist yet, that's fine
  }
  
  // Create context menu only if auto-search is enabled
  if (settings.enableAutoSearch) {
    chrome.contextMenus.create({
      id: 'powersearch-auto-search',
      title: 'Search in PowerSearch',
      contexts: ['selection'],
    })
  }
}

chrome.runtime.onInstalled.addListener(() => {
  updateContextMenu()
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'powersearch-auto-search' && info.selectionText && tab?.id) {
    const rawSettings = await getSettings()
    const settings = await enforceFeatureLimits(rawSettings)
    if (!settings.enableAutoSearch) return

    // Store the query in session storage for the popup to pick up
    await chrome.storage.session.set({
      autoSearchQuery: info.selectionText,
      autoSearchTimestamp: Date.now(),
    })

    // Open side panel or popup
    if (settings.openMode === 'sidePanel' && typeof chrome !== 'undefined' && 'sidePanel' in chrome && tab.windowId) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId })
      } catch (e) {
        logEvent('sidepanel', 'Failed to open side panel in runSearch', 'warning', String(e))
        // If sidePanel.open fails, it's okay - user can manually open and sidebar will detect the query
      }
    } else {
      // For popup mode, open the extension popup
      try {
        chrome.action.openPopup()
      } catch (e) {
        // Fallback: let user click the extension icon
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Port connections (popup streaming)
// ---------------------------------------------------------------------------

let activePort: chrome.runtime.Port | null = null
let activeAbortController: AbortController | null = null

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'popup') return

  activePort = port

  port.onMessage.addListener(async msg => {
    if (msg.type === 'SEARCH_START') {
      // Cancel any in-flight search
      activeAbortController?.abort()
      activeAbortController = new AbortController()

      await runSearch(
        msg.query as string,
        msg.searchId as string,
        port,
        activeAbortController.signal,
        (msg.scope as SearchScope) ?? 'all'
      )
    }
  })

  port.onDisconnect.addListener(() => {
    if (activePort === port) {
      activeAbortController?.abort()
      activePort = null
      // Don't clear highlights when popup closes — keep them visible on the target tab
      // Highlights are only cleared when user explicitly clicks Clear or starts a new search
    }
  })
})

// ---------------------------------------------------------------------------
// One-shot messages (navigate, clear, recent)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PRIME_CACHE' && sender.tab?.id) {
    if (msg.text) {
      setCachedTabText(sender.tab.id, msg.text as string).catch(() => { })
    }
    return false
  }

  if (msg.type === 'NAVIGATE_TO_MATCH') {
    handleNavigateToMatch(
      msg.tabId as number,
      msg.matchIndex as number,
      msg.query as string,
      msg.url as string,
      msg.title as string
    )
    return false
  }

  if (msg.type === 'CLEAR_RESULTS') {
    handleClearResults()
    return false
  }

  if (msg.type === 'GET_RECENT') {
    Promise.all([getRecentSearches(), getRecentClicks(), getPinnedSearches()]).then(([searches, clicks, pinned]) => {
      sendResponse({ searches, clicks, pinned })
    })
    return true // keep channel open for async response
  }

  if (msg.type === 'CHECK_PERMISSION') {
    chrome.permissions.contains({ origins: ['<all_urls>'] }).then(granted => {
      sendResponse({ granted })
    })
    return true
  }

  if (msg.type === 'CLEAR_RECENT_SEARCHES') {
    clearRecentSearches().then(() => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'CLEAR_RECENT_CLICKS') {
    clearRecentClicks().then(() => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'PIN_SEARCH') {
    pinSearch(msg.query as string).then(() => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'UNPIN_SEARCH') {
    unpinSearch(msg.query as string).then(() => sendResponse({ ok: true }))
    return true
  }



  if (msg.type === 'GET_DEBUG_LOGS') {
    getStoredLogs()
      .then(logs => {
        sendResponse({ ok: true, logs, formatted: formatLogsForReport(logs) })
      })
      .catch(error => {
        sendResponse({ ok: false, error: String(error) })
      })
    return true
  }

  if (msg.type === 'CLEAR_DEBUG_LOGS') {
    clearLogs()
      .then(() => {
        sendResponse({ ok: true })
      })
      .catch(error => {
        sendResponse({ ok: false, error: String(error) })
      })
    return true
  }

  return false
})

// ---------------------------------------------------------------------------
// Core search orchestration
// ---------------------------------------------------------------------------

async function runSearch(
  query: string,
  _searchId: string,
  port: chrome.runtime.Port,
  signal: AbortSignal,
  scope: SearchScope = 'all'
): Promise<void> {
  if (!query.trim()) return

  const safeSend = (msg: SearchProgressMessage): boolean => {
    try { port.postMessage(msg); return true } catch { return false }
  }

  // Load user settings for this search
  const rawSettings = await getSettings()
  const settings = await enforceFeatureLimits(rawSettings)

  // Clear any previous highlights from a prior search
  await handleClearResults()

  // Record the search query in recent history
  await pushRecentSearch(query)

  // Start history search in parallel (fast, non-blocking) — skip if tabs-only
  const historyPromise =
    scope !== 'tabs'
      ? searchHistory(query, {
        maxResults: settings.historyResultsLimit,
        caseSensitive: settings.caseSensitive,
        matchWholeWord: settings.matchWholeWord,
      })
      : Promise.resolve([])

  // Get all tabs — skip if history-only
  const allTabs = scope !== 'history' ? await chrome.tabs.query({}) : []
  const searchableTabs = allTabs.filter(t => isSearchableUrl(t.url))
  const total = searchableTabs.length
  const tabsToSearch = searchableTabs

  const allTabResults: TabSearchResult[] = []
  let historyResults: HistorySearchResult[] = []
  let historyDelivered = false

  try {
    // If no tabs at all, fall straight through to history-only result
    if (total === 0) {
      try { historyResults = await historyPromise } catch { historyResults = [] }
      historyDelivered = true
      safeSend({
        type: 'SEARCH_PROGRESS',
        batch: [],
        historyResults,
        completed: 0,
        total: 0,
        done: true,
      })
      await setActiveResults(query, { query, tabs: [], history: historyResults, completedBatches: 0, totalBatches: 0 })
      return
    }

    // Process tabs in batches
    for (let i = 0; i < tabsToSearch.length; i += BATCH_SIZE) {
      if (signal.aborted) return

      const batch = tabsToSearch.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(
        batch.map(tab => searchSingleTab(tab, query, signal, settings))
      )

      if (signal.aborted) return

      const validResults = batchResults
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => (r as PromiseFulfilledResult<TabSearchResult>).value)

      allTabResults.push(...validResults)

      const isLastBatch = i + BATCH_SIZE >= tabsToSearch.length

      // Attach history results to the last batch if ready
      if (isLastBatch && !historyDelivered) {
        try {
          historyResults = await historyPromise
          historyDelivered = true
        } catch {
          historyResults = []
          historyDelivered = true
        }
      }

      const sent = safeSend({
        type: 'SEARCH_PROGRESS',
        batch: validResults,
        historyResults: historyDelivered ? historyResults : undefined,
        completed: Math.min(i + BATCH_SIZE, total),
        total,
        done: isLastBatch,
      })
      if (!sent) return // port disconnected
    }

    // History may still be pending
    if (!historyDelivered) {
      try { historyResults = await historyPromise } catch { historyResults = [] }
    }

  } catch (err) {
    // Unexpected error — guarantee done:true so the UI stops spinning
    try { historyResults = await historyPromise } catch { historyResults = [] }
    safeSend({
      type: 'SEARCH_PROGRESS',
      batch: [],
      historyResults,
      completed: total,
      total,
      done: true,
    })
    return
  }

  // Persist complete results to session storage
  const finalResults: SearchResults = {
    query,
    tabs: allTabResults,
    history: historyResults,
    completedBatches: Math.ceil(total / BATCH_SIZE),
    totalBatches: Math.ceil(total / BATCH_SIZE),
  }
  await setActiveResults(query, finalResults)
}

async function searchSingleTab(
  tab: chrome.tabs.Tab,
  query: string,
  signal: AbortSignal,
  settings?: Settings
): Promise<TabSearchResult | null> {
  if (signal.aborted || !tab.id || !isSearchableUrl(tab.url)) return null

  let text: string

  // Check cache
  const cached = await getCachedTabText(tab.id)
  if (cached && Date.now() - cached.timestamp < TAB_CACHE_TTL_MS) {
    text = cached.text
  } else {
    try {
      // Run extraction in ALL frames simultaneously (catches iframes like Polarion's
      // wiki editor, CKEditor, etc.) — chrome.tabs.sendMessage only reaches top frame.
      const frameResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          // Skip invisible iframes (width or height is 0)
          if (window.innerWidth === 0 || window.innerHeight === 0) return ''
          if (!document.body) return ''
          function accept(node: Node): number {
            const p = (node as Text).parentElement
            if (!p) return NodeFilter.FILTER_REJECT
            const tag = p.tagName.toLowerCase()
            if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT
            if ((p as HTMLElement).hidden || p.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT

            if (typeof p.checkVisibility === 'function') {
              if (!p.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return NodeFilter.FILTER_REJECT
            } else {
              const cs = window.getComputedStyle(p)
              if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return NodeFilter.FILTER_REJECT
              const rect = p.getBoundingClientRect()
              if (rect.width === 0 && rect.height === 0) return NodeFilter.FILTER_REJECT
            }
            return NodeFilter.FILTER_ACCEPT
          }
          const parts: string[] = []
          function gather(root: Element | ShadowRoot): void {
            const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: accept })
            let n: Node | null
            while ((n = w.nextNode()) !== null) {
              const t = (n.textContent ?? '').trim()
              if (t) parts.push(t)
            }
            for (const el of root.querySelectorAll('*')) {
              if (el.shadowRoot) gather(el.shadowRoot)
            }
          }
          gather(document.body)
          // Fallback for PDF viewer, XML, plain-text pages where DOM walker yields nothing
          if (parts.length === 0) {
            const fb = (document.body || document.documentElement).innerText
            if (fb) return fb.replace(/\s+/g, ' ').trim()
          }
          return parts.join(' ').replace(/\s+/g, ' ').trim()
        },
      })

      // Combine text from all frames
      text = frameResults
        .map(r => (r.result as string | null) ?? '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      // Avoid indexing/storing extremely large pages in full.
      if (text.length > MAX_INDEXED_TEXT_CHARS) {
        text = text.slice(0, MAX_INDEXED_TEXT_CHARS)
      }

      if (text) await setCachedTabText(tab.id, text)
    } catch {
      return null
    }
  }

  if (!text || signal.aborted) return null

  const matches = exactSearch(text, query, {
    caseSensitive: settings?.caseSensitive,
    maxMatches: settings?.maxMatchesPerTab,
    matchWholeWord: settings?.matchWholeWord,
  })
  if (matches.length === 0) return null

  return {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url!,
    title: tab.title ?? '',
    favIconUrl: tab.favIconUrl,
    matchCount: matches.length,
    matches,
  }
}

// ---------------------------------------------------------------------------
// Navigation handler
// ---------------------------------------------------------------------------

async function handleNavigateToMatch(
  tabId: number,
  matchIndex: number,
  query: string,
  url: string,
  title: string
): Promise<void> {
  await pushRecentClick(url, title, query)

  try {
    const tab = await chrome.tabs.get(tabId)
    if (!tab) {
      logEvent('navigate', `Tab ${tabId} not found`, 'warning')
      return
    }

    await chrome.windows.update(tab.windowId, { focused: true })
    await chrome.tabs.update(tabId, { active: true })

    // Wait briefly for tab to become active before injecting highlights
    await new Promise(r => setTimeout(r, 120))

    // Read highlight color from settings
    const settings = await getSettings()
    const colors = HIGHLIGHT_PRESETS[settings.highlightColor] ?? HIGHLIGHT_PRESETS.yellow
    const caseSensitive = settings.caseSensitive
    const matchWholeWord = settings.matchWholeWord

    // Use executeScript with allFrames so highlights work in iframes too
    // (sendMessage only reaches the top frame — misses e.g. Polarion's wiki editor)
    const normQuery = caseSensitive ? query : query.toLowerCase()
    logEvent('navigate', `Highlighting "${query}" in tab ${tabId} (caseSensitive: ${caseSensitive}, wholeWord: ${matchWholeWord})`, 'info')
    
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (nq: string, mi: number, isCaseSensitive: boolean, isWholeWord: boolean,
        hlBg: string, hlActive: string, hlOutline: string,
        hlBgLight: string, hlActiveLight: string, hlOutlineLight: string) => {
        // Skip invisible iframes
        if (window.innerWidth === 0 || window.innerHeight === 0) return

        const HIGHLIGHT_CLASS = 'powersearch-hl'
        const HIGHLIGHT_ACTIVE_CLASS = 'powersearch-hl-active'

        // Inject highlight styles once per page (always refresh so active color is current)
        const STYLE_ID = 'powersearch-hl-style'
        const existingStyle = document.getElementById(STYLE_ID)
        if (existingStyle) existingStyle.remove()
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = `
          mark.powersearch-hl {
            background: ${hlBg};
            color: inherit;
            border-radius: 2px;
            outline: none;
          }
          mark.powersearch-hl-active {
            background: ${hlActive};
            color: #fff;
            border-radius: 2px;
            outline: 2px solid ${hlOutline};
            outline-offset: 1px;
          }
          @media (prefers-color-scheme: light) {
            mark.powersearch-hl {
              background: ${hlBgLight};
              color: inherit;
            }
            mark.powersearch-hl-active {
              background: ${hlActiveLight};
              color: #fff;
              outline-color: ${hlOutlineLight};
            }
          }
        `
          ; (document.head || document.documentElement).appendChild(style)

        // Remove previous highlights
        document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => {
          const parent = el.parentNode
          if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent ?? ''), el)
          }
        })
        const nav = document.getElementById('powersearch-nav-overlay')
        if (nav) nav.remove()

        if (!document.body) return

        // Find and wrap all matches — same traversal (incl. shadow DOM) as extraction
        const marks: HTMLElement[] = []
        function gatherNodes(root: Element | ShadowRoot, out: Text[]): void {
          const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              const p = node.parentElement
              if (!p) return NodeFilter.FILTER_REJECT
              const tag = p.tagName.toLowerCase()
              if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT
              if (p.classList.contains(HIGHLIGHT_CLASS)) return NodeFilter.FILTER_REJECT
              if ((p as HTMLElement).hidden || p.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT

              if (typeof p.checkVisibility === 'function') {
                if (!p.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return NodeFilter.FILTER_REJECT
              } else {
                const cs = window.getComputedStyle(p)
                if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return NodeFilter.FILTER_REJECT
                const rect = p.getBoundingClientRect()
                if (rect.width === 0 && rect.height === 0) return NodeFilter.FILTER_REJECT
              }
              return NodeFilter.FILTER_ACCEPT
            }
          })
          let n: Node | null
          while ((n = w.nextNode()) !== null) out.push(n as Text)
          
          // Safely traverse shadow DOM — check if querySelectorAll exists (Element and ShadowRoot both have it)
          try {
            if (root && typeof (root as any).querySelectorAll === 'function') {
              for (const el of (root as any).querySelectorAll('*')) {
                if (el.shadowRoot) gatherNodes(el.shadowRoot, out)
              }
            }
          } catch (e) {
            // Shadow DOM traversal failed — continue with what we have
          }
        }
        const textNodes: Text[] = []
        gatherNodes(document.body, textNodes)

        for (const textNode of textNodes) {
          const text = textNode.textContent ?? ''
          const norm = isCaseSensitive ? text : text.toLowerCase()
          let pos = 0
          const frags: (string | HTMLElement)[] = []
          while (true) {
            const idx = norm.indexOf(nq, pos)
            if (idx === -1) break
            
            // Check whole word boundary if isWholeWord is enabled
            if (isWholeWord) {
              const beforeChar = idx > 0 ? text[idx - 1] : ' '
              const afterChar = idx + nq.length < text.length ? text[idx + nq.length] : ' '
              const isWordBoundaryStart = !/\w/.test(beforeChar)
              const isWordBoundaryEnd = !/\w/.test(afterChar)
              
              // Skip this match if it doesn't respect word boundaries
              if (!isWordBoundaryStart || !isWordBoundaryEnd) {
                pos = idx + 1
                continue
              }
            }
            
            if (idx > pos) frags.push(text.slice(pos, idx))
            const mark = document.createElement('mark')
            mark.className = HIGHLIGHT_CLASS
            mark.textContent = text.slice(idx, idx + nq.length)
            mark.setAttribute('data-powersearch-index', String(marks.length))
            frags.push(mark)
            marks.push(mark)
            pos = idx + nq.length
          }
          if (frags.length > 0) {
            if (pos < text.length) frags.push(text.slice(pos))
            const frag = document.createDocumentFragment()
            for (const part of frags) {
              frag.appendChild(typeof part === 'string' ? document.createTextNode(part) : part)
            }
            textNode.parentNode?.replaceChild(frag, textNode)
          }
        }

        if (marks.length === 0) return

        // Scroll to the requested match index (clamp to available)
        const target = marks[Math.min(mi, marks.length - 1)]
        marks.forEach(m => m.classList.remove(HIGHLIGHT_ACTIVE_CLASS))
        target.classList.add(HIGHLIGHT_ACTIVE_CLASS)
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      },
      args: [normQuery, matchIndex, caseSensitive, matchWholeWord,
        colors.bg, colors.active, colors.outline,
        colors.bgLight, colors.activeLight, colors.outlineLight],
    })
    logEvent('navigate', `Highlighting completed for tab ${tabId}`, 'info')
  } catch (err) {
    // Tab closed or restricted — log the error for debugging
    const errMsg = err instanceof Error ? err.message : String(err)
    logEvent('navigate', `Failed to highlight in tab ${tabId}: ${errMsg}`, 'error')
  }
}

// ---------------------------------------------------------------------------
// Clear results handler
// ---------------------------------------------------------------------------

async function handleClearResults(): Promise<void> {
  await clearActiveResults()

  // Remove highlights from all tabs — use executeScript directly so highlights are removed
  // even when the content script is not currently loaded (e.g. tabs opened before permission grant)
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !isSearchableUrl(tab.url)) continue
    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        document.querySelectorAll('.powersearch-hl').forEach(el => {
          const p = el.parentNode
          if (p) { p.replaceChild(document.createTextNode(el.textContent ?? ''), el); p.normalize() }
        })
        const style = document.getElementById('powersearch-hl-style')
        if (style) style.remove()
      },
    }).catch(() => { /* tab may be restricted or closed */ })
  }
}

// ---------------------------------------------------------------------------
// Content script injection helpers
// ---------------------------------------------------------------------------

/**
 * Inject the content script into every currently open, searchable tab.
 * Called once after the user grants <all_urls> permission.
 */
async function injectContentScriptIntoAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({})
  await Promise.allSettled(
    tabs
      .filter(t => t.id !== undefined && isSearchableUrl(t.url))
      .map(t =>
        chrome.scripting.executeScript({
          target: { tabId: t.id! },
          files: ['src/content/content-script.js'],
        }).catch(() => { /* restricted page — ignore */ })
      )
  )
}

// ---------------------------------------------------------------------------
// Open Mode Configuration (Popup vs Side Panel)
// ---------------------------------------------------------------------------

async function applyOpenMode() {
  const settings = await getSettings()

  if (settings.openMode === 'sidePanel') {
    // Enable Side Panel but disable Popup
    if (typeof chrome !== 'undefined' && 'sidePanel' in chrome) {
      try {
        const popupPath = chrome.runtime.getURL('src/popup/index.html')
        await chrome.sidePanel.setOptions({ enabled: true, path: popupPath })
        chrome.action.setPopup({ popup: '' })
      } catch (error) {
        logEvent('sidepanel', 'Failed to enable sidepanel mode, falling back to popup', 'error', String(error))
        // Fall back to popup if sidepanel setup fails
        chrome.action.setPopup({ popup: chrome.runtime.getURL('src/popup/index.html') })
      }
    }
  } else {
    // Enable Popup but disable Side Panel
    if (typeof chrome !== 'undefined' && 'sidePanel' in chrome) {
      try {
        await chrome.sidePanel.setOptions({ enabled: false })
      } catch (error) {
        logEvent('sidepanel', 'Failed to disable sidepanel', 'error', String(error))
      }
    }
    chrome.action.setPopup({ popup: chrome.runtime.getURL('src/popup/index.html') })
  }
}

// Apply immediately on startup
applyOpenMode()

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    applyOpenMode()
    updateContextMenu()
  }
})

// Focus workaround: If popup is disabled (Side Panel Mode), clicking the icon
// or pressing the Cmd+Shift+F shortcut triggers onClicked.
// CRITICAL: chrome.sidePanel.open() must be called synchronously in the user gesture context,
// NOT inside an async callback. The fact that we're here means sidepanel is already enabled.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.windowId) return
  
  if (typeof chrome !== 'undefined' && 'sidePanel' in chrome) {
    chrome.sidePanel.open({ windowId: tab.windowId })
      .then(() => {
      })
      .catch((error) => {
        logEvent('sidepanel', 'Failed to open sidepanel on icon click', 'error', String(error))
      })
  }
})

// End of service worker
