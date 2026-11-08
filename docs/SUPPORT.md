# PowerSearch Support

## Getting Help

If you run into an issue, find a bug, or have a feature request:

1. **GitHub Issues**: Open an issue on [GitHub Issues](https://github.com/husain3012/PowerSearch/issues). This is the fastest way to get help, track bugs, and discuss enhancements.
2. **Email Support**: You can also contact the developer directly at `husainlabwork@gmail.com`.

## When Reporting an Issue

To help diagnose and fix problems quickly, please include:

1. Your operating system (e.g., macOS 14 Sonoma, Windows 11, Ubuntu 22.04).
2. Your browser and version (e.g., Chrome 124, Edge 124, Brave 1.65).
3. The exact steps to reproduce the issue.
4. What you expected to happen versus what actually happened.
5. Any console error messages:
   - Go to `chrome://extensions`
   - Enable **Developer mode** (top right toggle)
   - Click **Inspect views: service worker** or inspect the popup to check for console errors.

## Frequently Asked Questions

### Q: Why does PowerSearch request permission to read page content?
PowerSearch performs real-time, local full-text search across all your open tabs. To locate text matches across tab bodies and highlight them when you click a result, the extension requires host access (`<all_urls>`).

**All search queries, tab contents, and browsing history stay 100% local to your device.** Nothing is ever transmitted to remote servers.

### Q: Why can't PowerSearch search internal browser pages?
Chromium security policies prevent extensions from injecting scripts into privileged browser URLs (such as `chrome://`, `edge://`, `brave://`, `about:`, Chrome Web Store pages, and the native Chrome PDF viewer).

### Q: How do I change or assign the keyboard shortcut?
You can customize the shortcut anytime:
- **Chrome**: Open `chrome://extensions/shortcuts`
- **Edge**: Open `edge://extensions/shortcuts`
- **Brave**: Open `brave://extensions/shortcuts`

Find **PowerSearch** and click the pencil icon next to **Open PowerSearch** to assign your desired key combination (default: `Ctrl+Shift+F` on Windows/Linux or `Command+Shift+F` on macOS).

### Q: How do I toggle between Floating Popup Mode and Sidebar Mode?
Open the PowerSearch Settings panel (gear icon in the top right of the search bar) and select your preferred **Open Mode**:
- **Floating Popup**: Fast and keyboard-friendly. Opens as a popup, navigates to results, and closes automatically.
- **Sidebar (Side Panel)**: Persistent side panel that remains open alongside web pages while you browse and switch between tabs.

### Q: How does local caching work?
Extracted page text is cached in browser session storage with an LRU limit of 50 tabs and a 5-minute TTL. The cache is automatically cleared when a tab is closed or when the browser restarts.
