/**
 * Jet-stand footprints. The painted stand is one tile; the aircraft occupies
 * the class envelope (nose-to-tail along the lead-in, wings across it).
 * A cell counts when the box covers at least a quarter of it, so a code-C
 * stand is 3×3 and a code-F stand is 5×5 rather than a one-cell sliver.
 */
import { envelopeLetter, envelopeWorld } from '../render/aircraft/stands'
import { CELL } from '../render/aircraft/specs'
import type { StandClass, Tile, Vec } from './types'
import { inBounds } from './path'
import { cellInRunwayClearance } from './runwayClearance'

export type Dir = 'n' | 's' | 'e' | 'w'
export type StandScale = 'small' | 'wide' | 'jumbo'

/** Grass, pavement, and belts may sit under the wings. Buildings may not. */
export const WING_CLEAR_TILES = new Set<Tile>(['grass', 'taxi', 'runway', 'road', 'belt'])
const WING_OK = WING_CLEAR_TILES

/** These stamps may cross a stand. A building may not. */
const CROSSES_STAND = new Set<Tile>(['taxi', 'runway', 'road', 'belt', 'grass'])

const MIN_OVERLAP = 0.25

const ENTRY: { dir: Dir; dc: number; dr: number }[] = [
  { dir: 's', dc: 0, dr: 1 },
  { dir: 'n', dc: 0, dr: -1 },
  { dir: 'e', dc: 1, dr: 0 },
  { dir: 'w', dc: -1, dr: 0 },
]

function tileAt(tiles: Tile[][], c: number, r: number): Tile | null {
  if (!inBounds(c, r)) return null
  return tiles[r]?.[c] ?? null
}

/** Lead-in side. Same order as the apron paint: south, north, east, west. */
export function standEntry(tiles: Tile[][], c: number, r: number): Dir {
  for (const d of ENTRY) {
    const t = tileAt(tiles, c + d.dc, r + d.dr)
    if (t === 'taxi' || t === 'runway') return d.dir
  }
  for (const d of ENTRY) {
    if (tileAt(tiles, c + d.dc, r + d.dr) === 'stand') return d.dir
  }
  return 's'
}

function axisOverlap(offset: number, half: number): number {
  return Math.min(offset + 0.5, half) - Math.max(offset - 0.5, -half)
}

/** Cells the aircraft box covers, including the anchor. */
export function footprintCells(
  tiles: Tile[][],
  anchor: Vec,
  cls: StandClass,
  scale?: StandScale | null,
): Vec[] {
  const entry = standEntry(tiles, anchor.c, anchor.r)
  const env = envelopeWorld(envelopeLetter(cls, scale))
  const depthAlongX = entry === 'e' || entry === 'w'
  const halfX = (depthAlongX ? env.depth : env.width) / 2 / CELL
  const halfZ = (depthAlongX ? env.width : env.depth) / 2 / CELL
  const reachX = Math.ceil(halfX + 0.5)
  const reachZ = Math.ceil(halfZ + 0.5)
  const cells: Vec[] = []
  for (let dc = -reachX; dc <= reachX; dc++) {
    if (axisOverlap(dc, halfX) < MIN_OVERLAP) continue
    for (let dr = -reachZ; dr <= reachZ; dr++) {
      if (axisOverlap(dr, halfZ) < MIN_OVERLAP) continue
      cells.push({ c: anchor.c + dc, r: anchor.r + dr })
    }
  }
  return cells
}

export interface StandPad {
  anchor: Vec
  cells: Vec[]
}

export function standPads(
  tiles: Tile[][],
  standClass: Record<string, StandClass>,
  standScale: Record<string, StandScale | undefined>,
): StandPad[] {
  const out: StandPad[] = []
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'stand') continue
      const key = `${c},${r}`
      out.push({
        anchor: { c, r },
        cells: footprintCells(tiles, { c, r }, standClass[key] ?? 'M', standScale[key]),
      })
    }
  }
  return out
}

function occupiedKeys(pads: StandPad[]): Set<string> {
  const keys = new Set<string>()
  for (const pad of pads) {
    for (const p of pad.cells) keys.add(`${p.c},${p.r}`)
  }
  return keys
}

/** True when any cell lies inside an existing stand's aircraft box. */
export function standFootprintHits(
  tiles: Tile[][],
  cells: Vec[],
  standClass: Record<string, StandClass>,
  standScale: Record<string, StandScale | undefined>,
): boolean {
  const keys = occupiedKeys(standPads(tiles, standClass, standScale))
  return cells.some((p) => keys.has(`${p.c},${p.r}`))
}

/** Taxi, road, belt, and runway may cross. Other stamps may not. */
export function placementHitsStand(
  tiles: Tile[][],
  cells: Vec[],
  tile: Tile,
  standClass: Record<string, StandClass>,
  standScale: Record<string, StandScale | undefined>,
): boolean {
  if (CROSSES_STAND.has(tile)) return false
  return standFootprintHits(tiles, cells, standClass, standScale)
}

/**
 * Geometry rejection for a new stand. The anchor itself is checked by the
 * caller (it has to be grass). Wings may cover grass, taxi, runway, road, and belt.
 */
export function standPlaceBlock(
  tiles: Tile[][],
  anchor: Vec,
  cls: StandClass,
  scale: StandScale | null | undefined,
  standClass: Record<string, StandClass>,
  standScale: Record<string, StandScale | undefined>,
): string | null {
  const cells = footprintCells(tiles, anchor, cls, scale)
  if (cells.some((p) => !inBounds(p.c, p.r))) return 'That stand hangs off the map.'
  if (cells.some((p) => cellInRunwayClearance(tiles, p.c, p.r))) {
    return 'That stand sits inside runway clearance. Taxiways can still cross.'
  }
  const taken = occupiedKeys(standPads(tiles, standClass, standScale))
  for (const p of cells) {
    const tile = tiles[p.r]?.[p.c]
    if (tile === 'stand' || taken.has(`${p.c},${p.r}`)) return 'That stand overlaps another stand.'
    if (!tile || !WING_OK.has(tile)) return 'That stand overlaps a building.'
  }
  return null
}
