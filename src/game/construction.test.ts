import { describe, expect, it } from 'vitest'
import { buildSeconds, cancelRefund } from './construction.ts'
import { Game } from './sim.ts'
import { SIZE, type Vec } from './types.ts'
import { walkableFor } from './path.ts'

function field() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  return game
}

function findGrass(game: Game, besideTruck: boolean) {
  for (let r = 1; r < SIZE - 1; r++) {
    for (let c = 1; c < SIZE - 1; c++) {
      const v = { c, r }
      if (game.tile(v) !== 'grass' || game.siteAt(v)) continue
      const near = [
        { c: c + 1, r },
        { c: c - 1, r },
        { c, r: r + 1 },
        { c, r: r - 1 },
      ].some((p) => {
        const tile = game.tile(p)
        return Boolean(tile && walkableFor('truck', tile))
      })
      if (near === besideTruck) return v
    }
  }
  return null
}

describe('construction', () => {
  it('build time scales with size and stays short', () => {
    expect(buildSeconds(1)).toBeCloseTo(4.35)
    expect(buildSeconds(10)).toBeGreaterThan(buildSeconds(1))
    expect(buildSeconds(40)).toBe(12)
    expect(cancelRefund(1000)).toBe(400)
  })

  it('the starter kit is instant and leaves no construction sites', () => {
    const game = field()
    expect(game.sites).toEqual([])
    expect(game.tile({ c: 8, r: 26 })).toBe('runway')
    expect(game.tile({ c: 12, r: 22 })).toBe('taxi')
    expect(game.tile({ c: 14, r: 22 })).toBe('grass')
    expect(game.pathStandToRunway({ c: 12, r: 21 })?.length).toBeGreaterThan(1)
    expect(game.pathStandToRunway({ c: 20, r: 21 })?.length).toBeGreaterThan(1)
  })

  it('progress runs even when the van has not arrived, then the tile flips', () => {
    const game = field()
    const cell = findGrass(game, false)
    expect(cell).toBeTruthy()
    game.setTool('stand')
    game.placeSingle(cell!)
    expect(game.sites).toHaveLength(1)
    expect(game.tile(cell!)).toBe('grass')
    game.speed = 1
    game.tick(2)
    expect(game.sites[0].elapsed).toBeGreaterThan(0)
    expect(game.tile(cell!)).toBe('grass')
    const limit = game.sites[0].duration + 2
    game.tick(limit)
    expect(game.sites).toHaveLength(0)
    expect(game.tile(cell!)).toBe('stand')
  })

  it('cancelling refunds 40 percent', () => {
    const game = field()
    const cell = findGrass(game, false)
    game.setTool('stand')
    game.placeSingle(cell!)
    const cost = game.sites[0].cost
    const cash = game.cash
    game.clearTile(cell!)
    expect(game.sites).toHaveLength(0)
    expect(game.cash).toBe(cash + Math.round(cost * 0.4))
    expect(game.tile(cell!)).toBe('grass')
  })

  it('the contractor drives in through the guard post', () => {
    const game = field()
    const cell = findGrass(game, true)
    expect(cell).toBeTruthy()
    const guards: Vec[] = []
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (game.tile({ c, r }) === 'guard') guards.push({ c, r })
      }
    }
    expect(guards.length).toBeGreaterThan(0)
    game.setTool('stand')
    game.placeSingle(cell!)
    game.speed = 1
    game.tick(0.2)
    const van = game.trucks.find((t) => t.kind === 'contractor')
    expect(van).toBeTruthy()
    expect(van!.path.some((p) => guards.some((g) => g.c === p.c && g.r === p.r))).toBe(true)
    expect(game.trucks.some((t) => t.kind === 'delivery')).toBe(true)
  })
})
