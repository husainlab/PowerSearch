import { useState } from 'preact/hooks'
import type { SearchFilters } from '../../types'

interface FilterBarProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  tabCount: number
  historyCount: number
}

export function FilterBar({ filters, onFiltersChange, tabCount, historyCount }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false)

  const handleDomainChange = (e: Event) => {
    const value = (e.target as HTMLInputElement).value
    onFiltersChange({ ...filters, domain: value || null })
  }

  const handleStartDateChange = (e: Event) => {
    const value = (e.target as HTMLInputElement).value
    const timestamp = value ? new Date(value).getTime() : null
    onFiltersChange({ ...filters, startDate: timestamp })
  }

  const handleEndDateChange = (e: Event) => {
    const value = (e.target as HTMLInputElement).value
    const timestamp = value ? new Date(value).getTime() : null
    onFiltersChange({ ...filters, endDate: timestamp })
  }

  const clearFilters = () => {
    onFiltersChange({
      domain: null,
      startDate: null,
      endDate: null,
      visitedOnly: false,
      unvisitedOnly: false,
    })
  }

  const hasActiveFilters = filters.domain || filters.startDate || filters.endDate

  return (
    <div class="powersearch-filter-bar">
      <button
        class={`powersearch-filter-bar__toggle${expanded ? ' powersearch-filter-bar__toggle--active' : ''}`}
        onClick={() => setExpanded(!expanded)}
        title="Toggle filters"
      >
        🔍 Filters ({tabCount} tabs, {historyCount} history) {hasActiveFilters && <span class="powersearch-filter-bar__badge">●</span>}
      </button>

      {expanded && (
        <div class="powersearch-filter-panel">
          {/* Domain filter */}
          <div class="powersearch-filter-group">
            <label class="powersearch-filter-label">Domain / Website</label>
            <input
              type="text"
              class="powersearch-filter-input"
              placeholder="e.g., github.com"
              value={filters.domain || ''}
              onInput={handleDomainChange}
            />
          </div>

          {/* Date range filter */}
          <div class="powersearch-filter-group">
            <label class="powersearch-filter-label">Date Range (History)</label>
            <div class="powersearch-filter-date-range">
              <input
                type="date"
                class="powersearch-filter-input powersearch-filter-input--date"
                value={filters.startDate ? new Date(filters.startDate).toISOString().split('T')[0] : ''}
                onChange={handleStartDateChange}
                title="Start date"
              />
              <span class="powersearch-filter-dash">→</span>
              <input
                type="date"
                class="powersearch-filter-input powersearch-filter-input--date"
                value={filters.endDate ? new Date(filters.endDate).toISOString().split('T')[0] : ''}
                onChange={handleEndDateChange}
                title="End date"
              />
            </div>
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <button
              class="powersearch-filter-clear-btn"
              onClick={clearFilters}
              title="Clear all filters"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
