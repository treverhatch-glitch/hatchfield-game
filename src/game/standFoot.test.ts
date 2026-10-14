import { describe, expect, it } from 'vitest'
import { Game } from './sim'
import { footprintCells, standPads } from './standFoot'
import type { Tile } from './types'

function grass(w = 32, h = 32): Tile[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => 'grass' as Tile))
}

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.startFocus = 'pax'
  game.buildStarterKit()
  game.cash = 500_000
  return game
}

describe('stand footprints', () => {
  it('sizes a code-C stand to 3×3 and a code-F stand to 5×5', () => {
    const tiles = grass()
    tiles[6][10] = 'taxi'
    const codeC = footprintCells(tiles, { c: 11, r: 6 }, 'M', 'small')
    expect(codeC).toHaveLength(9)
    expect(codeC.map((p) => `${p.c},${p.r}`).sort()).toEqual(
      ['10,5', '10,6', '10,7', '11,5', '11,6', '11,7', '12,5', '12,6', '12,7'].sort(),
    )

    tiles[6][9] = 'taxi'
    const codeF = footprintCells(tiles, { c: 10, r: 6 }, 'L', 'jumbo')
    expect(codeF).toHaveLength(25)
    const cols = codeF.map((p) => p.c)
    const rows = codeF.map((p) => p.r)
    expect(Math.max(...cols) - Math.min(...cols)).toBe(4)
    expect(Math.max(...rows) - Math.min(...rows)).toBe(4)
  })

  it('keeps the passenger stands off the hall and blocks buildings on the wing', () => {
    const game = field()
    const pads = standPads(game.tiles, game.standClass, game.standScale)
    expect(pads).toHaveLength(2)
    const hall = new Set(
      game.tiles.flatMap((row, r) => row.map((t, c) => (t === 'terminal' ? `${c},${r}` : ''))).filter(Boolean),
    )
    const seen = new Set<string>()
    for (const pad of pads) {
      expect(pad.cells).toHaveLength(9)
      for (const cell of pad.cells) {
        const key = `${cell.c},${cell.r}`
        expect(seen.has(key), key).toBe(false)
        seen.add(key)
        expect(hall.has(key), key).toBe(false)
      }
    }

    const wing = { c: 12, r: 5 }
    expect(game.tile(wing)).toBe('grass')
    expect(seen.has('12,5')).toBe(true)

    game.setTool('snack')
    game.placeSingle(wing)
    expect(game.tile(wing)).toBe('grass')
    expect(game.sites).toHaveLength(0)
    expect(game.news[0]?.text ?? '').toMatch(/stand footprint/i)
    expect(game.ghostBlocked([wing])).toBe(true)

    game.setTool('taxi')
    expect(game.ghostBlocked([wing])).toBe(false)
    game.placeSingle(wing)
    expect(game.sites.some((site) => site.tile === 'taxi')).toBe(true)

    const open = field()
    open.cash = 500_000
    open.setTool('stand')
    open.setHover({ c: 2, r: 2 })
    expect(open.ghostCells(open.hover)).toHaveLength(9)
    expect(open.ghostReady(open.ghostCells(open.hover))).toBe(true)
    open.placeSingle({ c: 2, r: 2 })
    expect(open.sites.some((site) => site.tile === 'stand' && site.cells.length === 1)).toBe(true)
  })
})
