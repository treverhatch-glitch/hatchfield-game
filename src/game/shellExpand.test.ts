import { describe, expect, it } from 'vitest'
import { TERMINAL_COST } from './catalog.ts'
import { Game } from './sim.ts'
import { shellHallBounds, stampAnchor, hallFitFor } from '../render/hallRooms.ts'
import { terminals } from '../render/world/layout.ts'

function fresh(): Game {
  const game = new Game()
  game.sandbox = true
  game.beginNew('easy')
  game.buyLand('city')
  game.cash = 500_000
  return game
}

function finish(game: Game) {
  const site = game.sites.at(-1)
  expect(site).toBeTruthy()
  game.finishSite(site!)
  game.sites = game.sites.filter((row) => row !== site)
}

describe('terminal shell expansion', () => {
  it('grows one hall when a shell is stamped against it, and refuses to join two', () => {
    const game = fresh()
    const origin = { c: 10, r: 10 }
    game.placeTerminal(origin)
    finish(game)
    expect(game.fits).toHaveLength(1)
    const cols = game.fits[0].zones![0].length

    game.placeTerminal({ c: origin.c + 2, r: origin.r })
    expect(game.sites.at(-1)?.kind).toBe('expand')
    expect(game.sites.at(-1)?.cost).toBe(TERMINAL_COST)
    finish(game)
    expect(game.fits).toHaveLength(1)
    expect(game.fits[0].origin).toEqual(origin)
    expect(game.fits[0].zones![0].length).toBeGreaterThan(cols)
    expect(game.fits[0].floorExtra?.right).toBeGreaterThan(0)

    const info = terminals(game).find((row) => row.cluster.cells.some((p) => p.c === origin.c && p.r === origin.r))!
    const anchored = hallFitFor(info, undefined, stampAnchor(origin, false))
    const fitted = hallFitFor(info)
    const bounds = shellHallBounds(info, anchored)
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(shellHallBounds(info, fitted).maxX - shellHallBounds(info, fitted).minX)

    game.placeTerminal({ c: 16, r: 10 })
    finish(game)
    expect(game.fits).toHaveLength(2)

    const queued = game.sites.length
    game.placeTerminal({ c: 14, r: 10 })
    expect(game.sites).toHaveLength(queued)
    expect(game.news[0]?.text).toMatch(/two terminals/i)
  })
})
