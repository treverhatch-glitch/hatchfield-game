import { describe, it, expect } from 'vitest'
import { AWARDS, RESERVED_AWARD_IDS, validateAwards, awardMatches } from './awards.ts'
import type { AwardCriterionKind, AwardDef } from './awards.ts'

describe('Awards validation', () => {
  it('AWARDS list has exactly 12 awards', () => {
    expect(AWARDS.length).toBe(12)
  })

  it('AWARDS validation passes cleanly on shipped data', () => {
    const errors = validateAwards(AWARDS, RESERVED_AWARD_IDS)
    expect(errors).toEqual([])
  })

  it('rejects duplicate award ids', () => {
    const badAwards: AwardDef[] = [
      { id: 'foo', name: 'Foo 1', blurb: '', prestige: 5, reputation: 3, criteria: [{ kind: 'passengers', min: 10 }] },
      { id: 'foo', name: 'Foo 2', blurb: '', prestige: 5, reputation: 3, criteria: [{ kind: 'passengers', min: 10 }] }
    ]
    const errors = validateAwards(badAwards, [])
    expect(errors).toContain('Duplicate award ID: foo')
  })

  it('rejects duplicate award names', () => {
    const badAwards: AwardDef[] = [
      { id: 'foo1', name: 'Foo', blurb: '', prestige: 5, reputation: 3, criteria: [{ kind: 'passengers', min: 10 }] },
      { id: 'foo2', name: 'Foo', blurb: '', prestige: 5, reputation: 3, criteria: [{ kind: 'passengers', min: 10 }] }
    ]
    const errors = validateAwards(badAwards, [])
    expect(errors).toContain('Duplicate award name: Foo')
  })

  it('rejects awards with reserved ids', () => {
    const badAwards: AwardDef[] = [
      { id: 'cleanest_terminal', name: 'Some Award', blurb: '', prestige: 5, reputation: 3, criteria: [{ kind: 'passengers', min: 10 }] }
    ]
    const errors = validateAwards(badAwards, RESERVED_AWARD_IDS)
    expect(errors).toContain('Award ID conflicts with reserved ID: cleanest_terminal')
  })

  it('rejects out of range prestige and reputation', () => {
    const badAwards: AwardDef[] = [
      { id: 'foo1', name: 'Foo1', blurb: '', prestige: 1, reputation: 3, criteria: [{ kind: 'passengers', min: 10 }] },
      { id: 'foo2', name: 'Foo2', blurb: '', prestige: 13, reputation: 3, criteria: [{ kind: 'passengers', min: 10 }] },
      { id: 'foo3', name: 'Foo3', blurb: '', prestige: 5, reputation: 0, criteria: [{ kind: 'passengers', min: 10 }] },
      { id: 'foo4', name: 'Foo4', blurb: '', prestige: 5, reputation: 7, criteria: [{ kind: 'passengers', min: 10 }] }
    ]
    const errors = validateAwards(badAwards, [])
    expect(errors).toContain('Award foo1 prestige out of range (2-12): 1')
    expect(errors).toContain('Award foo2 prestige out of range (2-12): 13')
    expect(errors).toContain('Award foo3 reputation out of range (1-6): 0')
    expect(errors).toContain('Award foo4 reputation out of range (1-6): 7')
  })

  it('rejects empty criteria or invalid criteria min values', () => {
    const badAwards: AwardDef[] = [
      { id: 'foo1', name: 'Foo1', blurb: '', prestige: 5, reputation: 3, criteria: [] },
      { id: 'foo2', name: 'Foo2', blurb: '', prestige: 5, reputation: 3, criteria: [{ kind: 'passengers', min: -1 }] },
      { id: 'foo3', name: 'Foo3', blurb: '', prestige: 5, reputation: 3, criteria: [{ kind: 'passengers', min: NaN }] }
    ]
    const errors = validateAwards(badAwards, [])
    expect(errors).toContain('Award foo1 must have at least one criterion')
    expect(errors).toContain('Award foo2 criterion passengers min is invalid: -1')
    expect(errors).toContain('Award foo3 criterion passengers min is invalid: NaN')
  })

  describe('awardMatches', () => {
    const def: AwardDef = {
      id: 'test',
      name: 'Test',
      blurb: '',
      prestige: 5,
      reputation: 3,
      criteria: [
        { kind: 'passengers', min: 100 },
        { kind: 'satisfaction', min: 80 }
      ]
    }

    const baseSnapshot: Record<AwardCriterionKind, number> = {
      passengers: 0,
      satisfaction: 0,
      cleanliness: 0,
      net: 0,
      on_time_pct: 0,
      transfer_pct: 0,
      leased_units: 0,
      avg_quality: 0,
      green_share: 0,
      cargo_tonnes: 0
    }

    it('returns true when all criteria are met', () => {
      expect(awardMatches(def, { ...baseSnapshot, passengers: 100, satisfaction: 80 })).toBe(true)
      expect(awardMatches(def, { ...baseSnapshot, passengers: 105, satisfaction: 85 })).toBe(true)
    })

    it('returns false when at least one criterion is not met', () => {
      expect(awardMatches(def, { ...baseSnapshot, passengers: 99, satisfaction: 80 })).toBe(false)
      expect(awardMatches(def, { ...baseSnapshot, passengers: 100, satisfaction: 79 })).toBe(false)
    })
    
    it('returns false if a required criterion is completely missing from snapshot', () => {
      // Simulate missing key scenario, by omitting one property
      const incompleteSnapshot = {
        passengers: 100
      } as Record<AwardCriterionKind, number>
      
      expect(awardMatches(def, incompleteSnapshot)).toBe(false)
    })
  })
})
