import { describe, expect, it } from 'vitest'
import { PRICE_WAR } from './pricewar.data.ts'
import {
  PriceWar,
  composeRivalWalkIn,
  responseWalkInLoss,
  startChance,
  undercutFee,
  warIntensity,
} from './pricewar.ts'

const quiet = { walkedAirlineIds: [] as string[], postedFeeIndex: 1, softOffer: null }
const forced = { startChance: 1, minDay: 1, poachChance: 0, cooldownDays: 3 }

describe('price war table', () => {
  it('amplifies intensity slightly for walked airlines and still caps the loss', () => {
    expect(warIntensity(0)).toBe(1)
    expect(warIntensity(3)).toBeGreaterThan(warIntensity(0))
    expect(warIntensity(40)).toBe(PRICE_WAR.intensityCap)
    expect(startChance(2)).toBeGreaterThan(startChance(0))
    expect(startChance(40)).toBeLessThanOrEqual(PRICE_WAR.startChanceCap)
    const calm = responseWalkInLoss('hold', warIntensity(0))
    const hot = responseWalkInLoss('hold', warIntensity(3))
    expect(hot).toBeGreaterThan(calm)
    expect(responseWalkInLoss('hold', 9)).toBeLessThanOrEqual(PRICE_WAR.walkInLossCap)
    expect(responseWalkInLoss('match', 2)).toBeLessThan(calm)
    expect(responseWalkInLoss('promote', 2)).toBeLessThan(responseWalkInLoss('match', 2))
  })

  it('caps combined rival walk-in loss at 25%', () => {
    expect(composeRivalWalkIn(1, 1)).toBe(1)
    expect(composeRivalWalkIn(0.95, 1)).toBeCloseTo(0.95)
    expect(composeRivalWalkIn(0.8, 0.88)).toBeCloseTo(0.75)
    expect(composeRivalWalkIn(0.75, 0.5)).toBeCloseTo(0.75)
    expect(undercutFee(1, 1)).toBeLessThan(1)
    expect(undercutFee(1, 4)).toBeGreaterThanOrEqual(PRICE_WAR.feeFloor)
  })
})

describe('price war engine', () => {
  it('starts a war, undercuts fees, and poaches a soft offer', () => {
    const war = PriceWar.create(3, { startChance: 1, poachChance: 1, poachChanceCap: 1, minDay: 1 })
    const event = war.advanceDay({
      walkedAirlineIds: [],
      postedFeeIndex: 1.1,
      softOffer: { id: 'harbor', name: 'Harbor Air' },
    })
    expect(event.started).toBe(true)
    expect(event.poachedOfferId).toBe('harbor')
    expect(war.stub().poached).toEqual(['harbor'])
    expect(war.stub().feeIndex).toBeLessThan(1.1)
    const card = war.card()
    expect(card?.pending).toBe(true)
    expect(card?.rivalFee).toBeLessThan(card?.playerFee ?? 0)
    expect(war.walkInFactor()).toBeLessThan(1)
    expect(war.marginFactor()).toBe(1)
  })

  it('matching cuts margin and recovers walk-in; holding keeps the loss', () => {
    const match = PriceWar.create(2, forced)
    const hold = PriceWar.create(2, forced)
    match.advanceDay(quiet)
    hold.advanceDay(quiet)
    const pressured = hold.walkInFactor()
    expect(pressured).toBeLessThan(1)
    expect(match.quote('match').cost).toBe(0)
    expect(hold.quote('promote').cost).toBe(PRICE_WAR.promoteCost)
    match.commit('match')
    hold.commit('hold')
    expect(match.marginFactor()).toBe(PRICE_WAR.matchMargin)
    expect(hold.marginFactor()).toBe(1)
    expect(match.walkInFactor()).toBeGreaterThan(hold.walkInFactor())
    expect(match.walkInFactor()).toBeGreaterThan(pressured)
    expect(match.card()?.pending).toBe(false)
    for (let i = 0; i < PRICE_WAR.matchDays; i++) match.advanceDay(quiet)
    expect(match.marginFactor()).toBe(1)
    expect(match.walkInFactor()).toBe(1)
  })

  it('counter-promote recovers walk-in without cutting the tariff', () => {
    const war = PriceWar.create(2, forced)
    war.advanceDay(quiet)
    const before = war.walkInFactor()
    const done = war.commit('promote')
    expect(done.cost).toBe(PRICE_WAR.promoteCost)
    expect(war.marginFactor()).toBe(1)
    expect(war.walkInFactor()).toBeGreaterThan(before)
    expect(war.walkInFactor()).toBeCloseTo(1 - PRICE_WAR.promoteLoss)
  })

  it('walked airlines deepen the same war', () => {
    const tune = { ...forced, poachChance: 0 }
    const calm = PriceWar.create(9, tune)
    const hot = PriceWar.create(9, tune)
    calm.advanceDay(quiet)
    hot.advanceDay({ ...quiet, walkedAirlineIds: ['harbor', 'summit', 'harbor'] })
    expect(hot.card()?.walked).toBe(2)
    expect(hot.card()?.intensity).toBeGreaterThan(calm.card()?.intensity ?? 0)
    expect(hot.walkInFactor()).toBeLessThan(calm.walkInFactor())
    expect(hot.stub().feeIndex).toBeLessThan(calm.stub().feeIndex)
  })

  it('clamps a steep hold at the walk-in cap', () => {
    const war = PriceWar.create(1, { ...forced, holdLoss: 0.9, walkInLossCap: 0.25 })
    war.advanceDay(quiet)
    expect(war.walkInFactor()).toBeCloseTo(0.75)
  })

  it('auto-holds when the player ignores the card', () => {
    const war = PriceWar.create(1, { ...forced, responseWindowDays: 2, holdDays: 3 })
    war.advanceDay(quiet)
    expect(war.card()?.pending).toBe(true)
    const next = war.advanceDay(quiet)
    expect(next.resolved).toBe(false)
    expect(war.card()?.pending).toBe(true)
    const held = war.advanceDay(quiet)
    expect(held.resolved).toBe(true)
    expect(war.card()?.choice).toBe('hold')
    expect(war.marginFactor()).toBe(1)
  })

  it('is deterministic for a fixed seed and diverges across seeds', () => {
    const run = (seed: number) => {
      const war = PriceWar.create(seed)
      const input = {
        walkedAirlineIds: ['harbor'],
        postedFeeIndex: 1.02,
        softOffer: { id: 'summit', name: 'Summit' },
      }
      for (let day = 0; day < 16; day++) {
        const event = war.advanceDay(input)
        if (event.started) war.commit(day % 2 === 0 ? 'match' : 'hold')
      }
      return war.serialize()
    }
    expect(run(42)).toBe(run(42))
    expect(run(42)).not.toBe(run(99))
    const restored = PriceWar.restore(run(42))
    const again = PriceWar.create(42)
    const input = {
      walkedAirlineIds: ['harbor'],
      postedFeeIndex: 1.02,
      softOffer: { id: 'summit', name: 'Summit' },
    }
    for (let day = 0; day < 16; day++) {
      const event = again.advanceDay(input)
      if (event.started) again.commit(day % 2 === 0 ? 'match' : 'hold')
    }
    expect(restored?.serialize()).toBe(again.serialize())
  })

  it('opens a war for the playtest seed within four days', () => {
    const war = PriceWar.create(1)
    let started = 0
    for (let i = 0; i < 4 && !started; i++) {
      if (war.advanceDay(quiet).started) started = war.day
    }
    expect(started).toBeGreaterThan(0)
    expect(started).toBeLessThanOrEqual(4)
  })
})
