/**
 * Licensing — All Features Free & Open Source
 *
 * All features are available to every user for free without restrictions.
 * These stubs maintain the function signatures so the rest of the codebase
 * continues to compile without changes to every call site.
 */

import type { Settings } from '../types'

// ---- Stubs (always "pro" / unrestricted) ----------------------------------

export async function getUserLicense() {
  return { isPro: true }
}

export async function checkSearchLimit(tabsQueried: number) {
  return {
    tabsQueried,
    maxTabs: Infinity,
    isLimited: false,
    tabsRemaining: Infinity,
  }
}

export interface ProFeatures {
  unlimitedTabs: boolean
  sidePanelMode: boolean
  pinnedSearches: boolean
  allHighlightColors: boolean
  advancedFilters: boolean
  caseSensitive: boolean
  matchWholeWord: boolean
  contextMenuSearch: boolean
  backgroundIndexing: boolean
  configurableMatches: boolean
}

export async function getAvailableFeatures(): Promise<ProFeatures> {
  return {
    unlimitedTabs: true,
    sidePanelMode: true,
    pinnedSearches: true,
    allHighlightColors: true,
    advancedFilters: true,
    caseSensitive: true,
    matchWholeWord: true,
    contextMenuSearch: true,
    backgroundIndexing: true,
    configurableMatches: true,
  }
}

export async function enforceFeatureLimits(settings: Settings): Promise<Settings> {
  // All features are free — no enforcement needed
  return settings
}

