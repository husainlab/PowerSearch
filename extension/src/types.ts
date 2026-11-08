// ---------------------------------------------------------------------------
// Shared types used across background, content script, and popup
// ---------------------------------------------------------------------------

export interface SearchMatch {
  /** ~60-char context snippet surrounding the match */
  context: string
  /** Byte offset of the match start within context (for highlight rendering) */
  matchStart: number
  /** Byte offset of the match end within context */
  matchEnd: number
  /** Char offset of the match within the full page text */
  position: number
}

export interface TabSearchResult {
  tabId: number
  windowId: number
  url: string
  title: string
  favIconUrl?: string
  matchCount: number
  matches: SearchMatch[]
}

export interface HistorySearchResult {
  id: string
  url: string
  title: string
  lastVisitTime: number
  visitCount: number
}

export interface SearchResults {
  query: string
  tabs: TabSearchResult[]
  history: HistorySearchResult[]
  completedBatches: number
  totalBatches: number
}

export interface RecentSearch {
  query: string
  timestamp: number
}

export interface RecentClick {
  url: string
  title: string
  query: string
  timestamp: number
}

export type SearchScope = 'all' | 'tabs' | 'history'

export interface PinnedSearch {
  query: string
  timestamp: number
}

export interface RecentData {
  searches: RecentSearch[]
  clicks: RecentClick[]
  pinned: PinnedSearch[]
}

export interface SearchFilters {
  domain?: string | null
  startDate?: number | null
  endDate?: number | null
  visitedOnly?: boolean
  unvisitedOnly?: boolean
}

export interface TabTextCache {
  text: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// Message types (popup ↔ service worker ↔ content script)
// ---------------------------------------------------------------------------

export type MessageType =
  | 'SEARCH_START'
  | 'SEARCH_PROGRESS'
  | 'NAVIGATE_TO_MATCH'
  | 'CLEAR_RESULTS'
  | 'GET_RECENT'
  | 'EXTRACT_TEXT'
  | 'HIGHLIGHT_AND_SCROLL'
  | 'NAVIGATE_MATCH'
  | 'REMOVE_HIGHLIGHTS'

export interface SearchStartMessage {
  type: 'SEARCH_START'
  query: string
  searchId: string
  scope: SearchScope
}

export interface SearchProgressMessage {
  type: 'SEARCH_PROGRESS'
  batch: TabSearchResult[]
  historyResults?: HistorySearchResult[]
  completed: number
  total: number
  done: boolean
}

export interface NavigateToMatchMessage {
  type: 'NAVIGATE_TO_MATCH'
  tabId: number
  matchIndex: number
  query: string
}

export interface ClearResultsMessage {
  type: 'CLEAR_RESULTS'
}

export interface GetRecentMessage {
  type: 'GET_RECENT'
}

export interface ExtractTextMessage {
  type: 'EXTRACT_TEXT'
}

export interface HighlightAndScrollMessage {
  type: 'HIGHLIGHT_AND_SCROLL'
  query: string
  matchIndex: number
}

export interface NavigateMatchMessage {
  type: 'NAVIGATE_MATCH'
  direction: 'prev' | 'next'
}

export interface RemoveHighlightsMessage {
  type: 'REMOVE_HIGHLIGHTS'
}

export type BackgroundMessage =
  | SearchStartMessage
  | NavigateToMatchMessage
  | ClearResultsMessage
  | GetRecentMessage

export type ContentMessage =
  | ExtractTextMessage
  | HighlightAndScrollMessage
  | NavigateMatchMessage
  | RemoveHighlightsMessage


// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type ThemeMode = 'system' | 'dark' | 'light'
export type HighlightColor = 'yellow' | 'blue' | 'green' | 'pink'

export type OpenMode = 'popup' | 'sidePanel'

export interface Settings {
  theme: ThemeMode
  defaultScope: SearchScope
  highlightColor: HighlightColor
  maxMatchesPerTab: number
  historyResultsLimit: number
  caseSensitive: boolean
  matchWholeWord: boolean
  openMode: OpenMode
  enableAutoSearch: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultScope: 'all',
  highlightColor: 'yellow',
  maxMatchesPerTab: 1000,
  historyResultsLimit: 50,
  caseSensitive: false,
  matchWholeWord: false,
  openMode: 'popup',
  enableAutoSearch: true,
}

export interface HighlightPreset {
  bg: string; active: string; outline: string
  bgLight: string; activeLight: string; outlineLight: string
}

export const HIGHLIGHT_PRESETS: Record<HighlightColor, HighlightPreset> = {
  yellow: { bg: 'rgba(251,191,36,0.4)', active: '#F97316', outline: '#FB923C',
            bgLight: 'rgba(217,119,6,0.25)', activeLight: '#EA580C', outlineLight: '#F97316' },
  blue:   { bg: 'rgba(96,165,250,0.35)', active: '#3B82F6', outline: '#60A5FA',
            bgLight: 'rgba(59,130,246,0.2)', activeLight: '#2563EB', outlineLight: '#3B82F6' },
  green:  { bg: 'rgba(52,211,153,0.35)', active: '#059669', outline: '#34D399',
            bgLight: 'rgba(16,185,129,0.2)', activeLight: '#047857', outlineLight: '#059669' },
  pink:   { bg: 'rgba(244,114,182,0.35)', active: '#DB2777', outline: '#F472B6',
            bgLight: 'rgba(219,39,119,0.2)', activeLight: '#BE185D', outlineLight: '#DB2777' },
}
