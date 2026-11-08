/**
 * Centralized error and event logging system
 * Stores errors in chrome.storage.local for user access and support debugging
 * Users can report issues by taking screenshots of stored errors
 */

interface LogEntry {
  timestamp: number
  level: 'error' | 'warning' | 'info'
  context: string
  message: string
  details?: string
}

const MAX_LOGS = 100
const LOGS_KEY = 'error_logs'

/**
 * Log an error or event for support debugging
 * Users can access logs via Settings or report them to support
 */
export async function logEvent(
  context: string,
  message: string,
  level: 'error' | 'warning' | 'info' = 'info',
  details?: string
): Promise<void> {
  try {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      context,
      message,
      details,
    }

    // Get existing logs
    const stored = await chrome.storage.local.get(LOGS_KEY)
    const logs: LogEntry[] = stored[LOGS_KEY] || []

    // Add new entry and maintain max size
    logs.push(entry)
    if (logs.length > MAX_LOGS) {
      logs.shift() // Remove oldest
    }

    // Store updated logs
    await chrome.storage.local.set({ [LOGS_KEY]: logs })

    // Also log to console for development visibility (error/warning only)
    if (level === 'error') {
      console.error(`[${context}]`, message, details || '')
    } else if (level === 'warning') {
      console.warn(`[${context}]`, message, details || '')
    }
  } catch (e) {
    // Fallback: only console if storage fails
    console.error(`[ErrorLogger] Failed to log event:`, e, context, message)
  }
}

/**
 * Retrieve all stored logs for user to report
 */
export async function getStoredLogs(): Promise<LogEntry[]> {
  try {
    const stored = await chrome.storage.local.get(LOGS_KEY)
    return stored[LOGS_KEY] || []
  } catch (e) {
    console.error('[ErrorLogger] Failed to retrieve logs:', e)
    return []
  }
}

/**
 * Clear all logs (after user reports them)
 */
export async function clearLogs(): Promise<void> {
  try {
    await chrome.storage.local.remove(LOGS_KEY)
  } catch (e) {
    console.error('[ErrorLogger] Failed to clear logs:', e)
  }
}

/**
 * Format logs for user report (human-readable)
 */
export function formatLogsForReport(logs: LogEntry[]): string {
  return logs
    .map(
      log =>
        `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] ${log.context}: ${log.message}${log.details ? '\n  Details: ' + log.details : ''}`
    )
    .join('\n')
}
