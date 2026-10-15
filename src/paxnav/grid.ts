/**
 * Nav grid over a built terminal. Each 4 m build tile is split into 1 m cells
 * (PAXNAV_TUNING.cellsPerTile). Walls and doors sit on tile edges, so a cell
 * edge is open unless it lies on a wall, or on a door edge outside the door
 * span. Kit that is not walk-through (desks, belts, seats, counters) blocks
 * its whole tile. Nobody walks on bare plot, over a roof, or off the grid.
 *
 * Two layers keep the security line honest: PRE cells are walkable before
 * security, AIR cells after it. Only a security lane joins them.
 */
import { EQUIP_SPEC, ZONE_SIDE } from '../terminalbuild/config.ts'
import { floorLinks, type FloorLink } from '../terminalbuild/floors.ts'
import { edgeKey, edgeBetween, edgeTiles, indexLayout, isFloor, outsideDoors, tileKey, type GridIndex } from '../terminalbuild/grid.ts'
import type { BuildLayout, Tile } from '../terminalbuild/types.ts'
import { PAXNAV_TUNING } from './config.ts'

/** Walkable before security (curb, hall, check-in, security floor). */
export const PRE = 1
/** Walkable after security (hall, gates, security floor). */
export const AIR = 2
/** Security lane tile: the only way from PRE to AIR. */
export const LANE = 4
/** Outside pavement at a curb door. Passengers appear here. */
export const CURB = 8

export interface NavGrid {
  layout: BuildLayout
  ix: GridIndex
  /** Cells per tile edge. */
  k: number
  margin: number
  cellM: number
  tileM: number
  /** Grid size in cells. */
  gw: number
  gh: number
  /** Layer bits per cell (PRE | AIR | LANE | CURB). 0 = nobody stands here. */
  mask: Uint8Array
  /** Edge bits per cell: 1 = open to the east neighbour, 2 = open to the south neighbour. */
  open: Uint8Array
  /** Security lane equipment index per cell, -1 off a lane. */
  laneOf: Int16Array
  /** Road-edge curb cells passengers spawn on. */
  spawns: number[]
  /**
   * Stairs, escalators, and lifts between enabled stories.
   * Empty while only floor 0 ships. The cells stay on this floor's grid.
   */
  links: FloorLink[]
}

const OPEN_E = 1
const OPEN_S = 2

export function buildNavGrid(layout: BuildLayout, tileM: number): NavGrid {
  const T = PAXNAV_TUNING
  const k = T.cellsPerTile
  const margin = T.marginTiles
  const ix = indexLayout(layout)
  const tw = layout.w + margin * 2
  const th = layout.h + margin * 2
  const gw = tw * k
  const gh = th * k

  // Per tile layer bits first.
  const tileMask = new Uint8Array(tw * th)
  const tileLane = new Int16Array(tw * th).fill(-1)
  const lanes = layout.equipment.filter((e) => e.kind === 'security_lane')
  for (let y = 0; y < layout.h; y++) {
    for (let x = 0; x < layout.w; x++) {
      if (!isFloor(layout, x, y)) continue
      const zone = layout.zones[y][x]
      if (!zone || zone === 'baggage') continue
      const eq = ix.equipAt.get(tileKey(x, y))
      if (eq && !EQUIP_SPEC[eq.kind].walkThrough) continue
      const side = ZONE_SIDE[zone]
      let bits = side === 'landside' ? PRE : side === 'airside' ? AIR : side === 'staff' ? 0 : PRE | AIR
      const ti = (y + margin) * tw + (x + margin)
      if (eq?.kind === 'security_lane') {
        bits = PRE | AIR | LANE
        tileLane[ti] = lanes.indexOf(eq)
      }
      tileMask[ti] = bits
    }
  }

  const curbDoors = outsideDoors(layout, ['curb'])
  const spawns: number[] = []
  const curbTiles: { out: Tile; inn: Tile }[] = []
  for (const { door, tile } of curbDoors) {
    const [a, b] = edgeTiles(door)
    const out = a.x === tile.x && a.y === tile.y ? b : a
    if (out.x < -margin || out.y < -margin || out.x >= layout.w + margin || out.y >= layout.h + margin) continue
    // A curb only counts when the inside face is somewhere a passenger can stand.
    if (!tileMask[(tile.y + margin) * tw + (tile.x + margin)]) continue
    tileMask[(out.y + margin) * tw + (out.x + margin)] = PRE | CURB
    curbTiles.push({ out, inn: tile })
  }

  const mask = new Uint8Array(gw * gh)
  const laneOf = new Int16Array(gw * gh).fill(-1)
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      const ti = Math.floor(cy / k) * tw + Math.floor(cx / k)
      mask[cy * gw + cx] = tileMask[ti]
      laneOf[cy * gw + cx] = tileLane[ti]
    }
  }

  // Edge passability. Inside one tile everything is open; across a tile edge
  // a wall closes it and a door opens only its span.
  const lo = Math.floor((k - T.doorCells) / 2)
  const hi = lo + T.doorCells
  const open = new Uint8Array(gw * gh)
  const links = floorLinks(layout)
  const crossing = (a: Tile, b: Tile, along: number): boolean => {
    const key = edgeKey(edgeBetween(a, b))
    const door = ix.doors.get(key)
    if (door) {
      if (door.kind === 'staff' || door.kind === 'exit') return false
      return along >= lo && along < hi
    }
    return !ix.walls.has(key)
  }
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      const c = cy * gw + cx
      if (!mask[c]) continue
      const tx = Math.floor(cx / k) - margin
      const ty = Math.floor(cy / k) - margin
      let bits = 0
      if (cx + 1 < gw && mask[c + 1]) {
        if ((cx + 1) % k !== 0 || crossing({ x: tx, y: ty }, { x: tx + 1, y: ty }, cy % k)) bits |= OPEN_E
      }
      if (cy + 1 < gh && mask[c + gw]) {
        if ((cy + 1) % k !== 0 || crossing({ x: tx, y: ty }, { x: tx, y: ty + 1 }, cx % k)) bits |= OPEN_S
      }
      open[c] = bits
    }
  }

  // Spawn on the road edge of each curb tile: the row of cells farthest from the door.
  for (const { out, inn } of curbTiles) {
    const dx = out.x - inn.x
    const dy = out.y - inn.y
    const ox = (out.x + margin) * k
    const oy = (out.y + margin) * k
    for (let i = 0; i < k; i++) {
      const cx = dx !== 0 ? ox + (dx > 0 ? k - 1 : 0) : ox + i
      const cy = dy !== 0 ? oy + (dy > 0 ? k - 1 : 0) : oy + i
      spawns.push(cy * gw + cx)
    }
  }

  return { layout, ix, k, margin, cellM: tileM / k, tileM, gw, gh, mask, open, laneOf, spawns, links }
}

