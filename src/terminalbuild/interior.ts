/**
 * Interior edits inside a shell, Prison Architect order:
 * foundation, walls, room zones, required items.
 * Pure. The walk merges an InteriorEdit onto the hall layout. Rendering only draws the edit.
 */
import {
  BUILD_TUNING,
  DOOR_COST,
  EQUIP_SPEC,
  PAINT_COST,
  ROOM_SPEC,
  floorTileCost,
  layoutTileM,
  wallEdgeCost,
  zoneTileCost,
} from './config.ts'
import { floorOf } from './floors.ts'
import { edgeKey, inBounds, isFloor, tileKey } from './grid.ts'
import type { BuildLayout, BuildZone, Door, Edge, Equip, InteriorEdit, Rect, Room, RoomKind, Tile } from './types.ts'
import { validateLayout } from './validate.ts'

const refund = (price: number) => -Math.round(price * BUILD_TUNING.refundShare)

export function emptyInterior(): InteriorEdit {
  return { walls: [], doors: [], removed: [], floorPaint: [], wallPaint: [], zones: [], rooms: [], equipment: [], foundation: [] }
}

/** Lay indoor floor. Tiles already in the list are left as they are. */
export function paintFoundation(edit: InteriorEdit, tiles: Tile[]): InteriorEdit {
  const have = new Set((edit.foundation ?? []).map((t) => tileKey(t.x, t.y, floorOf(t))))
  const add = tiles
    .filter((t) => !have.has(tileKey(t.x, t.y, floorOf(t))))
    .map((t) => ({ x: t.x, y: t.y, floor: floorOf(t) }))
  if (!add.length) return edit
  return { ...edit, foundation: [...(edit.foundation ?? []), ...add] }
}

/** A straight wall run. Horizontal drags lay south edges; vertical drags lay east edges. */
export function wallRun(a: Tile, b: Tile): Edge[] {
  const floor = floorOf(a)
  const edges: Edge[] = []
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    const y = a.y
    const x0 = Math.min(a.x, b.x)
    const x1 = Math.max(a.x, b.x)
    for (let x = x0; x <= x1; x++) edges.push({ x, y, dir: 'S', floor })
  } else {
    const x = a.x
    const y0 = Math.min(a.y, b.y)
    const y1 = Math.max(a.y, b.y)
    for (let y = y0; y <= y1; y++) edges.push({ x, y, dir: 'E', floor })
  }
  return edges
}

export function dragRect(a: Tile, b: Tile): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(b.x - a.x) + 1, h: Math.abs(b.y - a.y) + 1 }
}

export function tilesInRect(r: Rect, floor = 0): Tile[] {
  const out: Tile[] = []
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y, floor })
  return out
}

/** Hall-metre centre of a build tile. The hall box is centred on the origin. */
export function tileCenter(x: number, y: number, tileM: number, hallW: number, hallD: number): { x: number; z: number } {
  return { x: -hallW / 2 + (x + 0.5) * tileM, z: -hallD / 2 + (y + 0.5) * tileM }
}

export function tileAtPoint(
  hx: number,
  hz: number,
  tileM: number,
  hallW: number,
  hallD: number,
  w: number,
  h: number,
): Tile | null {
  const x = Math.floor((hx + hallW / 2) / tileM)
  const y = Math.floor((hz + hallD / 2) / tileM)
  if (x < 0 || y < 0 || x >= w || y >= h) return null
  return { x, y, floor: 0 }
}

/** Closest edge of a tile to a hall-metre point. */
export function nearestEdge(hx: number, hz: number, tile: Tile, tileM: number, hallW: number, hallD: number): Edge {
  const left = -hallW / 2 + tile.x * tileM
  const top = -hallD / 2 + tile.y * tileM
  const dW = Math.abs(hx - left)
  const dE = Math.abs(hx - (left + tileM))
  const dN = Math.abs(hz - top)
  const dS = Math.abs(hz - (top + tileM))
  const floor = floorOf(tile)
  const min = Math.min(dW, dE, dN, dS)
  if (min === dW) return { x: tile.x - 1, y: tile.y, dir: 'E', floor }
  if (min === dE) return { x: tile.x, y: tile.y, dir: 'E', floor }
  if (min === dN) return { x: tile.x, y: tile.y - 1, dir: 'S', floor }
  return { x: tile.x, y: tile.y, dir: 'S', floor }
}

function covers(r: Rect, t: Tile): boolean {
  return t.x >= r.x && t.y >= r.y && t.x < r.x + r.w && t.y < r.y + r.h
}

function sameFloor(a: { floor?: number }, b: { floor?: number }): boolean {
  return floorOf(a) === floorOf(b)
}

