import { useState, useEffect } from 'preact/hooks'
import type { Settings, ThemeMode, HighlightColor, SearchScope } from '../../types'
import { getActionShortcut, formatShortcut, getShortcutsUrl } from '../../platform'
import { saveSettings } from '../../background/storage'

interface SettingsPanelProps {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Option configs — each with a tooltip description
// ---------------------------------------------------------------------------

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tabs', label: 'Tabs' },
  { value: 'history', label: 'History' },
]

const COLOR_OPTIONS: { value: HighlightColor; label: string; swatch: string }[] = [
  { value: 'yellow', label: 'Yellow', swatch: '#FBBF24' },
  { value: 'blue', label: 'Blue', swatch: '#3B82F6' },
  { value: 'green', label: 'Green', swatch: '#34D399' },
  { value: 'pink', label: 'Pink', swatch: '#F472B6' },
]

const MAX_MATCHES_OPTIONS = [
  { value: 100, label: '100' },
  { value: 500, label: '500' },
  { value: 1000, label: '1000' },
  { value: 0, label: '∞' },
]

const HISTORY_LIMIT_OPTIONS = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
]

const OPEN_MODE_OPTIONS: { value: 'popup' | 'sidePanel'; label: string }[] = [
  { value: 'popup', label: 'Floating Popup' },
  { value: 'sidePanel', label: 'Sidebar (Side Panel)' },
]

// Chrome Web Store URL — direct link to the review section of the published extension
const CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/khfikkkbfobhkohjbjindgnplohhpcjn/reviews'

// Tooltip descriptions for each setting
const TOOLTIPS = {
  shortcut: 'Opens your browser\'s extension shortcuts page where you can change or reassign the keyboard shortcut for PowerSearch.',
  openMode: 'Choose how the extension opens. "Floating Popup" is faster for keyboard users. "Sidebar" keeps results open while you browse.',
  theme: 'Choose the appearance. "System" follows your OS dark/light mode. "Dark" and "Light" override it.',
  scope: 'Choose which scope PowerSearch defaults to when you open it. "All" searches both tabs and history.',
  highlight: 'Change the color used to highlight matches on the page when you navigate to a result.',
  maxMatches: 'Limit the number of matches found per tab. Lower values make search faster on very large pages. "∞" means no limit.',
  historyLimit: 'How many results to fetch from your browsing history. Higher values may take slightly longer.',
  caseSensitive: 'When enabled, search is case-sensitive — "React" will NOT match "react" or "REACT".',
  matchWholeWord: 'When enabled, only matches complete words. "test" will NOT match "testing" or "contest".',
  enableAutoSearch: 'When enabled, right-click on any selected text and choose "Search in PowerSearch" to instantly search and open the sidebar.',
  clearData: 'Remove saved data. Click once to select, click again to confirm. Pinned searches and recent history will be deleted permanently.',
}

// ---------------------------------------------------------------------------
// Tooltip wrapper component
// ---------------------------------------------------------------------------

