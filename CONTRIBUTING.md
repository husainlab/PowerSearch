# Contributing to PowerSearch

Thank you for your interest in contributing to PowerSearch! We welcome contributions from everyone — whether you're reporting a bug, proposing a new feature, improving documentation, or submitting a pull request.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect and kindness.

---

## How Can I Contribute?

### 1. Reporting Bugs
Before submitting a bug report, please check existing [GitHub Issues](https://github.com/husain3012/PowerSearch/issues) to ensure the bug hasn't already been reported.

When opening a new bug report, please include:
- A clear, descriptive title.
- Operating system and browser version (e.g. macOS 14 Sonoma, Chrome 124).
- Exact steps to reproduce the behavior.
- Expected behavior versus actual behavior.
- Relevant console logs from `chrome://extensions` (Inspect background / popup).

### 2. Suggesting Enhancements
Feature requests are always appreciated! When suggesting an enhancement:
- Explain why this feature would be useful to most users.
- Describe how you envision the feature working.
- Note any potential impacts on privacy or browser performance.

### 3. Submitting Pull Requests
1. **Fork the repo** and clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/PowerSearch.git
   cd PowerSearch/extension
   ```
2. **Create a topic branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Make your changes**:
   - Write clean, maintainable, TypeScript-typed code.
   - Respect the 100% local, zero-telemetry architecture.
   - Follow existing formatting and style conventions.
5. **Run tests & verify the build**:
   ```bash
   npm test
   npm run build
   ```
   All existing and new tests must pass before a PR will be merged.
6. **Commit your changes**:
   Use clear, concise commit messages (e.g., `feat: add regex search support`, `fix: handle edge cases in shadow DOM traversal`).
7. **Push to your fork & open a PR**:
   Submit the pull request against the `main` branch. Fill out the pull request template completely.

---

## Development Guidelines

### Tech Stack
- **Runtime**: Chrome Manifest V3
- **Framework**: Preact + TypeScript
- **Bundler**: Vite + CRXJS
- **Test Runner**: Vitest

### Code Principles
- **Privacy First**: Never introduce external network calls, tracking, telemetry, or remote dependencies that transmit tab content or user search queries.
- **Performance**: Keep DOM text extraction lightweight. Avoid long main-thread blocking operations. Tab text extraction should always be capped to prevent memory pressure.
- **Cross-Browser Compatibility**: PowerSearch runs on Chromium-based browsers (Chrome, Edge, Brave, Opera, Vivaldi). Always use feature detection (e.g., `hasSidePanelAPI()`, `hasIdleAPI()`) before invoking browser-specific APIs.

---

## Need Help?

Feel free to open an issue or ask questions in your pull request. We're here to help!

