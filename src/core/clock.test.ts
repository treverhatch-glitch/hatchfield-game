import { describe, expect, it } from 'vitest'
import {
  gameDayAt,
  realSecondsToSimMinutes,
  SIM_MINUTES_PER_GAME_DAY,
  SimClock,
} from './clock.ts'

describe('shared simulation clock', () => {
  it('uses sim minutes and a single three-real-minute game day', () => {
    expect(realSecondsToSimMinutes(1)).toBe(8)
    expect(realSecondsToSimMinutes(180)).toBe(SIM_MINUTES_PER_GAME_DAY)
    expect(gameDayAt(1_439)).toBe(0)
    expect(gameDayAt(1_440)).toBe(1)
  })

  it('returns the dt every module consumes and reports day crossings', () => {
    const clock = new SimClock({ simMinutes: 1_430 })
    const step = clock.advanceRealSeconds(2)
    expect(step).toEqual({
      dt: 16,
      simMinutes: 1_446,
      gameDay: 1,
      crossedGameDays: 1,
    })
    expect(clock.snapshot()).toEqual({ simMinutes: 1_446 })
  })

  it('does not advance while paused', () => {
    const clock = new SimClock()
    expect(clock.advanceRealSeconds(10, 0).dt).toBe(0)
    expect(clock.simMinutes).toBe(0)
  })
})
