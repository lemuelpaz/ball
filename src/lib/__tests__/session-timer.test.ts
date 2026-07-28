import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatMMSS } from '@/lib/session-timer'

describe('formatMMSS', () => {
  it('formats zero seconds as 00:00', () => {
    expect(formatMMSS(0)).toBe('00:00')
  })

  it('formats seconds below one minute', () => {
    expect(formatMMSS(9)).toBe('00:09')
    expect(formatMMSS(59)).toBe('00:59')
  })

  it('formats exactly one minute', () => {
    expect(formatMMSS(60)).toBe('01:00')
  })

  it('formats minutes and seconds', () => {
    expect(formatMMSS(61)).toBe('01:01')
    expect(formatMMSS(125)).toBe('02:05')
    expect(formatMMSS(599)).toBe('09:59')
  })

  it('formats large values correctly', () => {
    expect(formatMMSS(3600)).toBe('60:00')
    expect(formatMMSS(3661)).toBe('61:01')
  })

  it('pads single-digit minutes and seconds with leading zero', () => {
    expect(formatMMSS(70)).toBe('01:10')
  })
})

describe('createSessionTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at 0 seconds', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const timer = createSessionTimer()
    expect(timer.getSeconds()).toBe(0)
  })

  it('does not increment when not running', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const timer = createSessionTimer()
    vi.advanceTimersByTime(3000)
    expect(timer.getSeconds()).toBe(0)
  })

  it('increments by 1 each second when running', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const timer = createSessionTimer()
    timer.start()
    vi.advanceTimersByTime(1000)
    expect(timer.getSeconds()).toBe(1)
    vi.advanceTimersByTime(2000)
    expect(timer.getSeconds()).toBe(3)
  })

  it('pauses and stops incrementing when stopped', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const timer = createSessionTimer()
    timer.start()
    vi.advanceTimersByTime(3000)
    expect(timer.getSeconds()).toBe(3)
    timer.stop()
    vi.advanceTimersByTime(5000)
    expect(timer.getSeconds()).toBe(3)
  })

  it('resumes from where it paused after start is called again', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const timer = createSessionTimer()
    timer.start()
    vi.advanceTimersByTime(2000)
    timer.stop()
    timer.start()
    vi.advanceTimersByTime(2000)
    expect(timer.getSeconds()).toBe(4)
  })

  it('resets seconds to 0 and stops the timer', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const timer = createSessionTimer()
    timer.start()
    vi.advanceTimersByTime(5000)
    expect(timer.getSeconds()).toBe(5)
    timer.reset()
    expect(timer.getSeconds()).toBe(0)
    vi.advanceTimersByTime(3000)
    expect(timer.getSeconds()).toBe(0)
  })

  it('notifies onChange callback every second when running', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const onChange = vi.fn()
    const timer = createSessionTimer(onChange)
    timer.start()
    vi.advanceTimersByTime(3000)
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenNthCalledWith(1, 1)
    expect(onChange).toHaveBeenNthCalledWith(2, 2)
    expect(onChange).toHaveBeenNthCalledWith(3, 3)
  })

  it('does not call onChange after stop', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const onChange = vi.fn()
    const timer = createSessionTimer(onChange)
    timer.start()
    vi.advanceTimersByTime(2000)
    timer.stop()
    const callsAfterStop = onChange.mock.calls.length
    vi.advanceTimersByTime(2000)
    expect(onChange.mock.calls.length).toBe(callsAfterStop)
  })

  it('does not call onChange after reset', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const onChange = vi.fn()
    const timer = createSessionTimer(onChange)
    timer.start()
    vi.advanceTimersByTime(2000)
    timer.reset()
    const callsAfterReset = onChange.mock.calls.length
    vi.advanceTimersByTime(3000)
    expect(onChange.mock.calls.length).toBe(callsAfterReset)
  })

  it('formats current time as MM:SS via getFormatted', async () => {
    const { createSessionTimer } = await import('@/lib/session-timer')
    const timer = createSessionTimer()
    timer.start()
    vi.advanceTimersByTime(65000)
    expect(timer.getFormatted()).toBe('01:05')
  })
})