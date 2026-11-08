# PowerSearch — Architecture

## Overview
PowerSearch is a Chrome Manifest V3 extension that performs local full-text search across open tabs and browser history.

## Tech Stack
- Runtime: Chrome Manifest V3
- UI: Preact + TypeScript
- Build: Vite + CRXJS
- Storage: `chrome.storage.local` and `chrome.storage.session`

## Source Layout
```
extension/
  src/
    background/
      service-worker.ts
      error-logger.ts
      history-search.ts
      licensing.ts
      search-engine.ts
      storage.ts
      tab-indexer.ts
    content/
      content-script.ts
    onboarding/
      Onboarding.tsx
      index.tsx
      index.html
      onboarding.css
    popup/
      App.tsx
      hooks.ts
      index.tsx
      index.html
      components/
        Autocomplete.tsx
        FilterBar.tsx
        HistoryGroup.tsx
        RecentSearches.tsx
        ResultsPanel.tsx
        SearchBar.tsx
        SettingsPanel.tsx
        TabGroup.tsx
        TabResult.tsx
      styles/
        themes.css
    platform.ts
    types.ts
```

## Security Properties
- Tab contents and search queries stay local to the browser profile.
- Indexed page text is capped to reduce memory and storage pressure on very large pages.

## Search Flow
1. Popup sends `SEARCH_START` over a long-lived port.
2. Service worker loads enforced settings.
3. Tab text is extracted, normalized, and cached in session storage.
4. Results stream back to the popup in batches.

## Documentation Set
- Privacy Policy: [chrome-store-docs/PRIVACY_POLICY.md](chrome-store-docs/PRIVACY_POLICY.md)
- Support: [chrome-store-docs/SUPPORT.md](chrome-store-docs/SUPPORT.md)
- Terms: [chrome-store-docs/TERMS_AND_CONDITIONS.md](chrome-store-docs/TERMS_AND_CONDITIONS.md)

### Pin / Unpin search

```
User clicks ☆ on a recent query  →  App.tsx sends PIN_SEARCH { query }
  → service-worker.ts: pinSearch(query) → chrome.storage.local pinnedSearches[]
User clicks ★ on a pinned query  →  App.tsx sends UNPIN_SEARCH { query }
  → service-worker.ts: unpinSearch(query) → removes from pinnedSearches[]
Panel mount / GET_RECENT response includes { searches, clicks, pinned }
  → RecentSearches renders Pinned section above recents
```

### Navigation (clicking a match or pressing ‹/›)

```
User clicks snippet row OR presses ‹ / ›
  → SiteGroup: setCursor(flatIndex); sendMessage NAVIGATE_TO_MATCH
  → service-worker.ts: handleNavigateToMatch()
      ├─ chrome.windows.update(focused) + chrome.tabs.update(active)
      ├─ pushRecentClick(url, title, query)
      ├─ getSettings() → reads highlightColor + caseSensitive
      ├─ HIGHLIGHT_PRESETS[color] → resolves dark/light color values
      └─ executeScript allFrames (colors passed as args):
           ├─ inject <style id="powersearch-hl-style"> (configurable highlight color)
           ├─ remove old <mark class="powersearch-hl"> nodes
           ├─ gatherNodes(): TreeWalker + shadow DOM recursion → text nodes
           ├─ wrap matching text in <mark class="powersearch-hl"> (respects caseSensitive)
           ├─ mark[matchIndex].classList.add("powersearch-hl-active")
           ├─ scrollIntoView()
           └─ inject #powersearch-nav-overlay (↑/↓/✕ floating overlay)
  → TabResult: activeRef.scrollIntoView() in side panel
  → SiteGroup cursor state kept in sync for subsequent ‹/›
```

### Keyboard navigation

```
User presses ArrowDown while search bar is focused
  → SearchBar calls onNavigateResults()
  → App.tsx focuses first .powersearch-site__toggle (first group header button)
User presses ArrowDown / ArrowUp inside results container
  → App.tsx handleResultsKeyDown:
      querySelectorAll('.powersearch-site__toggle') → array of focusable headers
      moves focus forward/backward through the array
User presses ArrowDown / ArrowUp while a group header is focused
  → same handler cycles through headers; wraps at ends
```

### Auto-focus search bar

```
User opens side panel (Ctrl+Shift+F or extension icon click)
  → window 'focus' event fires inside the side panel iframe
  → SearchBar useEffect listener: inputRef.current.focus()
```

