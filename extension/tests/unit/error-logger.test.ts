/**
 * Unit tests for the error logger module
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { logEvent, getStoredLogs, clearLogs, formatLogsForReport } from '../../src/background/error-logger'

describe('error-logger', () => {
  beforeEach(async () => {
    await clearLogs()
  })

  // ------------------------------------------------------------------
  // logEvent
  // ------------------------------------------------------------------

  it('stores a log entry in chrome.storage.local', async () => {
    await logEvent('test-ctx', 'test message', 'info', 'some details')

    const logs = await getStoredLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].context).toBe('test-ctx')
    expect(logs[0].message).toBe('test message')
    expect(logs[0].level).toBe('info')
    expect(logs[0].details).toBe('some details')
    expect(logs[0].timestamp).toBeGreaterThan(0)
  })

  it('stores multiple log entries in order', async () => {
    await logEvent('ctx1', 'msg1', 'info')
    await logEvent('ctx2', 'msg2', 'warning')
    await logEvent('ctx3', 'msg3', 'error')

    const logs = await getStoredLogs()
    expect(logs).toHaveLength(3)
    expect(logs[0].context).toBe('ctx1')
    expect(logs[1].level).toBe('warning')
    expect(logs[2].level).toBe('error')
  })

  it('caps logs at 100 entries (evicts oldest)', async () => {
    // Write 105 log entries
    for (let i = 0; i < 105; i++) {
      await logEvent('ctx', `msg-${i}`, 'info')
    }

    const logs = await getStoredLogs()
    expect(logs.length).toBeLessThanOrEqual(100)
    // The earliest entries should have been evicted
    expect(logs[0].message).toBe('msg-5')
    expect(logs[logs.length - 1].message).toBe('msg-104')
  })

  it('stores entries without details', async () => {
    await logEvent('ctx', 'no details')

    const logs = await getStoredLogs()
    expect(logs[0].details).toBeUndefined()
  })

  // ------------------------------------------------------------------
  // getStoredLogs
  // ------------------------------------------------------------------

  it('returns empty array when no logs exist', async () => {
    const logs = await getStoredLogs()
    expect(logs).toEqual([])
  })

  // ------------------------------------------------------------------
  // clearLogs
  // ------------------------------------------------------------------

  it('clears all stored logs', async () => {
    await logEvent('ctx', 'msg1', 'info')
    await logEvent('ctx', 'msg2', 'error')
    await clearLogs()

    const logs = await getStoredLogs()
    expect(logs).toEqual([])
  })

  // ------------------------------------------------------------------
  // formatLogsForReport
  // ------------------------------------------------------------------

  it('formats logs as human-readable text', () => {
    const logs = [
      {
        timestamp: new Date('2025-01-15T10:30:00Z').getTime(),
        level: 'error' as const,
        context: 'navigate',
        message: 'Tab not found',
        details: 'tabId=42',
      },
      {
        timestamp: new Date('2025-01-15T10:31:00Z').getTime(),
        level: 'info' as const,
        context: 'search',
        message: 'Search completed',
      },
    ]

    const report = formatLogsForReport(logs)

    expect(report).toContain('[ERROR]')
    expect(report).toContain('navigate')
    expect(report).toContain('Tab not found')
    expect(report).toContain('Details: tabId=42')
    expect(report).toContain('[INFO]')
    expect(report).toContain('Search completed')
  })

  it('formats empty logs as empty string', () => {
    expect(formatLogsForReport([])).toBe('')
  })
})
