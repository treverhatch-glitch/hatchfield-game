import { describe, expect, it } from 'vitest'
import { LAYOUTS, runHarness } from './trafficHarness.ts'

/**
 * Flood the field for several sim days (86,400 sim s each) and hold the
 * controller to its promises: no deadlock, no runway incursion, no two
 * aircraft on one cell, nobody stuck for 15 minutes.
 */
describe('airfield traffic stress', () => {
  for (const [name, rows] of Object.entries(LAYOUTS)) {
    it(`${name}: heavy traffic for 3 sim days stays safe and moving`, () => {
      const rep = runHarness(name, rows, { spawnEverySec: 10, turnSec: 60, days: 3, seed: 3 })
      console.info(`[atc-stress] ${JSON.stringify(rep)}`)
      expect(rep.deadlocks).toBe(0)
      expect(rep.incursions).toBe(0)
      expect(rep.overlaps).toBe(0)
      expect(rep.stalls).toBe(0)
      expect(rep.landings).toBeGreaterThan(1000)
      expect(Math.abs(rep.landings - rep.takeoffs)).toBeLessThan(20)
    }, 60_000)
  }

  it('two runways out-carry one under the same flood', () => {
    const one = runHarness('one', LAYOUTS.oneRunwayParallel, { spawnEverySec: 10, turnSec: 60, days: 1, seed: 5 })
    const two = runHarness('two', LAYOUTS.twoRunways, { spawnEverySec: 10, turnSec: 60, days: 1, seed: 5 })
    expect(two.movementsPerHour).toBeGreaterThan(one.movementsPerHour * 1.4)
  }, 60_000)
})
