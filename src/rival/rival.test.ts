import { describe, expect, it } from 'vitest'
import { RIVAL, RIVAL_NAME } from './config.ts'
import {
  courtCost,
  dailyIncome,
  dailyUpkeep,
  demandSplit,
  expandCost,
  feeBlend,
  poachChance,
} from './demand.ts'
import { RivalAirport, createRivalState } from './engine.ts'
import { createRivalRng } from './rng.ts'
import type { PlayerSnapshot, RivalState, Walkaway } from './types.ts'

function player(partial: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    name: 'Hatchfield',
    feeIndex: 1,
    service: 40,
    capacity: 2,
    reputation: 40,
    airlines: [],
    ...partial,
  }
}

function unhappy(): PlayerSnapshot {
  return player({
    feeIndex: 1.2,
    service: 30,
    capacity: 2,
    reputation: 30,
    airlines: [{ id: 'northline', name: 'Northline', tier: 2, kind: 'pax', standing: 10 }],
  })
}

describe('catchment demand', () => {
  it('keeps the player load factor at 1 when the airports match', () => {
    const same = { feeIndex: 1, service: 50, capacity: 4 }
    const split = demandSplit(same, { fees: { landing: 1, passenger: 1, cargo: 1 }, service: 50, capacity: 4 })
    expect(split.playerShare).toBeCloseTo(0.5, 5)
    expect(split.rivalShare).toBeCloseTo(0.5, 5)
    expect(split.playerFactor).toBeCloseTo(1, 5)
  })

  it('gives a cheaper, better-run, larger field more of the catchment', () => {
    const split = demandSplit(
      { feeIndex: 1.25, service: 30, capacity: 1 },
      { fees: { landing: 0.82, passenger: 0.82, cargo: 0.82 }, service: 72, capacity: 8 },
    )
    expect(split.rivalShare).toBeGreaterThan(split.playerShare)
    expect(split.playerFactor).toBeLessThan(1)
    expect(split.playerFactor).toBeGreaterThanOrEqual(RIVAL.demandMin)
  })

  it('starts Bellwater near parity with a two-stand starter field', () => {
    const split = RivalAirport.create(1).demand({ feeIndex: 1, service: 40, capacity: 2 })
    expect(split.playerFactor).toBe(1)
  })

  it('leaves loads alone when the edge is only a few points', () => {
    const split = demandSplit(
      { feeIndex: 1, service: 55, capacity: 2 },
      { fees: { landing: 1.02, passenger: 1.02, cargo: 1.02 }, service: 50, capacity: 3 },
    )
    expect(Math.abs(split.playerShare - 0.5)).toBeLessThan(0.08)
    expect(split.playerFactor).toBe(1)
  })
})

