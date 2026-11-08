// Content script — injected via optional host permission grant or auto-injected
// once permission is approved. Guard against duplicate injection.
// Purely message-driven. No initialization side effects.

// Idempotency guard — safe to inject multiple times
export {}
declare global {
  interface Window { __POWERSEARCH_INJECTED__?: boolean }
}
if (window.__POWERSEARCH_INJECTED__) {
  // Already running — do nothing.
} else {
  window.__POWERSEARCH_INJECTED__ = true

  // Rest of the script is executed inside this block to avoid re-running on duplicate injection.

const HIGHLIGHT_CLASS = 'powersearch-hl'
const HIGHLIGHT_ACTIVE_CLASS = 'powersearch-hl-active'
const MAX_TEXT_BYTES = 500_000

let currentMatchIndex = 0
let totalMatches = 0

// ---------------------------------------------------------------------------
// Auto-Prime Cache
// ---------------------------------------------------------------------------
function primeCache() {
  // Idle callback so we don't impact page load performance
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => doPrimeCache(), { timeout: 2000 })
  } else {
    setTimeout(doPrimeCache, 1000)
  }
}

function doPrimeCache() {
  try {
    const text = extractPageText()
    if (text) {
      chrome.runtime.sendMessage({ type: 'PRIME_CACHE', text }).catch(() => {})
    }
  } catch (e) {
    // Ignore extraction errors
  }
}

if (document.readyState === 'complete') {
  primeCache()
} else {
  window.addEventListener('load', primeCache)
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'PING': {
      sendResponse({ alive: true })
      return false
    }

    case 'EXTRACT_TEXT': {
      const text = extractPageText()
      sendResponse({ text })
      return false
    }

    case 'HIGHLIGHT_AND_SCROLL': {
      highlightAndScroll(msg.query as string, msg.matchIndex as number)
      sendResponse({ ok: true })
      return false
    }

    case 'NAVIGATE_MATCH': {
      navigateMatch(msg.direction as 'prev' | 'next')
      sendResponse({ ok: true })
      return false
    }

    case 'REMOVE_HIGHLIGHTS': {
      removeHighlights()
      sendResponse({ ok: true })
      return false
    }
  }
  return false
})

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

function extractPageText(): string {
  // Skip invisible iframes
  if (window.innerWidth === 0 || window.innerHeight === 0) return ''

  const parts: string[] = []
  let totalLength = 0

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT

      const tag = parent.tagName.toLowerCase()
      if (tag === 'script' || tag === 'style' || tag === 'noscript') {
        return NodeFilter.FILTER_REJECT
      }
      
      if (parent.hidden || parent.getAttribute('aria-hidden') === 'true') {
        return NodeFilter.FILTER_REJECT
      }

      if (typeof parent.checkVisibility === 'function') {
        if (!parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return NodeFilter.FILTER_REJECT
      } else {
        const cs = window.getComputedStyle(parent)
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return NodeFilter.FILTER_REJECT
        const rect = parent.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node: Node | null
  while ((node = walker.nextNode()) !== null) {
    const text = node.textContent ?? ''
    if (!text.trim()) continue
    parts.push(text)
    totalLength += text.length
    if (totalLength >= MAX_TEXT_BYTES) break
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Highlight injection
// ---------------------------------------------------------------------------

function highlightAndScroll(query: string, matchIndex: number): void {
  // Always start fresh
  removeHighlights()

  if (!query) return

  const normQuery = query.toLowerCase()
  const matchNodes = findAndWrapMatches(normQuery)

  totalMatches = matchNodes.length
  currentMatchIndex = Math.min(matchIndex, totalMatches - 1)

  if (totalMatches === 0) return

  scrollToMatch(currentMatchIndex)
}

/**
 * Walk the live DOM and wrap matching text runs in <mark class="powersearch-hl">.
 * Returns the list of mark elements in document order.
 */
function findAndWrapMatches(normQuery: string): HTMLElement[] {
  const marks: HTMLElement[] = []
  const qLen = normQuery.length

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName.toLowerCase()
      if (
        tag === 'script' ||
        tag === 'style' ||
        tag === 'noscript' ||
        parent.classList.contains(HIGHLIGHT_CLASS)
      ) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode()) !== null) {
    textNodes.push(node as Text)
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    const normText = text.toLowerCase()
    let pos = 0
    const fragments: (string | HTMLElement)[] = []

    while (true) {
      const idx = normText.indexOf(normQuery, pos)
      if (idx === -1) break

      if (idx > pos) fragments.push(text.slice(pos, idx))

      const mark = document.createElement('mark')
      mark.className = HIGHLIGHT_CLASS
      mark.textContent = text.slice(idx, idx + qLen)
      mark.setAttribute('data-powersearch-index', String(marks.length))
      fragments.push(mark)
      marks.push(mark)

      pos = idx + qLen
    }

    if (fragments.length > 0) {
      if (pos < text.length) fragments.push(text.slice(pos))

      const fragment = document.createDocumentFragment()
      for (const part of fragments) {
        if (typeof part === 'string') {
          fragment.appendChild(document.createTextNode(part))
        } else {
          fragment.appendChild(part)
        }
      }
      textNode.parentNode?.replaceChild(fragment, textNode)
    }
  }

  return marks
}

function scrollToMatch(index: number): void {
  const marks = document.querySelectorAll<HTMLElement>(`.${HIGHLIGHT_CLASS}`)
  marks.forEach(m => m.classList.remove(HIGHLIGHT_ACTIVE_CLASS))

  const target = marks[index]
  if (!target) return

  target.classList.add(HIGHLIGHT_ACTIVE_CLASS)
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
}

function navigateMatch(direction: 'prev' | 'next'): void {
  if (totalMatches === 0) return

  if (direction === 'next') {
    currentMatchIndex = (currentMatchIndex + 1) % totalMatches
  } else {
    currentMatchIndex = (currentMatchIndex - 1 + totalMatches) % totalMatches
  }

  scrollToMatch(currentMatchIndex)
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function removeHighlights(): void {
  const marks = document.querySelectorAll<HTMLElement>(`.${HIGHLIGHT_CLASS}`)
  const parents = new Set<Node>()

  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    const text = document.createTextNode(mark.textContent ?? '')
    parent.replaceChild(text, mark)
    parents.add(parent)
  }

  // Normalize parents only once after all replacements are done
  for (const p of parents) {
    p.normalize()
  }

  totalMatches = 0
  currentMatchIndex = 0
}
}
