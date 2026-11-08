import { useState, useEffect } from 'preact/hooks'
import { isMac } from '../platform'

type Step = 'intro' | 'requesting' | 'granted' | 'denied'

export function Onboarding() {
  const [step, setStep] = useState<Step>('intro')

  // Check if permission was already granted
  useEffect(() => {
    chrome.permissions.contains({ origins: ['<all_urls>'] }).then(granted => {
      if (granted) setStep('granted')
    })
  }, [])

  async function requestPermission() {
    setStep('requesting')
    try {
      const granted = await chrome.permissions.request({ origins: ['<all_urls>'] })
      setStep(granted ? 'granted' : 'denied')
    } catch {
      setStep('denied')
    }
  }

  return (
    <div class="ob-shell">
      <div class="ob-card">
        {/* Logo */}
        <div class="ob-logo">
          <svg class="ob-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7" fill="#22C55E"/>
            <line x1="10" y1="6.5" x2="10" y2="13.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <line x1="6.5" y1="10" x2="13.5" y2="10" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <line x1="15.5" y1="15.5" x2="21.5" y2="21.5" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span class="ob-wordmark">PowerSearch</span>
        </div>

        {step === 'intro' && <IntroStep onGrant={requestPermission} />}
        {step === 'requesting' && <RequestingStep />}
        {step === 'granted' && <GrantedStep />}
        {step === 'denied' && <DeniedStep onRetry={requestPermission} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** The modifier key label for the current OS */
function modifierKey(): string {
  return isMac() ? '⌘' : 'Ctrl'
}

/** Readable shortcut string for inline text */
function shortcutInline(): string {
  return isMac() ? '⌘+Shift+F' : 'Ctrl+Shift+F'
}

function IntroStep({ onGrant }: { onGrant: () => void }) {
  return (
    <>
      <h1 class="ob-headline">
        Search every open tab.
        <br />
        <em class="ob-headline-em">One shortcut.</em>
      </h1>

      <p class="ob-body">
        PowerSearch searches the text of every tab you have open — simultaneously —
        and checks your browser history too. To do that, it needs permission to
        read the content of your tabs.
      </p>

      <button class="ob-btn ob-btn--primary" onClick={onGrant} style={{ marginBottom: '1.5rem' }}>
        Allow access to tabs
      </button>

      <div class="ob-shortcut-hint" style={{ marginBottom: '1.5rem' }}>
        After granting — press <kbd class="ob-kbd">{shortcutInline()}</kbd> to open PowerSearch
      </div>

      <div class="ob-note" style={{ marginBottom: '1.5rem' }}>
        Chrome will show a system dialog asking to &ldquo;Read and change all your
        data on all websites.&rdquo; This is standard for any extension that reads tab content.
        PowerSearch only reads — it never modifies anything.
      </div>

      {/* Privacy & Security */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '1rem 0 0.75rem 0', color: 'var(--color-text-primary)', fontSize: '0.9rem', fontWeight: '600' }}>🔒 Privacy & Security</h3>
        <div class="ob-permission-box">
          <div class="ob-permission-row ob-permission-row--yes">
            <span class="ob-permission-bullet ob-permission-bullet--yes">✓</span>
            <span>Read text in open tabs and browser history</span>
          </div>
          <div class="ob-permission-row ob-permission-row--yes">
            <span class="ob-permission-bullet ob-permission-bullet--yes">✓</span>
            <span><strong>Tab text and search results stay on your device</strong> — nothing is ever sent to external servers</span>
          </div>
          <div class="ob-permission-row ob-permission-row--yes">
            <span class="ob-permission-bullet ob-permission-bullet--yes">✓</span>
            <span>No analytics, no telemetry, no sale of browsing data</span>
          </div>
          <div class="ob-permission-row ob-permission-row--no">
            <span class="ob-permission-bullet ob-permission-bullet--no">✕</span>
            <span>Never modifies pages, and never uploads tab contents or search queries to our servers</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-text-primary)', fontSize: '0.9rem', fontWeight: '600' }}>✨ Features</h3>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
          <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Search all open tabs + browser history simultaneously</span></li>
          <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Pin/save your favorite searches for quick access</span></li>
          <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Auto-complete from recent searches as you type</span></li>
          <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Filter results by domain and date range</span></li>
          <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Right-click context menu: search selected text instantly</span></li>
          <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Light/dark theme support</span></li>
          <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Two modes: popup or sidebar panel</span></li>
        </ul>
      </div>

      {/* How It Works */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-text-primary)', fontSize: '0.9rem', fontWeight: '600' }}>⚡ Quick Start</h3>
        <div style={{ background: 'var(--color-surface-raised)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
          <p style={{ margin: '0 0 0.75rem 0' }}><strong>Popup Mode (default):</strong> Press {shortcutInline()} to open. Search → click result → extension closes. Open again and your last search remains until you clear it.</p>
          <p style={{ margin: '0 0 0.75rem 0' }}><strong>Sidebar Mode:</strong> Click the extension icon to open as a sidebar panel. Persistent while you browse.</p>
          <p style={{ margin: '0' }}><strong>Right-Click Menu:</strong> Highlight any text, right-click → "Search in PowerSearch" to instantly search.</p>
        </div>
      </div>

      {/* Limitations */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-text-primary)', fontSize: '0.9rem', fontWeight: '600' }}>⚠️ Limitations (Due to Browser Restrictions)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-primary)', fontSize: '0.85rem', fontWeight: '500' }}>🔑 Key Shortcut</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>On MAC systems, the keyboard shortcut needs to be assigned after first setup via Chrome settings.</span></li>
            </ul>
          </div>
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-primary)', fontSize: '0.85rem', fontWeight: '500' }}>📌 Sidebar Mode</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Cursor is not auto-focused on the search bar. You need to click on the search bar to start typing.</span></li>
              <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>Right-click menu ("Search in PowerSearch") does not auto-open the sidebar. You must manually open it via shortcut or extension menu, then the selected text will be pre-filled and ready to search.</span></li>
            </ul>
          </div>

          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-primary)', fontSize: '0.85rem', fontWeight: '500' }}>💬 Popup Mode</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem' }}><span>•</span><span>When you click on a search result, the popup closes. However, when you open the extension again, your previous search query and results will still be there until you manually clear the search bar.</span></li>
            </ul>
          </div>

        </div>
      </div>
    </>
  )
}

