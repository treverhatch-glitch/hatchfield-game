import { describe, expect, it } from 'vitest'
import { footprintBlock, footprintCells } from './buildingFootprint.ts'
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
