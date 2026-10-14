import { describe, expect, it } from 'vitest'
import {
  LONG_STEP_SEC,
  TEST_TIMEOUT_MS,
  buildAirport,
  expectHealthy,
  runDays,
  useSeed,
} from './harness.ts'

describe('mixed fleet, 14 days', () => {
  useSeed(14)

  it('three carriers share one runway without losing anyone', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({
      airlines: ['northline', 'bushline', 'harbor'],
      deskStaff: 2,
      mechanics: 1,
      cash: 200_000,
    })
    const seen = new Set<string>()
    let harborWalked = false
    const m = runDays(g, 14, {
      stepSec: LONG_STEP_SEC,
      onTick: (game) => {
        for (const f of game.flights) seen.add(f.airframeId)
        if (game.news.some((n) => /Harbor Air abandoned the field \(dead Standing\)/.test(n.text))) {
          harborWalked = true
        }
      },
    })
    expectHealthy(m)
    // Auto-sign may add more carriers on top of the three signed up front.
    expect(g.signed).toEqual(expect.arrayContaining(['northline', 'bushline']))
    // Harbor is signed past its letter (the starter field has no police post). It may
    // walk on Standing, a player-made bottleneck. It must never vanish any other way.
    if (!g.signed.includes('harbor')) expect(harborWalked).toBe(true)
    expect(m.flightsDone).toBeGreaterThan(15)
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })
})
