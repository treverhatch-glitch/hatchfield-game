import { describe, expect, it } from 'vitest'
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import {
  RUNWAY_TURN_SEC,
  runwayArrivalGapSec,
  runwayMovementCapacity,
  runwayOverbooked,
} from './capacity.ts'

describe('runway movement capacity', () => {
  it('spaces one strip so the previous landing can roll clear', () => {
    expect(runwayArrivalGapSec(1)).toBe(RUNWAY_TURN_SEC)
    expect(runwayArrivalGapSec(2)).toBe(RUNWAY_TURN_SEC / 2)
    expect(runwayArrivalGapSec(0)).toBe(RUNWAY_TURN_SEC)
  })

  it('counts a day of movements and flags a bank past that', () => {
    const one = runwayMovementCapacity(1, REAL_SECONDS_PER_GAME_DAY)
    const gap = RUNWAY_TURN_SEC
    const turns = Math.floor((REAL_SECONDS_PER_GAME_DAY + gap - 1e-9) / gap)
    expect(one).toBe(turns * 2)
    expect(one).toBeGreaterThanOrEqual(4)
    // A window shorter than the two-strip gap fits the opening turn only.
    expect(runwayMovementCapacity(2, RUNWAY_TURN_SEC / 2 - 1)).toBe(2)
    // Night stretches the gap by at most 1.4. That must stay inside the
    // two-stand interval measured on the idle soak, or a gate sits empty.
    expect(RUNWAY_TURN_SEC * 1.4).toBeLessThan(76)
    expect(runwayOverbooked(one, one)).toBe(false)
    expect(runwayOverbooked(one + 1, one)).toBe(true)
    expect(runwayOverbooked(Number.NaN, one)).toBe(false)
  })
})
