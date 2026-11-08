import type { RecentSearch, RecentClick, PinnedSearch, SearchResults, TabTextCache, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

// ---------------------------------------------------------------------------
// Session storage (cleared on browser restart)
// ---------------------------------------------------------------------------

const SESSION_KEYS = {
  activeQuery: 'activeQuery',
  activeResults: 'activeResults',
} as const

const TAB_CACHE_PREFIX = 'tabCache:'
const MAX_TAB_CACHE_ENTRIES = 50

export async function getActiveResults(): Promise<{ query: string; results: SearchResults } | null> {
  const data = await chrome.storage.session.get([
    SESSION_KEYS.activeQuery,
    SESSION_KEYS.activeResults,
  ])
  if (!data[SESSION_KEYS.activeQuery] || !data[SESSION_KEYS.activeResults]) return null
  return {
    query: data[SESSION_KEYS.activeQuery] as string,
    results: data[SESSION_KEYS.activeResults] as SearchResults,
  }
}

export async function setActiveResults(query: string, results: SearchResults): Promise<void> {
  await chrome.storage.session.set({
    [SESSION_KEYS.activeQuery]: query,
    [SESSION_KEYS.activeResults]: results,
  })
}

export async function clearActiveResults(): Promise<void> {
  await chrome.storage.session.remove([SESSION_KEYS.activeQuery, SESSION_KEYS.activeResults])
}

// ---------------------------------------------------------------------------
// Tab text cache (session-scoped, TTL enforced at read time)
// ---------------------------------------------------------------------------

export async function getCachedTabText(tabId: number): Promise<TabTextCache | null> {
  const key = TAB_CACHE_PREFIX + tabId
  const data = await chrome.storage.session.get(key)
  return (data[key] as TabTextCache) ?? null
}

export async function setCachedTabText(tabId: number, text: string): Promise<void> {
  const key = TAB_CACHE_PREFIX + tabId
  const entry: TabTextCache = { text, timestamp: Date.now() }

  // LRU eviction: read all session keys, evict oldest tab cache entries if over limit
  const allData = await chrome.storage.session.get(null)
  const cacheKeys = Object.keys(allData).filter(k => k.startsWith(TAB_CACHE_PREFIX))

  if (cacheKeys.length >= MAX_TAB_CACHE_ENTRIES) {
    // Sort by timestamp ascending, remove oldest
    const sorted = cacheKeys
      .map(k => ({ key: k, ts: (allData[k] as TabTextCache).timestamp }))
      .sort((a, b) => a.ts - b.ts)
    const toRemove = sorted.slice(0, sorted.length - MAX_TAB_CACHE_ENTRIES + 1).map(e => e.key)
    await chrome.storage.session.remove(toRemove)
  }

  await chrome.storage.session.set({ [key]: entry })
}

export async function invalidateTabCache(tabId: number): Promise<void> {
  await chrome.storage.session.remove(TAB_CACHE_PREFIX + tabId)
}

// ---------------------------------------------------------------------------
// Local storage (persists across sessions)
// ---------------------------------------------------------------------------

const LOCAL_KEYS = {
  recentSearches: 'recentSearches',
  recentClicks: 'recentClicks',
  pinnedSearches: 'pinnedSearches',
} as const

const MAX_RECENT = 5

export async function getRecentSearches(): Promise<RecentSearch[]> {
  const data = await chrome.storage.local.get(LOCAL_KEYS.recentSearches)
  return (data[LOCAL_KEYS.recentSearches] as RecentSearch[]) ?? []
}

export async function pushRecentSearch(query: string): Promise<void> {
  const existing = await getRecentSearches()
  const deduped = existing.filter(s => s.query !== query)
  const updated: RecentSearch[] = [{ query, timestamp: Date.now() }, ...deduped].slice(0, MAX_RECENT)
  await chrome.storage.local.set({ [LOCAL_KEYS.recentSearches]: updated })
}

export async function getRecentClicks(): Promise<RecentClick[]> {
  const data = await chrome.storage.local.get(LOCAL_KEYS.recentClicks)
  return (data[LOCAL_KEYS.recentClicks] as RecentClick[]) ?? []
}

export async function pushRecentClick(url: string, title: string, query: string): Promise<void> {
  const existing = await getRecentClicks()
  const deduped = existing.filter(c => c.url !== url)
  const updated: RecentClick[] = [
    { url, title, query, timestamp: Date.now() },
    ...deduped,
  ].slice(0, MAX_RECENT)
  await chrome.storage.local.set({ [LOCAL_KEYS.recentClicks]: updated })
}

export async function clearRecentSearches(): Promise<void> {
  await chrome.storage.local.remove(LOCAL_KEYS.recentSearches)
}

export async function clearRecentClicks(): Promise<void> {
  await chrome.storage.local.remove(LOCAL_KEYS.recentClicks)
}

// ---------------------------------------------------------------------------
// Pinned searches (persistent, user-managed)
// ---------------------------------------------------------------------------

export async function getPinnedSearches(): Promise<PinnedSearch[]> {
  const data = await chrome.storage.local.get(LOCAL_KEYS.pinnedSearches)
  return (data[LOCAL_KEYS.pinnedSearches] as PinnedSearch[]) ?? []
}

export async function pinSearch(query: string): Promise<void> {
  const existing = await getPinnedSearches()
  if (existing.some(p => p.query === query)) return
  const updated: PinnedSearch[] = [{ query, timestamp: Date.now() }, ...existing]
  await chrome.storage.local.set({ [LOCAL_KEYS.pinnedSearches]: updated })
}

export async function unpinSearch(query: string): Promise<void> {
  const existing = await getPinnedSearches()
  const updated = existing.filter(p => p.query !== query)
  await chrome.storage.local.set({ [LOCAL_KEYS.pinnedSearches]: updated })
}

// ---------------------------------------------------------------------------
// Extension settings (persistent, merged with defaults)
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get('settings')
  const stored = (data['settings'] as Partial<Settings>) ?? {}
  // Merge with defaults so new settings added in future versions get their defaults
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings })
}
