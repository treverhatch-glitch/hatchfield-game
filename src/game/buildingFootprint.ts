import { HANGAR_DESIGN } from '../scale/data.ts'
import type { SizeTier } from '../scale/types.ts'
import type { Tile, Vec } from './types.ts'

/**
 * Cells a stamp occupies around the clicked origin.
 * The control tower is a round cab: its keep-out is the whole 3×3,
 * so the shaft cannot be stamped onto a road.
 * Roads, taxiways, and linear stamps stay a single cell.
 */
const ROUND: readonly Vec[] = [
  { c: 0, r: 0 },
  { c: 1, r: 0 },
  { c: -1, r: 0 },
  { c: 0, r: 1 },
  { c: 0, r: -1 },
  { c: 1, r: 1 },
  { c: 1, r: -1 },
  { c: -1, r: 1 },
  { c: -1, r: -1 },
]

export const BUILDING_FOOTPRINT: Partial<Record<Tile, readonly Vec[]>> = {
  tower: ROUND,
}

export function footprintCells(tile: Tile, origin: Vec): Vec[] {
  const shape = BUILDING_FOOTPRINT[tile] ?? [{ c: 0, r: 0 }]
  return shape.map((d) => ({ c: origin.c + d.c, r: origin.r + d.r }))
}

/**
 * Cells a hangar keeps clear. The anchor is first. Width is centred on the
 * anchor; an even lot (wide, 4) keeps the extra cell on the +c / +r side.
 */
export function hangarFootprintCells(origin: Vec, tier: SizeTier): Vec[] {
  const n = HANGAR_DESIGN[tier].lot
  const lo = -Math.floor((n - 1) / 2)
  const cells: Vec[] = [origin]
  for (let dr = lo; dr < lo + n; dr++) {
    for (let dc = lo; dc < lo + n; dc++) {
      if (dc === 0 && dr === 0) continue
      cells.push({ c: origin.c + dc, r: origin.r + dr })
    }
  }
  return cells
}

/** 'road' when the keep-out covers a road. 'edge' when it leaves the map. */
export function footprintBlock(
  tiles: readonly (readonly Tile[])[],
  tile: Tile,
  origin: Vec,
  hangarTier?: SizeTier | null,
): 'road' | 'edge' | null {
  const cells = tile === 'hangar' ? hangarFootprintCells(origin, hangarTier ?? 'small') : footprintCells(tile, origin)
  if (tile !== 'hangar' && !BUILDING_FOOTPRINT[tile]) return null
  for (const cell of cells) {
    if (cell.c === origin.c && cell.r === origin.r) continue
    const row = tiles[cell.r]
    if (!row || cell.c < 0 || cell.c >= row.length) return 'edge'
    if (row[cell.c] === 'road') return 'road'
  }
  return null
}
