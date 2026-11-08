import type { HistorySearchResult } from '../types'

const DEFAULT_HISTORY_RESULTS = 50

/**
 * Search browser history for entries matching the query in URL or title.
 * chrome.history.search does a substring match on URL + title internally.
 * We post-filter and deduplicate, then sort by recency.
 */
export async function searchHistory(
  query: string,
  options?: { maxResults?: number; caseSensitive?: boolean; matchWholeWord?: boolean }
): Promise<HistorySearchResult[]> {
  if (!query.trim()) return []

  const limit = options?.maxResults ?? DEFAULT_HISTORY_RESULTS
  const caseSensitive = options?.caseSensitive ?? false
  const matchWholeWord = options?.matchWholeWord ?? false

  // If filtering is needed, fetch more results from Chrome API initially
  const needsPostFilter = caseSensitive || matchWholeWord
  const fetchLimit = needsPostFilter ? limit * 10 : limit

  const rawResults = await chrome.history.search({
    text: query,
    maxResults: fetchLimit,
    startTime: 0,
  })

  const seen = new Set<string>()
  const results: HistorySearchResult[] = []

  // Helper for word boundaries
  const isWordChar = (c: string) => /\w/.test(c)

  const matchesOptions = (text: string, q: string) => {
    if (!text) return false
    const haystack = caseSensitive ? text : text.toLowerCase()
    const needle = caseSensitive ? q : q.toLowerCase()
    const idx = haystack.indexOf(needle)
    if (idx === -1) return false

    if (matchWholeWord) {
      // Check boundaries around the first match
      // If we need to find ANY match that respects whole word, we must loop:
      let pos = 0
      while (pos < haystack.length) {
        const i = haystack.indexOf(needle, pos)
        if (i === -1) return false
        const charBefore = i > 0 ? haystack[i - 1] : ''
        const charAfter = i + needle.length < haystack.length ? haystack[i + needle.length] : ''
        if (!((charBefore && isWordChar(charBefore)) || (charAfter && isWordChar(charAfter)))) {
          return true
        }
        pos = i + 1
      }
      return false
    }
    return true
  }

  for (const item of rawResults) {
    if (!item.url || seen.has(item.url)) continue

    if (needsPostFilter) {
      const urlMatches = matchesOptions(item.url, query)
      const titleMatches = matchesOptions(item.title ?? '', query)
      if (!urlMatches && !titleMatches) continue
    }

    seen.add(item.url)
    results.push({
      id: item.id,
      url: item.url,
      title: item.title ?? '',
      lastVisitTime: item.lastVisitTime ?? 0,
      visitCount: item.visitCount ?? 0,
    })

    if (results.length >= limit) break
  }

  // Sort most recently visited first
  results.sort((a, b) => b.lastVisitTime - a.lastVisitTime)

  return results
}
