import { describe, expect, it } from 'vitest'
import { footprintCellsForLetter, standEntry } from './standFoot.ts'
import { Game } from './sim.ts'
import { envelopeWorld } from '../render/aircraft/stands.ts'
import { previewStandBox, standBox } from '../render/world/layout.ts'
import { aliasSize, footprintLetter, standServiceTier } from '../stands/index.ts'
import type { StandRung, StandSize } from '../stands/types.ts'
import type { Tile, Tool } from './types.ts'

function keys(cells: { c: number; r: number }[]): string[] {
  return cells.map((p) => `${p.c},${p.r}`).sort()
}

function opened(): Game {
  const game = new Game()
  game.autosave = false
  game.beginNew('easy')
  return game
}

function field(): Game {
  const game = opened()
  game.sandbox = false
  game.buyLand('city')
  game.startFocus = 'pax'
  game.buildStarterKit()
  game.cash = 500_000
  return game
}

describe('stand honesty', () => {
  it('does not give a rival a stand leased to a hub carrier', () => {
    const game = field()
    const free = game.freeStands()
    expect(free.length).toBeGreaterThanOrEqual(2)
    for (const stand of free) {
      game.hubLeases.push({ id: `stand:${stand.c},${stand.r}`, kind: 'gate', airlineId: 'gulf_pearl' })
    }
    expect(game.assignStand(null, undefined, 'zephyr_go', 'b738')).toBeNull()
    expect(game.assignStand(free[0], undefined, 'gulf_pearl', 'b738')).toMatchObject({
      c: free[0]!.c,
      r: free[0]!.r,
    })

    game.hubLeases = [{ id: `stand:${free[0]!.c},${free[0]!.r}`, kind: 'gate', airlineId: 'gulf_pearl' }]
    const rival = game.assignStand(free[0], undefined, 'zephyr_go', 'b738')
    expect(rival).toBeTruthy()
    expect(`${rival!.c},${rival!.r}`).not.toBe(`${free[0]!.c},${free[0]!.r}`)
  })

  it('refuses a timetable pin onto a leased stand and says so', () => {
    const game = field()
    const stand = game.freeStands()[0]!
    game.hubLeases.push({ id: `stand:${stand.c},${stand.r}`, kind: 'gate', airlineId: 'gulf_pearl' })
    game.schedule.push({
      id: 's1',
      airline: 'zephyr_go',
      flightNo: 'ZG1',
      eta: 80,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: false,
      flightId: null,
      airframeId: 'b738',
    })
    game.setSlotStandPref('s1', stand)
    expect(game.schedule[0]?.standPref ?? null).toBeNull()
    expect(game.news[0]?.text ?? '').toMatch(/leased/)
  })

  it('draws the same footprint the placement check uses for every size and rung', () => {
    const game = opened()
    const anchor = { c: 16, r: 16 }
    const cases: { tool: string; size: StandSize; rung: StandRung; jumbo?: boolean }[] = [
      { tool: 'stand_light', size: 'light', rung: 0 },
      { tool: 'stand_s', size: 'light', rung: 1 },
      { tool: 'stand_narrow', size: 'narrow', rung: 0 },
      { tool: 'stand', size: 'narrow', rung: 1 },
      { tool: 'stand_heavy', size: 'heavy', rung: 0 },
      { tool: 'stand_w', size: 'heavy', rung: 1 },
      { tool: 'stand_l', size: 'heavy', rung: 1 },
    ]
    for (const row of cases) {
      const alias = aliasSize(row.tool, false)
      expect(alias).toMatchObject({ size: row.size, rung: row.rung })
      const letter = footprintLetter(row.size, row.rung)
      game.setTool(row.tool as Tool)
      game.setHover(anchor)
      const expected = keys(footprintCellsForLetter(game.tiles, anchor, letter))
      expect(keys(game.ghostCells(anchor)), row.tool).toEqual(expected)
      expect(game.standPreview()?.letter, row.tool).toBe(letter)
      expect(standServiceTier(row.size, row.rung)).toBe(row.size === 'heavy' && row.rung === 1 ? 'wide' : 'small')
    }

    game.fieldXp = 700
    game.researchUnlocked.push('heavy_pack')
    expect(game.fieldLevel()).toBe(5)
    game.setTool('stand_l')
    const jumboLetter = footprintLetter('heavy', 2)
    expect(jumboLetter).toBe('F')
    expect(keys(game.ghostCells(anchor))).toEqual(keys(footprintCellsForLetter(game.tiles, anchor, jumboLetter)))
    expect(game.standPreview()?.letter).toBe('F')
    expect(standServiceTier('heavy', 2)).toBe('jumbo')
  })

  it('draws the code D box the placement check uses, not the code F class box', () => {
    const game = opened()
    const anchor = { c: 16, r: 16 }
    game.setTool('stand_heavy')
    game.setHover(anchor)
    const preview = game.standPreview()
    expect(preview).toMatchObject({ cls: 'L', letter: 'D' })
    expect(preview?.scale ?? null).toBeNull()
    const entry = standEntry(game.tiles, anchor.c, anchor.r)
    const drawn = previewStandBox(preview!, anchor, entry, false)
    const placed = envelopeWorld('D')
    const legacy = standBox({ c: anchor.c, r: anchor.r, cls: 'L', jetway: false, entry })
    expect(drawn.width).toBeCloseTo(placed.width)
    expect(drawn.depth).toBeCloseTo(placed.depth)
    expect(legacy.width).toBeGreaterThan(drawn.width)
    expect(keys(game.ghostCells(anchor))).toEqual(keys(footprintCellsForLetter(game.tiles, anchor, 'D')))

    const tiles = game.tiles as Tile[][]
    const wing = footprintCellsForLetter(tiles, anchor, 'D').find((p) => p.c !== anchor.c || p.r !== anchor.r)
    expect(wing).toBeTruthy()
    tiles[wing!.r]![wing!.c] = 'tower'
    expect(game.placementGhostReason()).toMatch(/overlap/i)
    expect(keys(game.ghostCells(anchor)).includes(`${wing!.c},${wing!.r}`)).toBe(true)
  })

  it('treats a D-rung heavy stand as a heavy hardstand, not a jumbo slab', () => {
    const game = field()
    game.tiles[2]![2] = 'stand'
    game.standClass['2,2'] = 'L'
    game.standSize['2,2'] = 'heavy'
    game.standRung['2,2'] = 0
    game.tool = 'pan'
    game.clickTile({ c: 2, r: 2 })
    const hardstand = game.buildingCard()
    expect(hardstand?.name).toBe('Heavy stand')
    expect(hardstand?.why ?? '').not.toMatch(/no fuel truck/)

    game.standRung['2,2'] = 1
    game.clickTile({ c: 2, r: 2 })
    expect(game.buildingCard()?.name).toBe('Widebody stand')

    game.standRung['2,2'] = 2
    game.clickTile({ c: 2, r: 2 })
    expect(game.buildingCard()?.name).toBe('Jumbo stand')
    expect(game.buildingCard()?.why ?? '').toMatch(/no fuel truck/)
  })
})
