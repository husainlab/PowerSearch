/**
 * Build Artifact Validation — Zip Package Tests
 *
 * Verifies the production extension zip archive contains all required files,
 * valid Manifest V3 structure, correct loaders, no stale build artifacts,
 * and no development/internal files or leaked secrets.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT_DIR = resolve(__dirname, '../../..')
const EXTENSION_DIR = resolve(__dirname, '../..')
const manifestJson = JSON.parse(readFileSync(resolve(EXTENSION_DIR, 'manifest.json'), 'utf-8'))
const EXPECTED_ZIP_NAME = `tab-search-manager-powersearch-v${manifestJson.version}.zip`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let zipPath: string
let zipFiles: string[]
let manifest: any
let loaderContent: string
let activeServiceWorkerFile: string
let activeServiceWorkerContent: string

beforeAll(() => {
  // Check if expected zip exists in the project root; if not, build it automatically
  zipPath = resolve(ROOT_DIR, EXPECTED_ZIP_NAME)
  if (!existsSync(zipPath)) {
    execSync('npm run package', { cwd: EXTENSION_DIR, stdio: 'pipe' })
  }

  if (!existsSync(zipPath)) {
    throw new Error(
      `Package zip not found at ${zipPath}. Run "npm run package" first.`
    )
  }

  // List all files in the zip
  const listing = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf-8' })
  zipFiles = listing
    .split('\n')
    .filter((line) => line.match(/^\s+\d+/)) // lines starting with size
    .map((line) => line.replace(/^\s+\d+\s+\S+\s+\S+\s+/, '').trim())
    .filter((f) => f && !f.endsWith('/')) // exclude directories

  // Extract manifest.json
  manifest = JSON.parse(
    execSync(`unzip -p "${zipPath}" manifest.json`, { encoding: 'utf-8' })
  )

  // Extract service-worker-loader.js
  loaderContent = execSync(`unzip -p "${zipPath}" service-worker-loader.js`, {
    encoding: 'utf-8',
  }).trim()

  // Determine which service worker file the loader imports
  const importMatch = loaderContent.match(
    /import\s+['"]\.\/([^'"]+)['"]/
  )
  activeServiceWorkerFile = importMatch ? importMatch[1] : ''

  // Extract the active service worker content
  if (activeServiceWorkerFile) {
    activeServiceWorkerContent = execSync(
      `unzip -p "${zipPath}" "${activeServiceWorkerFile}"`,
      { encoding: 'utf-8' }
    )
  }
})

// =====================================================================
// Zip file exists and is valid
// =====================================================================

describe('zip — File Integrity', () => {
  it('zip file exists on disk', () => {
    expect(existsSync(zipPath)).toBe(true)
  })

  it('zip is a valid archive (unzip -t)', () => {
    const result = execSync(`unzip -t "${zipPath}" 2>&1`, {
      encoding: 'utf-8',
    })
    expect(result).toContain('No errors detected')
  })

  it('zip is not excessively large (< 5MB for a lightweight extension)', () => {
    const stat = execSync(`stat -f%z "${zipPath}"`, { encoding: 'utf-8' }).trim()
    const sizeBytes = parseInt(stat, 10)
    expect(sizeBytes).toBeLessThan(5 * 1024 * 1024)
  })
})

// =====================================================================
// Required files present
// =====================================================================

describe('zip — Required Files', () => {
  it('contains manifest.json', () => {
    expect(zipFiles).toContain('manifest.json')
  })

  it('contains service-worker-loader.js', () => {
    expect(zipFiles).toContain('service-worker-loader.js')
  })

  it('contains popup HTML', () => {
    expect(zipFiles).toContain('src/popup/index.html')
  })

  it('contains onboarding HTML', () => {
    expect(zipFiles).toContain('src/onboarding/index.html')
  })

  it('contains all required icon PNGs', () => {
    const requiredIcons = [
      'icons/icon-16.png',
      'icons/icon-32.png',
      'icons/icon-48.png',
      'icons/icon-128.png',
    ]
    for (const icon of requiredIcons) {
      expect(zipFiles).toContain(icon)
    }
  })

  it('contains at least one CSS file', () => {
    const cssFiles = zipFiles.filter((f) => f.endsWith('.css'))
    expect(cssFiles.length).toBeGreaterThanOrEqual(1)
  })

  it('contains a content script JS file', () => {
    const contentScripts = zipFiles.filter(
      (f) => f.includes('content-script') && f.endsWith('.js') && !f.endsWith('.map')
    )
    expect(contentScripts.length).toBeGreaterThanOrEqual(1)
  })

  it('contains the active service worker JS file', () => {
    expect(activeServiceWorkerFile).toBeTruthy()
    expect(zipFiles).toContain(activeServiceWorkerFile)
  })
})

// =====================================================================
// Manifest inside zip is correct
// =====================================================================

describe('zip — Manifest Validation', () => {
  it('manifest_version is 3', () => {
    expect(manifest.manifest_version).toBe(3)
  })

  it('version matches expected pattern', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('version matches project manifest.json', () => {
    expect(manifest.version).toBe(manifestJson.version)
  })

  it('background service_worker points to loader', () => {
    expect(manifest.background.service_worker).toBe('service-worker-loader.js')
  })

  it('all icons referenced in manifest exist in the zip', () => {
    for (const size of Object.values(manifest.icons) as string[]) {
      expect(zipFiles).toContain(size)
    }
  })

  it('popup HTML referenced in manifest exists in the zip', () => {
    expect(zipFiles).toContain(manifest.action.default_popup)
  })

  it('content script JS referenced in manifest exists in the zip', () => {
    for (const cs of manifest.content_scripts) {
      for (const jsFile of cs.js) {
        expect(zipFiles).toContain(jsFile)
      }
    }
  })

  it('side panel path referenced in manifest exists in the zip', () => {
    if (manifest.side_panel?.default_path) {
      expect(zipFiles).toContain(manifest.side_panel.default_path)
    }
  })
})

// =====================================================================
// Service worker loader → active worker chain
// =====================================================================

describe('zip — Service Worker Loader', () => {
  it('loader imports exactly one service worker file', () => {
    const imports = loaderContent.match(/import\s+['"][^'"]+['"]/g) || []
    expect(imports.length).toBe(1)
  })

  it('the imported service worker file exists in the zip', () => {
    expect(activeServiceWorkerFile).toBeTruthy()
    expect(zipFiles).toContain(activeServiceWorkerFile)
  })
})

// =====================================================================
// NO stale / old build artifacts
// =====================================================================

describe('zip — No Stale Build Artifacts', () => {
  it('only ONE service worker JS file exists (no old builds)', () => {
    const swFiles = zipFiles.filter(
      (f) =>
        f.includes('service-worker') &&
        f.endsWith('.js') &&
        !f.endsWith('.js.map') &&
        f !== 'service-worker-loader.js'
    )

    expect(swFiles).toHaveLength(1)
    expect(swFiles[0]).toBe(activeServiceWorkerFile)
  })

  it('only ONE popup JS bundle exists (no old builds)', () => {
    const popupFiles = zipFiles.filter(
      (f) =>
        f.match(/assets\/popup-.*\.js$/) && !f.endsWith('.js.map')
    )

    expect(popupFiles).toHaveLength(1)
  })

  it('only ONE popup CSS bundle exists', () => {
    const popupCss = zipFiles.filter(
      (f) => f.match(/assets\/popup-.*\.css$/)
    )

    expect(popupCss).toHaveLength(1)
  })

  it('only ONE onboarding JS bundle exists', () => {
    const onboardingFiles = zipFiles.filter(
      (f) =>
        f.match(/assets\/onboarding-.*\.js$/) && !f.endsWith('.js.map')
    )

    expect(onboardingFiles).toHaveLength(1)
  })

  it('only ONE content script JS exists', () => {
    const contentScripts = zipFiles.filter(
      (f) =>
        f.includes('content-script') && f.endsWith('.js') && !f.endsWith('.js.map')
    )

    expect(contentScripts).toHaveLength(1)
  })

  it('source map count matches JS file count', () => {
    const jsFiles = zipFiles.filter(
      (f) => f.startsWith('assets/') && f.endsWith('.js') && !f.endsWith('.js.map')
    )
    const mapFiles = zipFiles.filter((f) => f.endsWith('.js.map') && !f.includes('crx-manifest'))

    // Each JS file should have exactly one .map file
    expect(mapFiles.length).toBe(jsFiles.length)
  })
})

// =====================================================================
// No dev / internal files leaked
// =====================================================================

describe('zip — No Development Files', () => {
  it('no .ts source files (only compiled .js)', () => {
    const tsFiles = zipFiles.filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.d.ts')
    )
    expect(tsFiles).toHaveLength(0)
  })

  it('no .tsx source files', () => {
    const tsxFiles = zipFiles.filter((f) => f.endsWith('.tsx'))
    expect(tsxFiles).toHaveLength(0)
  })

  it('no node_modules', () => {
    const nodeModules = zipFiles.filter((f) => f.includes('node_modules'))
    expect(nodeModules).toHaveLength(0)
  })

  it('no package.json', () => {
    expect(zipFiles).not.toContain('package.json')
  })

  it('no package-lock.json', () => {
    expect(zipFiles).not.toContain('package-lock.json')
  })

  it('no tsconfig.json', () => {
    expect(zipFiles).not.toContain('tsconfig.json')
  })

  it('no vite.config.ts', () => {
    expect(zipFiles).not.toContain('vite.config.ts')
  })

  it('no vitest.config.ts', () => {
    expect(zipFiles).not.toContain('vitest.config.ts')
  })

  it('no .DS_Store files', () => {
    const dsStore = zipFiles.filter((f) => f.includes('.DS_Store'))
    expect(dsStore).toHaveLength(0)
  })

  it('no .git files or directories', () => {
    const gitFiles = zipFiles.filter(
      (f) => f.includes('.git') && !f.includes('.github')
    )
    expect(gitFiles).toHaveLength(0)
  })

  it('no test files', () => {
    const testFiles = zipFiles.filter(
      (f) => f.includes('.test.') || f.includes('__test__') || f.includes('/tests/')
    )
    expect(testFiles).toHaveLength(0)
  })

  it('no README or CHANGELOG', () => {
    const docs = zipFiles.filter(
      (f) =>
        f.toLowerCase().includes('readme') ||
        f.toLowerCase().includes('changelog') ||
        f.toLowerCase().includes('license')
    )
    expect(docs).toHaveLength(0)
  })

  it('no .env files', () => {
    const envFiles = zipFiles.filter((f) => f.includes('.env'))
    expect(envFiles).toHaveLength(0)
  })
})
