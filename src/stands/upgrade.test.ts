import { describe, expect, it } from 'vitest'
import { REAL_AIRFRAMES } from '../render/aircraft/realworld.ts'
import { Game } from '../game/sim.ts'
import { footprintCellsForLetter, standGrowBlock } from '../game/standFoot.ts'
import type { Tile } from '../game/types.ts'
import { rungRefusal } from './gates.ts'
import { standAllows } from './fit.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  return game
}

describe('surface rungs', () => {
  it('keeps grass to the bush list and lets concrete take a Citation', () => {
    const game = field()
    game.tiles[2]![2] = 'stand'
    game.standClass['2,2'] = 'S'
    game.standSize['2,2'] = 'light'
    game.standRung['2,2'] = 0
    expect(standAllows('light', 0, 'bn2', REAL_AIRFRAMES.bn2.icao)).toBe(true)
    expect(game.standFitsAirframe({ c: 2, r: 2 }, 'bn2')).toBe(true)
    expect(game.standFitsAirframe({ c: 2, r: 2 }, 'citation')).toBe(false)
    for (const id of ['dhc6', 'pc12', 'at802'] as const) {
      expect(standAllows('light', 0, id, REAL_AIRFRAMES[id].icao)).toBe(true)
      expect(game.standFitsAirframe({ c: 2, r: 2 }, id)).toBe(true)
    }
    expect(game.buyStandRung('2,2')).toBe(true)
    expect(game.standRung['2,2']).toBe(1)
    expect(game.cash).toBe(200_000 - 2_000)
    expect(game.standFitsAirframe({ c: 2, r: 2 }, 'citation')).toBe(true)
  })

  it('bills the new light and narrow upkeep and leaves a wide slab at the old rate', () => {
    const game = field()
    const billed = (game as unknown as { pillarUpkeepBill(): number }).pillarUpkeepBill()
    game.standSize = {}
    const legacy = (game as unknown as { pillarUpkeepBill(): number }).pillarUpkeepBill()
    expect(billed - legacy).toBe(80)
    expect(rungRefusal('heavy', 0, 3, new Set())).toBe('Widebody slab needs Field level 4.')
    expect(rungRefusal('heavy', 0, 4, new Set())).toBe('Research widebody ops first.')
    expect(rungRefusal('heavy', 0, 4, new Set(['widebody_ops']))).toBeNull()
  })

  it('refuses a pour whose next box covers a building', () => {
    const tiles = Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => 'grass' as Tile))
    tiles[6]![10] = 'taxi'
    tiles[6]![11] = 'stand'
    const now = new Set(footprintCellsForLetter(tiles, { c: 11, r: 6 }, 'B').map((p) => `${p.c},${p.r}`))
    const extra = footprintCellsForLetter(tiles, { c: 11, r: 6 }, 'F').find((p) => !now.has(`${p.c},${p.r}`))
    expect(extra).toBeTruthy()
    tiles[extra!.r]![extra!.c] = 'tower'
    const why = standGrowBlock(tiles, { c: 11, r: 6 }, 'B', 'F', { '11,6': 'L' }, {}, { '11,6': 'B' })
    expect(why).toMatch(/overlaps a building/)
  })

  it('shows the next pour on the stand card', () => {
    const game = field()
    game.tool = 'pan'
    game.clickTile({ c: 11, r: 6 })
    const row = game.buildingCard()?.sections?.find((section) => section.id === 'upgrade')?.rows[0]
    expect(row?.label).toBe('Reinforced concrete needs Field level 3.')
    expect(row?.disabled).toBe(true)
    expect(game.buildingCard()?.name).toBe('Medium stand')
  })
})
