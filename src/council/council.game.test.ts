import { describe, expect, it } from 'vitest'
import { FIELD_LEVEL_XP } from '../game/catalog.ts'
import { Game } from '../game/sim.ts'

function lateAirport(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.fieldXp = FIELD_LEVEL_XP[8]
  game.cash = 200_000
  game.pokeCouncil()
  return game
}

describe('Airport Council game wiring', () => {
  it('posts funded votes, awards capped tycoon prestige, and survives a save', () => {
    const game = lateAirport()
    const request = game.councilView().pending!
    const full = request.choices.find((choice) => choice.id === 'full')!
    const cash = game.cash

    game.answerCouncilRequest(request.id, 'full')
    expect(game.cash).toBe(cash - full.cost)
    expect(game.bank.ledger().byCategory.civic_programs).toBe(-full.cost)
    expect(game.tycoonView().prestige).toBeGreaterThan(0)
    expect(game.councilView().votes[0]?.passed).toBe(true)

    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.councilView()).toEqual(game.councilView())
    expect(loaded.tycoonView().prestige).toBe(game.tycoonView().prestige)
  })

  it('loads an old save without council data and opens from the saved late-game day', () => {
    const game = lateAirport()
    game.clock = 180 * 140
    game.persist()
    const raw = JSON.parse(localStorage.getItem('apron-save-v25')!) as Record<string, unknown>
    delete raw.council
    localStorage.setItem('apron-save-v25', JSON.stringify(raw))

    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    loaded.pokeCouncil()
    expect(loaded.councilView().pending).not.toBeNull()
  })
})
