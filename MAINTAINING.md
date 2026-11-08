# PowerSearch — Maintainer & Release Guide

Comprehensive guide for local development, packaging, Chrome Web Store submission, and troubleshooting for PowerSearch maintainers.

---

## Table of Contents

1. [Local Development](#local-development)
2. [Building & Packaging](#building--packaging)
3. [Chrome Web Store Submission](#chrome-web-store-submission)
4. [Permissions & Privacy Justifications](#permissions--privacy-justifications)
5. [Testing & Quality Assurance](#testing--quality-assurance)
6. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Local Development

### Prerequisites
- Node.js 18+ (tested on Node 18, 20, 22)
- npm 9+
- Google Chrome, Microsoft Edge, or any modern Chromium-based browser

### Setup
```bash
# Clone the repository
git clone https://github.com/husain3012/PowerSearch.git
cd PowerSearch/extension

# Install dependencies
npm install

# Start Vite in development mode (with HMR)
npm run dev
```

### Loading Unpacked in Chrome
1. Navigate to `chrome://extensions/` in your browser.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `PowerSearch/extension/dist` directory (run `npm run build` first if not yet generated).
5. The extension icon will appear in your browser toolbar.

---

## Building & Packaging

### Production Build
```bash
cd extension
npm run build
```
Compiled output is written to `extension/dist/`.

### Creating a Release Package
```bash
cd extension
npm run package
```
This script:
1. Cleans previous `dist/` artifacts.
2. Compiles a production bundle with minification and sourcemaps.
3. Compresses the contents of `dist/` into `tab-search-manager-powersearch-v<VERSION>.zip` at the repository root.

### Bumping Version
When preparing a new release:
1. Update `"version"` in `extension/manifest.json`.
2. Update `"version"` in `extension/package.json`.
3. Update version in `package.json` package script if needed.
4. Run tests:
   ```bash
   npm test
   ```
5. Run package:
   ```bash
   npm run package
   ```
6. Commit changes and tag the release:
   ```bash
   git tag v1.0.X
   git push origin main --tags
   ```

---

## Chrome Web Store Submission

### Prerequisites
- Chrome Web Store Developer Account (one-time $5 registration fee)
- Production ZIP package generated via `npm run package`
- Promotional assets:
  - 128×128 icon (available in `extension/public/icons/icon-128.png`)
  - Screenshots (1280×800 or 640×400)
  - Optional: Small promo tile (440×280) and Marquee promo tile (1400×560)

### Step-by-Step Submission
1. Log in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click **Add New Item** or select your existing item.
3. Upload the latest `tab-search-manager-powersearch-v<VERSION>.zip`.
4. Fill in Store Listing Details:
   - **Product Title**: `PowerSearch — Tab Search, History Search & Tab Manager`
   - **Summary** (132 chars): `Instantly search all open tabs and browser history with one shortcut. Find any tab in seconds. Privacy-first, no login required.`
   - **Category**: Search Tools / Productivity
   - **Privacy Policy URL**: Link to `chrome-store-docs/PRIVACY_POLICY.md` or published page.
   - **Support URL**: Link to GitHub Issues or `chrome-store-docs/SUPPORT.md`.
5. Complete the **Privacy Practices** questionnaire (see justifications below).
6. Click **Submit for review**. Reviews typically take 1–3 business days.

---

## Permissions & Privacy Justifications

Chrome Web Store reviewers require justifications for declared permissions:

| Permission | Purpose & Reviewer Justification |
|---|---|
| `tabs` | Required to query open tabs, read tab URLs/titles/favicons, and activate/focus tabs when a user selects a search result. |
| `history` | Required to search browser history via `chrome.history.search` when the user selects the "All" or "History" search scope. |
| `storage` | Required to store user settings (theme, highlight color, open mode, max matches) and recent/pinned queries locally. |
| `idle` | Required to detect browser idle periods to index inactive tabs without degrading page performance. |
| `scripting` | Required to inject the text extraction walker and match highlight styles into tabs. |
| `sidePanel` | Required to provide the persistent side panel experience in Chrome 114+. |
| `contextMenus` | Required to add the "Search in PowerSearch" right-click action on selected text. |
| `<all_urls>` (optional host) | Required to extract visible text from open web pages for local search. User explicitly grants this during onboarding. All text processing occurs strictly inside the local browser profile. |

---

## Testing & Quality Assurance

### Automated Tests
Run unit and integration tests with Vitest:
```bash
cd extension

# Run all test suites
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Manual QA Checklist
Before uploading to the Chrome Web Store:
- [ ] Fresh installation opens onboarding page (`src/onboarding/index.html`).
- [ ] Granting tab permissions immediately allows search across tabs.
- [ ] Keyboard shortcut (`Ctrl+Shift+F` on Windows/Linux, `Cmd+Shift+F` on Mac) opens search bar.
- [ ] Tab search finds text across multiple open tabs and frames.
- [ ] History search retrieves matching history entries.
- [ ] Scope switching (`All`, `Tabs`, `History`) filters results immediately.
- [ ] Clicking a match navigates to the tab and smoothly scrolls to the highlighted term.
- [ ] Match colors match selected color preset in Settings (Yellow, Blue, Green, Pink).
- [ ] Switching between Dark, Light, and System themes renders cleanly.
- [ ] Switching between Floating Popup and Sidebar mode works reliably.
- [ ] Right-click "Search in PowerSearch" populates search bar with selected text.
- [ ] Pinning and unpinning searches persists across sessions.
- [ ] Clearing recent data removes data from local storage.

---

## Troubleshooting & FAQ

### Service Worker Lifecycle
MV3 service workers terminate after ~30 seconds of inactivity. PowerSearch manages this via:
- Long-lived Port connection with automatic reconnection on disconnect (`setTimeout(connectPort, 200)`).
- Session storage cache (`chrome.storage.session`) so state restores immediately upon reconnection.

### Keyboard Shortcut Conflicts
If `Ctrl+Shift+F` or `Cmd+Shift+F` conflicts with another extension or OS shortcut:
1. Direct the user to `chrome://extensions/shortcuts` (or click "Change →" in PowerSearch Settings).
2. Rebind to an alternate key combination (e.g. `Alt+Shift+F`).

