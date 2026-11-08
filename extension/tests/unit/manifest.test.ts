/**
 * Unit tests for manifest.json validation
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const manifestPath = resolve(__dirname, '../../manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

describe('manifest.json — MV3 compliance', () => {
  it('uses manifest_version 3', () => {
    expect(manifest.manifest_version).toBe(3)
  })

  it('has a name', () => {
    expect(manifest.name).toBeTruthy()
    expect(typeof manifest.name).toBe('string')
  })

  it('has a valid version string', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('has a description', () => {
    expect(manifest.description).toBeTruthy()
    expect(manifest.description.length).toBeGreaterThan(10)
  })
})

describe('manifest.json — Permissions', () => {
  it('declares required permissions', () => {
    const requiredPermissions = [
      'tabs',
      'history',
      'storage',
      'idle',
      'scripting',
      'sidePanel',
      'contextMenus',
    ]

    for (const perm of requiredPermissions) {
      expect(manifest.permissions).toContain(perm)
    }
  })

  it('does not request unnecessary permissions', () => {
    const dangerousPerms = [
      'management',
      'debugger',
      'downloads',
      'bookmarks',
      'cookies',
      'webRequest',
      'webRequestBlocking',
      'proxy',
      'topSites',
      'notifications',
    ]

    for (const perm of dangerousPerms) {
      expect(manifest.permissions).not.toContain(perm)
    }
  })

  it('uses optional_host_permissions for <all_urls>', () => {
    expect(manifest.optional_host_permissions).toContain('<all_urls>')
    // Should NOT be in required permissions
    expect(manifest.permissions).not.toContain('<all_urls>')
  })
})

describe('manifest.json — Background service worker', () => {
  it('declares a service_worker background', () => {
    expect(manifest.background).toBeDefined()
    expect(manifest.background.service_worker).toBeTruthy()
  })

  it('uses module type', () => {
    expect(manifest.background.type).toBe('module')
  })
})

describe('manifest.json — Content scripts', () => {
  it('declares content scripts', () => {
    expect(manifest.content_scripts).toBeInstanceOf(Array)
    expect(manifest.content_scripts.length).toBeGreaterThan(0)
  })

  it('content script runs at document_idle', () => {
    const cs = manifest.content_scripts[0]
    expect(cs.run_at).toBe('document_idle')
  })

  it('content script matches all URLs', () => {
    const cs = manifest.content_scripts[0]
    expect(cs.matches).toContain('<all_urls>')
  })

  it('content script runs in all frames', () => {
    const cs = manifest.content_scripts[0]
    expect(cs.all_frames).toBe(true)
  })
})

describe('manifest.json — Action & Side Panel', () => {
  it('has a default popup', () => {
    expect(manifest.action.default_popup).toBeTruthy()
  })

  it('popup HTML file exists', () => {
    const popupPath = resolve(__dirname, '../..', manifest.action.default_popup)
    expect(existsSync(popupPath)).toBe(true)
  })

  it('has a side panel configuration', () => {
    expect(manifest.side_panel).toBeDefined()
    expect(manifest.side_panel.default_path).toBeTruthy()
  })
})

describe('manifest.json — Icons', () => {
  const requiredSizes = ['16', '32', '48', '128']

  it('declares all required icon sizes', () => {
    for (const size of requiredSizes) {
      expect(manifest.icons).toHaveProperty(size)
    }
  })

  it.each(requiredSizes)('icon %s exists on disk', (size) => {
    // Icons are in public/ at dev time (Vite copies them to dist root at build)
    const iconPath = resolve(__dirname, '../../public', manifest.icons[size])
    expect(existsSync(iconPath)).toBe(true)
  })

  it('action icons match top-level icons', () => {
    for (const size of requiredSizes) {
      expect(manifest.action.default_icon[size]).toBe(manifest.icons[size])
    }
  })
})

describe('manifest.json — Keyboard shortcut', () => {
  it('configures _execute_action command', () => {
    expect(manifest.commands).toBeDefined()
    expect(manifest.commands._execute_action).toBeDefined()
  })

  it('has a Mac shortcut', () => {
    expect(manifest.commands._execute_action.suggested_key.mac).toBeTruthy()
  })

  it('has a default shortcut', () => {
    expect(manifest.commands._execute_action.suggested_key.default).toBeTruthy()
  })

  it('Mac shortcut uses Command', () => {
    expect(manifest.commands._execute_action.suggested_key.mac).toContain('Command')
  })
})
