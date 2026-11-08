// ---------------------------------------------------------------------------
// Platform, OS, and browser detection utilities
// Shared across background, popup, content script, and onboarding contexts.
// ---------------------------------------------------------------------------

export type OSName = 'mac' | 'windows' | 'linux' | 'chromeos' | 'unknown'
export type BrowserName = 'chrome' | 'edge' | 'brave' | 'opera' | 'vivaldi' | 'unknown'

// ---------------------------------------------------------------------------
// OS detection
// ---------------------------------------------------------------------------

let _cachedOS: OSName | null = null

/**
 * Detect the current operating system.
 * Uses navigator.userAgentData (modern, Chromium 93+) with fallback
 * to navigator.platform + navigator.userAgent.
 */
export function getOS(): OSName {
  if (_cachedOS) return _cachedOS

  // Modern high-entropy API (Chromium 93+)
  const uaData = (navigator as any).userAgentData
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase()
    if (p === 'macos') return (_cachedOS = 'mac')
    if (p === 'windows') return (_cachedOS = 'windows')
    if (p === 'chrome os' || p === 'chromeos') return (_cachedOS = 'chromeos')
    if (p === 'linux') return (_cachedOS = 'linux')
  }

  // Legacy fallback
  const platform = (navigator.platform ?? '').toLowerCase()
  const ua = (navigator.userAgent ?? '').toLowerCase()

  if (platform.startsWith('mac') || ua.includes('macintosh')) return (_cachedOS = 'mac')
  if (platform.startsWith('win') || ua.includes('windows')) return (_cachedOS = 'windows')
  if (ua.includes('cros')) return (_cachedOS = 'chromeos')
  if (platform.startsWith('linux') || ua.includes('linux')) return (_cachedOS = 'linux')

  return (_cachedOS = 'unknown')
}

export function isMac(): boolean {
  return getOS() === 'mac'
}

// ---------------------------------------------------------------------------
// Browser detection
// ---------------------------------------------------------------------------

let _cachedBrowser: BrowserName | null = null

/**
 * Best-effort browser detection. Some browsers (Arc, Wavebox) report as
 * plain Chrome — we return 'chrome' for those.
 */
export function getBrowser(): BrowserName {
  if (_cachedBrowser) return _cachedBrowser

  const ua = navigator.userAgent

  // Brave exposes a dedicated API
  if ((navigator as any).brave?.isBrave) return (_cachedBrowser = 'brave')

  // Order matters — more specific UA tokens first
  if (ua.includes('Vivaldi/')) return (_cachedBrowser = 'vivaldi')
  if (ua.includes('OPR/') || ua.includes('Opera/')) return (_cachedBrowser = 'opera')
  if (ua.includes('Edg/')) return (_cachedBrowser = 'edge')

  return (_cachedBrowser = 'chrome')
}

// ---------------------------------------------------------------------------
// Keyboard shortcut helpers
// ---------------------------------------------------------------------------

/**
 * Get the user-configured keyboard shortcut for the extension action.
 * Falls back to the manifest default if the commands API is unavailable
 * or the shortcut hasn't been customised.
 */
export async function getActionShortcut(): Promise<string> {
  try {
    const commands = await chrome.commands.getAll()
    const action = commands.find(c => c.name === '_execute_action')
    // action.shortcut is '' when the user hasn't assigned a shortcut
    // (Brave on Mac often doesn't auto-assign the suggested_key)
    if (action?.shortcut) return action.shortcut
    // Shortcut exists but is empty — return empty so UI can show "Not set"
    if (action && action.shortcut === '') return ''
  } catch {
    // chrome.commands may not be available in all contexts
  }

  // Fallback based on OS — matches manifest.json suggested_key
  return isMac() ? 'Command+Shift+F' : 'Ctrl+Shift+F'
}

/**
 * Convert a Chrome-style shortcut string into individual key labels
 * appropriate for the current OS.
 *
 * Examples:
 *   formatShortcut('Ctrl+Shift+F')      → { keys: ['Ctrl','Shift','F'], separator: '+' }    (Windows)
 *   formatShortcut('Command+Shift+F')   → { keys: ['⌘','⇧','F'], separator: '' }           (Mac)
 */
export function formatShortcut(shortcut: string, os?: OSName): { keys: string[]; separator: string } {
  const parts = shortcut.split('+').map(s => s.trim())
  const targetOS = os ?? getOS()

  if (targetOS === 'mac') {
    // Per Chrome docs: on Mac, "Ctrl" means Command (⌘).
    // Only "MacCtrl" means the actual Control key (⌃).
    const macSymbols: Record<string, string> = {
      'Command': '⌘', 'Cmd': '⌘', 'Meta': '⌘',
      'Ctrl': '⌘', 'Control': '⌘',
      'MacCtrl': '⌃',
      'Shift': '⇧',
      'Alt': '⌥', 'Option': '⌥',
    }
    return {
      keys: parts.map(k => macSymbols[k] ?? k),
      separator: '',
    }
  }

  // Windows / Linux / ChromeOS — human-readable text
  return { keys: parts, separator: '+' }
}

// ---------------------------------------------------------------------------
// Feature detection — safe guards for browser-specific APIs
// ---------------------------------------------------------------------------

/** chrome.sidePanel API (Chrome 114+, Edge 114+). Not in all Chromium forks. */
export function hasSidePanelAPI(): boolean {
  return typeof chrome !== 'undefined' && 'sidePanel' in chrome
}

/** chrome.idle API — generally available but not guaranteed. */
export function hasIdleAPI(): boolean {
  return typeof chrome !== 'undefined' && 'idle' in chrome
}

/**
 * Get the browser-specific URL for the extensions keyboard shortcuts page.
 * Most Chromium browsers also accept `chrome://extensions/shortcuts` but
 * Edge requires its own scheme.
 */
export function getShortcutsUrl(): string {
  const browser = getBrowser()
  switch (browser) {
    case 'edge': return 'edge://extensions/shortcuts'
    case 'brave': return 'brave://extensions/shortcuts'
    case 'opera': return 'opera://extensions/shortcuts'
    case 'vivaldi': return 'vivaldi://extensions/shortcuts'
    default: return 'chrome://extensions/shortcuts'
  }
}
