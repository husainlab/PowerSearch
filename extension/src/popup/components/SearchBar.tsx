import { useRef, useEffect, useState } from 'preact/hooks'
import type { SearchScope } from '../../types'
import { getActionShortcut, formatShortcut, isMac } from '../../platform'

interface SearchBarProps {
  query: string
  onSearch: (query: string) => void
  onClear: () => void
  isSearching: boolean
  scope: SearchScope
  onScopeChange: (scope: SearchScope) => void
  onNavigateResults?: () => void
  onOpenSettings?: () => void
  onPinSearch?: (query: string) => void
  onUnpinSearch?: (query: string) => void
  isPinned?: boolean
  canPinSearch?: boolean
  onFocus?: () => void
  onBlur?: () => void
}

const SCOPE_LABELS: Record<SearchScope, string> = { all: 'All', tabs: 'Tabs', history: 'History' }

export function SearchBar({ query, onSearch, onClear, isSearching, scope, onScopeChange, onNavigateResults, onOpenSettings, onPinSearch, onUnpinSearch, isPinned, canPinSearch, onFocus, onBlur }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localQuery, setLocalQuery] = useState(query)
  const [localPinned, setLocalPinned] = useState(false)

  // Keep localQuery in sync when parent `query` changes (e.g., restore session)
  useEffect(() => {
    setLocalQuery(query)
    setLocalPinned(false)
  }, [query])

  // Shortcut display — fetched from chrome.commands (reflects user customisation)
  const [shortcutKeys, setShortcutKeys] = useState<string[]>([])
  const [shortcutSep, setShortcutSep] = useState('')
  const [shortcutLabel, setShortcutLabel] = useState('')
  const [shortcutEmpty, setShortcutEmpty] = useState(false)

  const loadShortcut = () => {
    getActionShortcut().then(raw => {
      if (!raw) {
        // Shortcut not assigned (common on Brave/Mac)
        setShortcutEmpty(true)
        setShortcutKeys([])
        setShortcutLabel('')
        return
      }
      const { keys, separator } = formatShortcut(raw)
      setShortcutKeys(keys)
      setShortcutSep(separator)
      setShortcutLabel(keys.join(separator || '+'))
      setShortcutEmpty(false)
    })
  }

  useEffect(() => {
    loadShortcut()
    // Refresh shortcut if user changes it and returns to the side panel
    window.addEventListener('focus', loadShortcut)
    return () => window.removeEventListener('focus', loadShortcut)
  }, [])

  // Auto-focus on mount. Chrome side panels don't steal OS focus automatically,
  // so call window.focus() first to request it, then focus the input.
  useEffect(() => {
    window.focus()
    inputRef.current?.focus()
    const t1 = setTimeout(() => { window.focus(); inputRef.current?.focus() }, 100)
    const t2 = setTimeout(() => { window.focus(); inputRef.current?.focus() }, 400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Re-focus when the side panel window regains focus (Ctrl+Shift+F or icon click)
  useEffect(() => {
    const handleWindowFocus = () => inputRef.current?.focus()
    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [])

  // Fallback: if a letter/digit is typed while the input is not focused,
  // redirect focus so the character lands in the search bar.
  // NOTE: space is intentionally excluded to avoid hijacking button actions.
  useEffect(() => {
    const handleDocKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleDocKeyDown)
    return () => document.removeEventListener('keydown', handleDocKeyDown)
  }, [])

  const handleInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value
    setLocalQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      onClear()
      return
    }

    debounceRef.current = setTimeout(() => {
      onSearch(value)
    }, 300)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setLocalQuery('')
      onClear()
    }
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const value = (e.target as HTMLInputElement).value.trim()
      if (value) onSearch(value)
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onNavigateResults?.()
    }
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handlePinClick()
    }
  }

  const handleClearClick = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLocalQuery('')
    onClear()
    inputRef.current?.focus()
  }

  const handlePinClick = () => {
    const value = (inputRef.current?.value ?? localQuery ?? '').trim()
    if (!value) return

    // Optimistic local toggle so UI responds immediately
    setLocalPinned(p => !p)

    if (isPinned || localPinned) {
      onUnpinSearch?.(value)
    } else {
      onPinSearch?.(value)
    }
  }

  // On Mac, shortcut keys render compactly without separators (⌘⇧F).
  // On Windows/Linux, render as individual <kbd> elements with "+" between them.
  const renderShortcut = () => {
    // Shortcut not assigned — show hint to set it
    if (shortcutEmpty) {
      return (
        <button
          class="powersearch-search-bar__shortcut powersearch-search-bar__shortcut--notset"
          onClick={onOpenSettings}
          title="Click to set a keyboard shortcut"
        >
          Set shortcut
        </button>
      )
    }

    if (shortcutKeys.length === 0) return null

    if (isMac()) {
      // Compact Mac symbol style: ⌘⇧F
      return (
        <span
          class="powersearch-search-bar__shortcut powersearch-search-bar__shortcut--mac"
          aria-label={shortcutLabel}
          title={`Shortcut: ${shortcutLabel}`}
        >
          {shortcutKeys.join('')}
        </span>
      )
    }

    // Windows / Linux / ChromeOS: Ctrl+Shift+F as individual <kbd> elements
    return (
      <span
        class="powersearch-search-bar__shortcut"
        aria-label={shortcutLabel}
        title={`Shortcut: ${shortcutLabel}`}
      >
        {shortcutKeys.map((key, i) => (
          <>
            {i > 0 && <span class="powersearch-search-bar__shortcut-sep">{shortcutSep}</span>}
            <kbd class="powersearch-search-bar__shortcut-key">{key}</kbd>
          </>
        ))}
      </span>
    )
  }

  return (
    <div class={`powersearch-search-bar${isSearching ? ' powersearch-search-bar--searching' : ''}`}>
      <div class="powersearch-search-bar__row">
        <svg
          class="powersearch-search-bar__icon"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          {isSearching ? (
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-dasharray="28"
              stroke-dashoffset="10"
              stroke-linecap="round"
            />
          ) : (
            <>
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.25" />
              <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" stroke-width="1.25" stroke-linecap="square" />
            </>
          )}
        </svg>

        <input
          ref={inputRef}
          class="powersearch-search-bar__input"
          type="text"
          value={localQuery}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Search all tabs and history…"
          aria-label="Search"
          autocomplete="off"
          spellcheck={false}
        />

        {(localQuery ?? '') && canPinSearch && (
          <button
            class="powersearch-search-bar__btn"
            onClick={handlePinClick}
            aria-label={isPinned ? 'Unpin search' : 'Pin search'}
            title={isPinned ? 'Unpin this search' : 'Pin this search'}
          >
            <span aria-hidden="true" style={{ fontSize: '14px', lineHeight: 1 }}>{(isPinned || localPinned) ? '★' : '☆'}</span>
          </button>
        )}

        {query && (
          <button
            class="powersearch-search-bar__btn"
            onClick={handleClearClick}
            aria-label="Clear search"
            title="Clear (Esc)"
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.25" />
              <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
              <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
            </svg>
          </button>
        )}

        {!query && renderShortcut()}

        <div class="powersearch-search-bar__divider" aria-hidden="true" />

        <button
          class="powersearch-search-bar__btn"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
            <path d="M6.7 1.5h2.6l.35 1.7a5 5 0 011.1.64l1.6-.65 1.3 2.26-1.25 1.1a5 5 0 010 1.27l1.25 1.1-1.3 2.26-1.6-.65a5 5 0 01-1.1.64l-.35 1.7H6.7l-.35-1.7a5 5 0 01-1.1-.64l-1.6.65-1.3-2.26 1.25-1.1a5 5 0 010-1.27l-1.25-1.1 1.3-2.26 1.6.65a5 5 0 011.1-.64l.35-1.7z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
            <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.1" />
          </svg>
        </button>
      </div>

      <div class="powersearch-search-bar__scope" role="group" aria-label="Search scope">
        {(['all', 'tabs', 'history'] as const).map(s => (
          <button
            key={s}
            class={`powersearch-search-bar__scope-btn${scope === s ? ' powersearch-search-bar__scope-btn--active' : ''}`}
            onClick={() => onScopeChange(s)}
            aria-pressed={scope === s}
          >
            {SCOPE_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}
