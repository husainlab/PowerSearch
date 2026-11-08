import { useState } from 'preact/hooks'
import type { RecentData } from '../../types'

interface RecentSearchesProps {
  data: RecentData
  onSearch: (query: string) => void
  onClickResult: (url: string, query?: string) => void
  onClearSearches: () => void
  onClearClicks: () => void
  onPinSearch: (query: string) => void
  onUnpinSearch: (query: string) => void
  canPinSearch?: boolean
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export function RecentSearches({ data, onSearch, onClickResult, onClearSearches, onClearClicks, onPinSearch, onUnpinSearch, canPinSearch }: RecentSearchesProps) {
  const hasSearches = data.searches.length > 0
  const hasClicks = data.clicks.length > 0
  const hasPinned = canPinSearch && data.pinned.length > 0
  const [confirmItem, setConfirmItem] = useState<{ url: string; query?: string } | null>(null)
  const [hoveredChip, setHoveredChip] = useState<string | null>(null)

  const handleClickResult = async (url: string, query?: string) => {
    const allTabs = await chrome.tabs.query({})
    const existing = allTabs.find(t => t.url === url)
    if (existing?.id !== undefined) {
      onClickResult(url, query)
    } else {
      setConfirmItem({ url, query })
    }
  }

  if (!hasSearches && !hasClicks && !hasPinned) {
    return (
      <div class="powersearch-recent">
        <div class="powersearch-empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" class="powersearch-empty-state__icon">
            <circle cx="20" cy="20" r="13" stroke="currentColor" stroke-width="1.75"/>
            <line x1="29.2" y1="29.2" x2="40" y2="40" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="13" y1="16" x2="27" y2="16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" opacity="0.55"/>
            <line x1="13" y1="21" x2="23" y2="21" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" opacity="0.35"/>
            <line x1="13" y1="26" x2="19" y2="26" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" opacity="0.2"/>
          </svg>
          <p class="powersearch-empty-state__text">Type to search all open tabs and history.</p>
          <p class="powersearch-empty-state__sub">Pinned and recent searches will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div class="powersearch-recent">
      {confirmItem && (
        <div class="powersearch-tab-closed">
          <span class="powersearch-tab-closed__msg">This tab is closed.</span>
          <div class="powersearch-tab-closed__actions">
            <button class="powersearch-tab-closed__btn powersearch-tab-closed__btn--primary" onClick={() => { onClickResult(confirmItem.url, confirmItem.query); setConfirmItem(null) }}>Open it</button>
            <button class="powersearch-tab-closed__btn" onClick={() => setConfirmItem(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Pinned searches — always at the top, no clear button */}
      {hasPinned && (
        <div>
          <div class="powersearch-recent__row-header">
            <span class="powersearch-recent__label">★ Pinned</span>
          </div>
          <div class="powersearch-recent__searches" style={{ marginTop: '0.5rem' }}>
            {data.pinned.map(p => (
              <span key={p.query} class="powersearch-recent__chip-wrap">
                <button
                  class="powersearch-recent__chip powersearch-recent__chip--pinned"
                  onClick={() => onSearch(p.query)}
                  title={p.query}
                >
                  {p.query}
                </button>
                <button
                  class="powersearch-recent__pin-btn powersearch-recent__pin-btn--active"
                  onClick={() => onUnpinSearch(p.query)}
                  title={`Unpin "${p.query}"`}
                  aria-label={`Unpin "${p.query}"`}
                >★</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {hasSearches && (
        <div>
          <div class="powersearch-recent__row-header">
            <span class="powersearch-recent__label">Recent searches</span>
            <button
              class="powersearch-recent__clear-btn"
              onClick={onClearSearches}
              title="Clear recent searches"
              aria-label="Clear recent searches"
            >
              Clear
            </button>
          </div>
          <div class="powersearch-recent__searches" style={{ marginTop: '0.5rem' }}>
            {data.searches.map(s => (
              <span
                key={s.query}
                class="powersearch-recent__chip-wrap"
                onMouseEnter={() => setHoveredChip(s.query)}
                onMouseLeave={() => setHoveredChip(null)}
              >
                <button
                  class="powersearch-recent__chip"
                  onClick={() => onSearch(s.query)}
                  title={s.query}
                >
                  {s.query}
                </button>
                {!data.pinned.some(p => p.query === s.query) && (
                  <button
                    class={`powersearch-recent__pin-btn${hoveredChip === s.query ? ' powersearch-recent__pin-btn--visible' : ''}`}
                    onClick={() => onPinSearch(s.query)}
                    title={`Pin "${s.query}"`}
                    aria-label={`Pin "${s.query}"`}
                  >☆</button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasClicks && (
        <div>
          <div class="powersearch-recent__row-header">
            <span class="powersearch-recent__label">Recent results</span>
            <button
              class="powersearch-recent__clear-btn"
              onClick={onClearClicks}
              title="Clear recent results"
              aria-label="Clear recent results"
            >
              Clear
            </button>
          </div>
          <div class="powersearch-recent__clicks" style={{ marginTop: '0.375rem' }}>
            {data.clicks.map(c => (
              <button
                key={c.url}
                class="powersearch-recent__click-row"
                onClick={() => handleClickResult(c.url, c.query)}
                title={c.url}
              >
                <span class="powersearch-recent__click-icon" aria-hidden="true">↗</span>
                <span class="powersearch-recent__click-body">
                  <span class="powersearch-recent__click-title">{c.title || getDomain(c.url)}</span>
                  {c.query && (
                    <span class="powersearch-recent__click-query">for &ldquo;{c.query}&rdquo;</span>
                  )}
                </span>
                <span class="powersearch-recent__click-domain">{getDomain(c.url)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
