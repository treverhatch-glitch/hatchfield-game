import { describe, expect, it } from 'vitest'
import { cashGrowthMultiple, dayMargin, sampleOperatingMargins } from './balance.ts'

describe('cash-flow helpers', () => {
  it('keeps early margin in 0–10% and mid-game margin in 15–30%', () => {
    const sample = sampleOperatingMargins()
    expect(sample.early.sinks).toBeGreaterThan(0)
    expect(sample.midgame.sinks).toBeGreaterThan(sample.early.sinks)
    expect(dayMargin(sample.early)).toBeGreaterThanOrEqual(0)
    expect(dayMargin(sample.early)).toBeLessThanOrEqual(0.1)
    expect(sample.midgame.margin).toBeGreaterThanOrEqual(0.15)
    expect(sample.midgame.margin).toBeLessThanOrEqual(0.3)
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