function roomsOverlap(a: Room, b: Room): boolean {
  if (!sameFloor(a, b)) return false
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function paintWallRun(edit: InteriorEdit, edges: Edge[], erase: boolean): InteriorEdit {
  const keys = new Set(edges.map(edgeKey))
  if (erase) {
    return {
      ...edit,
      walls: edit.walls.filter((w) => !keys.has(edgeKey(w))),
      doors: edit.doors.filter((d) => !keys.has(edgeKey(d))),
      wallPaint: edit.wallPaint.filter((w) => !keys.has(edgeKey(w))),
      removed: [...new Set([...edit.removed, ...keys])],
    }
  }
  const have = new Set(edit.walls.map(edgeKey))
  const add = edges
    .filter((e) => !have.has(edgeKey(e)))
    .map((e) => ({ x: e.x, y: e.y, dir: e.dir, floor: floorOf(e) }))
  return {
    ...edit,
    removed: edit.removed.filter((k) => !keys.has(k)),
    walls: [...edit.walls, ...add],
  }
}

/** A public door on a wall segment. Calling it again takes the door off. */
export function toggleDoor(edit: InteriorEdit, edge: Edge): InteriorEdit {
  const k = edgeKey(edge)
  if (edit.doors.some((d) => edgeKey(d) === k)) {
    return { ...edit, doors: edit.doors.filter((d) => edgeKey(d) !== k) }
  }
  const door: Door = { x: edge.x, y: edge.y, dir: edge.dir, kind: 'public', floor: floorOf(edge) }
  return {
    ...edit,
    doors: [...edit.doors, door],
    walls: edit.walls.filter((w) => edgeKey(w) !== k),
    removed: edit.removed.filter((r) => r !== k),
  }
}

export function paintTiles(edit: InteriorEdit, tiles: Tile[], paint: string | null): InteriorEdit {
  const drop = new Set(tiles.map((t) => tileKey(t.x, t.y, floorOf(t))))
  const kept = edit.floorPaint.filter((p) => !drop.has(tileKey(p.x, p.y, floorOf(p))))
  if (!paint) return { ...edit, floorPaint: kept }
  return {
    ...edit,
    floorPaint: [...kept, ...tiles.map((t) => ({ x: t.x, y: t.y, paint, floor: floorOf(t) }))],
  }
}

export function paintEdges(edit: InteriorEdit, edges: Edge[], paint: string | null): InteriorEdit {
  const drop = new Set(edges.map(edgeKey))
  const kept = edit.wallPaint.filter((w) => !drop.has(edgeKey(w)))
  if (!paint) return { ...edit, wallPaint: kept }
  return {
    ...edit,
    wallPaint: [...kept, ...edges.map((e) => ({ x: e.x, y: e.y, dir: e.dir, paint, floor: floorOf(e) }))],
  }
}

function zoneFor(kind: RoomKind): BuildZone {
  return ROOM_SPEC[kind].zones[0]
}

function paintRoomZone(edit: InteriorEdit, room: Room): InteriorEdit['zones'] {
  const zone = zoneFor(room.kind)
  const floor = floorOf(room)
  const drop = new Set(tilesInRect(room, floor).map((t) => tileKey(t.x, t.y, floor)))
  const kept = edit.zones.filter((z) => !drop.has(tileKey(z.x, z.y, floorOf(z))))
  return [...kept, ...tilesInRect(room, floor).map((t) => ({ x: t.x, y: t.y, zone, floor }))]
}

export function assignRoom(edit: InteriorEdit, room: Room, taken: readonly Room[] = []): { edit: InteriorEdit; error?: string } {
  if (room.w < 1 || room.h < 1) return { edit, error: 'Drag a room.' }
  const next: Room = { ...room, floor: floorOf(room) }
  if (edit.rooms.some((r) => r.id === next.id) || taken.some((r) => r.id === next.id)) return { edit, error: 'Room id in use.' }
  if ([...edit.rooms, ...taken].some((r) => roomsOverlap(r, next))) return { edit, error: 'Overlaps another room.' }
  return { edit: { ...edit, rooms: [...edit.rooms, next], zones: paintRoomZone(edit, next) } }
}

export function resizeRoom(edit: InteriorEdit, id: string, rect: Rect, taken: readonly Room[] = []): { edit: InteriorEdit; error?: string } {
  const room = edit.rooms.find((r) => r.id === id)
  if (!room) return { edit, error: 'No such room.' }
  if (rect.w < 1 || rect.h < 1) return { edit, error: 'Drag a room.' }
  const next: Room = { ...room, ...rect }
  const others = [...edit.rooms.filter((r) => r.id !== id), ...taken.filter((r) => r.id !== id)]
  if (others.some((r) => roomsOverlap(r, next))) return { edit, error: 'Overlaps another room.' }
  const oldKeys = new Set(tilesInRect(room, floorOf(room)).map((t) => tileKey(t.x, t.y, floorOf(t))))
  const keptZones = edit.zones.filter((z) => !oldKeys.has(tileKey(z.x, z.y, floorOf(z))))
  const stripped: InteriorEdit = { ...edit, rooms: edit.rooms.map((r) => (r.id === id ? next : r)), zones: keptZones }
  return { edit: { ...stripped, zones: paintRoomZone(stripped, next) } }
}

export function deleteRoom(edit: InteriorEdit, id: string): InteriorEdit {
  const room = edit.rooms.find((r) => r.id === id)
  if (!room) return edit
  const keys = new Set(tilesInRect(room, floorOf(room)).map((t) => tileKey(t.x, t.y, floorOf(t))))
  return {
    ...edit,
    rooms: edit.rooms.filter((r) => r.id !== id),
    zones: edit.zones.filter((z) => !keys.has(tileKey(z.x, z.y, floorOf(z)))),
    equipment: edit.equipment.filter((e) => !(keys.has(tileKey(e.x, e.y, floorOf(e))) && floorOf(e) === floorOf(room))),
  }
}

export function freshRoomId(edit: InteriorEdit, kind: RoomKind): string {
  let n = edit.rooms.length + 1
  let id = `${kind}-${n}`
  while (edit.rooms.some((r) => r.id === id)) {
    n += 1
    id = `${kind}-${n}`
  }
  return id
}

/** Drop the first missing required item on the first free tile of the room. */
export function furnishRoom(edit: InteriorEdit, layout: BuildLayout, roomId: string): { edit: InteriorEdit; error?: string } {
  const room = edit.rooms.find((r) => r.id === roomId)
  if (!room) return { edit, error: 'No such room.' }
  const spec = ROOM_SPEC[room.kind]
  const floor = floorOf(room)
  const missing = spec.needs.find(
    (need) =>
      !layout.equipment.some(
        (e) => e.kind === need && floorOf(e) === floor && covers(room, e) && e.x >= 0 && e.y >= 0,
      ),
  )
  if (!missing) return { edit, error: 'Nothing missing.' }
  const spot = tilesInRect(room, floor).find(
    (t) =>
      isFloor(layout, t.x, t.y) &&
      !layout.equipment.some((e) => e.x === t.x && e.y === t.y && floorOf(e) === floor),
  )
  if (!spot) return { edit, error: 'No free tile.' }
  const piece: Equip = { id: `${room.id}:${missing}`, kind: missing, x: spot.x, y: spot.y, wear: 0, floor }
  return { edit: { ...edit, equipment: [...edit.equipment, piece] } }
}

export function roomReport(layout: BuildLayout, roomId: string) {
  const tail = `:${roomId}`
  return validateLayout(layout).findings.filter((f) => f.id.endsWith(tail) || f.id.includes(`${tail}:`))
}

const ROOM_FINDING = /^(room_empty|room_floor|room_zone):/

/** One validation pass. Findings for every listed room, or every room when ids are omitted. */
export function roomsReport(layout: BuildLayout, roomIds?: readonly string[]) {
  const findings = validateLayout(layout).findings.filter((f) => ROOM_FINDING.test(f.id))
  if (!roomIds) return findings
  const ids = new Set(roomIds)
  return findings.filter((f) => ids.has(f.id.split(':')[1] ?? ''))
}

function copyLayout(base: BuildLayout): BuildLayout {
  return {
    ...base,
    floor: base.floor.map((row) => row.slice()),
    zones: base.zones.map((row) => row.slice()),
    walls: base.walls.map((w) => ({ ...w })),
    doors: base.doors.map((d) => ({ ...d })),
    rooms: base.rooms.map((r) => ({ ...r })),
    equipment: base.equipment.map((e) => ({ ...e })),
    verticals: base.verticals?.map((v) => ({ ...v })),
    floorPaint: base.floorPaint?.map((row) => row.slice()) ?? base.floor.map((row) => row.map(() => null)),
  }
}

/** Merge a player's interior edit onto the hall layout the walkers already use. */
export function applyInterior(base: BuildLayout, edit: InteriorEdit): BuildLayout {
  const next = copyLayout(base)
  for (const t of edit.foundation ?? []) {
    if (floorOf(t) !== 0 || !inBounds(next, t.x, t.y)) continue
    next.floor[t.y][t.x] = true
  }
  const removed = new Set(edit.removed)
  const doorKeys = new Set(edit.doors.map(edgeKey))
  next.walls = next.walls.filter((w) => !removed.has(edgeKey(w)) && !doorKeys.has(edgeKey(w)))
  for (const w of edit.walls) {
    if (removed.has(edgeKey(w)) || doorKeys.has(edgeKey(w))) continue
    if (next.walls.some((o) => edgeKey(o) === edgeKey(w))) continue
    next.walls.push({ x: w.x, y: w.y, dir: w.dir, floor: floorOf(w), finish: w.finish })
  }
  next.doors = next.doors.filter((d) => !removed.has(edgeKey(d)) && !doorKeys.has(edgeKey(d)))
  for (const d of edit.doors) {
    if (removed.has(edgeKey(d))) continue
    next.doors.push({ ...d, floor: floorOf(d) })
  }
  for (const p of edit.wallPaint) {
    const wall = next.walls.find((w) => edgeKey(w) === edgeKey(p))
    if (wall) wall.finish = p.paint
  }
  const paint = next.floorPaint ?? next.floor.map((row) => row.map(() => null))
  next.floorPaint = paint
  for (const p of edit.floorPaint) {
    if (floorOf(p) !== 0 || !inBounds(next, p.x, p.y)) continue
    paint[p.y][p.x] = p.paint
  }
  for (const z of edit.zones) {
    if (floorOf(z) !== 0 || !inBounds(next, z.x, z.y)) continue
    next.zones[z.y][z.x] = z.zone
  }
  for (const room of edit.rooms) {
    if (next.rooms.some((r) => r.id === room.id)) continue
    next.rooms.push({ ...room, floor: floorOf(room) })
  }
  for (const eq of edit.equipment) {
    const floor = floorOf(eq)
    if (next.equipment.some((e) => e.id === eq.id)) continue
    if (next.equipment.some((e) => e.x === eq.x && e.y === eq.y && floorOf(e) === floor)) continue
    next.equipment.push({ ...eq, floor, wear: eq.wear ?? 0 })
  }
  return next
}

function paintCell(l: BuildLayout, x: number, y: number): string | null {
  return l.floorPaint?.[y]?.[x] ?? null
}

/** Cash to go from one merged layout to the next. Removals refund `refundShare`. */
export function interiorCost(before: BuildLayout, after: BuildLayout): number {
  let cost = 0
  const beforeWalls = new Map(before.walls.map((w) => [edgeKey(w), w]))
  const afterWalls = new Map(after.walls.map((w) => [edgeKey(w), w]))
  for (const [k, w] of afterWalls) {
    const prev = beforeWalls.get(k)
    if (!prev) cost += wallEdgeCost(layoutTileM(after))
    else if ((prev.finish ?? '') !== (w.finish ?? '') && w.finish) cost += PAINT_COST.wall
  }
  for (const k of beforeWalls.keys()) if (!afterWalls.has(k)) cost += refund(wallEdgeCost(layoutTileM(before)))

  const beforeDoors = new Map(before.doors.map((d) => [edgeKey(d), d]))
  const afterDoors = new Map(after.doors.map((d) => [edgeKey(d), d]))
  for (const [k, d] of afterDoors) if (!beforeDoors.has(k)) cost += DOOR_COST[d.kind].build
  for (const [k, d] of beforeDoors) if (!afterDoors.has(k)) cost += refund(DOOR_COST[d.kind].build)

  const beforeRooms = new Map(before.rooms.map((r) => [r.id, r]))
  const afterRooms = new Map(after.rooms.map((r) => [r.id, r]))
  for (const [id, r] of afterRooms) if (!beforeRooms.has(id)) cost += ROOM_SPEC[r.kind].build
  for (const [id, r] of beforeRooms) if (!afterRooms.has(id)) cost += refund(ROOM_SPEC[r.kind].build)

  const beforeEq = new Map(before.equipment.map((e) => [e.id, e]))
  const afterEq = new Map(after.equipment.map((e) => [e.id, e]))
  for (const [id, e] of afterEq) if (!beforeEq.has(id)) cost += EQUIP_SPEC[e.kind].build
  for (const [id, e] of beforeEq) if (!afterEq.has(id)) cost += refund(EQUIP_SPEC[e.kind].build)

  const h = Math.max(before.h, after.h)
  const w = Math.max(before.w, after.w)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wasFloor = Boolean(before.floor[y]?.[x])
      const nowFloor = Boolean(after.floor[y]?.[x])
      if (wasFloor !== nowFloor) cost += nowFloor ? floorTileCost(layoutTileM(after)) : refund(floorTileCost(layoutTileM(before)))
      const was = paintCell(before, x, y)
      const now = paintCell(after, x, y)
      if (was !== now) {
        if (now) cost += PAINT_COST.floor
        else if (was) cost += refund(PAINT_COST.floor)
      }
      const bz = before.zones[y]?.[x] ?? null
      const az = after.zones[y]?.[x] ?? null
      if (bz === az) continue
      if (az) cost += zoneTileCost(layoutTileM(after))
      else if (bz) cost += refund(zoneTileCost(layoutTileM(before)))
    }
  }
  return cost
}
