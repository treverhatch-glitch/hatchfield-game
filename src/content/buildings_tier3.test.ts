import { describe, expect, it } from 'vitest'
import { MAX_FIELD_LEVEL, PRESTIGE_STARS } from '../game/catalog.ts'
import { catalog as TIER3PLUS_CATALOG } from '../tier3plus/catalog.ts'
import { LATE_BUILDINGS, PRESTIGE_LANDMARKS, TIER3_BUILDINGS } from './buildings_tier3.ts'

const MIN_TIER3_FL = 7

describe('Tier III + prestige building data', () => {
  it('has 10 Tier III buildings and 6 prestige landmarks', () => {
    expect(TIER3_BUILDINGS).toHaveLength(10)
    expect(PRESTIGE_LANDMARKS).toHaveLength(6)
  })

  it('uses unique ids that do not repeat the tier3plus catalog', () => {
    const ids = LATE_BUILDINGS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const existing of TIER3PLUS_CATALOG) expect(ids).not.toContain(existing.id)
  })

  it('charges a positive cost and daily upkeep for everything (nothing is free)', () => {
    for (const b of LATE_BUILDINGS) {
      expect(Number.isFinite(b.cost), b.id).toBe(true)
      expect(b.cost, b.id).toBeGreaterThan(0)
      expect(Number.isFinite(b.upkeepPerDay), b.id).toBe(true)
      expect(b.upkeepPerDay, b.id).toBeGreaterThan(0)
      expect(b.upkeepPerDay, b.id).toBeLessThan(b.cost)
    }
  })

  it('keeps unlock levels in range', () => {
    for (const b of LATE_BUILDINGS) {
      expect(Number.isInteger(b.unlockFL), b.id).toBe(true)
      expect(b.unlockFL, b.id).toBeGreaterThanOrEqual(MIN_TIER3_FL)
      expect(b.unlockFL, b.id).toBeLessThanOrEqual(MAX_FIELD_LEVEL)
    }
    for (const p of PRESTIGE_LANDMARKS) {
      expect(p.unlockFL, p.id).toBeGreaterThanOrEqual(8)
      expect(Number.isInteger(p.unlockPrestigeStars), p.id).toBe(true)
      expect(p.unlockPrestigeStars, p.id).toBeGreaterThanOrEqual(0)
      expect(p.unlockPrestigeStars, p.id).toBeLessThanOrEqual(PRESTIGE_STARS)
      if (p.unlockPrestigeStars > 0) expect(p.unlockFL, p.id).toBe(MAX_FIELD_LEVEL)
    }
  })

  it('has real-meter footprints, staff, build time and finite effects', () => {
    for (const b of LATE_BUILDINGS) {
      expect(b.footprint.widthM, b.id).toBeGreaterThan(0)
      expect(b.footprint.depthM, b.id).toBeGreaterThan(0)
      // Nothing late-game is bigger than a kilometer on a side.
      expect(Math.max(b.footprint.widthM, b.footprint.depthM), b.id).toBeLessThanOrEqual(1_000)
      expect(b.staff, b.id).toBeGreaterThan(0)
      expect(b.buildDays, b.id).toBeGreaterThan(0)
      const values = Object.values(b.effects)
      expect(values.length, b.id).toBeGreaterThan(0)
      for (const v of values) {
        expect(Number.isFinite(v), b.id).toBe(true)
        expect(v, b.id).toBeGreaterThan(0)
      }
      expect(b.purpose.length, b.id).toBeGreaterThan(0)
      expect(b.catch.length, b.id).toBeGreaterThan(0)
    }
  })

  it('prices cargo hub II and the approach centre under the previous rung', () => {
    const cheapest = new Map<number, number>()
    for (const b of TIER3_BUILDINGS) {
      cheapest.set(b.unlockFL, Math.min(cheapest.get(b.unlockFL) ?? Infinity, b.cost))
    }
    // Field level 7 still steps up from the tier below. The two rebalanced
    // buys are the cheap entry at 8 and 9 so a one-carrier field can reach them.
    expect(cheapest.get(7)).toBe(280_000)
    expect(cheapest.get(8)).toBe(220_000)
    expect(cheapest.get(9)).toBe(160_000)
    expect(cheapest.get(10)!).toBeGreaterThan(cheapest.get(9)!)
  })

  it('keeps prestige landmarks unique, pricey and within bonus ranges', () => {
    for (const p of PRESTIGE_LANDMARKS) {
      expect(p.unique, p.id).toBe(true)
      expect(p.cost, p.id).toBeGreaterThanOrEqual(500_000)
      expect(p.prestigeStars, p.id).toBeGreaterThanOrEqual(1)
      expect(p.prestigeStars, p.id).toBeLessThanOrEqual(3)
      expect(p.cityApprovalBonus, p.id).toBeGreaterThanOrEqual(0)
      expect(p.cityApprovalBonus, p.id).toBeLessThanOrEqual(15)
      expect(p.effects.touristFootfallPerDay ?? 0, p.id).toBeGreaterThan(0)
      expect(p.effects.ratingBonus ?? 0, p.id).toBeGreaterThan(0)
    }
  })
})
