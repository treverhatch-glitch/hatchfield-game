import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { RIVAL_NAME } from './config.ts'
import { SAVE_KEY } from '../game/types.ts'
import { PRICE_WAR } from './pricewar.data.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  expect(game.buyLand('city')).toBe(true)
  game.buildStarterKit()
  return game
}

describe('rival on the live field', () => {
  it('stays near parity on a starter kit and advances one game-day', () => {
    const game = field()
    const factor = game.rivalDemandFactor()
    expect(factor).toBeGreaterThan(0.9)
    expect(factor).toBeLessThan(1.08)
    const opening = game.rivalPanel()
    expect(opening?.name).toBe(RIVAL_NAME)
    expect(opening?.roster.map((c) => c.id).sort()).toEqual(['bushline', 'upps'])

    game.speed = 1
    game.tick(180)
    const day = game.rivalPanel()
    expect(day?.day).toBe(1)
    expect(day!.capacity).toBeGreaterThanOrEqual(2)
    expect(day!.capacity).toBeLessThanOrEqual(8)
  })

  it('pulls a Bellwater carrier when the player signs them, and courts one that walks', () => {
    const game = field()
    game.offer = { airline: 'bushline', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toContain('bushline')
    expect(game.rivalPanel()?.roster.some((c) => c.id === 'bushline')).toBe(false)

    game.paxDesks = 8
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.abandonAirline('northline', 'heat')
    expect(game.signed).not.toContain('northline')
    game.speed = 1
    game.tick(180)
    expect(game.rivalPanel()?.roster.some((c) => c.id === 'northline')).toBe(true)
  })

  it('charges a real court fee and only signs the carrier when the pitch lands', () => {
    const game = field()
    const before = game.cash
    game.courtRivalCarrier('northline')
    expect(game.cash).toBe(before)
    expect(game.signed).not.toContain('northline')

    game.courtRivalCarrier('bushline')
    expect(game.cash).toBe(before - 20_000)
    const based = game.rivalPanel()?.roster.some((c) => c.id === 'bushline')
    if (game.signed.includes('bushline')) expect(based).toBe(false)
    else expect(based).toBe(true)
  })

  it('restores Bellwater with the field', () => {
    const game = field()
    game.speed = 1
    game.tick(180)
    const day = game.rivalPanel()?.day
    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.rivalPanel()?.name).toBe(RIVAL_NAME)
    expect(loaded.rivalPanel()?.day).toBe(day)
  })
})

function warField(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.diplomacySeed = 1
  expect(game.buyLand('city')).toBe(true)
  game.cash = 80_000
  return game
}

function untilWar(game: Game, limit = 12): void {
  for (let i = 0; i < limit && !game.priceWarCard()?.pending; i++) game.advancePriceWarDay()
}

describe('price war on the field', () => {
  it('rolls on the game-day boundary', () => {
    const game = warField()
    expect(game.priceWarDay()).toBe(0)
    game.clock = 179
    game.tick(2)
    expect(game.priceWarDay()).toBe(1)
  })

  it('starts a war on the fixed seed, then match and hold change demand', () => {
    const match = warField()
    untilWar(match)
    const card = match.priceWarCard()
    expect(card?.pending).toBe(true)
    expect(card?.name).toBe('Bellwater Intl')
    expect(card?.rivalFee).toBeLessThan(card?.playerFee ?? 0)
    expect(match.alerts.active.some((row) => row.key.startsWith('event:price-war'))).toBe(true)
    const pressured = match.rivalWalkInFactor()
    expect(pressured).toBeLessThan(1)
    expect(pressured).toBeGreaterThanOrEqual(1 - PRICE_WAR.walkInLossCap)
    const cash = match.cash
    const park = match.parkUseFee('short')
    match.respondToPriceWar('match')
    expect(match.cash).toBe(cash)
    expect(match.priceWarCard()?.pending).toBe(false)
    expect(match.priceWarCard()?.choice).toBe('match')
    expect(match.parkUseFee('short')).toBe(Math.round(park * PRICE_WAR.matchMargin))
    expect(match.rivalWalkInFactor()).toBeGreaterThan(pressured)

    const hold = warField()
    untilWar(hold)
    const during = hold.rivalWalkInFactor()
    const heldPark = hold.parkUseFee('short')
    hold.respondToPriceWar('hold')
    expect(hold.rivalWalkInFactor()).toBeCloseTo(during, 5)
    expect(hold.parkUseFee('short')).toBe(heldPark)
  })

  it('spends marketing cash to counter-promote and refuses a short treasury', () => {
    const game = warField()
    untilWar(game)
    game.cash = 100
    game.respondToPriceWar('promote')
    expect(game.cash).toBe(100)
    expect(game.priceWarCard()?.pending).toBe(true)
    game.cash = 80_000
    game.respondToPriceWar('promote')
    expect(game.cash).toBe(80_000 - PRICE_WAR.promoteCost)
    expect(game.priceWarCard()?.choice).toBe('promote')
    expect(game.rivalWalkInFactor()).toBeGreaterThan(0.97)
  })

  it('keeps walked airlines and a hold inside the 25% walk-in cap', () => {
    const game = warField()
    for (const id of ['harbor', 'summit', 'northline', 'zoomjet', 'budgie_ultra'] as const) {
      game.presentNegotiation(id)
      for (const service of ['landing', 'pax', 'bags', 'fuel', 'catering', 'parking'] as const) {
        game.setNegotiationFee(service, 80)
      }
      game.counterNegotiation()
    }
    expect(game.rivalCard()?.airlines.length).toBe(5)
    untilWar(game)
    expect(game.priceWarCard()?.walked).toBe(5)
    expect(game.priceWarCard()?.intensity).toBeGreaterThan(1)
    game.respondToPriceWar('hold')
    expect(game.rivalWalkInFactor()).toBeCloseTo(0.75, 5)
  })

  it('pulls an open letter when Bellwater poaches it', () => {
    let found = false
    for (let seed = 1; seed <= 30 && !found; seed++) {
      const game = warField()
      game.diplomacySeed = seed
      game.presentNegotiation('harbor')
      for (let day = 0; day < 6 && !game.priceWarCard(); day++) game.advancePriceWarDay()
      if (game.priceWarCard()?.poachedName !== 'Harbor Air') continue
      expect(game.offer).toBeNull()
      found = true
    }
    expect(found).toBe(true)
  })

  it('saves and restores the open war', () => {
    const game = warField()
    untilWar(game)
    const headline = game.priceWarCard()?.headline
    const day = game.priceWarDay()
    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.priceWarDay()).toBe(day)
    expect(loaded.priceWarCard()?.headline).toBe(headline)
    expect(localStorage.getItem(SAVE_KEY)).toContain('priceWar')
  })
})