describe('Bellwater day', () => {
  it('undercuts a cheaper player and pays for a stand when the roster is full', () => {
    const rival = RivalAirport.create(2)
    const before = RIVAL.startTreasury
    const result = rival.advanceDay(player(), [])
    expect(result.day).toBe(1)
    expect(result.moves.some((m) => m.kind === 'undercut' && m.announce)).toBe(true)
    expect(result.moves.some((m) => m.kind === 'expand')).toBe(true)
    const model = rival.panel(player())
    expect(model.fees.landing).toBeCloseTo(1.02, 5)
    expect(model.fees.passenger).toBeCloseTo(1.01, 5)
    expect(model.fees.cargo).toBeCloseTo(1.04, 5)
    expect(model.capacity).toBe(3)
    const income = dailyIncome(2, { landing: 1.05, passenger: 1.04, cargo: 1.07 })
    const spent = income - dailyUpkeep(2) - expandCost(2)
    expect(model.treasury).toBe(Math.round(before + spent))
    expect(model.treasury).toBeLessThan(before)
  })

  it('courts a carrier that walked off the player field', () => {
    const rival = RivalAirport.create(1)
    const walked: Walkaway = { id: 'northline', name: 'Northline', tier: 2, kind: 'pax', reason: 'heat' }
    const result = rival.advanceDay(player({ feeIndex: feeBlend(RIVAL.fees) }), [walked])
    expect(rival.rosterIds()).toContain('northline')
    expect(result.moves.some((m) => m.kind === 'court' && m.text.includes('Northline'))).toBe(true)
  })

  it('drops a carrier the player has already signed', () => {
    const rival = RivalAirport.create(1)
    const move = rival.releaseToPlayer('bushline', 'Bushline Local')
    expect(move?.tone).toBe('good')
    expect(rival.rosterIds()).not.toContain('bushline')
    const again = rival.advanceDay(
      player({
        feeIndex: feeBlend(RIVAL.fees),
        airlines: [{ id: 'bushline', name: 'Bushline Local', tier: 1, kind: 'pax', standing: 70 }],
      }),
      [],
    )
    expect(again.moves.some((m) => m.kind === 'lost')).toBe(false)
  })

  it('refuses a fee cut that the books cannot carry', () => {
    const state = createRivalState(1)
    state.roster = []
    state.capacity = 8
    state.treasury = 0
    state.fees = { landing: 0.9, passenger: 0.9, cargo: 0.9 }
    const rival = RivalAirport.restore(state)
    expect(rival).not.toBeNull()
    const result = rival!.advanceDay(player({ feeIndex: 0.7 }), [])
    expect(result.moves.some((m) => m.kind === 'hold')).toBe(true)
    expect(rival!.panel(player()).fees.landing).toBeCloseTo(0.9, 5)
  })

  it('stops cutting at the fee floor', () => {
    const rival = RivalAirport.create(4)
    const calm = player({ feeIndex: 0.5, service: 70, capacity: 8 })
    for (let i = 0; i < 20; i++) rival.advanceDay(calm, [])
    const model = rival.panel(calm)
    expect(model.fees.landing).toBe(RIVAL.feeFloor)
    expect(model.fees.passenger).toBe(RIVAL.feeFloor)
    expect(model.fees.cargo).toBe(RIVAL.feeFloor)
    expect(model.capacity).toBeLessThanOrEqual(RIVAL.maxCapacity)
    expect(Number.isFinite(model.treasury)).toBe(true)
  })

  it('does not poach a happy carrier', () => {
    const rival = RivalAirport.create(5)
    const happy = player({
      airlines: [{ id: 'harbor', name: 'Harbor Air', tier: 3, kind: 'pax', standing: 80 }],
    })
    for (let i = 0; i < 12; i++) {
      const day = rival.advanceDay(happy, [])
      expect(day.poached).toHaveLength(0)
    }
  })

  it('poaches an unhappy carrier from the same roll the chance function uses', () => {
    let wins = 0
    let losses = 0
    for (let seed = 1; seed < 40 && (wins === 0 || losses === 0); seed++) {
      const state = createRivalState(seed)
      state.day = RIVAL.poachMinDay - 1
      state.lastPoachDay = -RIVAL.poachCooldownDays
      state.lastExpandDay = state.day
      state.capacity = 4
      state.fees = { landing: 0.9, passenger: 0.9, cargo: 0.9 }
      // Park service on the drift target so the poach roll sees this value.
      const util = state.roster.length / state.capacity
      state.service = Math.min(88, Math.max(28, 46 + (1 - util) * 16 + (state.reputation - 50) * 0.12))
      const rival = RivalAirport.restore(state)!
      const roll = createRivalRng(seed).next()
      const chance = poachChance({
        standing: 10,
        playerFee: 1.2,
        rivalFee: 0.9,
        playerService: 30,
        rivalService: state.service,
      })
      const result = rival.advanceDay(unhappy(), [])
      const won = result.poached.length === 1
      expect(won).toBe(roll < chance)
      if (won) {
        wins += 1
        expect(result.poached[0].id).toBe('northline')
        expect(rival.rosterIds()).toContain('northline')
      } else {
        losses += 1
      }
    }
    expect(wins).toBeGreaterThan(0)
    expect(losses).toBeGreaterThan(0)
  })
})

