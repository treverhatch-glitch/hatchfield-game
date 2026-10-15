import { describe, expect, it } from 'vitest'
import { blankLayout, placeFloor } from './layout.ts'
import { edgeKey } from './grid.ts'
import {
  applyInterior,
  assignRoom,
  deleteRoom,
  dragRect,
  emptyInterior,
  furnishRoom,
  interiorCost,
  nearestEdge,
  paintEdges,
  paintTiles,
  paintWallRun,
  resizeRoom,
  roomReport,
  tileAtPoint,
  toggleDoor,
  wallRun,
} from './interior.ts'

function slab(w: number, h: number) {
  let l = blankLayout(w, h)
  l = placeFloor(l, { x: 0, y: 0, w, h }).layout
  return l
}

describe('interior edit', () => {
  it('drags a wall run and keeps floor 0 on the key', () => {
    const run = wallRun({ x: 1, y: 2 }, { x: 3, y: 2 })
    expect(run.map(edgeKey)).toEqual(['1,2,S', '2,2,S', '3,2,S'])
    expect(run[0]?.floor).toBe(0)
    const up = wallRun({ x: 0, y: 0 }, { x: 0, y: 2 })
    expect(up.map((e) => e.dir)).toEqual(['E', 'E', 'E'])
    const edit = paintWallRun(emptyInterior(), run, false)
    const gone = paintWallRun(edit, [run[1]!], true)
    expect(gone.walls).toHaveLength(2)
    expect(gone.removed).toContain('2,2,S')
  })

  it('merges a door and floor paint onto the layout without dropping the base wall key', () => {
    const base = slab(4, 3)
    let edit = paintWallRun(emptyInterior(), wallRun({ x: 1, y: 1 }, { x: 2, y: 1 }), false)
    edit = toggleDoor(edit, { x: 1, y: 1, dir: 'S' })
    edit = paintTiles(edit, [{ x: 0, y: 0 }, { x: 1, y: 0 }], 'floor_carpet')
    edit = paintEdges(edit, [{ x: 2, y: 1, dir: 'S' }], 'wall_panel')
    const merged = applyInterior(base, edit)
    expect(merged.doors.map(edgeKey)).toContain('1,1,S')
    expect(merged.walls.map(edgeKey)).not.toContain('1,1,S')
    expect(merged.walls.find((w) => edgeKey(w) === '2,1,S')?.finish).toBe('wall_panel')
    expect(merged.floorPaint?.[0]?.[0]).toBe('floor_carpet')
    expect(merged.floorPaint?.[0]?.[1]).toBe('floor_carpet')
    expect(tileAtPoint(0, 0, 4, 48, 32, 12, 8)).toEqual({ x: 6, y: 4, floor: 0 })
    expect(nearestEdge(2, 0.2, { x: 0, y: 0 }, 4, 48, 32).dir).toBe('S')
  })

  it('assigns, resizes, and deletes a room, and requires its item', () => {
    const base = slab(6, 4)
    const id = 'shops-1'
    const placed = assignRoom(emptyInterior(), { id, kind: 'retail', x: 0, y: 0, w: 2, h: 2 })
    expect(placed.error).toBeUndefined()
    let edit = placed.edit
    const overlap = assignRoom(edit, { id: 'shops-2', kind: 'retail', x: 1, y: 1, w: 2, h: 1 })
    expect(overlap.error).toMatch(/overlap/i)
    const grown = resizeRoom(edit, id, dragRect({ x: 0, y: 0 }, { x: 2, y: 1 }))
    expect(grown.error).toBeUndefined()
    expect(grown.edit.rooms[0]).toMatchObject({ w: 3, h: 2 })
    const merged = applyInterior(base, grown.edit)
    expect(merged.zones[0][0]).toBe('retail')
    const report = roomReport(merged, id)
    expect(report.some((f) => f.id.includes('shop_counter'))).toBe(true)
    const furnished = furnishRoom(grown.edit, merged, id)
    expect(furnished.error).toBeUndefined()
    const ready = applyInterior(base, furnished.edit)
    expect(roomReport(ready, id).some((f) => f.id.includes('shop_counter'))).toBe(false)
    expect(ready.equipment[0]?.floor).toBe(0)
    const cleared = deleteRoom(furnished.edit, id)
    expect(cleared.rooms).toHaveLength(0)
    expect(cleared.equipment).toHaveLength(0)
    const cost = interiorCost(base, ready)
    expect(cost).toBeGreaterThan(0)
    expect(interiorCost(ready, base)).toBeLessThan(0)
  })
})
