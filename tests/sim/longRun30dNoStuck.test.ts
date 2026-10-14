import { describe, expect, it } from 'vitest'
import {
  LONG_STEP_SEC,
  TEST_TIMEOUT_MS,
  buildAirport,
  expectBoundedGrowth,
  expectHealthy,
  runDays,
  useSeed,
} from './harness.ts'

describe('30-day run', () => {
  useSeed(2030)

  it('nothing sticks, nothing goes NaN, cash stays bounded', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({
      airlines: ['northline'],
      deskStaff: 1,
      janitors: 1,
      mechanics: 1,
      cash: 250_000,
    })
    const m = runDays(g, 30, { stepSec: LONG_STEP_SEC })
    expectHealthy(m)
    expectBoundedGrowth(m)
    expect(m.cashByDay).toHaveLength(30)
    expect(m.ledgerEntries).toBeGreaterThan(30)
    expect(g.gameDay()).toBe(30)
  })
})
