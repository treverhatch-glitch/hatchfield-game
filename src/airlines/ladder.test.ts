import { describe, expect, it } from 'vitest'
import { ROSTER, rosterByType } from './roster.ts'
import { LADDER_TIERS, LADDER_UNLOCK_GATES, UNLOCK_GATES } from './rosterConfig.ts'
import { isAirlineUnlocked, unlockGate } from './rosterOffers.ts'

describe('airline ladder (sys_03)', () => {
  it('gives every passenger carrier a ladder tier 0-5 and keeps cargo off the ladder', () => {
    for (const a of ROSTER) {
      if (a.type === 'cargo') expect(a.ladderTier).toBeNull()
      else expect(LADDER_TIERS).toContain(a.ladderTier)
    }
  })

  it('has a tier 0 a brand-new field can earn, and keeps tiers 2-4 locked on day one', () => {
    const day1 = { size: 1, reputation: 20 }
    const tier0 = ROSTER.filter((a) => a.ladderTier === 0)
    expect(tier0.length).toBeGreaterThan(0)
    expect(isAirlineUnlocked(tier0[0], day1)).toBe(true)
    for (const a of ROSTER) {
      if (a.ladderTier !== null && a.ladderTier >= 2) expect(isAirlineUnlocked(a, day1)).toBe(false)
    }
  })

  it('climbs: each tier needs at least the field size and more reputation than the one below', () => {
    for (let t = 1; t < LADDER_TIERS.length; t++) {
      const lo = LADDER_UNLOCK_GATES[LADDER_TIERS[t - 1]]
      const hi = LADDER_UNLOCK_GATES[LADDER_TIERS[t]]
      expect(hi.size).toBeGreaterThanOrEqual(lo.size)
      expect(hi.reputation).toBeGreaterThan(lo.reputation)
    }
  })

  it('leaves every existing unlock gate exactly where the per-type gates had it', () => {
    for (const a of ROSTER) {
      const g = UNLOCK_GATES[a.type]
      const rank = rosterByType(a.type).findIndex((r) => r.id === a.id)
      expect(unlockGate(a), a.id).toEqual({ size: g.size, reputation: Math.min(100, g.reputation + g.reputationStep * rank) })
    }
  })
})
