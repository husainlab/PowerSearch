import { useState, useRef, useCallback, useEffect } from 'preact/hooks'
import { TabResult } from './TabResult'
import type { TabSearchResult } from '../../types'

interface TabGroupProps {
  results: TabSearchResult[]
  query: string
  isSearching: boolean
  totalMatches: number
}

function getDisplayOrigin(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

type SortMode = 'default' | 'matches'

export function TabGroup({ results, query, isSearching, totalMatches }: TabGroupProps) {
  const [sectionOpen, setSectionOpen] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('default')
  const [forceVersion, setForceVersion] = useState(0)
  const [forceValue, setForceValue] = useState(true)

  const totalMatchCount = results.reduce((sum, t) => sum + t.matchCount, 0)

  // Build window map: windowId → display number (only shown when multiple windows)
  const windowIds = [...new Set(results.map(t => t.windowId))].sort()
  const windowMap = new Map(windowIds.map((id, i) => [id, i + 1]))
  const multipleWindows = windowIds.length > 1

  const sortedResults = sortMode === 'matches'
    ? [...results].sort((a, b) => b.matchCount - a.matchCount)
    : results

  const collapseAll = (e: MouseEvent) => {
    e.stopPropagation()
    setForceValue(false)
    setForceVersion(v => v + 1)
  }

  const expandAll = (e: MouseEvent) => {
    e.stopPropagation()
    setForceValue(true)
    setForceVersion(v => v + 1)
  }

  const toggleSort = (e: MouseEvent) => {
    e.stopPropagation()
    setSortMode(m => m === 'matches' ? 'default' : 'matches')
  }

  return (
    <div class="powersearch-section">
      <div class="powersearch-section__header">
        <button
          class="powersearch-section__toggle"
          onClick={() => setSectionOpen(o => !o)}
          aria-expanded={sectionOpen}
          aria-label={`Open tabs — ${totalMatches} pages with matches`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="4" height="3" rx="0.25" stroke="currentColor" stroke-width="1" />
            <rect x="7" y="1" width="4" height="3" rx="0.25" stroke="currentColor" stroke-width="1" />
            <rect x="1" y="6" width="4" height="5" rx="0.25" stroke="currentColor" stroke-width="1" />
            <rect x="7" y="6" width="4" height="5" rx="0.25" stroke="currentColor" stroke-width="1" />
          </svg>
          Open tabs
          <span class="powersearch-section__count">
            {isSearching ? `${totalMatches}…` : `${totalMatches} pages · ${totalMatchCount} matches`}
          </span>
        </button>

        <div class="powersearch-section__controls">
          <button
            class={`powersearch-section__ctrl-btn${sortMode === 'matches' ? ' powersearch-section__ctrl-btn--active' : ''}`}
            onClick={toggleSort}
            title={sortMode === 'matches' ? 'Sorted by match count — click for tab order' : 'Sort by match count'}
          >
            {sortMode === 'matches' ? '↓ count' : '↕ sort'}
          </button>
          <button class="powersearch-section__ctrl-btn" onClick={expandAll} title="Expand all">⊞</button>
          <button class="powersearch-section__ctrl-btn" onClick={collapseAll} title="Collapse all">⊟</button>
        </div>

        <button
          class="powersearch-section__chevron-btn"
          onClick={() => setSectionOpen(o => !o)}
          aria-label={sectionOpen ? 'Collapse section' : 'Expand section'}
        >
          <svg
            class={`powersearch-section__chevron${sectionOpen ? ' powersearch-section__chevron--open' : ''}`}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="square" />
          </svg>
        </button>
      </div>

      {sectionOpen && (
        <div class="powersearch-section__body">
          {sortedResults.map((tab) => (
            <SiteGroup
              key={tab.tabId}
              tab={tab}
              query={query}
              windowNum={windowMap.get(tab.windowId)}
              multipleWindows={multipleWindows}
              forceVersion={forceVersion}
              forceValue={forceValue}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SiteGroupProps {
  tab: TabSearchResult
  query: string
  windowNum?: number
  multipleWindows: boolean
  forceVersion: number
  forceValue: boolean
}

function SiteGroup({ tab, query, windowNum, multipleWindows, forceVersion, forceValue }: SiteGroupProps) {
  const [open, setOpen] = useState(true)
  const [cursor, setCursor] = useState(0)

  // Sync open/closed state when collapse-all / expand-all fires
  const prevVersionRef = useRef(0)
  useEffect(() => {
    if (forceVersion !== prevVersionRef.current) {
      prevVersionRef.current = forceVersion
      setOpen(forceValue)
    }
  }, [forceVersion, forceValue])

  const allMatches = Array.from({ length: tab.matchCount }, (_, i) => ({
    tabId: tab.tabId, matchIndex: i, url: tab.url, title: tab.title,
  }))

  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const navigate = useCallback((dir: 1 | -1) => {
    const next = (cursorRef.current + dir + allMatches.length) % allMatches.length
    cursorRef.current = next
    setCursor(next)
    const m = allMatches[next]
    chrome.runtime.sendMessage({
      type: 'NAVIGATE_TO_MATCH',
      tabId: m.tabId,
      matchIndex: m.matchIndex,
      query,
      url: m.url,
      title: m.title,
    })
  }, [allMatches, query])

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const startPress = (dir: 1 | -1, e: Event) => {
    e.stopPropagation()
    navigate(dir)
    pressTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => navigate(dir), 80)
    }, 400)
  }

  const stopPress = () => {
    if (pressTimer.current)  { clearTimeout(pressTimer.current);   pressTimer.current = null }
    if (repeatTimer.current) { clearInterval(repeatTimer.current); repeatTimer.current = null }
  }

  const jumpToTab = (e: MouseEvent) => {
    e.stopPropagation()
    chrome.windows.update(tab.windowId, { focused: true })
    chrome.tabs.update(tab.tabId, { active: true })
  }

  const displayName = tab.title || getDisplayOrigin(tab.url)

  const handleToggleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (!open) setOpen(true)
      navigate(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      navigate(-1)
    }
    // ArrowUp / ArrowDown bubble up to App.tsx's results container handler
  }

  return (
    <div class="powersearch-site">
      <div class="powersearch-site__header">
        {/* Favicon + title — click toggles collapse */}
        <button
          class="powersearch-site__toggle"
          onClick={() => setOpen(o => !o)}
          onKeyDown={handleToggleKeyDown}
          title={tab.title || tab.url}
          aria-expanded={open}
        >
          {tab.favIconUrl ? (
            <img
              class="powersearch-site__favicon"
              src={tab.favIconUrl}
              alt=""
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div class="powersearch-site__favicon-placeholder" aria-hidden="true" />
          )}
          <span class="powersearch-site__name">{displayName}</span>
          {multipleWindows && windowNum !== undefined && (
            <span class="powersearch-site__win-badge">Win {windowNum}</span>
          )}
        </button>

        {/* Jump to tab (switch without navigating to a match) */}
        <button
          class="powersearch-site__jump-btn"
          onClick={jumpToTab}
          title="Switch to this tab"
          aria-label="Switch to this tab"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M7.5 1H11V4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="5.5" y1="6.5" x2="11" y2="1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <path d="M8.5 4.5V9C8.5 9.6 8 10 7.5 10H2C1.4 10 1 9.6 1 9V3.5C1 2.9 1.4 2.5 2 2.5H5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </button>

        {/* Match count badge */}
        <span class="powersearch-site__match-count">
          {tab.matchCount} {tab.matchCount === 1 ? 'match' : 'matches'}
        </span>

        {/* Prev / counter / next — only when expanded */}
        {open && allMatches.length > 0 && (
          <>
            <button
              class="powersearch-site__nav-btn"
              onMouseDown={(e) => startPress(-1, e)}
              onMouseUp={stopPress}
              onMouseLeave={stopPress}
              onTouchStart={(e) => startPress(-1, e)}
              onTouchEnd={stopPress}
              aria-label="Previous match"
              title="Previous match"
            >‹</button>
            <span class="powersearch-site__counter" aria-live="polite">
              {cursor + 1}/{allMatches.length}
            </span>
            <button
              class="powersearch-site__nav-btn"
              onMouseDown={(e) => startPress(1, e)}
              onMouseUp={stopPress}
              onMouseLeave={stopPress}
              onTouchStart={(e) => startPress(1, e)}
              onTouchEnd={stopPress}
              aria-label="Next match"
              title="Next match"
            >›</button>
          </>
        )}

        {/* Chevron collapse toggle */}
        <button
          class="powersearch-site__chevron-btn"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <svg
            class={`powersearch-site__chevron${open ? ' powersearch-site__chevron--open' : ''}`}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="square" />
          </svg>
        </button>
      </div>

      {open && (
        <TabResult
          tab={tab}
          query={query}
          activeIndex={cursor}
          onMatchClick={setCursor}
        />
      )}
    </div>
  )
}
