/**
 * Global test setup — Comprehensive Chrome Extension API mock
 *
 * Creates an in-memory implementation of chrome.storage.local,
 * chrome.storage.session, and stubs for all other Chrome APIs
 * used by the extension.
 */

import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// In-memory storage backing stores
// ---------------------------------------------------------------------------

const localStore = new Map<string, unknown>()
const sessionStore = new Map<string, unknown>()

function createStorageArea(store: Map<string, unknown>) {
  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (keys === null || keys === undefined) {
        // Return all
        const result: Record<string, unknown> = {}
        for (const [k, v] of store) {
          result[k] = v
        }
        return result
      }
      if (typeof keys === 'string') {
        const result: Record<string, unknown> = {}
        if (store.has(keys)) result[keys] = store.get(keys)
        return result
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {}
        for (const key of keys) {
          if (store.has(key)) result[key] = store.get(key)
        }
        return result
      }
      // Object with defaults
      const result: Record<string, unknown> = {}
      for (const [key, defaultVal] of Object.entries(keys)) {
        result[key] = store.has(key) ? store.get(key) : defaultVal
      }
      return result
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        store.set(key, value)
      }
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys]
      for (const key of keyList) {
        store.delete(key)
      }
    }),
    clear: vi.fn(async () => {
      store.clear()
    }),
  }
}

// ---------------------------------------------------------------------------
// chrome.* namespace mock
// ---------------------------------------------------------------------------

const changeListeners: Array<(changes: Record<string, unknown>, area: string) => void> = []

const chromeMock = {
  storage: {
    local: createStorageArea(localStore),
    session: createStorageArea(sessionStore),
    onChanged: {
      addListener: vi.fn((fn: (changes: Record<string, unknown>, area: string) => void) => {
        changeListeners.push(fn)
      }),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onConnect: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    id: 'test-extension-id',
  },
  tabs: {
    query: vi.fn(async () => []),
    get: vi.fn(async (tabId: number) => ({ id: tabId, url: 'https://example.com', windowId: 1 })),
    create: vi.fn(async () => ({ id: 999 })),
    update: vi.fn(async () => ({})),
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  windows: {
    update: vi.fn(async () => ({})),
  },
  history: {
    search: vi.fn(async () => []),
  },
  permissions: {
    contains: vi.fn(async () => true),
    onAdded: { addListener: vi.fn() },
  },
  scripting: {
    executeScript: vi.fn(async () => [{ result: '' }]),
  },
  sidePanel: {
    setOptions: vi.fn(async () => {}),
    open: vi.fn(async () => {}),
  },
  contextMenus: {
    create: vi.fn(),
    remove: vi.fn(async () => {}),
    onClicked: { addListener: vi.fn() },
  },
  idle: {
    setDetectionInterval: vi.fn(),
    onStateChanged: { addListener: vi.fn() },
  },
  commands: {
    getAll: vi.fn(async () => [
      { name: '_execute_action', shortcut: 'Ctrl+Shift+F' },
    ]),
  },
  action: {
    setPopup: vi.fn(),
    openPopup: vi.fn(),
    onClicked: { addListener: vi.fn() },
  },
}

// Attach to globalThis so modules importing chrome.* work
;(globalThis as any).chrome = chromeMock

// ---------------------------------------------------------------------------
// Helpers for tests to access internals
// ---------------------------------------------------------------------------

/** Clear all in-memory storage between tests */
export function resetMockStorage(): void {
  localStore.clear()
  sessionStore.clear()
}

/** Get the raw backing store for assertions */
export function getLocalStore(): Map<string, unknown> {
  return localStore
}

export function getSessionStore(): Map<string, unknown> {
  return sessionStore
}

// ---------------------------------------------------------------------------
// Auto-reset storage before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetMockStorage()
})
