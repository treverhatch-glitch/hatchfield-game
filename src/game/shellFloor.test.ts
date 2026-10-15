import { describe, expect, it } from 'vitest'
import { GRID_C, GRID_R, HALL_D, HALL_W, blankZones, type PlacedItem } from './terminal.ts'
import {
  apronGrowth,
  cellCenterInFloor,
  cellInFloor,
  extraForGrowth,
  growZoneGrid,
  hallsTouched,
  stampCells,
} from './shellFloor.ts'

function item(c: number, r: number): PlacedItem {
  return { id: `${c},${r}`, def: 'bench', c, r, wear: 0 }
}

describe('shell floor', () => {
  it('treats a stamp-sized shell as no extra floor', () => {
    const growth = apronGrowth({ c: 4, r: 6 }, false, { minC: 4, maxC: 5, minR: 6, maxR: 7 })
    const extra = extraForGrowth(growth, GRID_C, GRID_R, false)
    expect(stampCells(false)).toBe(2)
    expect(extra.left + extra.right + extra.top + extra.bottom).toBe(0)
    const mid = cellInFloor(0, 0, extra, GRID_C, GRID_R)
    expect(mid).toEqual(cellInFloor(0, 0, null, GRID_C, GRID_R))
    expect(cellCenterInFloor(0, 0, null, GRID_C, GRID_R).x).toBeCloseTo(-HALL_W / 2 + HALL_W / GRID_C / 2)
  })

  it('adds columns when the shell grows east and keeps an old cell put', () => {
    const growth = apronGrowth({ c: 10, r: 10 }, true, { minC: 10, maxC: 14, minR: 10, maxR: 12 })
    expect(growth).toEqual({ left: 0, right: 2, top: 0, bottom: 0 })
    const extra = extraForGrowth(growth, 8, 5, true)
    expect(extra.right).toBe(Math.round((2 * 8) / 3))
    expect(extra.left).toBe(0)
    const zones = blankZones()
    zones[1][2] = 'checkin'
    const grown = growZoneGrid(zones, [item(2, 1)], null, extra)
    expect(grown.zones[0]).toHaveLength(8 + extra.right)
    expect(grown.zones).toHaveLength(5)
    expect(grown.zones[1][2]).toBe('checkin')
    expect(grown.items[0]).toMatchObject({ c: 2, r: 1 })
    const before = cellCenterInFloor(2, 1, null, 8, 5)
    const after = cellCenterInFloor(2, 1, extra, 8 + extra.right, 5)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.z).toBeCloseTo(before.z)
    const wing = cellInFloor(HALL_W / 2 + 1, 0, extra, 8 + extra.right, 5)
    expect(wing.c).toBeGreaterThanOrEqual(8)
    expect(wing.r).toBeGreaterThanOrEqual(0)
    expect(wing.r).toBeLessThan(5)
  })

  it('shifts indexes when the shell grows west, and names one hall when cells touch it', () => {
    const growth = apronGrowth({ c: 8, r: 4 }, false, { minC: 6, maxC: 9, minR: 4, maxR: 5 })
    const extra = extraForGrowth(growth, GRID_C, GRID_R, false)
    expect(extra.left).toBe(Math.round((2 * GRID_C) / 2))
    const grown = growZoneGrid(blankZones(), [item(1, 0)], null, extra)
    expect(grown.items[0].c).toBe(1 + extra.left)
    const tiles = Array.from({ length: 12 }, () => Array.from({ length: 16 }, () => 'grass'))
    for (let r = 4; r <= 5; r++) for (let c = 8; c <= 9; c++) tiles[r][c] = 'terminal'
    expect(hallsTouched(tiles, [{ c: 6, r: 4 }, { c: 7, r: 4 }, { c: 6, r: 5 }, { c: 7, r: 5 }], [{ origin: { c: 8, r: 4 } }])).toEqual([0])
    expect(hallsTouched(tiles, [{ c: 20, r: 4 }, { c: 21, r: 4 }, { c: 20, r: 5 }, { c: 21, r: 5 }], [{ origin: { c: 8, r: 4 } }])).toEqual([])
    const second = tiles.map((row) => row.slice())
    for (let r = 4; r <= 5; r++) for (let c = 4; c <= 5; c++) second[r][c] = 'terminal'
    const both = hallsTouched(
      second,
      [{ c: 6, r: 4 }, { c: 7, r: 4 }, { c: 6, r: 5 }, { c: 7, r: 5 }],
      [{ origin: { c: 4, r: 4 } }, { origin: { c: 8, r: 4 } }],
    )
    expect(both).toEqual([0, 1])
    expect(HALL_D).toBeGreaterThan(0)
  })
})
