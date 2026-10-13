import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { RIVAL_NAME } from './config.ts'

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
