import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindHudClock, HUD_HZ } from './hudClock.ts'

afterEach(() => {
  vi.useRealTimers()
})

describe('HUD clock', () => {
  it('publishes between 4 and 10 times a second', () => {
    expect(HUD_HZ).toBeGreaterThanOrEqual(4)
    expect(HUD_HZ).toBeLessThanOrEqual(10)
  })

  it('collapses a burst of emits into one snapshot', () => {
    vi.useFakeTimers()
    let value = 'a'
    const listeners = new Set<() => void>()
    const clock = bindHudClock(
      (fn) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
      () => value,
    )
    const seen: string[] = []
    const stop = clock.subscribe(() => seen.push(clock.getSnapshot()))
    value = 'b'
    for (const fn of listeners) fn()
    value = 'c'
    for (const fn of listeners) fn()
    expect(seen).toEqual([])
    expect(clock.getSnapshot()).toBe('a')
    vi.advanceTimersByTime(Math.round(1000 / HUD_HZ))
    expect(seen).toEqual(['c'])
    expect(clock.getSnapshot()).toBe('c')
    stop()
  })

  it('stays quiet when the snapshot did not change', () => {
    vi.useFakeTimers()
    const listeners = new Set<() => void>()
    const clock = bindHudClock(
      (fn) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
      () => 'same',
    )
    let ticks = 0
    clock.subscribe(() => {
      ticks += 1
    })
    for (const fn of listeners) fn()
    vi.advanceTimersByTime(Math.round(1000 / HUD_HZ))
    expect(ticks).toBe(0)
    expect(clock.getSnapshot()).toBe('same')
  })
})
