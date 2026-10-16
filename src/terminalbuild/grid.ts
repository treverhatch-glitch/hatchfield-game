/** Grid helpers shared by the validator and the flow model. */
import { EQUIP_SPEC, ZONE_SIDE } from './config.ts'
import { floorOf } from './floors.ts'
import type { BuildLayout, Door, Edge, Equip, Room, Tile, ZoneSide } from './types.ts'

export type Mover = 'depart' | 'arrive' | 'staff'

/** Floor 0 keeps the historical key. Upper stories are prefixed so they cannot collide. */
export const tileKey = (x: number, y: number, floor = 0) => (floor === 0 ? `${x},${y}` : `${floor}|${x},${y}`)
export const edgeKey = (e: Edge) => {
  const body = `${e.x},${e.y},${e.dir}`
  const floor = floorOf(e)
  return floor === 0 ? body : `${floor}|${body}`
}

export function inBounds(l: BuildLayout, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < l.w && y < l.h
}

export function isFloor(l: BuildLayout, x: number, y: number): boolean {
  return inBounds(l, x, y) && l.floor[y][x]
}

/** Story stamp copied onto a derived edge or tile. Omitted on the ground story so old keys stay. */
function storyOf(t: { floor?: number }): { floor: number } | Record<string, never> {
  return t.floor == null ? {} : { floor: floorOf(t) }
}

/** The edge shared by two 4-neighbour tiles (either may be off-grid). */
export function edgeBetween(a: Tile, b: Tile): Edge {
  const story = a.floor != null ? storyOf(a) : storyOf(b)
  if (b.x === a.x + 1) return { x: a.x, y: a.y, dir: 'E', ...story }
  if (b.x === a.x - 1) return { x: b.x, y: b.y, dir: 'E', ...story }
  if (b.y === a.y + 1) return { x: a.x, y: a.y, dir: 'S', ...story }
  return { x: b.x, y: b.y, dir: 'S', ...story }
}

/** The two tiles an edge separates. Both keep the edge's story. */
export function edgeTiles(e: Edge): [Tile, Tile] {
  const story = storyOf(e)
  return e.dir === 'E'
    ? [{ x: e.x, y: e.y, ...story }, { x: e.x + 1, y: e.y, ...story }]
    : [{ x: e.x, y: e.y, ...story }, { x: e.x, y: e.y + 1, ...story }]
}

export const STEPS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export function around(t: Tile): Tile[] {
  const story = storyOf(t)
  return STEPS.map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy, ...story }))
}

export interface GridIndex {
  walls: Set<string>
  doors: Map<string, Door>
  equipAt: Map<string, Equip>
  roomAt: Map<string, Room>
}

export function indexLayout(l: BuildLayout): GridIndex {
  const walls = new Set(l.walls.map(edgeKey))
  const doors = new Map(l.doors.map((d) => [edgeKey(d), d] as const))
  const equipAt = new Map(l.equipment.map((e) => [tileKey(e.x, e.y, floorOf(e)), e] as const))
  const roomAt = new Map<string, Room>()
  for (const r of l.rooms) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) roomAt.set(tileKey(x, y, floorOf(r)), r)
  }
  return { walls, doors, equipAt, roomAt }
}

export function sideAt(l: BuildLayout, t: Tile): ZoneSide | null {
  const z = isFloor(l, t.x, t.y) ? l.zones[t.y][t.x] : null
  return z ? ZONE_SIDE[z] : null
}

/** Can a mover stand on this tile? Passengers need a painted public zone; solid kit blocks the tile. */
export function standable(l: BuildLayout, ix: GridIndex, t: Tile, who: Mover): boolean {
  if (!isFloor(l, t.x, t.y)) return false
  const zone = l.zones[t.y][t.x]
  if (who !== 'staff' && (!zone || zone === 'baggage' || zone === 'office' || zone === 'bagroom' || zone === 'vertical')) return false
  // Legacy 4 m halls still walk arrivals across airside and gates. The split
  // only applies once the layout is the 1 m document.
  if (l.version === 2 && who === 'depart' && (zone === 'claim' || zone === 'arrivals')) return false
  if (l.version === 2 && who === 'arrive' && (zone === 'security' || zone === 'airside' || zone === 'gates')) return false
  const eq = ix.equipAt.get(tileKey(t.x, t.y, floorOf(t)))
  return !eq || EQUIP_SPEC[eq.kind].walkThrough
}

/** Is the edge between two neighbour tiles open to this mover? */
export function edgeOpen(ix: GridIndex, a: Tile, b: Tile, who: Mover): boolean {
  const k = edgeKey(edgeBetween(a, b))
  const door = ix.doors.get(k)
  if (door) {
    if (door.kind === 'staff') return who === 'staff'
    if (door.kind === 'exit') return who === 'arrive'
    return true
  }
  return !ix.walls.has(k)
}

/** Edge has a wall or a door frame. */
export function edgeClosed(ix: GridIndex, e: Edge): boolean {
  const k = edgeKey(e)
  return ix.walls.has(k) || ix.doors.has(k)
}

/** Outside doors of a kind, with the floor tile they open from. */
export function outsideDoors(l: BuildLayout, kinds: Door['kind'][]): { door: Door; tile: Tile }[] {
  const out: { door: Door; tile: Tile }[] = []
  for (const d of l.doors) {
    if (!kinds.includes(d.kind)) continue
    const [a, b] = edgeTiles(d)
    const fa = isFloor(l, a.x, a.y)
    const fb = isFloor(l, b.x, b.y)
    if (fa === fb) continue
    out.push({ door: d, tile: fa ? a : b })
  }
  return out
}

/**
 * Breadth-first walk. `step` decides whether a move is allowed.
 * Returns distance (in tiles) to every reached tile, and parents for routes.
 */
export function flood(
  starts: readonly Tile[],
  step: (from: Tile, to: Tile) => boolean,
): { dist: Map<string, number>; parent: Map<string, string> } {
  const dist = new Map<string, number>()
  const parent = new Map<string, string>()
  const q: Tile[] = []
  for (const s of starts) {
    const k = tileKey(s.x, s.y)
    if (dist.has(k)) continue
    dist.set(k, 0)
    q.push(s)
  }
  for (let i = 0; i < q.length; i++) {
    const n = q[i]
    const nk = tileKey(n.x, n.y)
    const d = dist.get(nk)!
    for (const m of around(n)) {
      const mk = tileKey(m.x, m.y)
      if (dist.has(mk) || !step(n, m)) continue
      dist.set(mk, d + 1)
      parent.set(mk, nk)
      q.push(m)
    }
  }
  return { dist, parent }
}

/** Passenger walk step: both tiles standable, edge open. Optional extra veto. */
export function walkStep(
  l: BuildLayout,
  ix: GridIndex,
  who: Mover,
  veto?: (to: Tile) => boolean,
): (from: Tile, to: Tile) => boolean {
  return (from, to) => standable(l, ix, to, who) && edgeOpen(ix, from, to, who) && !veto?.(to)
}

export function parseTile(k: string): Tile {
  const [x, y] = k.split(',').map(Number)
  return { x, y }
}
