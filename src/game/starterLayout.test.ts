import { describe, expect, it } from 'vitest'
import { deliveryPath } from '../fuel/path.ts'
import { buildNetwork } from '../landside/network.ts'
import { starterField } from '../landside/fixtures.test-util.ts'
import { bagSortYaw } from '../render/world/bagFacing.ts'
import { bowserPath, nearestPath, retireApronBelts, runwayStrips, standBeltLinked, standBeltViaSort, tilesOf, walkableFor } from './path'
import { clearanceIntrusions, runwayBoxes } from './runwayClearance'
import { Game } from './sim'
import { STARTER_KITS, stampStarterKit } from './starterLayout'
import type { StartFocus, Tile } from './types'
import { airsideOf, clusters } from '../render/world/layout'

const FOCUSES: StartFocus[] = ['pax', 'cargo', 'hybrid']

function field(focus: StartFocus): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = focus
  game.buyLand(focus === 'cargo' ? 'factory' : 'city')
  game.buildStarterKit()
  return game
}

function grid(tiles: Tile[][]): string {
  return tiles.map((row) => row.join(',')).join('|')
}

function key(c: number, r: number): string {
  return `${c},${r}`
}

describe('starter kits', () => {
  it.each(FOCUSES)('%s kit is deterministic and complete', (focus) => {
    const first = field(focus)
    const second = field(focus)
    expect(grid(first.tiles)).toBe(grid(second.tiles))
    expect(first.news[0]?.text ?? '').toContain(STARTER_KITS[focus].label)

    const stands = tilesOf(first.tiles, 'stand')
    const roads = tilesOf(first.tiles, 'road')
    const halls = tilesOf(first.tiles, 'terminal')
    const boxes = runwayBoxes(first.tiles)
    expect(stands.length).toBeGreaterThanOrEqual(1)
    expect(roads.length).toBeGreaterThan(8)
    expect(tilesOf(first.tiles, 'guard').length).toBe(1)
    expect(tilesOf(first.tiles, 'cargo').length).toBe(1)
    expect(tilesOf(first.tiles, 'fuel').length).toBe(1)
    expect(boxes).toHaveLength(1)
    expect(runwayStrips(first.tiles, 6)).toHaveLength(1)
    expect(runwayStrips(first.tiles, 6)[0]).toHaveLength(14)
    expect(clearanceIntrusions(first.tiles)).toEqual([])
    const southExit = first.tiles[28]?.some((tile, c) => c >= 8 && c <= 21 && tile === 'taxi')
    const northExit = first.tiles[25]?.some((tile, c) => c >= 8 && c <= 15 && tile === 'taxi')
    expect(northExit).toBe(true)
    expect(southExit).toBe(true)

    for (const stand of stands) {
      for (const box of boxes) {
        expect(nearestPath(first.tiles, stand, box.cells, 'jet'), `${focus} stand ${stand.c},${stand.r}`).toBeTruthy()
      }
    }

    if (focus === 'cargo') {
      expect(halls).toHaveLength(0)
      expect(first.fits).toHaveLength(0)
      expect(stands).toHaveLength(1)
      expect(tilesOf(first.tiles, 'guard')).toEqual([{ c: 16, r: 10 }])
      const inbound = nearestPath(first.tiles, { c: 17, r: 0 }, stands, 'truck', undefined, 'outside')
      expect(inbound?.some((cell) => cell.c === 16 && cell.r === 10)).toBe(true)
      return
    }

    expect(halls).toHaveLength(8)
    expect(first.fits).toHaveLength(1)
    expect(stands).toHaveLength(2)
    expect(tilesOf(first.tiles, 'belt')).toEqual([
      { c: 11, r: 7 },
      { c: 11, r: 8 },
      { c: 12, r: 8 },
      { c: 12, r: 9 },
      { c: 13, r: 9 },
      { c: 12, r: 10 },
      { c: 12, r: 11 },
      { c: 12, r: 12 },
    ])
    expect(standBeltLinked(first.tiles, stands[0])).toBe(true)
    expect(standBeltLinked(first.tiles, stands[1])).toBe(true)
    expect(standBeltViaSort(first.tiles, stands[0])).toBe(true)
    expect(standBeltViaSort(first.tiles, stands[1])).toBe(true)
    const sort = tilesOf(first.tiles, 'bags')
    expect(sort).toEqual([{ c: 14, r: 9 }])
    expect(first.tiles[9][15]).toBe('terminal')
    expect(first.tiles[9][14]).toBe('bags')
    expect(bagSortYaw(first.tiles, 14, 9)).toBeCloseTo(-Math.PI / 2)
    const guard = tilesOf(first.tiles, 'guard')
    expect(guard).toEqual([{ c: 16, r: 2 }])
    const curb = buildNetwork(starterField())
    const onGuard = (cell: { c: number; r: number }) => cell.c === 16 && cell.r === 2
    expect(curb.path.some(onGuard)).toBe(false)
    expect(curb.exit.some(onGuard)).toBe(false)
    // The 2×4 hall's east face starts on row 7, so the curb approach ends there.
    expect(curb.path.at(-1)).toEqual({ c: 17, r: 7 })
    // The fork leaves the passenger branch. The service road past the post is not in it.
    expect(curb.path.some((cell) => cell.c === 15 && cell.r === 2)).toBe(false)
    expect(first.tiles[2][17]).toBe('road')
    expect(first.tiles[2][15]).toBe('road')
    const city = { c: 17, r: 0 }
    for (const stand of stands) {
      const truck = nearestPath(first.tiles, city, [stand], 'truck', undefined, 'outside')
      expect(truck?.some(onGuard), `${focus} city → stand`).toBe(true)
      const airside = nearestPath(first.tiles, { c: 7, r: 5 }, [stand], 'truck')
      expect(airside?.some(onGuard), `${focus} farm → stand`).toBe(false)
      const bags = nearestPath(first.tiles, { c: 14, r: 9 }, [stand], 'truck')
      expect(bags?.some(onGuard), `${focus} sort → stand`).toBe(false)
    }
    const bowser = bowserPath(first.tiles, { c: 7, r: 5 }, stands)
    expect(bowser).toBeTruthy()
    expect(bowser!.path.some(onGuard)).toBe(false)
    const tanker = deliveryPath(
      tilesOf(first.tiles, 'road'),
      tilesOf(first.tiles, 'fuel'),
      guard,
    )
    expect(tanker.path.some(onGuard)).toBe(true)
    const hall = new Set(halls.map((p) => key(p.c, p.r)))
    for (const road of roads) expect(hall.has(key(road.c, road.r))).toBe(false)
    const view = { tiles: first.tiles, mapRev: 1 }
    const [cluster] = clusters(view, 'terminal')
    expect(airsideOf(view, cluster)).toBe('w')
    const eastFace = halls.filter((p) => p.c === cluster.maxC)
    expect(eastFace.some((p) => first.tiles[p.r][p.c + 1] === 'road')).toBe(true)

    const services = [
      ...tilesOf(first.tiles, 'guard'),
      ...tilesOf(first.tiles, 'fuel'),
      ...tilesOf(first.tiles, 'bags'),
      ...tilesOf(first.tiles, 'cargo'),
      ...roads.filter((p) => p.r === 0),
    ]
    for (const from of services) {
      const fromCity = from.r === 0 || (from.c === 16 && from.r === 2)
      for (const stand of stands) {
        const path = nearestPath(
          first.tiles,
          from,
          [stand],
          'truck',
          undefined,
          fromCity ? 'outside' : 'airside',
        )
        expect(path, `${focus} ${from.c},${from.r} → ${stand.c},${stand.r}`).toBeTruthy()
        for (const step of path!) expect(hall.has(key(step.c, step.r))).toBe(false)
        if (!fromCity) expect(path!.some(onGuard), `${focus} ${from.c},${from.r} stays airside`).toBe(false)
      }
    }
  })

  it('serves a stand from the bag room, and drops the link when the room is gone', () => {
    const game = field('pax')
    const stand = { c: 11, r: 6 }
    expect(standBeltLinked(game.tiles, stand)).toBe(true)
    game.tiles[9][14] = 'grass'
    expect(standBeltLinked(game.tiles, stand)).toBe(false)
    expect(standBeltViaSort(game.tiles, stand)).toBe(false)
  })

  it('keeps tug pavement off the jet taxiway', () => {
    const game = field('pax')
    game.tiles[8][12] = 'belt'
    expect(retireApronBelts(game.tiles)).toBe(0)
    expect(game.tiles[8][12]).toBe('belt')
    expect(walkableFor('truck', 'belt')).toBe(true)
    expect(walkableFor('jet', 'belt')).toBe(false)
    const south = nearestPath(game.tiles, { c: 11, r: 6 }, [{ c: 11, r: 12 }], 'jet')
    expect(south?.some((cell) => game.tiles[cell.r][cell.c] === 'belt')).toBe(false)
  })

  it('does not make the three kits the same stamp', () => {
    const pax = grid(field('pax').tiles)
    const cargo = grid(field('cargo').tiles)
    const hybrid = grid(field('hybrid').tiles)
    expect(pax).not.toBe(cargo)
    expect(hybrid).not.toBe(cargo)
    expect(hybrid).not.toBe(pax)
    expect(STARTER_KITS.pax.label).toBe('Passenger-focused starter kit')
    expect(STARTER_KITS.cargo.label).toBe('Cargo-focused starter kit')
  })

  it('stampStarterKit writes the same cells the game button writes', () => {
    const game = field('pax')
    const blank = game.tiles.map((row) => row.map(() => 'grass' as Tile))
    stampStarterKit(blank, 'pax')
    expect(grid(blank)).toBe(grid(game.tiles))
  })
})