### Highlight cleanup

```
Side panel closes
  → Port.onDisconnect fires in service-worker
  → handleClearResults():
       clearActiveResults() (session storage)
       for each tab: executeScript → remove .powersearch-hl marks,
                                      remove #powersearch-hl-style,
                                      remove #powersearch-nav-overlay

User presses clear / new search starts
  → App.tsx sends CLEAR_RESULTS message → same handleClearResults()
```

---

## Key modules

### `platform.ts`

- **OS detection** — `getOS()`: macOS / Windows / Linux / ChromeOS via `navigator.userAgentData` (modern) + `navigator.platform` fallback. Cached after first call.
- **Browser detection** — `getBrowser()`: Chrome / Edge / Brave / Opera / Vivaldi via UA string + Brave API
- **Shortcut helpers** — `getActionShortcut()` queries `chrome.commands.getAll()` for real user-configured binding; `formatShortcut()` converts to Mac symbols (⌘⇧F) or Windows text (Ctrl+Shift+F)
- **Feature guards** — `hasSidePanelAPI()`, `hasIdleAPI()` for safe cross-browser API usage
- **Shortcuts URL** — `getShortcutsUrl()` returns browser-specific `chrome://extensions/shortcuts` (or `edge://`, `brave://`, etc.)

### `service-worker.ts`

- Single long-lived Port per popup instance (`activePort`)
- `AbortController` per search (`activeAbortController`) — cancelled on new search or disconnect
- `safeSend()` helper — wraps `port.postMessage`, returns false if port is dead
- Zero-tab fast path — sends `done:true` immediately if no searchable tabs
- Entire `runSearch` wrapped in try/catch — always sends `done:true` to stop spinner
- `handleClearResults` uses `executeScript` (not `sendMessage`) so highlights are removed even when the content script is not loaded
- `runSearch(query, scope)` — reads `Settings` at start; passes `caseSensitive`, `maxMatchesPerTab`, `matchWholeWord` to `exactSearch()`; passes `historyResultsLimit` to `searchHistory()`
- `handleNavigateToMatch()` — reads `highlightColor` from settings, resolves `HIGHLIGHT_PRESETS`, passes 6 color strings + `caseSensitive` as args to `executeScript`
- `chrome.sidePanel.setPanelBehavior()` wrapped in feature guard for non-Chrome browsers
- Handles `PIN_SEARCH` / `UNPIN_SEARCH` messages via `pinSearch()` / `unpinSearch()`

### `error-logger.ts`

- Centralized error logging system for troubleshooting customer issues
- `logEvent(context, message, level, details?)` — logs events with timestamp; supports `'info'`, `'warning'`, `'error'` levels
- Stores up to 100 most recent log entries in `chrome.storage.local`
- Errors and warnings are also printed to console for development visibility
- `getStoredLogs()` — retrieves all stored logs for user reporting
- `clearLogs()` — clears stored logs after user submits a report
- `formatLogsForReport(logs)` — formats logs as human-readable text for bug reports

### `history-search.ts`

- Searches browser history using `chrome.history.search()`
- `searchHistory(query, limit)` — searches history with configurable result limit
- Returns history results in chronological order with `lastVisitTime`
- Designed to be called during main search to include historical matches alongside open tab results
- Results are streamed back to the popup via the port message stream

### `search-engine.ts`

- `exactSearch(text, query, options?)` — `indexOf` loop with configurable:
  - `caseSensitive` (default false) — skips `.toLowerCase()` when true
  - `maxMatches` (default 1000) — 0 = no limit
  - `matchWholeWord` (default false) — rejects matches mid-word using `\w` boundary check
- `CONTEXT_CHARS = 100` — chars of context either side of each match
- `fuzzySearch` / `bitapSearch` exist as dead code (removed from import)

### `tab-indexer.ts`

- Listens to `tabs.onActivated` and `tabs.onUpdated(complete)` — queues tab for indexing
- Drains queue during `chrome.idle` state (every 30 s); **guarded** — falls back to `setInterval` on browsers without `chrome.idle`
- Queue capped at 50 entries (LRU drop)
- TTL: 5 minutes. Cache invalidated on `tabs.onRemoved`
- `isSearchableUrl()` — blocks `chrome://`, `edge://`, `brave://`, `vivaldi://`, `opera://`, `devtools://`, `chrome-extension://`, `about:` URLs

### `storage.ts`