/** Can a mover step from cell `a` to its 4-neighbour `b`? Layer bits are checked by the caller. */
export function stepOpen(g: NavGrid, a: number, b: number): boolean {
  const d = b - a
  if (d === 1) return (g.open[a] & OPEN_E) !== 0
  if (d === -1) return (g.open[b] & OPEN_E) !== 0
  if (d === g.gw) return (g.open[a] & OPEN_S) !== 0
  if (d === -g.gw) return (g.open[b] & OPEN_S) !== 0
  return false
}

/** Can a mover step between cells that are 4- or 8-neighbours? Diagonals need both corner routes open. */
export function moveOpen(g: NavGrid, a: number, b: number, layer: number): boolean {
  if (!(g.mask[b] & layer)) return false
  const ax = a % g.gw
  const bx = b % g.gw
  const dx = bx - ax
  const dy = (b - bx) / g.gw - (a - ax) / g.gw
  if (dx === 0 || dy === 0) return stepOpen(g, a, b)
  const h = a + dx
  const v = a + dy * g.gw
  return (
    (g.mask[h] & layer) !== 0 &&
    (g.mask[v] & layer) !== 0 &&
    stepOpen(g, a, h) &&
    stepOpen(g, h, b) &&
    stepOpen(g, a, v) &&
    stepOpen(g, v, b)
  )
}

/** Cell centre in terminal metres (x east, z south; tile (0,0) starts at 0,0). */
export function cellX(g: NavGrid, c: number): number {
  return ((c % g.gw) + 0.5) * g.cellM - g.margin * g.tileM
}
export function cellZ(g: NavGrid, c: number): number {
  return (Math.floor(c / g.gw) + 0.5) * g.cellM - g.margin * g.tileM
}

/** Cell under a point in terminal metres, or -1 off the grid. */
export function cellAt(g: NavGrid, x: number, z: number): number {
  const cx = Math.floor((x + g.margin * g.tileM) / g.cellM)
  const cy = Math.floor((z + g.margin * g.tileM) / g.cellM)
  if (cx < 0 || cy < 0 || cx >= g.gw || cy >= g.gh) return -1
  return cy * g.gw + cx
}

/** Build tile a cell sits in (layout coords; -1 / w for the margin). */
export function tileOfCell(g: NavGrid, c: number): Tile {
  return { x: Math.floor((c % g.gw) / g.k) - g.margin, y: Math.floor(Math.floor(c / g.gw) / g.k) - g.margin }
}

/** All cells of a build tile. */
export function cellsOfTile(g: NavGrid, t: Tile): number[] {
  const out: number[] = []
  const ox = (t.x + g.margin) * g.k
  const oy = (t.y + g.margin) * g.k
  if (ox < 0 || oy < 0 || ox >= g.gw || oy >= g.gh) return out
  for (let y = 0; y < g.k; y++) for (let x = 0; x < g.k; x++) out.push((oy + y) * g.gw + ox + x)
  return out
}

/** Grid bounds in terminal metres. */
export function gridBounds(g: NavGrid): { minX: number; minZ: number; maxX: number; maxZ: number } {
  const o = g.margin * g.tileM
  return { minX: -o, minZ: -o, maxX: g.gw * g.cellM - o, maxZ: g.gh * g.cellM - o }
}