function RequestingStep() {
  return (
    <div class="ob-state-center">
      <div class="ob-spinner" aria-label="Waiting for permission dialog…" />
      <p class="ob-state-label">Waiting for your response…</p>
    </div>
  )
}

function GrantedStep() {
  const mod = modifierKey()

  return (
    <div class="ob-state-center">
      <div class="ob-check-circle" aria-hidden="true">✓</div>
      <h2 class="ob-state-headline">Access granted.</h2>
      <p class="ob-state-body">
        PowerSearch can now search all your open tabs and history.
      </p>

      <div class="ob-shortcut-display" style={{ marginBottom: '1.5rem' }}>
        <kbd class="ob-kbd ob-kbd--large">{mod}</kbd>
        <span class="ob-kbd-plus">+</span>
        <kbd class="ob-kbd ob-kbd--large">Shift</kbd>
        <span class="ob-kbd-plus">+</span>
        <kbd class="ob-kbd ob-kbd--large">F</kbd>
      </div>

      {/* Usage Flows */}
      <div style={{ textAlign: 'left', background: 'var(--color-surface-raised)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', width: '100%', border: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>How to Use</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>1. Quick Search (Popup)</h4>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-secondary)' }}>Press {shortcutInline()} → Type your query → Click a result → Extension closes. Open again and your search history is still there until you clear it.</p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>2. Sidebar Search</h4>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-secondary)' }}>Click the extension icon → Opens as a persistent sidebar. Click on the search bar to start typing. Sidebar stays open while you browse and switch tabs.</p>
        </div>

        <div style={{ marginBottom: '0' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>3. Right-Click Search</h4>
          <p style={{ margin: '0', color: 'var(--color-text-secondary)' }}>Highlight any text → Right-click → "Search in PowerSearch". You'll need to open the extension manually (only on sidebar mode), but your selected text will be pre-filled and ready to search.</p>
        </div>
      </div>
      
      {/* Keyboard Shortcuts */}
      <div style={{ textAlign: 'left', background: 'var(--color-surface-raised)', padding: '1rem', borderRadius: '8px', fontSize: '0.875rem', width: '100%', border: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>Keyboard Shortcuts</h3>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--color-text-secondary)' }}>
          <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Open PowerSearch</span> <kbd class="ob-kbd">{mod}+Shift+F</kbd></li>
          <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Navigate Results</span> <span><kbd class="ob-kbd">↓</kbd> <kbd class="ob-kbd">↑</kbd></span></li>
          <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Copy Result Snippet</span> <kbd class="ob-kbd">{mod}+C</kbd></li>
          <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pin / Unpin Search</span> <kbd class="ob-kbd">★</kbd></li>
          <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Clear Search</span> <span>Click <span style={{fontSize: '0.8rem'}}>✕</span></span></li>
        </ul>
      </div>

      <button
        class="ob-btn ob-btn--ghost"
        onClick={() => window.close()}
      >
        Close this tab
      </button>
    </div>
  )
}


function DeniedStep({ onRetry }: { onRetry: () => void }) {
  return (
    <div class="ob-state-center">
      <div class="ob-x-circle" aria-hidden="true">✕</div>
      <h2 class="ob-state-headline">Permission not granted.</h2>
      <p class="ob-state-body">
        Without access to tab content, PowerSearch can still search your browser
        history — but not the text inside open tabs.
      </p>
      <p class="ob-state-body" style={{ marginTop: '0.5rem' }}>
        You can grant access at any time from{' '}
        <code class="ob-inline-code">chrome://extensions</code> → PowerSearch → Details → Site access.
      </p>
      <button class="ob-btn ob-btn--primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

