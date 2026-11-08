/**
 * Licensing Stubs Tests
 *
 * After removing the Pro model, all licensing functions are stubs
 * that always return "all features enabled". These tests verify
 * the stubs behave correctly.
 */

import { describe, it, expect } from 'vitest'
import {
  getUserLicense,
  checkSearchLimit,
  getAvailableFeatures,
  enforceFeatureLimits,
} from '../../src/background/licensing'
import type { Settings } from '../../src/types'
import { DEFAULT_SETTINGS } from '../../src/types'

describe('getUserLicense (stub)', () => {
  it('always returns isPro: true', async () => {
    const license = await getUserLicense()
    expect(license.isPro).toBe(true)
  })
})

describe('checkSearchLimit (stub)', () => {
  it('always returns unlimited', async () => {
    const result = await checkSearchLimit(500)
    expect(result.isLimited).toBe(false)
    expect(result.maxTabs).toBe(Infinity)
    expect(result.tabsQueried).toBe(500)
    expect(result.tabsRemaining).toBe(Infinity)
  })
})

describe('getAvailableFeatures (stub)', () => {
  it('returns all features enabled', async () => {
    const features = await getAvailableFeatures()
    expect(features.unlimitedTabs).toBe(true)
    expect(features.sidePanelMode).toBe(true)
    expect(features.pinnedSearches).toBe(true)
    expect(features.allHighlightColors).toBe(true)
    expect(features.advancedFilters).toBe(true)
    expect(features.caseSensitive).toBe(true)
    expect(features.matchWholeWord).toBe(true)
    expect(features.contextMenuSearch).toBe(true)
    expect(features.backgroundIndexing).toBe(true)
    expect(features.configurableMatches).toBe(true)
  })
})

describe('enforceFeatureLimits (stub)', () => {
  it('passes settings through unchanged', async () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      highlightColor: 'blue',
      openMode: 'sidePanel',
      caseSensitive: true,
      matchWholeWord: true,
      maxMatchesPerTab: 500,
    }
    const result = await enforceFeatureLimits(settings)
    expect(result).toEqual(settings)
  })
})
