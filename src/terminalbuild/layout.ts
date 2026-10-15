/**
 * Build tools. Every edit is pure: it returns a new layout and what it costs.
 * Rejected edits return the input untouched with an `error` and zero cost.
 * Removals refund `refundShare` of the build price (negative cost).
 */
import { BUILD_TUNING, DOOR_COST, EQUIP_SPEC, FLOOR_COST, ROOM_SPEC, WALL_COST, ZONE_COST } from './config.ts'
import { STARTER_STORIES, floorOf } from './floors.ts'
import { edgeKey, edgeTiles, inBounds, isFloor, tileKey } from './grid.ts'
import type { BuildLayout, BuildZone, Door, Edge, EditResult, Equip, Rect, Room } from './types.ts'

export function blankLayout(w: number, h: number): BuildLayout {
  return {
    w,
    h,
    stories: STARTER_STORIES,
    floor: Array.from({ length: h }, () => Array.from({ length: w }, () => false)),
    zones: Array.from({ length: h }, () => Array.from({ length: w }, () => null)),
    walls: [],
    doors: [],
    rooms: [],
    equipment: [],
    verticals: [],
    slabs: [],
  }
}

function clone(l: BuildLayout): BuildLayout {
  return {
    ...l,
    floor: l.floor.map((row) => row.slice()),
    zones: l.zones.map((row) => row.slice()),
    walls: l.walls.slice(),
    doors: l.doors.slice(),
    rooms: l.rooms.slice(),
    equipment: l.equipment.slice(),
    verticals: l.verticals?.slice(),
    slabs: l.slabs?.map((s) => ({ ...s, tiles: s.tiles.map((row) => row.slice()), zones: s.zones.map((row) => row.slice()), paint: s.paint?.map((row) => row.slice()) })),
    floorPaint: l.floorPaint?.map((row) => row.slice()),
  }
}

const reject = (layout: BuildLayout, error: string): EditResult => ({ layout, cost: 0, error })
const refund = (price: number) => -Math.round(price * BUILD_TUNING.refundShare)

function rectInBounds(l: BuildLayout, r: Rect): boolean {
  return r.w > 0 && r.h > 0 && inBounds(l, r.x, r.y) && inBounds(l, r.x + r.w - 1, r.y + r.h - 1)
}

function* tilesIn(r: Rect) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) yield { x, y }
}

/** Edge is on the grid (map borders included). */
function edgeValid(l: BuildLayout, e: Edge): boolean {
  const [a, b] = edgeTiles(e)
  return (inBounds(l, a.x, a.y) || inBounds(l, b.x, b.y)) && a.x >= -1 && a.y >= -1
}

export function placeFloor(l: BuildLayout, r: Rect): EditResult {
  if (!rectInBounds(l, r)) return reject(l, 'Off the plot.')
  const next = clone(l)
  let n = 0
  for (const t of tilesIn(r)) {
    if (next.floor[t.y][t.x]) continue
    next.floor[t.y][t.x] = true
    n++
  }
  return { layout: next, cost: n * FLOOR_COST.build }
}

export function removeFloor(l: BuildLayout, r: Rect): EditResult {
  if (!rectInBounds(l, r)) return reject(l, 'Off the plot.')
  const inside = new Set([...tilesIn(r)].map((t) => tileKey(t.x, t.y)))
  if (l.equipment.some((e) => inside.has(tileKey(e.x, e.y)))) return reject(l, 'Remove the equipment first.')
  const next = clone(l)
  let n = 0
  for (const t of tilesIn(r)) {
    if (!next.floor[t.y][t.x]) continue
    next.floor[t.y][t.x] = false
    next.zones[t.y][t.x] = null
    n++
  }
  return { layout: next, cost: refund(n * FLOOR_COST.build) }
}

export function placeWall(l: BuildLayout, e: Edge): EditResult {
  if (!edgeValid(l, e)) return reject(l, 'Off the plot.')
  const k = edgeKey(e)
  if (l.walls.some((w) => edgeKey(w) === k)) return reject(l, 'Already a wall.')
  const next = clone(l)
  next.doors = next.doors.filter((d) => edgeKey(d) !== k)
  next.walls.push({ x: e.x, y: e.y, dir: e.dir, floor: floorOf(e) })
  return { layout: next, cost: WALL_COST.build }
}

export function removeWall(l: BuildLayout, e: Edge): EditResult {
  const k = edgeKey(e)
  if (!l.walls.some((w) => edgeKey(w) === k)) return reject(l, 'No wall there.')
  const next = clone(l)
  next.walls = next.walls.filter((w) => edgeKey(w) !== k)
  return { layout: next, cost: refund(WALL_COST.build) }
}

