import { describe, expect, it } from 'vitest'
import {
  GROWN, PROPOSED_PREFAB_I, QA_HEAVY, RAMP, STARTER, TRUNK_PREFAB_I, gapAt, simulateLane, utilisation,
} from './capacity'

describe('prefab security tuning', () => {
  it('trunk Prefab I already queues at starter traffic once the lane wears', () => {
    const d = simulateLane(TRUNK_PREFAB_I, STARTER, 7)
    expect(utilisation(TRUNK_PREFAB_I, STARTER, 100)).toBeGreaterThan(1)
    expect(d[2].maxQueue).toBeGreaterThan(25)
    expect(d.slice(3).some((x) => x.missed > 0)).toBe(true)
  })

  it('trunk under the QA heavy load sits at 100+ queued (QA saw 156 by day 7)', () => {
    const d = simulateLane(TRUNK_PREFAB_I, QA_HEAVY, 7)
    expect(d[6].maxQueue).toBeGreaterThan(100)
  })

  it('proposed Prefab I has no meaningful queue for the first week of starter traffic', () => {
    const d = simulateLane(PROPOSED_PREFAB_I, STARTER, 7)
    for (const day of d) {
      expect(day.maxQueue).toBeLessThanOrEqual(10)
      expect(day.meanWaitSec).toBeLessThan(10)
      expect(day.missed).toBe(0)
    }
    expect(utilisation(PROPOSED_PREFAB_I, STARTER, 100)).toBeLessThan(0.8)
  })

  it('proposed Prefab I strains as the player adds airlines', () => {
    const d = simulateLane(PROPOSED_PREFAB_I, RAMP, 10)
    expect(Math.max(...d.slice(0, 4).map((x) => x.maxQueue))).toBeLessThanOrEqual(10)
    expect(d[9].maxQueue).toBeGreaterThan(25)
    expect(utilisation(PROPOSED_PREFAB_I, GROWN)).toBeGreaterThan(1)
  })

  it('over-cap slowdown is bounded so queues cannot run away on their own', () => {
    const d = simulateLane(PROPOSED_PREFAB_I, GROWN, 6)
    expect(d[5].meanWaitSec).toBeLessThan(160)
  })

  it('ramp interpolates the flight gap', () => {
    expect(gapAt(RAMP, 1)).toBe(40)
    expect(gapAt(RAMP, 7)).toBeCloseTo(31)
    expect(gapAt(RAMP, 12)).toBe(22)
  })
})
