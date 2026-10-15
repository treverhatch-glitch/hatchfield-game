import { describe, expect, it } from 'vitest'
import { blankLayout, placeDoor, placeEquipment, placeRoom, placeWall } from './layout.ts'
import { edgeBetween, edgeKey, edgeTiles, tileKey } from './grid.ts'
import { ENABLED_STORIES, STARTER_STORIES, STARTER_TERMINAL, attachSlab, emptySlab, floorLinks, floorOf, layoutSlabs, storyEnabled } from './floors.ts'
import type { BuildLayout } from './types.ts'

describe('interior floors', () => {
  it('treats a missing floor as the ground story and keeps its edge key', () => {
    expect(floorOf({})).toBe(0)
    expect(floorOf({ floor: 0 })).toBe(0)
    expect(edgeKey({ x: 1, y: 2, dir: 'E' })).toBe('1,2,E')
    expect(edgeKey({ x: 1, y: 2, dir: 'E', floor: 0 })).toBe('1,2,E')
    expect(edgeKey({ x: 1, y: 2, dir: 'E', floor: 1 })).toBe('1|1,2,E')
    expect(tileKey(3, 4)).toBe('3,4')
    expect(tileKey(3, 4, 1)).toBe('1|3,4')
    expect(edgeKey(edgeBetween({ x: 1, y: 2 }, { x: 2, y: 2 }))).toBe('1,2,E')
    expect(edgeKey(edgeBetween({ x: 1, y: 2, floor: 1 }, { x: 2, y: 2, floor: 1 }))).toBe('1|1,2,E')
    const [a, b] = edgeTiles({ x: 1, y: 2, dir: 'E', floor: 1 })
    expect(a).toEqual({ x: 1, y: 2, floor: 1 })
    expect(b).toEqual({ x: 2, y: 2, floor: 1 })
    expect(ENABLED_STORIES).toBe(1)
    expect(STARTER_STORIES).toBe(1)
    expect(storyEnabled(0)).toBe(true)
    expect(storyEnabled(1)).toBe(false)
  })

  it('stamps floor 0 onto walls, doors, rooms, and furniture', () => {
    let l = blankLayout(4, 4)
    expect(l.stories).toBe(1)
    l = placeWall(l, { x: 0, y: 0, dir: 'E' }).layout
    l = placeDoor(l, { x: 1, y: 0, dir: 'E', kind: 'public' }).layout
    l.floor[0][0] = true
    l = placeRoom(l, { id: 'r', kind: 'checkin', x: 0, y: 0, w: 1, h: 1 }).layout
    l = placeEquipment(l, { id: 'd', kind: 'checkin_desk', x: 0, y: 0 }).layout
    expect(l.walls[0]?.floor).toBe(0)
    expect(l.doors[0]?.floor).toBe(0)
    expect(l.rooms[0]?.floor).toBe(0)
    expect(l.equipment[0]?.floor).toBe(0)
  })

  it('keeps a stair up to floor 1 in the layout and out of the live nav', () => {
    const l: BuildLayout = {
      ...blankLayout(2, 2),
      verticals: [{ kind: 'stairs', x: 0, y: 0, floor: 0, toFloor: 1 }],
    }
    expect(floorLinks(l)).toEqual([])
    expect(floorLinks(l, 2)).toEqual([{ kind: 'stairs', x: 0, y: 0, fromFloor: 0, toFloor: 1 }])
  })

  it('stores an upper slab only when the hall is allowed a second story, and still does not walk it', () => {
    const ground = blankLayout(3, 2)
    ground.floor[0][0] = true
    expect(STARTER_TERMINAL).toBe('split1f')
    expect(ground.stories).toBe(1)
    expect(ground.slabs).toEqual([])
    expect(attachSlab(ground, emptySlab(1, 3, 2)).error).toBe('This hall has no story there yet.')
    expect(ground.floor[0][0]).toBe(true)

    const ready = attachSlab({ ...ground, stories: 2 }, emptySlab(1, 3, 2))
    expect(ready.error).toBeUndefined()
    const slabs = layoutSlabs(ready.layout)
    expect(slabs.map((s) => s.index)).toEqual([0, 1])
    expect(slabs[0]?.tiles[0][0]).toBe(true)
    expect(slabs[1]?.elevationM).toBe(5)
    expect(slabs[1]?.tiles[0][0]).toBe(false)
    expect(floorLinks(ready.layout)).toEqual([])
    expect(storyEnabled(1)).toBe(false)
  })
})