/** A door takes the place of a wall segment. */
export function placeDoor(l: BuildLayout, d: Door): EditResult {
  if (!edgeValid(l, d)) return reject(l, 'Off the plot.')
  const k = edgeKey(d)
  const next = clone(l)
  next.walls = next.walls.filter((w) => edgeKey(w) !== k)
  next.doors = next.doors.filter((o) => edgeKey(o) !== k)
  next.doors.push({ x: d.x, y: d.y, dir: d.dir, kind: d.kind, floor: floorOf(d) })
  return { layout: next, cost: DOOR_COST[d.kind].build }
}

export function removeDoor(l: BuildLayout, e: Edge): EditResult {
  const k = edgeKey(e)
  const d = l.doors.find((o) => edgeKey(o) === k)
  if (!d) return reject(l, 'No door there.')
  const next = clone(l)
  next.doors = next.doors.filter((o) => edgeKey(o) !== k)
  return { layout: next, cost: refund(DOOR_COST[d.kind].build) }
}

const BELT_KIT = new Set<Equip['kind']>(['bag_belt', 'makeup_carousel'])

function wallBetween(walls: Set<string>, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  if (b.x === a.x + 1 && b.y === a.y) return walls.has(edgeKey({ x: a.x, y: a.y, dir: 'E' }))
  if (a.x === b.x + 1 && a.y === b.y) return walls.has(edgeKey({ x: b.x, y: b.y, dir: 'E' }))
  if (b.y === a.y + 1 && b.x === a.x) return walls.has(edgeKey({ x: a.x, y: a.y, dir: 'S' }))
  if (a.y === b.y + 1 && a.x === b.x) return walls.has(edgeKey({ x: b.x, y: b.y, dir: 'S' }))
  return true
}

/**
 * Zone cells the brush may take. Belts are solid. A wall splits the stroke:
 * only the side that contains the rectangle's first open tile is painted.
 * `invalid` is what the painter tints red.
 */
export function zonePaintMask(
  l: BuildLayout,
  r: Rect,
): { paint: { x: number; y: number }[]; invalid: { x: number; y: number }[] } {
  const belts = new Set(
    l.equipment.filter((e) => BELT_KIT.has(e.kind)).map((e) => tileKey(e.x, e.y)),
  )
  const walls = new Set(l.walls.map(edgeKey))
  const invalid: { x: number; y: number }[] = []
  const open: { x: number; y: number }[] = []
  for (const t of tilesIn(r)) {
    if (!isFloor(l, t.x, t.y)) continue
    if (belts.has(tileKey(t.x, t.y))) invalid.push(t)
    else open.push(t)
  }
  if (!open.length) return { paint: [], invalid }
  const anchor = open.find((t) => t.x === r.x && t.y === r.y) ?? open[0]
  const seen = new Set<string>([tileKey(anchor.x, anchor.y)])
  const q = [anchor]
  while (q.length) {
    const cur = q.shift()!
    for (const n of open) {
      const k = tileKey(n.x, n.y)
      if (seen.has(k)) continue
      const step = Math.abs(n.x - cur.x) + Math.abs(n.y - cur.y)
      if (step !== 1 || wallBetween(walls, cur, n)) continue
      seen.add(k)
      q.push(n)
    }
  }
  const paint = open.filter((t) => seen.has(tileKey(t.x, t.y)))
  for (const t of open) if (!seen.has(tileKey(t.x, t.y))) invalid.push(t)
  return { paint, invalid }
}

/** Paint (or clear with null) a zone. Bare tiles are skipped. Walls and belts are not painted. */
export function paintZone(l: BuildLayout, r: Rect, zone: BuildZone | null): EditResult {
  if (!rectInBounds(l, r)) return reject(l, 'Off the plot.')
  const mask = zonePaintMask(l, r)
  if (zone && mask.paint.length === 0 && mask.invalid.length > 0) {
    return { layout: l, cost: 0, error: 'Wall or belt in the way.', rejected: mask.invalid }
  }
  const next = clone(l)
  let n = 0
  const take = new Set(mask.paint.map((t) => tileKey(t.x, t.y)))
  for (const t of tilesIn(r)) {
    if (!take.has(tileKey(t.x, t.y)) || next.zones[t.y][t.x] === zone) continue
    next.zones[t.y][t.x] = zone
    if (zone) n++
  }
  return { layout: next, cost: n * ZONE_COST.build, rejected: mask.invalid.length ? mask.invalid : undefined }
}

