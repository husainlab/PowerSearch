# PowerSearch Privacy Policy

Last Updated: May 12, 2026

## Overview
PowerSearch is an open-source browser extension that searches your open tabs and browser history locally inside your browser. We designed the extension so that tab contents, search queries, and browsing history results stay strictly on your device.

## Data We Access
PowerSearch requests the following browser permissions:
- `tabs`: To list open tabs and focus or switch to the selected tab.
- `history`: To search your browser history when you choose the history or all search scope.
- `<all_urls>` (optional host permission): To read visible DOM text from open tabs so local full-text search and match highlighting work.
- `storage`: To store settings, recent searches, and pinned searches locally.
- `sidePanel`: To support the persistent side panel experience in supported Chromium browsers.
- `contextMenus`: To support searching selected text directly from the right-click menu.
- `idle`: To opportunistically index inactive open tabs in the background without affecting browser responsiveness.

## Data That Stays Local
The following data is processed and stored locally in your browser profile and is never transmitted to us or any third party:
- Extracted tab text used for local search.
- Search queries.
- Search results and match snippets.
- Recent searches and recent clicks.
- Pinned searches.
- Visual preferences and configuration settings.

## Third Parties & Telemetry
- We do **not** collect personal data.
- We do **not** use analytics SDKs, ad trackers, telemetry, or behavioral profiling tools.
- We do **not** transmit tab contents, browsing history, or search queries to remote servers.
- No data is sold, rented, or shared with third parties.

## Data Retention
Local extension data remains stored in your browser profile until you clear it via the extension settings panel (`Clear data`) or remove the extension from your browser.

## Open Source
PowerSearch is open-source software licensed under the MIT License. You can review the complete source code and verify our privacy and security properties on [GitHub](https://github.com/husain3012/PowerSearch).

## Contact
For privacy questions, support requests, or security inquiries, please open an issue on the [GitHub repository](https://github.com/husain3012/PowerSearch/issues) or contact `husainlabwork@gmail.com`.
