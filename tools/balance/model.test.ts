import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, ITEMS, PREFAB } from './config'
import { bagShare, comfortScore, dailyCapacity, effectiveness, evaluateDay, fieldLevel, growthRate, item, marginalNet, paybackDays } from './model'
import { runStrategy } from './strategies'

const p = DEFAULT_PARAMS
const prefab = () => PREFAB.map((id) => ({ id, condition: 1 }))

describe('core balance math', () => {
  it('daily capacity = servers*3600/serviceSec*hours/peak', () => {
    expect(dailyCapacity(item('sec_small'), 1, p)).toBeCloseTo((3600 / 45) * 16 / 1.6)
    expect(dailyCapacity(item('seats'), 1, p)).toBe(0)
  })
  it('wear halves effectiveness at worst', () => {
    expect(effectiveness(1)).toBe(1)
    expect(effectiveness(0)).toBe(0.5)
    expect(effectiveness(-3)).toBe(0.5)
    expect(dailyCapacity(item('sec_small'), 0, p)).toBeCloseTo(dailyCapacity(item('sec_small'), 1, p) / 2)
  })
  it('payback days', () => {
    expect(paybackDays(1000, 100)).toBe(10)
    expect(paybackDays(1000, 0)).toBe(Infinity)
    expect(paybackDays(1000, -5)).toBe(Infinity)
  })
  it('field level follows FIELD_LEVEL_XP', () => {
    expect(fieldLevel(0)).toBe(1)
    expect(fieldLevel(89)).toBe(1)
    expect(fieldLevel(90)).toBe(2)
    expect(fieldLevel(700)).toBe(5)
  })
  it('bag share is a sane fraction and grows with widebodies', () => {
    expect(bagShare(1)).toBeGreaterThan(0.5)
    expect(bagShare(1)).toBeLessThanOrEqual(1)
    expect(bagShare(5)).toBeGreaterThan(bagShare(2))
  })
  it('comfort has diminishing returns per copy', () => {
    const one = comfortScore([{ id: 'toilet', condition: 1 }])
    const two = comfortScore([{ id: 'toilet', condition: 1 }, { id: 'toilet', condition: 1 }])
    expect(one).toBe(6)
    expect(two - one).toBeCloseTo(3.6)
  })
  it('served never exceeds demand or the bottleneck', () => {
    for (const d of [100, 500, 2000]) {
      const r = evaluateDay(prefab(), d, 1, p)
      expect(r.served).toBeLessThanOrEqual(d)
      expect(r.served + r.spilled).toBeCloseTo(d)
    }
    expect(evaluateDay(prefab(), 5000, 1, p).spilled).toBeGreaterThan(0)
  })
  it('profit = fees + retail - upkeep', () => {
    const r = evaluateDay(prefab(), 300, 1, p)
    expect(r.profit).toBeCloseTo(r.feeRevenue + r.retailRevenue - r.upkeep)
  })
  it('relieving the bottleneck has positive marginal value', () => {
    const r = evaluateDay(prefab(), 2000, 2, p)
    const fix = ITEMS.find((i) => i.stage === r.bottleneck && i.unlockLevel <= 2)!
    expect(marginalNet(prefab(), fix.id, 2000, 2, p)).toBeGreaterThan(0)
  })
  it('happiness drives growth sign', () => {
    expect(growthRate(40, p)).toBe(0)
    expect(growthRate(70, p)).toBeGreaterThan(0)
    expect(growthRate(10, p)).toBeLessThan(0)
  })
  it('strategies are deterministic and respect unlock levels', () => {
    const q = { ...p, days: 60 }
    const a = runStrategy('balanced', q)
    expect(runStrategy('balanced', q).finalCash).toBe(a.finalCash)
    for (const s of ['greedy', 'cheapest', 'balanced'] as const) {
      const r = runStrategy(s, q)
      for (const [id, day] of Object.entries(r.firstBuyDay)) expect(r.daily[day].level).toBeGreaterThanOrEqual(item(id).unlockLevel)
    }
  })
})