/** Room footprints may not overlap. Zone fit is a validator hint, not a hard stop. */
export function placeRoom(l: BuildLayout, room: Room): EditResult {
  if (!rectInBounds(l, room)) return reject(l, 'Off the plot.')
  if (l.rooms.some((o) => o.id === room.id)) return reject(l, 'Room id in use.')
  const taken = new Set(
    l.rooms.filter((o) => floorOf(o) === floorOf(room)).flatMap((o) => [...tilesIn(o)].map((t) => tileKey(t.x, t.y, floorOf(o)))),
  )
  if ([...tilesIn(room)].some((t) => taken.has(tileKey(t.x, t.y, floorOf(room))))) return reject(l, 'Overlaps another room.')
  const next = clone(l)
  next.rooms.push({ ...room, floor: floorOf(room) })
  return { layout: next, cost: ROOM_SPEC[room.kind].build }
}

export function removeRoom(l: BuildLayout, id: string): EditResult {
  const room = l.rooms.find((o) => o.id === id)
  if (!room) return reject(l, 'No such room.')
  const next = clone(l)
  next.rooms = next.rooms.filter((o) => o.id !== id)
  return { layout: next, cost: refund(ROOM_SPEC[room.kind].build) }
}

export function placeEquipment(l: BuildLayout, e: Omit<Equip, 'wear'> & { wear?: number }): EditResult {
  if (!isFloor(l, e.x, e.y)) return reject(l, 'Equipment needs a floor tile.')
  if (l.equipment.some((o) => o.id === e.id)) return reject(l, 'Equipment id in use.')
  if (l.equipment.some((o) => o.x === e.x && o.y === e.y && floorOf(o) === floorOf(e))) return reject(l, 'Tile already has equipment.')
  const next = clone(l)
  next.equipment.push({ id: e.id, kind: e.kind, x: e.x, y: e.y, wear: e.wear ?? 0, floor: floorOf(e) })
  return { layout: next, cost: EQUIP_SPEC[e.kind].build }
}

export function removeEquipment(l: BuildLayout, id: string): EditResult {
  const eq = l.equipment.find((o) => o.id === id)
  if (!eq) return reject(l, 'No such equipment.')
  const next = clone(l)
  next.equipment = next.equipment.filter((o) => o.id !== id)
  return { layout: next, cost: refund(EQUIP_SPEC[eq.kind].build) }
}

/** Convenience tool: wall every outer floor edge that has no wall or door yet. */
export function encloseFloor(l: BuildLayout): EditResult {
  const closed = new Set([...l.walls.map(edgeKey), ...l.doors.map(edgeKey)])
  const next = clone(l)
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      if (!l.floor[y][x]) continue
      const outer: Edge[] = []
      if (!isFloor(l, x + 1, y)) outer.push({ x, y, dir: 'E' })
      if (!isFloor(l, x - 1, y)) outer.push({ x: x - 1, y, dir: 'E' })
      if (!isFloor(l, x, y + 1)) outer.push({ x, y, dir: 'S' })
      if (!isFloor(l, x, y - 1)) outer.push({ x, y: y - 1, dir: 'S' })
      for (const e of outer) {
        const k = edgeKey(e)
        if (closed.has(k)) continue
        closed.add(k)
        next.walls.push({ ...e, floor: floorOf(e) })
      }
    }
  }
  return { layout: next, cost: (next.walls.length - l.walls.length) * WALL_COST.build }
}

/** Apply edits in order, stopping at the first rejection. Handy for tools and tests. */
export function applyEdits(
  l: BuildLayout,
  edits: readonly ((l: BuildLayout) => EditResult)[],
): EditResult {
  let layout = l
  let cost = 0
  for (const edit of edits) {
    const res = edit(layout)
    if (res.error) return { layout, cost, error: res.error }
    layout = res.layout
    cost += res.cost
  }
  return { layout, cost }
}

/** Daily upkeep of everything built. Nothing is free. */
export function buildUpkeepPerDay(l: BuildLayout): number {
  let floor = 0
  let zoned = 0
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      if (l.floor[y][x]) floor++
      if (l.zones[y][x]) zoned++
    }
  }
  return (
    floor * FLOOR_COST.upkeepPerDay +
    zoned * ZONE_COST.upkeepPerDay +
    l.walls.length * WALL_COST.upkeepPerDay +
    l.doors.reduce((s, d) => s + DOOR_COST[d.kind].upkeepPerDay, 0) +
    l.rooms.reduce((s, r) => s + ROOM_SPEC[r.kind].upkeepPerDay, 0) +
    l.equipment.reduce((s, e) => s + EQUIP_SPEC[e.kind].upkeepPerDay, 0)
  )
}
