import { describe, expect, it } from 'vitest'
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import {
  ARRIVAL_OCCUPANCY_SEC,
  DEPARTURE_OCCUPANCY_SEC,
  RUNWAY_SLOT_SLACK_SEC,
  runwayArrivalGapSec,
  runwayMovementCapacity,
  runwayOverbooked,
} from './capacity.ts'

describe('runway movement capacity', () => {
  it('spaces one strip by arrival occupancy plus a departure slot', () => {
    const gap = ARRIVAL_OCCUPANCY_SEC + DEPARTURE_OCCUPANCY_SEC + RUNWAY_SLOT_SLACK_SEC
    expect(runwayArrivalGapSec(1)).toBe(gap)
    expect(runwayArrivalGapSec(2)).toBe(gap)
    expect(runwayArrivalGapSec(0)).toBe(gap)
    expect(gap).toBeLessThan(40)
    // Night stretches commercial spacing by at most 1.4. The physical gap
    // stays inside the two-stand interval measured on the idle soak.
    expect(gap * 1.4).toBeLessThan(76)
  })

  it('counts a day of movements on each strip and flags a bank past that', () => {
    const one = runwayMovementCapacity(1, REAL_SECONDS_PER_GAME_DAY)
    const gap = runwayArrivalGapSec(1)
    const turns = Math.floor((REAL_SECONDS_PER_GAME_DAY + gap - 1e-9) / gap)
    expect(one).toBe(turns * 2)
    // The retired 150s gap was a full turn: two turns, four movements a day.
    const legacyTurns = Math.floor((REAL_SECONDS_PER_GAME_DAY + 150 - 1e-9) / 150)
    expect(one).toBeGreaterThanOrEqual(legacyTurns * 2 * 3)
    expect(runwayMovementCapacity(2, REAL_SECONDS_PER_GAME_DAY)).toBe(one * 2)
    // A window shorter than one gap fits the opening turn on each strip.
    expect(runwayMovementCapacity(2, gap - 1)).toBe(4)
    const shortTurns = Math.floor((32 + gap - 1e-9) / gap)
    expect(runwayMovementCapacity(2, 32)).toBe(shortTurns * 2 * 2)
    expect(runwayOverbooked(one, one)).toBe(false)
    expect(runwayOverbooked(one + 1, one)).toBe(true)
    expect(runwayOverbooked(Number.NaN, one)).toBe(false)
  })
})
