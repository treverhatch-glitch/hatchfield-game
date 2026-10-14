import { describe, expect, it } from 'vitest'
import { jetRouteOnGraph } from './path'
import { Game } from './sim'
import type { Flight, Tile, Vec } from './types'
import { SIZE } from './types'

function grass(): Tile[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
}

function parked(game: Game, stand: Vec): Flight {
  const f = {
    id: 'flt-taxi',
    airline: 'northline',
    flightNo: 'NL100',
    airframeId: 'crj700',
    airframeName: 'CRJ-700',
    pax: 20,
    cargo: false,
    craft: 'jet',
    kind: 'regional',
    phase: 'taxi_out',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0.12,
    heading: 0,
    path: [stand, { c: stand.c + 4, r: stand.r }],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
      bags: true,
      bagsLoad: true,
      fuel: true,
      catering: true,
      bagDrop: true,
      mx: true,
      deiced: true,
    },
    waitingOn: {
      bags: false,
      bagsLoad: false,
      fuel: false,
      catering: false,
      mx: false,
      deice: false,
      paxOut: 0,
      paxIn: 0,
    },
    phaseTime: 1,
    ledger: [],
  } as Flight
  game.flights.push(f)
  return f
}

describe('taxi stays on the taxiway graph', () => {
  it('rejects a chord across grass', () => {
    const tiles = grass()
    tiles[10][10] = 'stand'
    tiles[10][14] = 'taxi'
    expect(jetRouteOnGraph(tiles, [{ c: 10, r: 10 }, { c: 14, r: 10 }])).toBe(false)
    tiles[10][11] = 'taxi'
    tiles[10][12] = 'taxi'
    tiles[10][13] = 'taxi'
    expect(
      jetRouteOnGraph(tiles, [
        { c: 10, r: 10 },
        { c: 11, r: 10 },
        { c: 12, r: 10 },
        { c: 13, r: 10 },
        { c: 14, r: 10 },
      ]),
    ).toBe(true)
  })

  it('holds and alerts instead of rolling across the grass', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.speed = 1
    game.scheduleAuto = false
    game.schedule = []
    game.spawnCool = 1e9
    const stand = { c: 12, r: 21 }
    const f = parked(game, stand)
    const before = { x: f.x, y: f.y }
    game.tick(1)
    expect(f.phase).toBe('taxi_out')
    expect(f.x).toBeCloseTo(before.x)
    expect(f.y).toBeCloseTo(before.y)
    expect(game.alerts.active.some((a) => a.key === 'cond:taxi-blocked:flt-taxi')).toBe(true)
  })
})
