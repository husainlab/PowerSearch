/**
 * Unit tests for tab-indexer URL validation (isSearchableUrl)
 */

import { describe, it, expect } from 'vitest'
import { isSearchableUrl } from '../../src/background/tab-indexer'

describe('isSearchableUrl', () => {
  // ------------------------------------------------------------------
  // Accepted URLs
  // ------------------------------------------------------------------

  it('accepts http:// URLs', () => {
    expect(isSearchableUrl('http://example.com')).toBe(true)
  })

  it('accepts https:// URLs', () => {
    expect(isSearchableUrl('https://example.com')).toBe(true)
  })

  it('accepts file:// URLs', () => {
    expect(isSearchableUrl('file:///Users/test/doc.html')).toBe(true)
  })

  it('accepts complex https URLs with paths and queries', () => {
    expect(isSearchableUrl('https://example.com/path?q=test&page=1#section')).toBe(true)
  })

  // ------------------------------------------------------------------
  // Blocked browser-internal URLs
  // ------------------------------------------------------------------

  it('rejects chrome:// URLs', () => {
    expect(isSearchableUrl('chrome://settings')).toBe(false)
  })

  it('rejects chrome-extension:// URLs', () => {
    expect(isSearchableUrl('chrome-extension://abcdef/popup.html')).toBe(false)
  })

  it('rejects edge:// URLs', () => {
    expect(isSearchableUrl('edge://settings')).toBe(false)
  })

  it('rejects brave:// URLs', () => {
    expect(isSearchableUrl('brave://settings')).toBe(false)
  })

  it('rejects vivaldi:// URLs', () => {
    expect(isSearchableUrl('vivaldi://settings')).toBe(false)
  })

  it('rejects opera:// URLs', () => {
    expect(isSearchableUrl('opera://settings')).toBe(false)
  })

  it('rejects about: URLs', () => {
    expect(isSearchableUrl('about:blank')).toBe(false)
  })

  it('rejects chrome-search:// URLs', () => {
    expect(isSearchableUrl('chrome-search://local-ntp/local-ntp.html')).toBe(false)
  })

  it('rejects devtools:// URLs', () => {
    expect(isSearchableUrl('devtools://devtools/bundled/devtools_app.html')).toBe(false)
  })

  // ------------------------------------------------------------------
  // Non-web protocols
  // ------------------------------------------------------------------

  it('rejects ftp:// URLs', () => {
    expect(isSearchableUrl('ftp://files.example.com')).toBe(false)
  })

  it('rejects data: URLs', () => {
    expect(isSearchableUrl('data:text/html,<h1>hi</h1>')).toBe(false)
  })

  it('rejects blob: URLs', () => {
    expect(isSearchableUrl('blob:https://example.com/uuid')).toBe(false)
  })

  it('rejects javascript: URLs', () => {
    expect(isSearchableUrl('javascript:void(0)')).toBe(false)
  })

  it('rejects mailto: URLs', () => {
    expect(isSearchableUrl('mailto:user@example.com')).toBe(false)
  })

  // ------------------------------------------------------------------
  // Falsy inputs
  // ------------------------------------------------------------------

  it('rejects undefined', () => {
    expect(isSearchableUrl(undefined)).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isSearchableUrl('')).toBe(false)
  })
})
