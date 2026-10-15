import { describe, expect, it } from 'vitest'
import { footprintBlock, footprintCells, hangarFootprintCells } from './buildingFootprint.ts'
import { Game } from './sim.ts'
import type { Tile } from './types.ts'
import { SIZE } from './types.ts'

function blank(): Tile[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
}

describe('building footprints', () => {
  it('gives the round tower a 3×3 keep-out and leaves a road as one cell', () => {
    expect(footprintCells('tower', { c: 4, r: 5 })).toHaveLength(9)
    expect(footprintCells('road', { c: 4, r: 5 })).toEqual([{ c: 4, r: 5 }])
  })

  it('reserves a real hangar lot, anchor first, and blocks a road inside it', () => {
    expect(hangarFootprintCells({ c: 10, r: 10 }, 'small')).toHaveLength(9)
    expect(hangarFootprintCells({ c: 10, r: 10 }, 'small')[0]).toEqual({ c: 10, r: 10 })
    expect(hangarFootprintCells({ c: 8, r: 8 }, 'wide')).toHaveLength(16)
    expect(hangarFootprintCells({ c: 8, r: 8 }, 'jumbo')).toHaveLength(25)
    const tiles = blank()
    tiles[10][11] = 'road'
    expect(footprintBlock(tiles, 'hangar', { c: 10, r: 10 }, 'small')).toBe('road')
    expect(footprintBlock(tiles, 'hangar', { c: 14, r: 14 }, 'small')).toBeNull()
  })

  it('blocks a tower whose keep-out covers a road and allows open grass', () => {
    const tiles = blank()
    tiles[5][6] = 'road'
    expect(footprintBlock(tiles, 'tower', { c: 5, r: 5 })).toBe('road')
    expect(footprintBlock(tiles, 'tower', { c: 8, r: 8 })).toBeNull()
    expect(footprintBlock(tiles, 'road', { c: 5, r: 5 })).toBeNull()
  })

  it('refuses the stamp in the game and still allows a clear plot', () => {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    game.buyLand('city')
    game.cash = 500_000
    game.researchTree.state.unlocked.push('airfield-5')
    game.tiles[5][6] = 'road'
    game.tool = 'tower'
    game.placeSingle({ c: 5, r: 5 })
    expect(game.tiles[5][5]).toBe('grass')
    expect(game.sites.some((s) => s.tile === 'tower')).toBe(false)
    expect(game.news.some((n) => /footprint crosses a road/i.test(n.text))).toBe(true)

    game.placeSingle({ c: 10, r: 10 })
    expect(game.sites.some((s) => s.tile === 'tower' && s.origin?.c === 10)).toBe(true)
  })
})
