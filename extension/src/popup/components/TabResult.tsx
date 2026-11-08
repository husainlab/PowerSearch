import { useEffect, useRef, useState } from 'preact/hooks'
import type { TabSearchResult } from '../../types'

interface TabResultProps {
  tab: TabSearchResult
  query: string
  activeIndex: number
  onMatchClick: (index: number) => void
}

function renderContext(context: string, matchStart: number, matchEnd: number) {
  const before = context.slice(0, matchStart)
  const match = context.slice(matchStart, matchEnd)
  const after = context.slice(matchEnd)
  return (
    <>
      {before}
      <mark>{match}</mark>
      {after}
    </>
  )
}

export function TabResult({ tab, query, activeIndex, onMatchClick }: TabResultProps) {
  const activeRef = useRef<HTMLButtonElement>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Scroll active match into view whenever it changes
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIndex])

  const navigateToMatch = (matchIndex: number) => {
    chrome.runtime.sendMessage({
      type: 'NAVIGATE_TO_MATCH',
      tabId: tab.tabId,
      matchIndex,
      query,
      url: tab.url,
      title: tab.title,
    })
  }

  const handleCopy = (e: MouseEvent, text: string, i: number) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(i)
      setTimeout(() => setCopiedIndex(c => c === i ? null : c), 1500)
    }).catch(() => {})
  }

  let displayUrl = tab.url
  try {
    const u = new URL(tab.url)
    displayUrl = u.hostname.replace('www.', '') + u.pathname
  } catch { /* keep original */ }
  if (displayUrl.length > 48) displayUrl = displayUrl.slice(0, 45) + '…'

  return (
    <div class="powersearch-tab-result">
      {/* Tab header — click goes to first match */}
      <button
        class="powersearch-tab-result__row"
        onClick={() => navigateToMatch(0)}
        title={tab.title || tab.url}
      >
        <span class="powersearch-tab-result__title">{tab.title || tab.url}</span>
        <span class="powersearch-tab-result__meta" title={tab.url}>{displayUrl}</span>
      </button>

      {/* All match snippets */}
      <div class="powersearch-tab-result__matches">
        {tab.matches.map((m, i) => {
          const isActive = i === activeIndex
          const isCopied = copiedIndex === i
          return (
            <button
              key={i}
              ref={isActive ? activeRef : undefined}
              class={`powersearch-match-snippet${isActive ? ' powersearch-match-snippet--active' : ''}`}
              onClick={() => { onMatchClick(i); navigateToMatch(i) }}
              title={m.context}
              aria-label={`Match ${i + 1} of ${tab.matches.length}`}
            >
              <span class={`powersearch-match-snippet__index${isActive ? ' powersearch-match-snippet__index--active' : ''}`}>{i + 1}</span>
              <span class="powersearch-match-snippet__text">
                …{renderContext(m.context, m.matchStart, m.matchEnd)}…
              </span>
              <button
                class={`powersearch-match-snippet__copy${isCopied ? ' powersearch-match-snippet__copy--copied' : ''}`}
                onClick={(e) => handleCopy(e, m.context, i)}
                aria-label="Copy snippet"
                title="Copy to clipboard"
                tabIndex={-1}
              >
                {isCopied ? '✓' : '⎘'}
              </button>
            </button>
          )
        })}
      </div>
    </div>
  )
}
