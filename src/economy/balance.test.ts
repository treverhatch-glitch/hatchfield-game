import { describe, expect, it } from 'vitest'
import { cashGrowthMultiple, dayMargin, sampleOperatingMargins } from './balance.ts'

describe('cash-flow helpers', () => {
  it('bills 45% early and 40% mid-game, and still grows without a runaway', () => {
    const sample = sampleOperatingMargins()
    expect(sample.early.sinks).toBeGreaterThan(0)
    expect(sample.midgame.sinks).toBeGreaterThan(sample.early.sinks)
    expect(sample.early.payroll / sample.early.income).toBeCloseTo(0.45, 3)
    expect(sample.midgame.payroll / sample.midgame.income).toBeCloseTo(0.4, 3)
    expect(dayMargin(sample.early)).toBeGreaterThan(0.25)
    expect(sample.midgame.margin).toBeGreaterThan(0.3)
  })

  it('grows a mid-game bank through day 30 without a runaway between day 20 and 30', () => {
    const sample = sampleOperatingMargins()
    expect(sample.series).toHaveLength(31)
    expect(sample.series.every((cash) => Number.isFinite(cash))).toBe(true)
    expect(sample.series[30]).toBeGreaterThan(sample.series[20]!)
    expect(sample.series[20]).toBeGreaterThan(sample.series[0]!)
    expect(sample.growthDay20to30).toBeGreaterThan(1)
    expect(sample.growthDay20to30).toBeLessThan(3)
    expect(cashGrowthMultiple([0, 10], 0, 1)).toBe(Number.POSITIVE_INFINITY)
  })
})