function SettingRow({ tooltip, children }: { tooltip: string; children: any }) {
  return (
    <div class="ps-settings__section" title={tooltip}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsPanel({
  settings,
  onSettingsChange,
  onClose,
}: SettingsPanelProps) {
  const [shortcutText, setShortcutText] = useState('…')
  const [clearConfirm, setClearConfirm] = useState<string | null>(null)

  // Fetch shortcut on first render
  useEffect(() => {
    getActionShortcut().then(raw => {
      const { keys, separator } = formatShortcut(raw)
      setShortcutText(keys.join(separator || ''))
    })
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value }
    onSettingsChange(next)
    saveSettings(next)
  }

  const openShortcutSettings = () => {
    chrome.tabs.create({ url: getShortcutsUrl() })
  }

  const handleClear = async (what: 'recent' | 'pinned' | 'all') => {
    if (clearConfirm !== what) {
      setClearConfirm(what)
      setTimeout(() => setClearConfirm(null), 3000)
      return
    }
    setClearConfirm(null)

    const { clearRecentSearches, clearRecentClicks } = await import('../../background/storage')

    if (what === 'recent' || what === 'all') {
      await clearRecentSearches()
      await clearRecentClicks()
    }
    if (what === 'pinned' || what === 'all') {
      await chrome.storage.local.set({ pinnedSearches: [] })
    }
  }

  return (
    <div class="ps-settings">
      {/* Header */}
      <div class="ps-settings__header">
        <button class="ps-settings__back" onClick={onClose} aria-label="Close settings" title="Back to search">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span class="ps-settings__title">Settings</span>
      </div>

      <div class="ps-settings__body">

        {/* ── Keyboard shortcut ── */}
        <SettingRow tooltip={TOOLTIPS.shortcut}>
          <div class="ps-settings__label">Keyboard shortcut</div>
          <button class="ps-settings__shortcut-row" onClick={openShortcutSettings} title={TOOLTIPS.shortcut}>
            <span class="ps-settings__shortcut-keys">{shortcutText}</span>
            <span class="ps-settings__shortcut-link">Change →</span>
          </button>
        </SettingRow>

        {/* ── Open Mode ── */}
        <SettingRow tooltip={TOOLTIPS.openMode}>
          <div class="ps-settings__label">Open Mode</div>
          <div class="ps-settings__pills" role="radiogroup" aria-label="Open Mode">
            {OPEN_MODE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                class={`ps-settings__pill${settings.openMode === opt.value ? ' ps-settings__pill--active' : ''}`}
                onClick={() => update('openMode', opt.value)}
                aria-pressed={settings.openMode === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>

        {/* ── Theme ── */}
        <SettingRow tooltip={TOOLTIPS.theme}>
          <div class="ps-settings__label">Theme</div>
          <div class="ps-settings__pills" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                class={`ps-settings__pill${settings.theme === opt.value ? ' ps-settings__pill--active' : ''}`}
                onClick={() => update('theme', opt.value)}
                aria-pressed={settings.theme === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>

        {/* ── Default scope ── */}
        <SettingRow tooltip={TOOLTIPS.scope}>
          <div class="ps-settings__label">Default search scope</div>
          <div class="ps-settings__pills" role="radiogroup" aria-label="Default scope">
            {SCOPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                class={`ps-settings__pill${settings.defaultScope === opt.value ? ' ps-settings__pill--active' : ''}`}
                onClick={() => update('defaultScope', opt.value)}
                aria-pressed={settings.defaultScope === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>

        {/* ── Highlight color ── */}
        <SettingRow tooltip={TOOLTIPS.highlight}>
          <div class="ps-settings__label">Highlight color</div>
          <div class="ps-settings__colors" role="radiogroup" aria-label="Highlight color">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                class={`ps-settings__color-btn${settings.highlightColor === opt.value ? ' ps-settings__color-btn--active' : ''}`}
                onClick={() => update('highlightColor', opt.value)}
                aria-pressed={settings.highlightColor === opt.value}
                title={`${opt.label} highlight`}
              >
                <span class="ps-settings__color-swatch" style={{ background: opt.swatch }} />
                <span class="ps-settings__color-name">{opt.label}</span>
              </button>
            ))}
          </div>
        </SettingRow>

        {/* ── Max matches per tab ── */}
        <SettingRow tooltip={TOOLTIPS.maxMatches}>
          <div class="ps-settings__label">Max matches per tab</div>
          <div class="ps-settings__pills" role="radiogroup" aria-label="Max matches per tab">
            {MAX_MATCHES_OPTIONS.map(opt => (
              <button
                key={opt.value}
                class={`ps-settings__pill${settings.maxMatchesPerTab === opt.value ? ' ps-settings__pill--active' : ''}`}
                onClick={() => update('maxMatchesPerTab', opt.value)}
                aria-pressed={settings.maxMatchesPerTab === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>

        {/* ── History results limit ── */}
        <SettingRow tooltip={TOOLTIPS.historyLimit}>
          <div class="ps-settings__label">History results</div>
          <div class="ps-settings__pills" role="radiogroup" aria-label="History results limit">
            {HISTORY_LIMIT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                class={`ps-settings__pill${settings.historyResultsLimit === opt.value ? ' ps-settings__pill--active' : ''}`}
                onClick={() => update('historyResultsLimit', opt.value)}
                aria-pressed={settings.historyResultsLimit === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>

        {/* ── Case-sensitive search ── */}
        <SettingRow tooltip={TOOLTIPS.caseSensitive}>
          <div class="ps-settings__toggle-row">
            <span class="ps-settings__label" style={{ marginBottom: 0 }}>Case-sensitive search</span>
            <button
              class={`ps-settings__toggle${settings.caseSensitive ? ' ps-settings__toggle--on' : ''}`}
              onClick={() => update('caseSensitive', !settings.caseSensitive)}
              role="switch"
              aria-checked={settings.caseSensitive}
              aria-label="Case-sensitive search"
            >
              <span class="ps-settings__toggle-thumb" />
            </button>
          </div>
          <div class="ps-settings__hint">"React" won't match "react"</div>
        </SettingRow>

        {/* ── Match whole word ── */}
        <SettingRow tooltip={TOOLTIPS.matchWholeWord}>
          <div class="ps-settings__toggle-row">
            <span class="ps-settings__label" style={{ marginBottom: 0 }}>Match whole word</span>
            <button
              class={`ps-settings__toggle${settings.matchWholeWord ? ' ps-settings__toggle--on' : ''}`}
              onClick={() => update('matchWholeWord', !settings.matchWholeWord)}
              role="switch"
              aria-checked={settings.matchWholeWord}
              aria-label="Match whole word"
            >
              <span class="ps-settings__toggle-thumb" />
            </button>
          </div>
          <div class="ps-settings__hint">"test" won't match "testing" or "contest"</div>
        </SettingRow>

        {/* ── Auto-search on selected text ── */}
        <SettingRow tooltip={TOOLTIPS.enableAutoSearch}>
          <div class="ps-settings__toggle-row">
            <span class="ps-settings__label" style={{ marginBottom: 0 }}>Auto-search on selection</span>
            <button
              class={`ps-settings__toggle${settings.enableAutoSearch ? ' ps-settings__toggle--on' : ''}`}
              onClick={() => {
                update('enableAutoSearch', !settings.enableAutoSearch)
              }}
              role="switch"
              aria-checked={settings.enableAutoSearch}
              aria-label="Auto-search on selected text"
            >
              <span class="ps-settings__toggle-thumb" />
            </button>
          </div>
          <div class="ps-settings__hint">Right-click menu to search selected text</div>
        </SettingRow>

        {/* ── Clear data ── */}
        <SettingRow tooltip={TOOLTIPS.clearData}>
          <div class="ps-settings__label">Clear data</div>
          <div class="ps-settings__clear-btns">
            <button
              class={`ps-settings__clear-btn${clearConfirm === 'recent' ? ' ps-settings__clear-btn--confirm' : ''}`}
              onClick={() => handleClear('recent')}
            >
              {clearConfirm === 'recent' ? 'Confirm?' : 'Recent searches'}
            </button>
            <button
              class={`ps-settings__clear-btn${clearConfirm === 'pinned' ? ' ps-settings__clear-btn--confirm' : ''}`}
              onClick={() => handleClear('pinned')}
            >
              {clearConfirm === 'pinned' ? 'Confirm?' : 'Pinned searches'}
            </button>
            <button
              class={`ps-settings__clear-btn ps-settings__clear-btn--danger${clearConfirm === 'all' ? ' ps-settings__clear-btn--confirm' : ''}`}
              onClick={() => handleClear('all')}
            >
              {clearConfirm === 'all' ? 'Confirm?' : 'Clear all'}
            </button>
          </div>
        </SettingRow>

        {/* ── Rate us ── */}
        <SettingRow tooltip="Your feedback helps us improve!">
          <div class="ps-settings__label">Enjoying PowerSearch?</div>
          <a
            href={CHROME_WEB_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="ps-settings__pill ps-settings__pill--cta"
            style={{ display: 'block', textAlign: 'center', marginTop: '0.75rem' }}
          >
            Leave a review on Chrome Web Store ⭐
          </a>
          <div class="ps-settings__hint" style={{ textAlign: 'center', marginTop: '0.5rem' }}>Your feedback helps us improve!</div>
        </SettingRow>

      </div>
    </div>
  )
}
