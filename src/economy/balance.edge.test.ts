import { describe, expect, it } from 'vitest'
import { cityLevyForGameDay, operatingMargin, payrollForGameDay } from '../core/bank.ts'
import {
  cashGrowthMultiple,
  closeDayCash,
  dayExpenses,
  dayMargin,
  projectCashFlow,
  runHeadlessBalance,
  sampleOperatingMargins,
  type CashFlowPicture,
  type DayCashFlow,
} from './balance.ts'

const picture = (over: Partial<CashFlowPicture> = {}): CashFlowPicture => ({
  phase: 'midgame',
  income: 203_000,
  otherCosts: 35_000,
  minimumStaffing: 0,
  sinkCharged: 4_000,
  ...over,
})

describe('economy balance edges', () => {
  it('projects only the opening line for zero, negative or NaN day counts, and floors fractions', () => {
    for (const days of [0, -3, Number.NaN]) expect(projectCashFlow(1_000, days, picture())).toEqual([1_000])
    expect(projectCashFlow(1_000, 2.9, picture())).toHaveLength(3)
  })

  it('charges no city levy while cash is under the protected floor or negative', () => {
    expect(cityLevyForGameDay(-50_000)).toBe(0)
    expect(cityLevyForGameDay(0)).toBe(0)
    expect(cityLevyForGameDay(140_000)).toBe(0)
    expect(cityLevyForGameDay(140_200)).toBe(1)
    expect(cityLevyForGameDay(1_140_000)).toBe(5_000)
  })

  it('keeps a loss-making field sliding steadily, never NaN, never paying a levy on debt', () => {
    const series = projectCashFlow(50_000, 40, picture({ phase: 'early', income: 0, otherCosts: 3_000, minimumStaffing: 1_200, sinkCharged: 800 }))
    expect(series).toHaveLength(41)
    expect(series.every(Number.isFinite)).toBe(true)
    for (let i = 1; i < series.length; i++) expect(series[i - 1]! - series[i]!).toBe(5_000)
    expect(series[40]).toBe(-150_000)
  })

  it('makes nothing free: zero income still pays the staffing floor, other costs and sinks', () => {
    const day: DayCashFlow = { income: 0, payroll: payrollForGameDay(0, 'early', 900), otherCosts: 3_000, sinks: 450, cityLevy: 0 }
    expect(day.payroll).toBe(900)
    expect(dayExpenses(day)).toBe(4_350)
    expect(closeDayCash(10_000, day)).toBe(5_650)
    expect(dayMargin(day)).toBe(0)
  })

  it('floors payroll at the staffing minimum and ignores negative income', () => {
    expect(payrollForGameDay(-10_000, 'midgame')).toBe(0)
    expect(payrollForGameDay(-10_000, 'midgame', 2_500)).toBe(2_500)
    expect(payrollForGameDay(1_000, 'early', 50_000)).toBe(50_000)
    expect(payrollForGameDay(0, 'midgame')).toBe(0)
    expect(Number.isFinite(payrollForGameDay(1e12, 'midgame'))).toBe(true)
  })

  it('reads margin as 0 with no income, clamps negative expenses, and goes negative on a loss', () => {
    expect(operatingMargin(0, 5_000)).toBe(0)
    expect(operatingMargin(-1, 5_000)).toBe(0)
    expect(operatingMargin(10_000, -5_000)).toBe(1)
    expect(operatingMargin(10_000, 15_000)).toBe(-0.5)
  })

  it('reports an undefined growth multiple for out-of-range, non-positive or NaN starts', () => {
    const series = [100, 150, 0, -20, Number.NaN]
    expect(cashGrowthMultiple(series, 0, 1)).toBe(1.5)
    expect(cashGrowthMultiple(series, 0, 9)).toBe(Number.POSITIVE_INFINITY)
    expect(cashGrowthMultiple(series, 2, 1)).toBe(Number.POSITIVE_INFINITY)
    expect(cashGrowthMultiple(series, 3, 1)).toBe(Number.POSITIVE_INFINITY)
    expect(cashGrowthMultiple(series, 0, 4)).toBe(Number.POSITIVE_INFINITY)
    expect(cashGrowthMultiple(series, -1, 0)).toBe(Number.POSITIVE_INFINITY)
    expect(cashGrowthMultiple(series, 0, 3)).toBe(-0.2)
  })

  it('pulls a hoarded bank and a modest one toward the same level instead of running away', () => {
    const rich = projectCashFlow(10_000_000, 60, picture())
    const modest = projectCashFlow(500_000, 60, picture())
    for (let i = 1; i < rich.length; i++) {
      // The levy on cash above the floor outweighs a mid-game day once the bank is huge.
      expect(rich[i]!).toBeLessThan(rich[i - 1]!)
      expect(modest[i]!).toBeGreaterThan(modest[i - 1]!)
      expect(rich[i]! - modest[i]!).toBeLessThan(rich[i - 1]! - modest[i - 1]!)
    }
    expect(modest[60]!).toBeGreaterThan(140_000)
  })

  it('is deterministic and survives a JSON round trip', () => {
    const a = runHeadlessBalance()
    const b = runHeadlessBalance()
    expect(b).toEqual(a)
    expect(JSON.parse(JSON.stringify(a))).toEqual(a)
    const s = sampleOperatingMargins()
    expect(sampleOperatingMargins()).toEqual(s)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('keeps every headless figure finite and the late tree only partly affordable', () => {
    const r = runHeadlessBalance()
    const nums = [
      r.early.researchPointsEarned,
      r.early.unbankedProgress,
      r.late.researchPointsEarned,
      r.late.totalTreeCost,
      r.late.affordableTreeShare,
      r.finances.early.margin,
      r.finances.midgame.margin,
      r.finances.midgame.cityLevy,
    ]
    expect(nums.every(Number.isFinite)).toBe(true)
    expect(r.early.researchPointsEarned).toBeGreaterThan(0)
    expect(r.late.researchPointsEarned).toBeGreaterThan(r.early.researchPointsEarned)
    expect(r.late.affordableTreeShare).toBeGreaterThan(0)
    expect(r.finances.midgame.margin).toBeGreaterThan(r.finances.early.margin)
  })

  it('margins move the right way as opening cash changes the levy', () => {
    const poor = sampleOperatingMargins(100_000)
    const rich = sampleOperatingMargins(5_000_000)
    expect(poor.midgame.cityLevy).toBe(0)
    expect(rich.midgame.cityLevy).toBeGreaterThan(0)
    expect(rich.midgame.margin).toBeLessThan(poor.midgame.margin)
    expect(poor.early).toEqual(rich.early)
  })
})
