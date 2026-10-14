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

describe('land plots and holding tax, 30 days', () => {
  useSeed(30)

  it('extra parcels raise the daily holding bill and the books stay finite', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({ deskStaff: 1, cash: 300_000 })
    const base = g.dailyHoldingQuote()
    expect(base).toBeGreaterThan(0)

    g.grantFieldXp(200)
    expect(g.buyParcel()).toBe(true)
    expect(g.parcels).toBe(2)
    const withParcel = g.dailyHoldingQuote()
    expect(withParcel).toBeGreaterThan(base)

    const m = runDays(g, 30, { stepSec: LONG_STEP_SEC })
    expectHealthy(m)
    expectBoundedGrowth(m)

    const holdingPosted = g.bank
      .ledger()
      .entries.filter((e) => e.category === 'building_upkeep').length
    expect(holdingPosted).toBeGreaterThanOrEqual(25)
  })
})
