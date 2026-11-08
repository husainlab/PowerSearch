import type { SearchMatch } from '../types'

const CONTEXT_CHARS = 100
const DEFAULT_MAX_MATCHES = 1000

// ---------------------------------------------------------------------------
// Exact substring search (Phase 1)
// ---------------------------------------------------------------------------

export function exactSearch(
  text: string,
  query: string,
  options?: { caseSensitive?: boolean; maxMatches?: number; matchWholeWord?: boolean }
): SearchMatch[] {
  if (!query || !text) return []

  const caseSensitive = options?.caseSensitive ?? false
  const matchWholeWord = options?.matchWholeWord ?? false
  const maxMatches = options?.maxMatches ?? DEFAULT_MAX_MATCHES
  const cap = maxMatches <= 0 ? Infinity : maxMatches

  const matches: SearchMatch[] = []
  const searchText = caseSensitive ? text : text.toLowerCase()
  const searchQuery = caseSensitive ? query : query.toLowerCase()
  const qLen = searchQuery.length

  // Word boundary helper: returns true if char is alphanumeric or underscore
  const isWordChar = (c: string) => /\w/.test(c)

  let pos = 0
  while (matches.length < cap) {
    const idx = searchText.indexOf(searchQuery, pos)
    if (idx === -1) break

    // When matchWholeWord is on, reject matches mid-word
    if (matchWholeWord) {
      const charBefore = idx > 0 ? searchText[idx - 1] : ''
      const charAfter = idx + qLen < searchText.length ? searchText[idx + qLen] : ''
      if ((charBefore && isWordChar(charBefore)) || (charAfter && isWordChar(charAfter))) {
        pos = idx + 1
        continue
      }
    }

    const ctxStart = Math.max(0, idx - CONTEXT_CHARS)
    const ctxEnd = Math.min(text.length, idx + qLen + CONTEXT_CHARS)
    const context = text.slice(ctxStart, ctxEnd)
    const matchStart = idx - ctxStart
    const matchEnd = matchStart + qLen

    matches.push({ context, matchStart, matchEnd, position: idx })
    pos = idx + qLen
  }

  return matches
}
