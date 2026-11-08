/**
 * Hooks — All features are free, no licensing needed.
 *
 * The useLicense hook is retained as a simple stub so that components
 * that depend on `features` continue to work without changes.
 */

export function useLicense() {
  // All features are always available — no license check needed
  const features = {
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

  return {
    features,
  }
}