- `chrome.storage.session` — cleared on browser restart
  - `activeQuery` / `activeResults` — last search result (restores on panel reopen)
  - `tabCache:<tabId>` — extracted text per tab (LRU, max 50 entries)
- `chrome.storage.local` — persists across restarts
  - `recentSearches` — last 5 queries
  - `recentClicks` — last 5 navigated results (`{ url, title, query, timestamp }`)
  - `pinnedSearches` — unlimited pinned queries
  - `settings` — user preferences (merged with `DEFAULT_SETTINGS` on read for forward-compat)
- Settings functions: `getSettings()`, `saveSettings(settings)`

### `App.tsx`

- `connectPort()` — creates Port, registers message handler; on `onDisconnect`:
  - If state = `searching` → sets state to `done` (stops spinner)
  - `setTimeout(connectPort, 200)` — auto-reconnects after service worker restart
- `appStateRef` — keeps disconnect handler in sync with current state (avoids stale closure)
- Session results restored from `chrome.storage.session` on mount
- **Settings state** — loads `Settings` from storage on mount; applies `defaultScope`; sets `data-theme` attribute on `<html>` for theme override
- **Settings panel** — `showSettings` boolean toggles between main UI and `<SettingsPanel />`
- `scope` state (`SearchScope`) — passed to `SEARCH_START`, `ResultsPanel`, and `SearchBar`
- `handleScopeChange(scope)` — updates scope state and re-fires search immediately
- `handleNavigateResults()` — focuses first `.powersearch-site__toggle` in results container
- `handleResultsKeyDown(e)` — ArrowUp/Down cycles keyboard focus across group headers
- `resultsContainerRef` — ref on results wrapper div for keyboard event delegation

### `SettingsPanel.tsx`

9 configurable settings with hover tooltips on every section:

| Setting | UI | Storage key |
|---|---|---|
| Keyboard shortcut | Current binding + "Change →" link (browser-aware URL) | — (links to browser settings) |
| Theme | System / Dark / Light pills | `settings.theme` |
| Default scope | All / Tabs / History pills | `settings.defaultScope` |
| Highlight color | 4 color swatches (Yellow/Blue/Green/Pink) | `settings.highlightColor` |
| Max matches per tab | 100 / 500 / 1000 / ∞ pills | `settings.maxMatchesPerTab` |
| History results | 25 / 50 / 100 / 200 pills | `settings.historyResultsLimit` |
| Case-sensitive | Toggle switch | `settings.caseSensitive` |
| Match whole word | Toggle switch | `settings.matchWholeWord` |
| Clear data | 3 buttons (Recent / Pinned / All) with confirm-on-click | — (deletes from storage) |

### `SearchBar.tsx`

- Two-row layout: `__row` (icon + input + clear + shortcut hint + ⚙️ gear) and `__scope` (scope pills)
- **OS-aware shortcut** — queries `chrome.commands.getAll()` on mount; Mac shows `⌘⇧F` (compact symbols), Windows shows individual `Ctrl` `Shift` `F` kbd elements
- **⚙️ Gear icon** — opens settings panel via `onOpenSettings` prop; separated by a vertical divider
- **Scope pills** — three toggle buttons: `All` / `Tabs` / `History`; active pill uses `--accent` background
- **Auto-focus** — `useEffect` attaches a `window` `'focus'` listener; fires `inputRef.current.focus()` whenever the side panel gains focus
- **ArrowDown** — calls `onNavigateResults()` prop to transfer keyboard focus into results

### `TabGroup.tsx` / `TabResult.tsx`

- `groupByOrigin()` — groups `TabSearchResult[]` by URL origin into `SiteGroup`
- `SiteGroup.cursor` — flat index across all matches in the site group
- **Window badge** — shows `Win N` badge when results span multiple windows
- **Match counter** — header shows `‹ {cursor+1}/{total} ›` between nav buttons
- **Sort / Collapse-all / Expand-all / Jump-to-tab** — section header toolbar
- **Copy snippet** — `TabResult` shows `⎘` button on hover; `✓` for 1.5 s after copy

### `HistoryGroup.tsx`

- `highlightText(text, query)` — splits text at case-insensitive query occurrences; wraps in `<mark>`

### `RecentSearches.tsx`

- **Empty state** — SVG illustration + helper text
- **Pinned section** — `★` chips above recents; star button unpins on click
- **Pin button** — `☆` on hover per recent chip; clicking pins the query

### `ResultsPanel.tsx`

