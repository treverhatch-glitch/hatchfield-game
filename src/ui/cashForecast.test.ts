import { describe, expect, it } from 'vitest'
import { money } from '../game/catalog.ts'
import { DAYS_PER_WEEK, HOURS_PER_GAME_DAY, moneySummaryLine, projectCash } from './cashForecast'

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

describe('money summary line', () => {
  it('reads earn, spend and net per day from the forecast', () => {
    const f = projectCash(0, 1_000, { payroll: 8_000, upkeep: 2_000, holding: 500, levy: 0 })
    expect(moneySummaryLine(f, money)).toBe(
      'You earn ~$24,000/day · You spend ~$10,500/day · Net ~+$13,500/day',
    )
  })

  it('shows a losing day with a minus net', () => {
    const f = projectCash(0, 0, { payroll: 4_000, upkeep: 0, holding: 0, levy: 0 })
    expect(moneySummaryLine(f, money)).toBe(
      'You earn ~$0/day · You spend ~$4,000/day · Net ~-$4,000/day',
    )
  })
})
