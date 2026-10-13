import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { SAVE_KEY } from '../game/types.ts'
import { PRICE_WAR } from './pricewar.data.ts'

function field(): Game {
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
    const game = field()
    expect(game.priceWarDay()).toBe(0)
    game.clock = 179
    game.tick(2)
    expect(game.priceWarDay()).toBe(1)
  })

  it('starts a war on the fixed seed, then match and hold change demand', () => {
    const match = field()
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

    const hold = field()
    untilWar(hold)
    const during = hold.rivalWalkInFactor()
    const heldPark = hold.parkUseFee('short')
    hold.respondToPriceWar('hold')
    expect(hold.rivalWalkInFactor()).toBeCloseTo(during, 5)
    expect(hold.parkUseFee('short')).toBe(heldPark)
  })

  it('spends marketing cash to counter-promote and refuses a short treasury', () => {
    const game = field()
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
    const game = field()
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
      const game = field()
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
    const game = field()
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