- Accepts `scope: SearchScope` prop
- Renders `TabGroup` only when `scope !== 'history'`
- Renders `HistoryGroup` only when `scope !== 'tabs'`

### Text extraction walker (all three locations kept in sync)

All three walkers (service-worker extraction, tab-indexer, and highlight injection) apply identical filtering:
1. Skip `<script>`, `<style>`, `<noscript>` tags
2. Skip elements with `HTMLElement.hidden = true`
3. Skip elements with `display: none` or `visibility: hidden` via `getComputedStyle`
4. Recurse into `element.shadowRoot` for web components
5. `innerText` fallback for PDF viewer / XML / plain-text pages where DOM yields nothing

---

## Permissions

| Permission | Purpose |
|---|---|
| `tabs` | Read tab URL, title, favIconUrl; focus/activate tabs |
| `history` | `chrome.history.search` for history results |
| `storage` | Session cache + local recent data |
| `idle` | Background indexing during browser idle |
| `scripting` | `executeScript` for text extraction and highlight injection |
| `sidePanel` | Persistent side panel (stays open across tab switches) |
| `optional: <all_urls>` | Read tab page content; user-granted on onboarding |

---

---

## Shared types (`types.ts`)

```typescript
type SearchScope = 'all' | 'tabs' | 'history'
type ThemeMode = 'system' | 'dark' | 'light'
type HighlightColor = 'yellow' | 'blue' | 'green' | 'pink'

interface Settings {
  theme: ThemeMode
  defaultScope: SearchScope
  highlightColor: HighlightColor
  maxMatchesPerTab: number      // 100, 500, 1000, 0 (no limit)
  historyResultsLimit: number   // 25, 50, 100, 200
  caseSensitive: boolean
  matchWholeWord: boolean
}

interface HighlightPreset {
  bg: string; active: string; outline: string       // dark mode
  bgLight: string; activeLight: string; outlineLight: string  // light mode
}

const HIGHLIGHT_PRESETS: Record<HighlightColor, HighlightPreset>  // yellow, blue, green, pink
```

---

## Limitations

### Unsearchable page types

| Page type | Reason |
|---|---|
| `chrome://`, `edge://`, `brave://`, `vivaldi://`, `opera://` | Browser blocks scripting into privileged URLs |
| `chrome-extension://` pages | Extensions cannot inject into other extensions |
| `devtools://`, `chrome-search://`, `about:` | Internal browser pages |
| `file://` local files | Requires user to manually enable "Allow access to file URLs" |
| Chrome's native PDF viewer | Rendered by a separate extension process; cannot be injected |
| Pages opened before the `<all_urls>` permission was granted | Content script not present; re-injection happens on next tab activation |

### Search behaviour

- **Exact match only** — fuzzySearch code exists but is unused; no partial/typo matching
- **Match cap per tab** — default 1000, configurable via Settings (100 / 500 / 1000 / unlimited)
- **History results** — default 50, configurable via Settings (25 / 50 / 100 / 200)
- **Case-sensitive** and **match whole word** — both off by default, toggleable in Settings
- **5-minute text cache TTL** — rapidly changing pages may return stale match counts until cache expires

### Navigation

- **‹/› navigation is per site group** — if a query appears across tabs from different origins, each origin has its own independent cursor; there is no global prev/next across all origins
- **Match index alignment** — the in-page highlight walker and the extraction walker must stay identical. If a page uses unusual rendering (e.g. canvas-rendered text, server-side rendered images, custom font glyphs) those matches are invisible to both walkers equally, so counts stay consistent but results are absent
- **iFrame cross-origin** — `allFrames: true` injects into same-origin iframes only; cross-origin iframes (e.g. embedded third-party widgets) are blocked by Chrome

### Storage

- `chrome.storage.session` has a 10 MB quota shared across all session keys. For tabs with very large pages the text cache entries may push the session store near quota. When `setActiveResults` exceeds quota it throws silently, which means the panel cannot restore results after a service worker restart (a new search is needed)
- Recent searches/clicks capped at 5 entries each

### Service worker lifetime

- Chrome can terminate the MV3 service worker after ~30 s of inactivity. The Port disconnect handler auto-reconnects the popup (200 ms delay), but any in-flight search is lost and must be re-triggered manually

### Performance

- Pages with very large DOMs (100k+ nodes) may cause `executeScript` to take several seconds, making those tabs appear slow to return results
- `getComputedStyle` is called per text node's parent during highlight injection; on pages with thousands of matches this can briefly block the page's main thread
