import { describe, expect, it } from 'vitest'
import { isLastWeekOfSeason, nextSeason, seasonDays, seasonFor, seasonOfDay, seasonRun, weekdayOf } from './seasons.ts'

describe('seasons', () => {
  it('summer and winter tile the year without gaps', () => {
    const s = seasonFor('summer', 0)
    const w = seasonFor('winter', 0)
    const s1 = seasonFor('summer', 1)
    expect(w.startDay).toBe(s.endDay + 1)
    expect(s1.startDay).toBe(w.endDay + 1)
    expect(seasonDays(s) + seasonDays(w)).toBe(364)
    expect(seasonDays(s) % 7).toBe(0)
  })
  it('seasonOfDay finds the right season incl. early-year winter', () => {
    expect(seasonOfDay(0).id).toBe('W-1')
    expect(seasonOfDay(84).id).toBe('S0')
    expect(seasonOfDay(seasonFor('summer', 0).endDay).id).toBe('S0')
    expect(seasonOfDay(seasonFor('summer', 0).endDay + 1).id).toBe('W0')
    expect(seasonOfDay(364 + 10).id).toBe('W0')
  })
  it('nextSeason / seasonRun alternate', () => {
    expect(nextSeason(seasonFor('summer', 2)).id).toBe('W2')
    expect(nextSeason(seasonFor('winter', 2)).id).toBe('S3')
    expect(seasonRun(seasonFor('summer', 0), 4).map((s) => s.id)).toEqual(['S0', 'W0', 'S1', 'W1'])
  })
  it('weekday and last week', () => {
    expect(weekdayOf(0)).toBe(0)
    expect(weekdayOf(13)).toBe(6)
    expect(weekdayOf(-1)).toBe(6)
    const s = seasonFor('summer', 0)
    expect(isLastWeekOfSeason(s, s.endDay)).toBe(true)
    expect(isLastWeekOfSeason(s, s.endDay - 7)).toBe(false)
  })
})
