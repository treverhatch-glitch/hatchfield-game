import { describe, expect, it } from 'vitest'
import { LATE_FIELD_XP } from './catalog.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.cash = 20_000_000
  game.fieldXp = LATE_FIELD_XP[9]
  return game
}

function stamp(game: Game, tool: 'cargo_hub_ii' | 'cold_store', c: number, r: number) {
  game.setTool('pan')
  game.setTool(tool)
  game.clickTile({ c, r })
}

function closeDays(game: Game, days: number) {
  for (let i = 0; i < days; i++) {
    game.clock += 180
    game.tickPayroll(0)
  }
}

describe('cargo hub II and cold store in the live game', () => {
  it('needs a night hub first', () => {
    const game = field()
    stamp(game, 'cargo_hub_ii', 15, 2)
    expect(game.lateSites).toHaveLength(0)
    expect(game.news[0]?.text).toMatch(/night hub/)
  })

  it('holds the cold store until the wallet node is owned, then builds and counts rooms', () => {
    const game = field()
    game.tiles[10]![10] = 'nighthub'
    stamp(game, 'cold_store', 14, 2)
    expect(game.lateSites).toHaveLength(0)
    expect(game.news[0]?.text).toMatch(/Ops wallet/)

    game.sandbox = true
    for (const id of ['cargo.t1', 'cargo.t2', 'safety_security.t1', 'safety_security.t2', 'safety_security.t3', 'cargo.t3', 'cargo.t4']) {
      game.buyOpsTech(id)
    }
    game.sandbox = false
    expect(game.hasOpsTech('cargo.t4')).toBe(true)
    stamp(game, 'cold_store', 15, 2)
    expect(game.lateSites).toHaveLength(1)
    expect(game.coldChainRooms()).toBe(0)
    closeDays(game, 10)
    expect(game.lateOpenAt(15, 2)).toBe(true)
    expect(game.coldChainRooms()).toBe(2)
  })
})
