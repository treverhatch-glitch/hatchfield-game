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

/** 'road' when the keep-out covers a road. 'edge' when it leaves the map. */
export function footprintBlock(
  tiles: readonly (readonly Tile[])[],
  tile: Tile,
  origin: Vec,
): 'road' | 'edge' | null {
  const shape = BUILDING_FOOTPRINT[tile]
  if (!shape) return null
  for (const cell of footprintCells(tile, origin)) {
    if (cell.c === origin.c && cell.r === origin.r) continue
    const row = tiles[cell.r]
    if (!row || cell.c < 0 || cell.c >= row.length) return 'edge'
    if (row[cell.c] === 'road') return 'road'
  }
  return null
}
