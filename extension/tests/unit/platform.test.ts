/**
 * Unit tests for platform detection utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// We need to reset the cached values between tests, so we re-import fresh
// by using dynamic imports and resetting modules.

describe('platform utilities', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  // ------------------------------------------------------------------
  // formatShortcut — doesn't rely on cached state
  // ------------------------------------------------------------------

  describe('formatShortcut', () => {
    it('converts Mac shortcuts to symbols', async () => {
      const { formatShortcut } = await import('../../src/platform')
      const result = formatShortcut('Command+Shift+F', 'mac')

      expect(result.keys).toEqual(['⌘', '⇧', 'F'])
      expect(result.separator).toBe('')
    })

    it('Ctrl maps to ⌘ on Mac (per Chrome docs)', async () => {
      const { formatShortcut } = await import('../../src/platform')
      const result = formatShortcut('Ctrl+Shift+F', 'mac')

      expect(result.keys).toEqual(['⌘', '⇧', 'F'])
    })

    it('MacCtrl maps to ⌃ on Mac', async () => {
      const { formatShortcut } = await import('../../src/platform')
      const result = formatShortcut('MacCtrl+Shift+F', 'mac')

      expect(result.keys[0]).toBe('⌃')
    })

    it('Alt maps to ⌥ on Mac', async () => {
      const { formatShortcut } = await import('../../src/platform')
      const result = formatShortcut('Alt+F', 'mac')

      expect(result.keys).toEqual(['⌥', 'F'])
      expect(result.separator).toBe('')
    })

    it('keeps text keys on Windows', async () => {
      const { formatShortcut } = await import('../../src/platform')
      const result = formatShortcut('Ctrl+Shift+F', 'windows')

      expect(result.keys).toEqual(['Ctrl', 'Shift', 'F'])
      expect(result.separator).toBe('+')
    })

    it('keeps text keys on Linux', async () => {
      const { formatShortcut } = await import('../../src/platform')
      const result = formatShortcut('Ctrl+Alt+S', 'linux')

      expect(result.keys).toEqual(['Ctrl', 'Alt', 'S'])
      expect(result.separator).toBe('+')
    })

    it('handles single key', async () => {
      const { formatShortcut } = await import('../../src/platform')
      const result = formatShortcut('F5', 'windows')

      expect(result.keys).toEqual(['F5'])
    })
  })

  // ------------------------------------------------------------------
  // getShortcutsUrl
  // ------------------------------------------------------------------

  describe('getShortcutsUrl', () => {
    it('returns edge:// URL for Edge', async () => {
      // Mock navigator to identify as Edge
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 Edg/120.0.0.0',
          platform: 'Win32',
          userAgentData: undefined,
        },
        writable: true,
        configurable: true,
      })

      const { getShortcutsUrl } = await import('../../src/platform')
      // getBrowser() will detect 'Edg/' in UA
      expect(getShortcutsUrl()).toBe('edge://extensions/shortcuts')
    })

    it('returns chrome:// URL for Chrome', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
          platform: 'Win32',
          userAgentData: undefined,
        },
        writable: true,
        configurable: true,
      })

      const { getShortcutsUrl } = await import('../../src/platform')
      expect(getShortcutsUrl()).toBe('chrome://extensions/shortcuts')
    })
  })

  // ------------------------------------------------------------------
  // hasSidePanelAPI / hasIdleAPI
  // ------------------------------------------------------------------

  describe('feature detection', () => {
    it('hasSidePanelAPI returns true when sidePanel exists on chrome', async () => {
      const { hasSidePanelAPI } = await import('../../src/platform')
      // Our mock has chrome.sidePanel
      expect(hasSidePanelAPI()).toBe(true)
    })

    it('hasIdleAPI returns true when idle exists on chrome', async () => {
      const { hasIdleAPI } = await import('../../src/platform')
      // Our mock has chrome.idle
      expect(hasIdleAPI()).toBe(true)
    })

    it('hasSidePanelAPI returns false when sidePanel is removed', async () => {
      const saved = (globalThis as any).chrome.sidePanel
      delete (globalThis as any).chrome.sidePanel

      const { hasSidePanelAPI } = await import('../../src/platform')
      expect(hasSidePanelAPI()).toBe(false)

      ;(globalThis as any).chrome.sidePanel = saved
    })
  })
})
