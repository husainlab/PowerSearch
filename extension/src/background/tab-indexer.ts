import { getCachedTabText, setCachedTabText, invalidateTabCache } from './storage'

const TAB_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const IDLE_INTERVAL_SECONDS = 30
const MAX_QUEUE_SIZE = 50

// Queue of tab IDs that need (re-)indexing
const indexQueue = new Set<number>()

// ---------------------------------------------------------------------------
// Initialise listeners
// ---------------------------------------------------------------------------

export function initTabIndexer(): void {
  // Queue tabs that become active or finish loading
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    enqueue(tabId)
  })

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      enqueue(tabId)
    }
  })

  // Invalidate cache when tab navigates away
  chrome.tabs.onRemoved.addListener(tabId => {
    invalidateTabCache(tabId)
    indexQueue.delete(tabId)
  })

  // Drain the index queue during idle periods.
  // Guard: chrome.idle may not be available in all Chromium-based browsers.
  if (typeof chrome !== 'undefined' && 'idle' in chrome) {
    chrome.idle.setDetectionInterval(IDLE_INTERVAL_SECONDS)
    chrome.idle.onStateChanged.addListener(state => {
      if (state === 'idle') {
        drainQueue()
      }
    })
  } else {
    // Fallback: drain periodically without idle detection
    setInterval(() => { drainQueue() }, IDLE_INTERVAL_SECONDS * 1000)
  }
}

function enqueue(tabId: number): void {
  if (indexQueue.size >= MAX_QUEUE_SIZE) {
    // Remove the oldest entry (first item in Set iteration order)
    const oldest = indexQueue.values().next().value
    if (oldest !== undefined) indexQueue.delete(oldest)
  }
  indexQueue.add(tabId)
}

async function drainQueue(): Promise<void> {
  const ids = Array.from(indexQueue)
  indexQueue.clear()

  for (const tabId of ids) {
    await indexTab(tabId)
  }
}

// ---------------------------------------------------------------------------
// Index a single tab (checks TTL first, skips if fresh)
// ---------------------------------------------------------------------------

export async function indexTab(tabId: number): Promise<void> {
  try {
    // Check if cache is still fresh
    const cached = await getCachedTabText(tabId)
    if (cached && Date.now() - cached.timestamp < TAB_CACHE_TTL_MS) return

    // Verify tab still exists and is searchable
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    if (!tab || !isSearchableUrl(tab.url)) return

    // Guard: only proceed if <all_urls> permission has been granted
    const hasPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] })
    if (!hasPermission) return

    // Extract text from ALL frames (catches iframe-rendered content like Polarion wikis)
    const frameResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
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
          // Safely traverse shadow DOM — check if querySelectorAll exists
          try {
            if (root && typeof (root as any).querySelectorAll === 'function') {
              for (const el of (root as any).querySelectorAll('*')) {
                if (el.shadowRoot) gather(el.shadowRoot)
              }
            }
          } catch (e) {
            // Shadow DOM traversal failed — continue with what we have
          }
        }
        gather(document.body)
        if (parts.length === 0) {
          const fb = (document.body || document.documentElement).innerText
          if (fb) return fb.replace(/\s+/g, ' ').trim()
        }
        return parts.join(' ').replace(/\s+/g, ' ').trim()
      },
    })

    const text = frameResults
      .map(r => (r.result as string | null) ?? '')
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text) {
      await setCachedTabText(tabId, text)
    }
  } catch {
    // Silently skip — tab may have closed, navigated, or not have a content script
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isSearchableUrl(url: string | undefined): boolean {
  if (!url) return false

  // Only allow web URLs and local files
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://')
  ) {
    // Reject browser-internal pages that block scripting across all
    // Chromium-based browsers (Chrome, Edge, Brave, Opera, Vivaldi, Arc, etc.)
    const blocked = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'brave://',
      'vivaldi://',
      'opera://',
      'about:',
      'chrome-search://',
      'devtools://',
    ]
    return !blocked.some(prefix => url.startsWith(prefix))
  }

  return false
}

export { TAB_CACHE_TTL_MS }
