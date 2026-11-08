import { useEffect, useState } from 'preact/hooks'
import type { RecentSearch } from '../../types'

interface AutocompleteProps {
  suggestions: RecentSearch[]
  onSelect: (query: string) => void
  visible: boolean
}

export function Autocomplete({ suggestions, onSelect, visible }: AutocompleteProps) {
  const [hoveredIndex, setHoveredIndex] = useState(-1)

  if (!suggestions || suggestions.length === 0) {
    return null
  }

  const handleSelect = (suggestion: string) => {
    onSelect(suggestion)
    setHoveredIndex(-1)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!visible || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoveredIndex(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoveredIndex(i => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' && hoveredIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[hoveredIndex].query)
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hoveredIndex, suggestions, visible])

  return (
    <div class="powersearch-autocomplete">
      <ul class="powersearch-autocomplete__list">
        {suggestions.map((suggestion, idx) => (
          <li
            key={suggestion.query}
            class={`powersearch-autocomplete__item${idx === hoveredIndex ? ' powersearch-autocomplete__item--active' : ''}`}
            onClick={() => handleSelect(suggestion.query)}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(-1)}
          >
            <span class="powersearch-autocomplete__icon">🕐</span>
            <span class="powersearch-autocomplete__text">{suggestion.query}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
