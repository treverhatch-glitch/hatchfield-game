import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'

function freshGame(sandbox: boolean): Game {
  const game = new Game()
  game.sandbox = sandbox
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

describe('ops wallet in the live game', () => {
  it('refuses a held node and a node the player cannot afford', () => {
    const game = freshGame(false)
    expect(game.buyOpsTech('commercial.t1')).toBe(false)
    expect(game.buyOpsTech('sustainability.t1')).toBe(false)
    expect(game.hasOpsTech('sustainability.t1')).toBe(false)
  })

  it('lets the sandbox buy a live node and keeps it through save and load', () => {
    const game = freshGame(true)
    expect(game.buyOpsTech('sustainability.t1')).toBe(true)
    expect(game.hasOpsTech('sustainability.t1')).toBe(true)
    expect(game.opsWallet().owned).toBe(1)
    game.persist()

    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.hasOpsTech('sustainability.t1')).toBe(true)
    expect(loaded.opsWallet().owned).toBe(1)
  })
})