describe('courting Bellwater', () => {
  it('prices a pitch from the carrier tier', () => {
    expect(courtCost(1)).toBe(RIVAL.courtBaseCost + RIVAL.courtPerTier)
    expect(courtCost(4)).toBe(RIVAL.courtBaseCost + 4 * RIVAL.courtPerTier)
  })

  it('moves a carrier when the roll lands, and raises loyalty when it does not', () => {
    const offer = { feeIndex: 0.9, service: 70, capacity: 6 }
    let wins = 0
    let losses = 0
    for (let seed = 1; seed < 30 && (wins === 0 || losses === 0); seed++) {
      const rival = RivalAirport.create(seed)
      const quote = rival.quoteCourt('bushline', offer)
      const roll = createRivalRng(seed).next()
      const result = rival.commitCourt('bushline', offer)
      expect(result.ok).toBe(true)
      expect(result.cost).toBe(quote.cost)
      expect(result.won).toBe(roll < quote.chance)
      if (result.won) {
        wins += 1
        expect(rival.rosterIds()).not.toContain('bushline')
        expect(result.carrier?.id).toBe('bushline')
      } else {
        losses += 1
        const loyalty = rival.panel(player()).roster.find((c) => c.id === 'bushline')?.loyalty
        expect(loyalty).toBe(RIVAL.home[0].loyalty + RIVAL.courtLoyaltyBump)
      }
    }
    expect(wins).toBeGreaterThan(0)
    expect(losses).toBeGreaterThan(0)
  })

  it('rejects a pitch for a carrier that is not based there', () => {
    const quote = RivalAirport.create(1).quoteCourt('crown', { feeIndex: 1, service: 40, capacity: 2 })
    expect(quote.ok).toBe(false)
  })
})

describe('rival save', () => {
  it('round-trips the day, fees, roster and the next draw', () => {
    const rival = RivalAirport.create(9)
    rival.advanceDay(player(), [{ id: 'harbor', name: 'Harbor Air', tier: 3, kind: 'pax', reason: 'standing' }])
    const raw = rival.serialize()
    const restored = RivalAirport.restore(raw)
    expect(restored).not.toBeNull()
    const left = rival.panel(player())
    const right = restored!.panel(player())
    expect(right.day).toBe(left.day)
    expect(right.fees).toEqual(left.fees)
    expect(right.roster.map((c) => c.id)).toEqual(left.roster.map((c) => c.id))
    expect(right.treasury).toBe(left.treasury)
    expect(restored!.serialize()).toBe(raw)
  })

  it('ignores a broken save', () => {
    expect(RivalAirport.restore('not-json')).toBeNull()
    expect(RivalAirport.restore('{"version":2}')).toBeNull()
  })

  it('names the competitor Bellwater Intl', () => {
    const model = RivalAirport.create(1).panel(player())
    expect(model.name).toBe(RIVAL_NAME)
    expect(model.comparison.map((row) => row.label)).toEqual(['Tariff', 'Service', 'Stands', 'Reputation', 'Demand'])
    expect(model.moves[0].text).toContain('Bushline')
  })
})

describe('books', () => {
  it('charges daily upkeep even with an empty roster', () => {
    const state: RivalState = createRivalState(1)
    state.roster = []
    const rival = RivalAirport.restore(state)!
    const blend = feeBlend(RIVAL.fees)
    rival.advanceDay(player({ feeIndex: blend }), [])
    const model = rival.panel(player({ feeIndex: blend }))
    expect(model.treasury).toBe(RIVAL.startTreasury - dailyUpkeep(RIVAL.startCapacity))
    expect(model.capacity).toBe(RIVAL.startCapacity)
  })
})
