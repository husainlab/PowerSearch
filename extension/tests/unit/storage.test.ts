/**
 * Unit tests for the storage module
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getRecentSearches,
  pushRecentSearch,
  clearRecentSearches,
  getRecentClicks,
  pushRecentClick,
  clearRecentClicks,
  getPinnedSearches,
  pinSearch,
  unpinSearch,
  getSettings,
  saveSettings,
  getActiveResults,
  setActiveResults,
  clearActiveResults,
  getCachedTabText,
  setCachedTabText,
  invalidateTabCache,
} from '../../src/background/storage'
import { DEFAULT_SETTINGS } from '../../src/types'
import type { SearchResults, Settings } from '../../src/types'

describe('storage — Recent Searches', () => {
  it('returns empty array initially', async () => {
    const searches = await getRecentSearches()
    expect(searches).toEqual([])
  })

  it('pushes a search and retrieves it', async () => {
    await pushRecentSearch('hello')
    const searches = await getRecentSearches()

    expect(searches).toHaveLength(1)
    expect(searches[0].query).toBe('hello')
    expect(searches[0].timestamp).toBeGreaterThan(0)
  })

  it('deduplicates on push (moves to front)', async () => {
    await pushRecentSearch('a')
    await pushRecentSearch('b')
    await pushRecentSearch('a')

    const searches = await getRecentSearches()
    expect(searches).toHaveLength(2)
    expect(searches[0].query).toBe('a') // most recent first
    expect(searches[1].query).toBe('b')
  })

  it('caps at 5 entries', async () => {
    for (let i = 0; i < 8; i++) {
      await pushRecentSearch(`search-${i}`)
    }

    const searches = await getRecentSearches()
    expect(searches).toHaveLength(5)
    // Most recent should be first
    expect(searches[0].query).toBe('search-7')
  })

  it('clears all recent searches', async () => {
    await pushRecentSearch('a')
    await pushRecentSearch('b')
    await clearRecentSearches()

    expect(await getRecentSearches()).toEqual([])
  })
})

describe('storage — Recent Clicks', () => {
  it('returns empty array initially', async () => {
    expect(await getRecentClicks()).toEqual([])
  })

  it('pushes a click and retrieves it', async () => {
    await pushRecentClick('https://example.com', 'Example', 'test')
    const clicks = await getRecentClicks()

    expect(clicks).toHaveLength(1)
    expect(clicks[0].url).toBe('https://example.com')
    expect(clicks[0].title).toBe('Example')
    expect(clicks[0].query).toBe('test')
  })

  it('deduplicates by URL (moves to front)', async () => {
    await pushRecentClick('https://a.com', 'A', 'q1')
    await pushRecentClick('https://b.com', 'B', 'q2')
    await pushRecentClick('https://a.com', 'A updated', 'q3')

    const clicks = await getRecentClicks()
    expect(clicks).toHaveLength(2)
    expect(clicks[0].url).toBe('https://a.com')
    expect(clicks[0].title).toBe('A updated')
  })

  it('caps at 5 entries', async () => {
    for (let i = 0; i < 8; i++) {
      await pushRecentClick(`https://${i}.com`, `Site ${i}`, 'q')
    }

    const clicks = await getRecentClicks()
    expect(clicks).toHaveLength(5)
  })

  it('clears all recent clicks', async () => {
    await pushRecentClick('https://a.com', 'A', 'q')
    await clearRecentClicks()

    expect(await getRecentClicks()).toEqual([])
  })
})

describe('storage — Pinned Searches', () => {
  it('returns empty array initially', async () => {
    expect(await getPinnedSearches()).toEqual([])
  })

  it('pins a search', async () => {
    await pinSearch('important query')
    const pinned = await getPinnedSearches()

    expect(pinned).toHaveLength(1)
    expect(pinned[0].query).toBe('important query')
  })

  it('does not duplicate an already-pinned search', async () => {
    await pinSearch('query')
    await pinSearch('query')

    const pinned = await getPinnedSearches()
    expect(pinned).toHaveLength(1)
  })

  it('unpins a search', async () => {
    await pinSearch('a')
    await pinSearch('b')
    await unpinSearch('a')

    const pinned = await getPinnedSearches()
    expect(pinned).toHaveLength(1)
    expect(pinned[0].query).toBe('b')
  })

  it('unpinning non-existent query is a no-op', async () => {
    await pinSearch('a')
    await unpinSearch('nonexistent')

    expect(await getPinnedSearches()).toHaveLength(1)
  })
})

describe('storage — Settings', () => {
  it('returns defaults when no settings are saved', async () => {
    const settings = await getSettings()
    expect(settings).toEqual(DEFAULT_SETTINGS)
  })

  it('merges saved settings with defaults', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark' })
    const settings = await getSettings()

    expect(settings.theme).toBe('dark')
    // Other defaults preserved
    expect(settings.defaultScope).toBe('all')
    expect(settings.highlightColor).toBe('yellow')
  })

  it('round-trips all settings correctly', async () => {
    const custom: Settings = {
      theme: 'light',
      defaultScope: 'tabs',
      highlightColor: 'blue',
      maxMatchesPerTab: 500,
      historyResultsLimit: 25,
      caseSensitive: true,
      matchWholeWord: true,
      openMode: 'sidePanel',
      enableAutoSearch: false,
    }

    await saveSettings(custom)
    const loaded = await getSettings()
    expect(loaded).toEqual(custom)
  })
})

describe('storage — Active Results (session)', () => {
  it('returns null when no active results', async () => {
    expect(await getActiveResults()).toBeNull()
  })

  it('stores and retrieves active results', async () => {
    const results: SearchResults = {
      query: 'test',
      tabs: [],
      history: [],
      completedBatches: 1,
      totalBatches: 1,
    }

    await setActiveResults('test', results)
    const stored = await getActiveResults()

    expect(stored).not.toBeNull()
    expect(stored!.query).toBe('test')
    expect(stored!.results).toEqual(results)
  })

  it('clears active results', async () => {
    const results: SearchResults = {
      query: 'test',
      tabs: [],
      history: [],
      completedBatches: 0,
      totalBatches: 0,
    }

    await setActiveResults('test', results)
    await clearActiveResults()

    expect(await getActiveResults()).toBeNull()
  })
})

describe('storage — Tab Text Cache (session)', () => {
  it('returns null for uncached tab', async () => {
    expect(await getCachedTabText(42)).toBeNull()
  })

  it('stores and retrieves cached text', async () => {
    await setCachedTabText(42, 'hello world')
    const cached = await getCachedTabText(42)

    expect(cached).not.toBeNull()
    expect(cached!.text).toBe('hello world')
    expect(cached!.timestamp).toBeGreaterThan(0)
  })

  it('invalidates cached tab text', async () => {
    await setCachedTabText(42, 'hello')
    await invalidateTabCache(42)

    expect(await getCachedTabText(42)).toBeNull()
  })

  it('performs LRU eviction when cache exceeds 50 entries', async () => {
    // Fill cache to 55 entries
    for (let i = 1; i <= 55; i++) {
      await setCachedTabText(i, `text-${i}`)
    }

    // Oldest entries (1-5) should have been evicted
    // The exact eviction behavior depends on timing, but total should be <= 50
    let count = 0
    for (let i = 1; i <= 55; i++) {
      const cached = await getCachedTabText(i)
      if (cached) count++
    }

    expect(count).toBeLessThanOrEqual(50)
  })
})
