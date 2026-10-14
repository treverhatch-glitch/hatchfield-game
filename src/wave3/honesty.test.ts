import { describe, expect, it } from 'vitest'
import {
  CAREFUL_TURNS_PER_DAY,
  CONTRACT_TIERS,
  PREFERRED_DAY_MAX,
  PREFERRED_DAY_MIN,
  RELATION_FEE_OWNER,
  SCORE_ON_CANCEL,
  SCORE_ON_DELAY,
  SCORE_ON_SUCCESS,
} from './config.ts'
import { Wave3Engine } from './engine.ts'
import { classifyTurn, extraSlotLine, relationshipLandingFactor } from './honesty.ts'
import { emptyRelations, noteLetter, noteTurnaround, readRelation, reviewRelationDay, tierOf } from './relations.ts'
import { applyTierToTerms } from './contracts.ts'

/** Tight apron: the climb is the clean turns, not the lounge. */
const field = { stands: 0, gates: 0, lounges: 0 }

const terms = {
  slotsPerWeek: 14,
  feePerPassenger: 5,
  feePerLanding: 150,
  penaltyPerCancellation: 500,
  penaltyPerDelayMinute: 5,
}

describe('relationship fee is one factor', () => {
  it('keeps a tier-1 neutral landing identical to the old stacked formula', () => {
    expect(RELATION_FEE_OWNER).toBe('wave3')
    const airframe = 1.1
    const spec = 1.05
    const diplomacyNeutral = 1
    const tier1 = CONTRACT_TIERS[0].feeMult
    expect(tier1).toBe(1)
    const today = airframe * spec * diplomacyNeutral * tier1
    const next = airframe * spec * relationshipLandingFactor(tier1)
    expect(next).toBe(today)
  })

  it('does not stack a diplomacy discount on top of the wave 3 factor', () => {
    const airframe = 1
    const spec = 1
    const preferred = CONTRACT_TIERS[1].feeMult
    const diplomacyDiscount = 0.92
    const bill = airframe * spec * relationshipLandingFactor(preferred)
    expect(bill).toBeCloseTo(preferred, 5)
    expect(bill).not.toBeCloseTo(preferred * diplomacyDiscount, 5)
  })
})

describe('turn outcomes', () => {
  it('scores a cancel and a divert, and excuses weather', () => {
    expect(classifyTurn({ cancelled: true })).toBe('cancel')
    expect(classifyTurn({ diverted: true })).toBe('cancel')
    expect(classifyTurn({ cancelled: true, excused: true })).toBeNull()
  })

  it('scores a late departure or a poor turnaround grade, not an arrival slip', () => {
    expect(classifyTurn({ grade: 'A', departureLateMin: 0 })).toBe('success')
    expect(classifyTurn({ grade: 'B', departureLateMin: 10 })).toBe('success')
    expect(classifyTurn({ grade: 'A', departureLateMin: 16 })).toBe('delay')
    expect(classifyTurn({ grade: 'C', departureLateMin: 0 })).toBe('delay')
    expect(classifyTurn({ grade: 'F' })).toBe('delay')
    expect(classifyTurn({})).toBe('success')
  })
})

describe('extra slots are a one-time timetable grant', () => {
  it('names the rows the day review writes, and nothing at tier 1', () => {
    expect(extraSlotLine(0)).toBe('Extra slots · 0')
    expect(extraSlotLine(1)).toBe('Extra slots · +1 on the timetable')
    const published = new Wave3Engine()
    expect(published.routesDue('harbor')).toBe(0)
    expect(published.slotLine('harbor')).toBe('Extra slots · 0')
    const preferred = new Wave3Engine()
    while (preferred.relation('harbor').tier < 2) preferred.noteTurnaround('harbor', 'success')
    expect(preferred.routesDue('harbor')).toBe(1)
    expect(preferred.slotLine('harbor')).toContain('+1 on the timetable')
    preferred.noteRoutesGranted('harbor', preferred.routesDue('harbor'))
    expect(preferred.routesDue('harbor')).toBe(0)
    expect(applyTierToTerms(terms, 1).slotsPerWeek).toBe(14)
    expect(applyTierToTerms(terms, 2).slotsPerWeek).toBe(15)
  })
})

describe('preferred pace', () => {
  it('reaches Preferred in about 20 to 30 days of careful service', () => {
    let state = noteLetter(emptyRelations(), 'harbor', 'accept')
    let reached: number | null = null
    for (let day = 1; day <= PREFERRED_DAY_MAX; day++) {
      state = noteTurnaround(state, 'harbor', 'success')
      state = reviewRelationDay(state, { day, signed: ['harbor'], ...field })
      if (tierOf(state, 'harbor') >= 2) {
        reached = day
        break
      }
    }
    expect(reached).not.toBeNull()
    expect(reached!).toBeGreaterThanOrEqual(PREFERRED_DAY_MIN)
    expect(reached!).toBeLessThanOrEqual(PREFERRED_DAY_MAX)
    expect(readRelation(state, 'harbor').score).toBeGreaterThanOrEqual(20)
    expect(SCORE_ON_SUCCESS).toBeGreaterThan(0)

    let early = noteLetter(emptyRelations(), 'harbor', 'accept')
    for (let day = 1; day < PREFERRED_DAY_MIN; day++) {
      early = noteTurnaround(early, 'harbor', 'success')
      early = reviewRelationDay(early, { day, signed: ['harbor'], ...field })
    }
    expect(tierOf(early, 'harbor')).toBe(1)
  })

  it('stays Published when every turn is a real delay', () => {
    let state = noteLetter(emptyRelations(), 'harbor', 'accept')
    for (let day = 1; day <= 60; day++) {
      for (let turn = 0; turn < CAREFUL_TURNS_PER_DAY; turn++) state = noteTurnaround(state, 'harbor', 'delay')
      state = reviewRelationDay(state, { day, signed: ['harbor'], ...field })
    }
    expect(tierOf(state, 'harbor')).toBe(1)
    expect(readRelation(state, 'harbor').score).toBeLessThan(20)
    expect(SCORE_ON_DELAY).toBeLessThan(0)
    expect(SCORE_ON_CANCEL).toBeLessThan(SCORE_ON_DELAY)
  })
})
