import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import { SearchBar } from './components/SearchBar'
import { RecentSearches } from './components/RecentSearches'
import { ResultsPanel } from './components/ResultsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { FilterBar } from './components/FilterBar'
import { Autocomplete } from './components/Autocomplete'
import type { SearchResults, RecentData, TabSearchResult, HistorySearchResult, SearchScope, Settings, SearchFilters } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { getSettings } from '../background/storage'

type AppState = 'idle' | 'searching' | 'done'

export function App() {
  const [query, setQuery] = useState('')
  const [appState, setAppState] = useState<AppState>('idle')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [recentData, setRecentData] = useState<RecentData>({ searches: [], clicks: [], pinned: [] })
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scope, setScope] = useState<SearchScope>('all')
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    domain: null,
    startDate: null,
    endDate: null,
    visitedOnly: false,
    unvisitedOnly: false,
  })
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [hasPendingAutoSearch, setHasPendingAutoSearch] = useState(false)

  const portRef = useRef<chrome.runtime.Port | null>(null)
  const searchIdRef = useRef<string>('')
  const appStateRef = useRef<AppState>('idle')
  const resultsContainerRef = useRef<HTMLDivElement>(null)
  const pendingAutoSearchRef = useRef<string | null>(null)

  const connectPort = () => {
    const port = chrome.runtime.connect({ name: 'popup' })
    portRef.current = port

    port.onMessage.addListener(msg => {
      if (msg.type === 'SEARCH_PROGRESS') {
        const { batch, historyResults, completed, total, done } = msg as {
          batch: TabSearchResult[]
          historyResults?: HistorySearchResult[]
          completed: number
          total: number
          done: boolean
        }

        setProgress({ completed, total })

        setResults(prev => {
          const prevTabs = prev?.tabs ?? []
          const existingIds = new Set(prevTabs.map(t => t.tabId))
          const newTabs = batch.filter(t => !existingIds.has(t.tabId))
          return {
            query: prev?.query ?? '',
            tabs: [...prevTabs, ...newTabs],
            history: historyResults ?? prev?.history ?? [],
            completedBatches: Math.ceil(completed / 8),
            totalBatches: Math.ceil(total / 8),
          }
        })

        if (done) setAppState('done')
      }
    })

    port.onDisconnect.addListener(() => {
      portRef.current = null
      // Service worker was killed — stop any in-progress spinner immediately
      if (appStateRef.current === 'searching') setAppState('done')
      // Reconnect after a short delay so future searches work
      setTimeout(() => { connectPort() }, 200)
    })

    return port
  }

  // Keep appStateRef in sync for the port disconnect handler
  useEffect(() => { appStateRef.current = appState }, [appState])

  // Restore prior session results and load recent data on mount
  useEffect(() => {
    // Check host permission first
    chrome.runtime.sendMessage({ type: 'CHECK_PERMISSION' }, response => {
      setHasPermission((response as { granted: boolean })?.granted ?? false)
    })

    // Load user settings FIRST so scope is ready
    getSettings().then(s => {
      setSettings(s)
      setScope(s.defaultScope)

      // Apply popup-specific dimensions if configured as a popup
      if (s.openMode === 'popup') {
        document.body.classList.add('is-popup')
      } else {
        document.body.classList.remove('is-popup')
      }

      // NOW check for auto-search query after settings are loaded
      chrome.storage.session.get(['autoSearchQuery'], data => {
        const autoQuery = data['autoSearchQuery'] as string | undefined
        if (autoQuery) {
          // Found auto-search query - store it and mark for trigger
          pendingAutoSearchRef.current = autoQuery
          setHasPendingAutoSearch(true)
          // Clear so it doesn't trigger again
          chrome.storage.session.remove('autoSearchQuery')
        }
      })
    })

    // Restore previous popup session (but skip if auto-search present)
    chrome.storage.session.get(['autoSearchQuery'], sessionData => {
      if (!sessionData['autoSearchQuery']) {
        // No auto-search pending, check for popup persistence in local storage
        chrome.storage.local.get(['popupActiveQuery', 'popupActiveResults'], data => {
          if (data['popupActiveQuery'] && data['popupActiveResults']) {
            setQuery(data['popupActiveQuery'] as string)
            setResults(data['popupActiveResults'] as SearchResults)
            setAppState('done')
          }
        })
      }
    })

    // Load recent searches + clicks
    chrome.runtime.sendMessage({ type: 'GET_RECENT' }, response => {
      if (response) setRecentData(response as RecentData)
    })

    // Open a port to the service worker for streaming
    const port = connectPort()

    return () => {
      port.disconnect()
    }
  }, [])

  // Watch for storage changes to recent/pinned data and auto-search trigger
  useEffect(() => {
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        if (changes.recentSearches || changes.recentClicks || changes.pinnedSearches) {
          chrome.runtime.sendMessage({ type: 'GET_RECENT' }, response => {
            if (response) setRecentData(response as RecentData)
          })
        }
        if (changes.settings) {
          getSettings().then(s => setSettings(s))
        }
      }
      
      // Watch for session storage changes (auto-search trigger)
      if (areaName === 'session' && changes.autoSearchQuery) {
        const autoQuery = (changes.autoSearchQuery.newValue as string) || undefined
        if (autoQuery && !pendingAutoSearchRef.current) {
          // Auto-search query appeared in session storage - trigger search
          pendingAutoSearchRef.current = autoQuery
          setHasPendingAutoSearch(true)
          // Will be picked up by the auto-search effect below
        }
      }
    }

    try {
      chrome.storage.onChanged.addListener(handler)
    } catch {
      // Some environments may not expose storage change events — ignore
    }

    return () => {
      try { chrome.storage.onChanged.removeListener(handler) } catch { }
    }
  }, [])

  // Apply theme to the app shell whenever settings.theme changes
  useEffect(() => {
    const root = document.documentElement
    root.removeAttribute('data-theme')
    if (settings.theme === 'dark') root.setAttribute('data-theme', 'dark')
    else if (settings.theme === 'light') root.setAttribute('data-theme', 'light')
  }, [settings.theme])

  // Save search query and results to local storage for popup persistence
  useEffect(() => {
    if (appState === 'done' && query.trim() && results) {
      chrome.storage.local.set({
        popupActiveQuery: query,
        popupActiveResults: results,
      })
    }
  }, [appState, query, results])

  const handleSearch = (q: string, overrideScope?: SearchScope) => {
    const trimmed = q.trim()
    if (!trimmed) return

    const activeScope = overrideScope ?? scope
    const searchId = Date.now().toString()
    searchIdRef.current = searchId

    setQuery(q)
    setAppState('searching')
    setProgress({ completed: 0, total: 0 })
    setResults({
      query: q,
      tabs: [],
      history: [],
      completedBatches: 0,
      totalBatches: 0,
    })

    portRef.current?.postMessage({ type: 'SEARCH_START', query: trimmed, searchId, scope: activeScope })
  }

  const handleScopeChange = (newScope: SearchScope) => {
    setScope(newScope)
    if (query.trim()) handleSearch(query, newScope)
  }

  const handleClear = () => {
    setQuery('')
    setAppState('idle')
    setResults(null)
    setProgress({ completed: 0, total: 0 })
    chrome.runtime.sendMessage({ type: 'CLEAR_RESULTS' })

    // Clear popup persistence when user manually clears
    chrome.storage.local.remove(['popupActiveQuery', 'popupActiveResults'])

    // Refresh recent data after clearing
    chrome.runtime.sendMessage({ type: 'GET_RECENT' }, response => {
      if (response) setRecentData(response as RecentData)
    })
  }

  const handleRecentSearch = (q: string) => {
    handleSearch(q)
  }

  const handleClearRecentSearches = () => {
    // Clear locally and notify background; update UI immediately
    try {
      chrome.storage.local.remove('recentSearches', () => {
        setRecentData(prev => ({ ...prev, searches: [] }))
        try { chrome.runtime.sendMessage({ type: 'CLEAR_RECENT_SEARCHES' }, () => {}) } catch {}
      })
    } catch {
      // Fallback to messaging if direct storage API fails
      chrome.runtime.sendMessage({ type: 'CLEAR_RECENT_SEARCHES' }, () => {
        setRecentData(prev => ({ ...prev, searches: [] }))
      })
    }
  }

  const handleClearRecentClicks = () => {
    try {
      chrome.storage.local.remove('recentClicks', () => {
        setRecentData(prev => ({ ...prev, clicks: [] }))
        try { chrome.runtime.sendMessage({ type: 'CLEAR_RECENT_CLICKS' }, () => {}) } catch {}
      })
    } catch {
      chrome.runtime.sendMessage({ type: 'CLEAR_RECENT_CLICKS' }, () => {
        setRecentData(prev => ({ ...prev, clicks: [] }))
      })
    }
  }

  const handlePinSearch = (q: string) => {
    if (!q?.trim()) return
    const key = 'pinnedSearches'
    try {
      chrome.storage.local.get([key], data => {
        const existing = (data[key] as { query: string; timestamp: number }[]) ?? []
        if (existing.some(p => p.query === q)) {
          setRecentData(prev => ({ ...prev, pinned: existing }))
          return
        }
        const updated = [{ query: q, timestamp: Date.now() }, ...existing]
        chrome.storage.local.set({ [key]: updated }, () => {
          setRecentData(prev => ({ ...prev, pinned: updated }))
          try { chrome.runtime.sendMessage({ type: 'PIN_SEARCH', query: q }, () => {}) } catch {}
        })
      })
    } catch {
      chrome.runtime.sendMessage({ type: 'PIN_SEARCH', query: q }, () => {
        setRecentData(prev => ({
          ...prev,
          pinned: prev.pinned.some(p => p.query === q)
            ? prev.pinned
            : [{ query: q, timestamp: Date.now() }, ...prev.pinned],
        }))
      })
    }
  }

  const handleUnpinSearch = (q: string) => {
    if (!q?.trim()) return
    const key = 'pinnedSearches'
    try {
      chrome.storage.local.get([key], data => {
        const existing = (data[key] as { query: string; timestamp: number }[]) ?? []
        const updated = existing.filter(p => p.query !== q)
        chrome.storage.local.set({ [key]: updated }, () => {
          setRecentData(prev => ({ ...prev, pinned: updated }))
          try { chrome.runtime.sendMessage({ type: 'UNPIN_SEARCH', query: q }, () => {}) } catch {}
        })
      })
    } catch {
      chrome.runtime.sendMessage({ type: 'UNPIN_SEARCH', query: q }, () => {
        setRecentData(prev => ({ ...prev, pinned: prev.pinned.filter(p => p.query !== q) }))
      })
    }
  }

  // Auto-highlighting on search completion removed per user feedback
  // Users prefer to stay on current page without automatic navigation

  // Trigger auto-search if query is pending from context menu
  useEffect(() => {
    if (pendingAutoSearchRef.current && scope && hasPermission) {
      const autoQuery = pendingAutoSearchRef.current
      pendingAutoSearchRef.current = null
      setHasPendingAutoSearch(false)
      
      // Directly post the search message without going through handleSearch
      // to avoid dependency issues
      setQuery(autoQuery)
      setAppState('searching')
      setProgress({ completed: 0, total: 0 })
      setResults({
        query: autoQuery,
        tabs: [],
        history: [],
        completedBatches: 0,
        totalBatches: 0,
      })
      
      const searchId = Date.now().toString()
      searchIdRef.current = searchId
      portRef.current?.postMessage({ type: 'SEARCH_START', query: autoQuery, searchId, scope })
    }
  }, [scope, hasPermission, hasPendingAutoSearch])

  // Get autocomplete suggestions from recent searches that match the current query
  const getAutocompleteSuggestions = useCallback(() => {
    if (!query.trim()) return []
    const lowerQuery = query.toLowerCase()
    return recentData.searches
      .filter(s => s.query.toLowerCase().includes(lowerQuery) && s.query !== query)
      .slice(0, 5)
  }, [query, recentData.searches])

  // Filter results based on active filters
  const getFilteredResults = useCallback(() => {
    if (!results) return null

    let filteredTabs = results.tabs
    let filteredHistory = results.history

    // Apply domain filter
    if (filters.domain) {
      const lowerDomain = filters.domain.toLowerCase()
      filteredTabs = filteredTabs.filter(t => t.url.toLowerCase().includes(lowerDomain))
      filteredHistory = filteredHistory.filter(h => h.url.toLowerCase().includes(lowerDomain))
    }

    // Apply date range filter (history only)
    if (filters.startDate || filters.endDate) {
      filteredHistory = filteredHistory.filter(h => {
        const time = h.lastVisitTime
        if (filters.startDate && time < filters.startDate) return false
        if (filters.endDate && time > filters.endDate) return false
        return true
      })
    }

    // Apply visited status filter (tabs only) - not applicable to current structure
    // since tabs don't have visit count, this is a placeholder

    // Sort tabs by match count (least matches first)
    const sortedTabs = [...filteredTabs].sort((a, b) => a.matches.length - b.matches.length)

    return {
      ...results,
      tabs: sortedTabs,
      history: filteredHistory,
    }
  }, [results, filters])

  const handleNavigateResults = useCallback(() => {
    const selectors = '.powersearch-tab-result__row, .powersearch-match-snippet, .powersearch-history-result'
    const first = resultsContainerRef.current?.querySelector<HTMLButtonElement | HTMLAnchorElement>(selectors)
    first?.focus()
  }, [])

  const handleResultsKeyDown = useCallback((e: KeyboardEvent) => {
    // Scope switching via Alt+1, Alt+2, Alt+3
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (e.key === '1' || e.key === '¡') { setScope('all'); e.preventDefault(); return }
      if (e.key === '2' || e.key === '™') { setScope('tabs'); e.preventDefault(); return }
      if (e.key === '3' || e.key === '£') { setScope('history'); e.preventDefault(); return }
    }

    // Allow Cmd+C / Ctrl+C to copy snippets if a snippet is focused
    if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
      const active = document.activeElement as HTMLElement
      if (active && active.classList.contains('powersearch-match-snippet')) {
        const copyBtn = active.querySelector<HTMLButtonElement>('.powersearch-match-snippet__copy')
        if (copyBtn) {
          copyBtn.click()
          e.preventDefault()
          return
        }
      }
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (e.ctrlKey || e.altKey || e.metaKey) return

    const input = document.querySelector<HTMLInputElement>('.powersearch-search-bar__input')
    // If ArrowDown from the search input, let SearchBar's handler call handleNavigateResults
    if (e.key === 'ArrowDown' && e.target === input) return

    const selectors = '.powersearch-tab-result__row, .powersearch-match-snippet, .powersearch-history-result'
    const toggles = Array.from(
      resultsContainerRef.current?.querySelectorAll<HTMLElement>(selectors) ?? []
    )
    if (!toggles.length) return

    // Use e.target (where the key was pressed) to avoid timing issues with document.activeElement
    const idx = toggles.indexOf(e.target as HTMLElement)
    e.preventDefault()

    if (e.key === 'ArrowDown') {
      // idx === -1 means focus is not on a toggle → go to first; otherwise next
      toggles[Math.min(Math.max(idx, -1) + 1, toggles.length - 1)]?.focus()
    } else {
      if (idx <= 0) {
        input?.focus()
      } else {
        toggles[idx - 1]?.focus()
      }
    }
  }, [])

  // Attach the same handler at the document level so ArrowUp/Down works
  // even when focus is outside the results container.
  useEffect(() => {
    document.addEventListener('keydown', handleResultsKeyDown)
    return () => document.removeEventListener('keydown', handleResultsKeyDown)
  }, [handleResultsKeyDown])

  // Navigate to an existing open tab, or open a new one if not found
  const handleRecentClick = async (url: string, query?: string) => {
    const allTabs = await chrome.tabs.query({})
    const existing = allTabs.find(t => t.url === url)
    if (existing?.id !== undefined) {
      chrome.windows.update(existing.windowId!, { focused: true })
      chrome.tabs.update(existing.id, { active: true })
      
      if (query) {
        chrome.runtime.sendMessage({
          type: 'NAVIGATE_TO_MATCH',
          tabId: existing.id,
          matchIndex: 0,
          query: query,
          url: existing.url,
          title: existing.title
        })
      }
    } else {
      // Create a new tab and notify the service worker so it can record the click
      try {
        chrome.tabs.create({ url }, (tab) => {
          if (tab && tab.id) {
            if (query) {
              chrome.runtime.sendMessage({
                type: 'NAVIGATE_TO_MATCH',
                tabId: tab.id,
                matchIndex: 0,
                query,
                url: tab.url,
                title: tab.title,
              })
            }
          }
        })
      } catch {
        // Fallback: create without callback if environment doesn't support callback
        chrome.tabs.create({ url })
      }
    }
  }
  const progressPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  const openOnboarding = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') })
  }

  // Still checking permission — show nothing to avoid flash
  if (hasPermission === null) {
    return <div class="powersearch-app" />
  }

  // Permission not yet granted — show inline prompt in the popup
  if (!hasPermission) {
    return (
      <div class="powersearch-app">
        <div class="powersearch-no-permission">
          <svg class="powersearch-no-permission__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="9.5" cy="9" r="7" stroke="#F97316" stroke-width="1.5"/>
            <clipPath id="np-cl">
              <circle cx="9.5" cy="9" r="6.5"/>
            </clipPath>
            <g clip-path="url(#np-cl)">
              <line x1="1" y1="5.5"  x2="18" y2="5.5"  stroke="#3E3C38" stroke-width="1" stroke-linecap="round"/>
              <line x1="1" y1="8"    x2="18" y2="8"    stroke="#6B6660" stroke-width="1" stroke-linecap="round"/>
              <line x1="1" y1="10.5" x2="18" y2="10.5" stroke="#F97316" stroke-width="1.25" stroke-linecap="round"/>
              <circle cx="12" cy="10.5" r="1.2" fill="#FBBF24"/>
              <line x1="1" y1="13"   x2="18" y2="13"   stroke="#6B6660" stroke-width="1" stroke-linecap="round"/>
            </g>
            <line x1="15" y1="14.5" x2="22" y2="21.5" stroke="#F97316" stroke-width="1.75" stroke-linecap="square"/>
          </svg>
          <p class="powersearch-no-permission__title">One step to activate PowerSearch</p>
          <p class="powersearch-no-permission__body">
            PowerSearch needs permission to read your open tabs. All searches stay local — nothing leaves your browser.
          </p>
          <button class="powersearch-no-permission__btn" onClick={openOnboarding}>
            Grant access →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div class="powersearch-app">
      {showSettings ? (
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <>
          {/* SearchBar and Autocomplete wrapper */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <SearchBar
              query={query}
              onSearch={handleSearch}
              onClear={handleClear}
              isSearching={appState === 'searching'}
              scope={scope}
              onScopeChange={handleScopeChange}
              onNavigateResults={handleNavigateResults}
              onOpenSettings={() => setShowSettings(true)}
              onPinSearch={handlePinSearch}
              onUnpinSearch={handleUnpinSearch}
              isPinned={recentData.pinned.some(p => p.query === query.trim())}
              canPinSearch={true}
              onFocus={() => setShowAutocomplete(true)}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 100)}
            />

            {/* Autocomplete dropdown - positioned relative to wrapper */}
            {showAutocomplete && query.length > 0 && getAutocompleteSuggestions().length > 0 && (
              <Autocomplete
                suggestions={getAutocompleteSuggestions()}
                onSelect={q => {
                  setQuery(q)
                  setShowAutocomplete(false)
                  handleSearch(q)
                }}
                visible={true}
              />
            )}
          </div>

          {appState === 'searching' && (
            <div class="powersearch-progress" role="progressbar" aria-valuenow={progressPercent}>
              <div class="powersearch-progress__fill" style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          {/* Filter bar when results are displayed */}
          {(appState !== 'idle' || results) && (
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              tabCount={results?.tabs.length ?? 0}
              historyCount={results?.history.length ?? 0}
            />
          )}

          {/* Scrollable container - flex: 1 takes remaining space, overflow-y auto for scrolling */}
          <div ref={resultsContainerRef} onKeyDown={handleResultsKeyDown} style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin', overflowX: 'hidden' }}>
            {appState === 'idle' && !results ? (
              <RecentSearches
                data={recentData}
                onSearch={handleRecentSearch}
                onClickResult={handleRecentClick}
                onClearSearches={handleClearRecentSearches}
                onClearClicks={handleClearRecentClicks}
                onPinSearch={handlePinSearch}
                onUnpinSearch={handleUnpinSearch}
                canPinSearch={true}
              />
            ) : (
              <ResultsPanel
                results={getFilteredResults()}
                isSearching={appState === 'searching'}
                query={query}
                scope={scope}
                settings={settings}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
