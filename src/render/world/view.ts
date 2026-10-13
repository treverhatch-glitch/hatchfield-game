import type { MapDraw } from '../../maps/types'
import type { StandAccess, StandClass, Tile, Vec, Weather } from '../../game/types'
import { SIZE } from '../../game/types'
import { CELL } from '../aircraft/specs'

/** Same cell as the apron. Imported from specs so the terminal grid cannot drift. */
export { CELL }

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
  /** Set by a non-default map. Missing or null keeps today's sky and farmland. */
  mapDraw?: MapDraw | null
  speed?: number
  standClass?: Record<string, StandClass>
  /** Wide is code E, jumbo is code F. Missing on an L stand means jumbo. */
  standScale?: Record<string, 'small' | 'wide' | 'jumbo'>
  standAccessAt?: (v: Vec | null) => StandAccess
  fits?: { origin: Vec; rooms?: Partial<Record<string, number>> }[]
  deskStaff?: number
}

export function tileAt(view: WorldView, c: number, r: number): Tile | null {
  if (r < 0 || c < 0 || r >= view.tiles.length || c >= (view.tiles[r]?.length ?? 0)) return null
  return view.tiles[r][c]
}
