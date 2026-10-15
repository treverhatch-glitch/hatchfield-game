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

/** A parked aircraft as drawn: cell position and sim heading (atan2(dRow, dCol)). */
export interface BridgeCraft {
  airframeId: string
  x: number
  y: number
  heading: number
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
  /** Bought apron light. Missing means the stand draws no mast. */
  standLit?: (v: Vec) => boolean
  /** Cloth colour when a flag is bought. Null means no pole. */
  standFlagColor?: (v: Vec) => string | null
  /** Jet bridges bought on this stand. */
  boughtBridges?: (v: Vec) => number
  /** 0 parks the jet bridge on the terminal. 1 docks the cab on the aircraft. */
  bridgeExtendAt?: (stand: Vec) => number
  /** The aircraft on this stand the bridge docks on. Null leaves the bridge parked. */
  bridgeAircraftAt?: (stand: Vec) => BridgeCraft | null
  fits?: { origin: Vec; rooms?: Partial<Record<string, number>>; tier?: 1 | 2 | 3; premade?: boolean; redesigned?: boolean }[]
  deskStaff?: number
  /** Airport view keeps the terminal roof on. Hall view may cut it away. */
  view?: 'apron' | 'hall'
  /** Set while the roof beat plays. The apron shell stays closed for the whole beat. */
  viewCue?: 'apron' | 'hall' | null
}

export function tileAt(view: WorldView, c: number, r: number): Tile | null {
  if (r < 0 || c < 0 || r >= view.tiles.length || c >= (view.tiles[r]?.length ?? 0)) return null
  return view.tiles[r][c]
}
