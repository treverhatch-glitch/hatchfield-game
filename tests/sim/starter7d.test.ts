import { describe, expect, it } from 'vitest'
import {
  TEST_TIMEOUT_MS,
  buildAirport,
  expectHealthy,
  runDays,
  seedRandom,
  useSeed,
} from './harness.ts'

describe('starter airport, 7 days', () => {
  useSeed(7)

  it('flies, earns, and stays healthy for a week', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({ deskStaff: 1 })
    const m = runDays(g, 7)
    expectHealthy(m)
    expect(m.flightsDone).toBeGreaterThan(5)
    expect(m.paxServed).toBeGreaterThan(200)
    expect(m.cashByDay).toHaveLength(7)
    expect(g.gameDay()).toBe(7)
  })

  it('is reproducible from a seed', { timeout: TEST_TIMEOUT_MS }, () => {
    const run = () => {
      const restore = seedRandom(99)
      try {
        return runDays(buildAirport(), 2).cashByDay
      } finally {
        restore()
      }
    }
    expect(run()).toEqual(run())
  })
})
