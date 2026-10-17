import { describe, expect, it } from 'vitest'
import { WEAR_RECOVER_DAYS, aircraftWear, daysSince, quantizeWear, tierBaseWear } from './airframeWear'

describe('airframe wear', () => {
  it('top tier is near fresh, budget tier 0 is the most worn', () => {
    expect(tierBaseWear(5, 'luxury')).toBe(0)
    expect(tierBaseWear(0, 'budget')).toBeGreaterThan(0.9)
    for (let t = 1; t <= 5; t++) expect(tierBaseWear(t)).toBeLessThan(tierBaseWear(t - 1))
  })

  it('is deterministic per tail and differs slightly between tails', () => {
    const a = aircraftWear({ tier: 2, seed: 'flt-abc' })
    expect(aircraftWear({ tier: 2, seed: 'flt-abc' })).toBe(a)
    const spread = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => aircraftWear({ tier: 2, seed: s })))
    expect(spread.size).toBeGreaterThan(1)
    for (const w of spread) expect(Math.abs(w - tierBaseWear(2))).toBeLessThanOrEqual(0.11)
  })

  it('service resets to fresh and creeps back to the baseline', () => {
    expect(aircraftWear({ tier: 0, daysSinceService: 0 })).toBe(0)
    const half = aircraftWear({ tier: 0, daysSinceService: WEAR_RECOVER_DAYS / 2 })
    expect(half).toBeCloseTo(quantizeWear(tierBaseWear(0) / 2), 5)
    expect(aircraftWear({ tier: 0, daysSinceService: WEAR_RECOVER_DAYS * 3 })).toBe(aircraftWear({ tier: 0 }))
    expect(daysSince(360, 0)).toBe(2)
    expect(daysSince(360, undefined)).toBeUndefined()
  })
})
