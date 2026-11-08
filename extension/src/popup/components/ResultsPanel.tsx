import { TabGroup } from './TabGroup'
import { HistoryGroup } from './HistoryGroup'
import type { SearchResults, SearchScope, Settings } from '../../types'

interface ResultsPanelProps {
  results: SearchResults | null
  isSearching: boolean
  query: string
  scope: SearchScope
  settings: Settings
}

export function ResultsPanel({ results, isSearching, query, scope, settings }: ResultsPanelProps) {
  if (!results) {
    return (
      <div class="powersearch-results">
        <div class="powersearch-empty">
          {isSearching ? 'Searching…' : 'No results.'}
        </div>
      </div>
    )
  }

  const totalTabMatches = results.tabs.length
  const totalHistoryMatches = results.history.length
  const hasAnyResults = totalTabMatches > 0 || totalHistoryMatches > 0

  return (
    <div class="powersearch-results" role="region" aria-label="Search results">
      {!isSearching && !hasAnyResults && (
        <div class="powersearch-empty">
          Nothing found for &ldquo;{query}&rdquo;
          <br />
          <span style={{ fontSize: '0.75rem', marginTop: '0.375rem', display: 'block' }}>
            Try different words or check your spelling.
          </span>
        </div>
      )}

      {scope !== 'history' && (totalTabMatches > 0 || isSearching) && (
        <TabGroup
          results={results.tabs}
          query={query}
          isSearching={isSearching}
          totalMatches={totalTabMatches}
        />
      )}

      {scope !== 'tabs' && totalHistoryMatches > 0 && (
        <HistoryGroup
          results={results.history}
          query={query}
          settings={settings}
        />
      )}
    </div>
  )
}
