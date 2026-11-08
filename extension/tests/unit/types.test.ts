/**
 * Unit tests for shared types and constants
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  HIGHLIGHT_PRESETS,
} from '../../src/types'
import type { Settings, HighlightColor } from '../../src/types'

describe('DEFAULT_SETTINGS', () => {
  it('has all required keys', () => {
    const expectedKeys: (keyof Settings)[] = [
      'theme',
      'defaultScope',
      'highlightColor',
      'maxMatchesPerTab',
      'historyResultsLimit',
      'caseSensitive',
      'matchWholeWord',
      'openMode',
      'enableAutoSearch',
    ]

    for (const key of expectedKeys) {
      expect(DEFAULT_SETTINGS).toHaveProperty(key)
    }
  })

  it('has sensible defaults', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system')
    expect(DEFAULT_SETTINGS.defaultScope).toBe('all')
    expect(DEFAULT_SETTINGS.highlightColor).toBe('yellow')
    expect(DEFAULT_SETTINGS.maxMatchesPerTab).toBe(1000)
    expect(DEFAULT_SETTINGS.historyResultsLimit).toBe(50)
    expect(DEFAULT_SETTINGS.caseSensitive).toBe(false)
    expect(DEFAULT_SETTINGS.matchWholeWord).toBe(false)
    expect(DEFAULT_SETTINGS.openMode).toBe('popup')
    expect(DEFAULT_SETTINGS.enableAutoSearch).toBe(true)
  })

  it('free users default to popup mode (not sidePanel)', () => {
    expect(DEFAULT_SETTINGS.openMode).toBe('popup')
  })
})

describe('HIGHLIGHT_PRESETS', () => {
  const colors: HighlightColor[] = ['yellow', 'blue', 'green', 'pink']

  it('has all 4 color presets', () => {
    for (const color of colors) {
      expect(HIGHLIGHT_PRESETS).toHaveProperty(color)
    }
  })

  it.each(colors)('%s preset has all required fields', (color) => {
    const preset = HIGHLIGHT_PRESETS[color]

    expect(preset).toHaveProperty('bg')
    expect(preset).toHaveProperty('active')
    expect(preset).toHaveProperty('outline')
    expect(preset).toHaveProperty('bgLight')
    expect(preset).toHaveProperty('activeLight')
    expect(preset).toHaveProperty('outlineLight')
  })

  it.each(colors)('%s preset colors are non-empty strings', (color) => {
    const preset = HIGHLIGHT_PRESETS[color]

    expect(preset.bg.length).toBeGreaterThan(0)
    expect(preset.active.length).toBeGreaterThan(0)
    expect(preset.outline.length).toBeGreaterThan(0)
    expect(preset.bgLight.length).toBeGreaterThan(0)
    expect(preset.activeLight.length).toBeGreaterThan(0)
    expect(preset.outlineLight.length).toBeGreaterThan(0)
  })

  it('bg colors contain rgba() (semi-transparent backgrounds)', () => {
    for (const color of colors) {
      expect(HIGHLIGHT_PRESETS[color].bg).toMatch(/^rgba\(/)
      expect(HIGHLIGHT_PRESETS[color].bgLight).toMatch(/^rgba\(/)
    }
  })

  it('active colors start with # (opaque hex)', () => {
    for (const color of colors) {
      expect(HIGHLIGHT_PRESETS[color].active).toMatch(/^#/)
      expect(HIGHLIGHT_PRESETS[color].activeLight).toMatch(/^#/)
    }
  })
})
