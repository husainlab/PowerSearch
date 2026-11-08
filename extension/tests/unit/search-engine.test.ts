/**
 * Unit tests for the search engine (exactSearch)
 */

import { describe, it, expect } from 'vitest'
import { exactSearch } from '../../src/background/search-engine'

describe('exactSearch', () => {
  // ------------------------------------------------------------------
  // Edge cases — empty inputs
  // ------------------------------------------------------------------

  it('returns [] for empty query', () => {
    expect(exactSearch('hello world', '')).toEqual([])
  })

  it('returns [] for empty text', () => {
    expect(exactSearch('', 'hello')).toEqual([])
  })

  it('returns [] when both are empty', () => {
    expect(exactSearch('', '')).toEqual([])
  })

  it('returns [] when query is not found', () => {
    expect(exactSearch('hello world', 'xyz')).toEqual([])
  })

  // ------------------------------------------------------------------
  // Basic matching
  // ------------------------------------------------------------------

  it('finds a single match with correct fields', () => {
    const text = 'The quick brown fox jumps over the lazy dog'
    const results = exactSearch(text, 'fox')

    expect(results).toHaveLength(1)
    expect(results[0].position).toBe(16)
    expect(results[0].matchStart).toBeGreaterThanOrEqual(0)
    expect(results[0].matchEnd).toBe(results[0].matchStart + 3)
    expect(results[0].context).toContain('fox')
  })

  it('finds multiple matches', () => {
    const text = 'ab ab ab ab'
    const results = exactSearch(text, 'ab')

    expect(results).toHaveLength(4)
    expect(results.map(m => m.position)).toEqual([0, 3, 6, 9])
  })

  it('match positions are correct for adjacent matches', () => {
    const text = 'aaa'
    const results = exactSearch(text, 'a')

    expect(results).toHaveLength(3)
    expect(results.map(m => m.position)).toEqual([0, 1, 2])
  })

  // ------------------------------------------------------------------
  // Case sensitivity
  // ------------------------------------------------------------------

  it('is case-insensitive by default', () => {
    const text = 'Hello HELLO hello'
    const results = exactSearch(text, 'hello')

    expect(results).toHaveLength(3)
  })

  it('respects caseSensitive option', () => {
    const text = 'Hello HELLO hello'
    const results = exactSearch(text, 'hello', { caseSensitive: true })

    expect(results).toHaveLength(1)
    expect(results[0].position).toBe(12)
  })

  it('caseSensitive: false matches mixed case', () => {
    const text = 'FoObAr'
    const results = exactSearch(text, 'foobar', { caseSensitive: false })

    expect(results).toHaveLength(1)
  })

  // ------------------------------------------------------------------
  // Whole word matching
  // ------------------------------------------------------------------

  it('matchWholeWord rejects mid-word matches', () => {
    const text = 'football foot foo'
    const results = exactSearch(text, 'foo', { matchWholeWord: true })

    expect(results).toHaveLength(1)
    expect(results[0].position).toBe(14)
  })

  it('matchWholeWord accepts word at start of text', () => {
    const text = 'foo bar baz'
    const results = exactSearch(text, 'foo', { matchWholeWord: true })

    expect(results).toHaveLength(1)
    expect(results[0].position).toBe(0)
  })

  it('matchWholeWord accepts word at end of text', () => {
    const text = 'bar baz foo'
    const results = exactSearch(text, 'foo', { matchWholeWord: true })

    expect(results).toHaveLength(1)
  })

  it('matchWholeWord accepts word surrounded by punctuation', () => {
    const text = '(foo) "foo" foo.'
    const results = exactSearch(text, 'foo', { matchWholeWord: true })

    expect(results).toHaveLength(3)
  })

  it('matchWholeWord with caseSensitive combined', () => {
    const text = 'Foo foo FOO foobar'
    const results = exactSearch(text, 'foo', {
      matchWholeWord: true,
      caseSensitive: true,
    })

    expect(results).toHaveLength(1)
    expect(results[0].position).toBe(4)
  })

  // ------------------------------------------------------------------
  // maxMatches cap
  // ------------------------------------------------------------------

  it('respects maxMatches limit', () => {
    const text = 'a a a a a a a a a a'
    const results = exactSearch(text, 'a', { maxMatches: 3 })

    expect(results).toHaveLength(3)
  })

  it('maxMatches: 0 means unlimited', () => {
    const text = 'a a a a a'
    const results = exactSearch(text, 'a', { maxMatches: 0 })

    expect(results).toHaveLength(5)
  })

  it('maxMatches: -1 means unlimited', () => {
    const text = 'a a a'
    const results = exactSearch(text, 'a', { maxMatches: -1 })

    expect(results).toHaveLength(3)
  })

  // ------------------------------------------------------------------
  // Context window
  // ------------------------------------------------------------------

  it('context is clipped at start of text', () => {
    const text = 'ab' + ' '.repeat(200) + 'end'
    const results = exactSearch(text, 'ab')

    expect(results).toHaveLength(1)
    // Context should start at position 0 (no negative index)
    expect(results[0].matchStart).toBe(0)
  })

  it('context is clipped at end of text', () => {
    const text = 'start' + ' '.repeat(200) + 'xy'
    const results = exactSearch(text, 'xy')

    expect(results).toHaveLength(1)
    // Context should end at text length
    expect(results[0].context.includes('xy')).toBe(true)
  })

  // ------------------------------------------------------------------
  // Special characters
  // ------------------------------------------------------------------

  it('treats regex-special characters as literals', () => {
    const text = 'price is $10.00 (tax included)'
    const results = exactSearch(text, '$10.00')

    expect(results).toHaveLength(1)
  })

  it('handles parentheses and brackets', () => {
    const text = 'call foo() and bar[0]'
    const results = exactSearch(text, 'foo()')

    expect(results).toHaveLength(1)
  })

  // ------------------------------------------------------------------
  // Unicode
  // ------------------------------------------------------------------

  it('finds unicode text', () => {
    const text = 'こんにちは世界 hello こんにちは'
    const results = exactSearch(text, 'こんにちは')

    expect(results).toHaveLength(2)
  })

  it('finds emoji matches', () => {
    const text = 'I love 🎉 coding 🎉'
    const results = exactSearch(text, '🎉')

    expect(results).toHaveLength(2)
  })
})
