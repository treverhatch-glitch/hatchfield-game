import { describe, expect, it } from 'vitest'
import { Game } from './sim'
import type { StartFocus, Tile } from './types'
import { SIZE } from './types'
import { auditWorld, placementReason } from './worldRules'

function blank(): Tile[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
}

function messages(tiles: Tile[][], standClass?: Record<string, 'S' | 'M' | 'L'>) {
  return auditWorld({ tiles, standClass }).map((v) => `${v.rule}:${v.message}`)
}

function kit(focus: StartFocus): Game {
  const game = new Game()
  game.sandbox = true
  game.beginNew('easy')
  game.startFocus = focus
  game.buyLand(focus === 'cargo' ? 'factory' : 'city')
  game.buildStarterKit()
  game.cash = 500_000
  return game
}

describe('world rules', () => {
  it('blocks a road that cuts through a terminal, including a hole in the silhouette', () => {
    const stacked = blank()
    stacked[10][10] = 'terminal'
    const why = placementReason(
      { tiles: stacked },
      { tile: 'road', cells: [{ c: 10, r: 10 }], origin: { c: 10, r: 10 }, name: 'Access road' },
    )
    expect(why).toMatch(/cuts through the terminal/i)

    const hole = blank()
    for (const [c, r] of [
      [5, 5],
      [6, 5],
      [7, 5],
      [5, 6],
      [7, 6],
      [5, 7],
      [6, 7],
      [7, 7],
    ]) {
      hole[r]![c] = 'terminal'
    }
    hole[6]![6] = 'road'
    expect(messages(hole).join('\n')).toMatch(/road at 6,6 cuts through the terminal/i)

    const slice = blank()
    for (let c = 5; c <= 7; c++) {
      slice[5]![c] = 'terminal'
      slice[6]![c] = 'road'
      slice[7]![c] = 'terminal'
    }
    expect(messages(slice).join('\n')).toMatch(/road at 6,6 cuts through the terminal/i)
  })

  it('flags a road sandwiched in a taxiway and allows a paved junction and a T', () => {
    const cross = blank()
    cross[4][5] = 'taxi'
    cross[6][5] = 'taxi'
    cross[5][5] = 'road'
    expect(messages(cross).join('\n')).toMatch(/junction:Road at 5,5 crosses the taxiway/)

    const junction = blank()
    junction[4][5] = 'taxi'
    junction[5][5] = 'taxi'
    junction[6][5] = 'taxi'
    junction[5][4] = 'road'
    junction[5][6] = 'road'
    expect(auditWorld({ tiles: junction })).toEqual([])

    const tee = blank()
    tee[5][5] = 'taxi'
    tee[4][5] = 'road'
    expect(auditWorld({ tiles: tee })).toEqual([])

    const parallel = blank()
    for (let c = 3; c <= 8; c++) {
      parallel[5][c] = 'road'
      parallel[6][c] = 'taxi'
    }
    expect(auditWorld({ tiles: parallel })).toEqual([])
  })

  it('keeps buildings out of a stand wing and still allows a service road under it', () => {
    const tiles = blank()
    tiles[10][9] = 'taxi'
    tiles[10][10] = 'stand'
    tiles[11][11] = 'snack'
    const hit = auditWorld({ tiles, standClass: { '10,10': 'M' } })
    expect(hit.some((v) => v.rule === 'wingtip')).toBe(true)
    expect(hit.some((v) => /stand footprint|wingtip/i.test(v.message))).toBe(true)

    tiles[11][11] = 'road'
    expect(auditWorld({ tiles, standClass: { '10,10': 'M' } })).toEqual([])
  })

  it('keeps the runway strip and the RESA clear, and still lets a taxiway cross', () => {
    const tiles = blank()
    for (let c = 10; c <= 18; c++) {
      tiles[20][c] = 'runway'
      tiles[21][c] = 'runway'
    }
    tiles[18][14] = 'snack'
    const strip = auditWorld({ tiles })
    expect(strip.some((v) => v.rule === 'runway-strip' && v.c === 14 && v.r === 18)).toBe(true)

    tiles[18][14] = 'taxi'
    expect(auditWorld({ tiles })).toEqual([])

    tiles[18][14] = 'grass'
    tiles[20][8] = 'cargo'
    const resa = auditWorld({ tiles })
    expect(resa.some((v) => v.rule === 'resa' && v.c === 8 && v.r === 20)).toBe(true)

    const why = placementReason(
      { tiles },
      { tile: 'cargo', cells: [{ c: 8, r: 20 }], origin: { c: 8, r: 20 }, name: 'Cargo shed' },
    )
    expect(why).toMatch(/clearance/i)
  })

  it('requires a tower to see each runway threshold, and stays quiet when there is no tower', () => {
    const tiles = blank()
    for (let c = 10; c <= 20; c++) {
      tiles[24][c] = 'runway'
      tiles[25][c] = 'runway'
    }
    tiles[16][10] = 'hangar'
    expect(auditWorld({ tiles }).some((v) => v.rule === 'tower-los')).toBe(false)

    tiles[8][10] = 'tower'
    const blocked = auditWorld({ tiles })
    expect(blocked.some((v) => v.rule === 'tower-los' && /hangar/i.test(v.message))).toBe(true)

    const why = placementReason(
      { tiles: blank().map((row) => row.slice()) },
      { tile: 'tower', cells: [{ c: 10, r: 8 }], origin: { c: 10, r: 8 }, name: 'Control tower' },
    )
    expect(why).toBeNull()

    const placing = blank()
    for (let c = 10; c <= 20; c++) {
      placing[24][c] = 'runway'
      placing[25][c] = 'runway'
    }
    placing[8][10] = 'tower'
    const hangarWhy = placementReason(
      { tiles: placing },
      { tile: 'hangar', cells: [{ c: 10, r: 16 }], origin: { c: 10, r: 16 }, name: 'Hangar' },
    )
    expect(hangarWhy).toMatch(/view of the runway/i)
  })

  it('audits every starter kit clean', () => {
    for (const focus of ['pax', 'cargo', 'hybrid'] as const) {
      expect(kit(focus).worldAudit(), focus).toEqual([])
    }
  })

  it('paints the build ghost red when a road would cut the terminal, and leaves a shoulder taxi legal', () => {
    const game = kit('pax')
    const hall = { c: 15, r: 9 }
    expect(game.tile(hall)).toBe('terminal')
    game.setTool('road')
    game.setHover(hall)
    expect(game.placementGhostReason()).toMatch(/cuts through the terminal/i)
    expect(game.ghostBlocked(game.ghostCells(hall))).toBe(true)
    game.placeSingle(hall)
    expect(game.tile(hall)).toBe('terminal')
    expect(game.news[0]?.text ?? '').toMatch(/terminal/i)

    const shoulder = { c: 10, r: 24 }
    expect(game.tile(shoulder)).toBe('grass')
    game.setTool('taxi')
    game.setHover(shoulder)
    expect(game.placementGhostReason()).toBeNull()
    expect(game.ghostBlocked(game.ghostCells(shoulder))).toBe(false)
  })

  it('skips the city-rail stub where it would overwrite a building or cross a taxiway', () => {
    const game = kit('pax')
    const row = 16
    game.tiles[row]![0] = 'hangar'
    game.tiles[row]![1] = 'terminal'
    game.tiles[row - 1]![2] = 'taxi'
    game.tiles[row + 1]![2] = 'taxi'
    game.investRail()
    expect(game.tiles[row]![0]).toBe('hangar')
    expect(game.tiles[row]![1]).toBe('terminal')
    expect(game.tiles[row]![2]).toBe('grass')
    expect(game.tiles[row]![3]).toBe('road')
  })
})
