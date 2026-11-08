import { useState } from 'preact/hooks'
import type { HistorySearchResult, Settings } from '../../types'

interface HistoryGroupProps {
  results: HistorySearchResult[]
  query: string
  settings: Settings
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function highlightText(text: string, query: string, caseSensitive: boolean, matchWholeWord: boolean) {
  if (!text || !query) return <>{text}</>
  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()

  const isWordChar = (c: string) => /\w/.test(c)

  let pos = 0
  while (pos < haystack.length) {
    const idx = haystack.indexOf(needle, pos)
    if (idx === -1) break

    if (matchWholeWord) {
      const charBefore = idx > 0 ? haystack[idx - 1] : ''
      const charAfter = idx + needle.length < haystack.length ? haystack[idx + needle.length] : ''
      if ((charBefore && isWordChar(charBefore)) || (charAfter && isWordChar(charAfter))) {
        pos = idx + 1
        continue
      }
    }

    return (
      <>
        {text.slice(0, idx)}
        <mark class="powersearch-history-result__mark">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return <>{text}</>
}

export function HistoryGroup({ results, query, settings }: HistoryGroupProps) {
  const [open, setOpen] = useState(true)

  const handleOpenUrl = async (url: string) => {
    const allTabs = await chrome.tabs.query({})
    const existing = allTabs.find(t => t.url === url)
    if (existing?.id !== undefined) {
      chrome.windows.update(existing.windowId!, { focused: true })
      chrome.tabs.update(existing.id, { active: true })
    } else {
      chrome.tabs.create({ url })
    }
  }

  return (
    <div class="powersearch-section">
      <button
        class="powersearch-section__header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`History — ${results.length} matches`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1" />
          <polyline points="6,3.5 6,6 8,7.5" stroke="currentColor" stroke-width="1" stroke-linecap="square" />
        </svg>
        History
        <span class="powersearch-section__count">{results.length}</span>
        <svg
          class={`powersearch-section__chevron${open ? ' powersearch-section__chevron--open' : ''}`}
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="square" />
        </svg>
      </button>

      {open && (
        <div class="powersearch-section__body">
          {results.map(item => (
            <button
              key={item.id}
              class="powersearch-history-result"
              onClick={() => handleOpenUrl(item.url)}
              title={item.url}
            >
              <span class="powersearch-history-result__icon" aria-hidden="true">↗</span>
              <span class="powersearch-history-result__body">
                <span class="powersearch-history-result__title">
                  {highlightText(item.title || getDomain(item.url), query, settings.caseSensitive, settings.matchWholeWord)}
                </span>
                <span class="powersearch-history-result__url">
                  {highlightText(item.url, query, settings.caseSensitive, settings.matchWholeWord)}
                </span>
              </span>
              <span class="powersearch-history-result__time">
                {formatRelativeTime(item.lastVisitTime)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
