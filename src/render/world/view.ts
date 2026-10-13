import type { StandAccess, StandClass, Tile, Vec, Weather } from '../../game/types'
import { SIZE } from '../../game/types'

/** Mirrors CELL / toWorld in src/render/world.ts (kept local to avoid an import cycle). */
export const CELL = 6.2

export function cellX(c: number): number {
  return (c - (SIZE - 1) / 2) * CELL
}

export function cellZ(r: number): number {
  return (r - (SIZE - 1) / 2) * CELL
}

export function worldToCell(x: number, z: number): Vec {
  return {
    c: Math.round(x / CELL + (SIZE - 1) / 2),
    r: Math.round(z / CELL + (SIZE - 1) / 2),
  }
}

/**
 * The slice of Game the world layer reads. `Game` satisfies this structurally, and
 * tests can pass a plain object.
 */
export interface WorldView {
  tiles: Tile[][]
  mapRev: number
  clock?: number
  weather?: Weather
  speed?: number
  standClass?: Record<string, StandClass>
  standAccessAt?: (v: Vec | null) => StandAccess
  fits?: { origin: Vec; rooms?: Partial<Record<string, number>> }[]
  deskStaff?: number
}

export function tileAt(view: WorldView, c: number, r: number): Tile | null {
  if (r < 0 || c < 0 || r >= view.tiles.length || c >= (view.tiles[r]?.length ?? 0)) return null
  return view.tiles[r][c]
}
