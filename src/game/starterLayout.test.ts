import { describe, expect, it } from 'vitest'
import { nearestPath, runwayStrips, standBeltLinked, tilesOf } from './path'
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
    expect(boxes).toHaveLength(2)
    expect(runwayStrips(first.tiles, 6)).toHaveLength(2)
    expect(runwayStrips(first.tiles, 6)[0]).toHaveLength(14)
    expect(runwayStrips(first.tiles, 6)[1]).toHaveLength(14)
    expect(clearanceIntrusions(first.tiles)).toEqual([])

    for (const stand of stands) {
      for (const box of boxes) {
        expect(nearestPath(first.tiles, stand, box.cells, 'jet'), `${focus} stand ${stand.c},${stand.r}`).toBeTruthy()
      }
    }

    if (focus === 'cargo') {
      expect(halls).toHaveLength(0)
      expect(first.fits).toHaveLength(0)
      expect(stands).toHaveLength(1)
      return
    }

    expect(halls).toHaveLength(9)
    expect(first.fits).toHaveLength(1)
    expect(stands).toHaveLength(2)
    expect(standBeltLinked(first.tiles, stands[0])).toBe(true)
    expect(standBeltLinked(first.tiles, stands[1])).toBe(true)
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
      for (const stand of stands) {
        const path = nearestPath(first.tiles, from, [stand], 'truck')
        expect(path, `${focus} ${from.c},${from.r} → ${stand.c},${stand.r}`).toBeTruthy()
        for (const step of path!) expect(hall.has(key(step.c, step.r))).toBe(false)
      }
    }
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
