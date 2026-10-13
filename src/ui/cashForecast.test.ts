import { describe, expect, it } from 'vitest'
import { DAYS_PER_WEEK, HOURS_PER_GAME_DAY, projectCash } from './cashForecast'

describe('cash forecast', () => {
  it('projects hourly income against the scheduled daily and weekly bills', () => {
    const f = projectCash(50_000, 1_000, { payroll: 8_000, upkeep: 2_000, holding: 500, levy: 0 })
    expect(f.dailyIncome).toBe(1_000 * HOURS_PER_GAME_DAY)
    expect(f.dailyCharges).toBe(10_500)
    expect(f.dailyNet).toBe(24_000 - 10_500)
    expect(f.weeklyCharges).toBe(10_500 * DAYS_PER_WEEK)
    expect(f.weeklyNet).toBe(f.dailyNet * DAYS_PER_WEEK)
    expect(f.cashInSevenDays).toBe(50_000 + f.weeklyNet)
  })

  it('treats a non-finite input as zero', () => {
    const f = projectCash(Number.NaN, Number.POSITIVE_INFINITY, {
      payroll: Number.NaN,
      upkeep: 10,
      holding: 0,
      levy: 0,
    })
    expect(f.hourlyIncome).toBe(0)
    expect(f.dailyCharges).toBe(10)
    expect(f.cashInSevenDays).toBe(-70)
  })
})
