/**
 * Shared facade openings for the closed exterior and the terminal-view cutaway.
 * Landside gets the entrance. Airside edges get the gate doors the jet bridges use.
 * Pure data: the shell mesh and the hall dock both read this list.
 */
import { WORLD_PER_METER } from '../aircraft/specs'
import { DIR_VEC, OPPOSITE, type Dir, type TerminalInfo } from './layout'
import { CELL, cellX, cellZ } from './view'

/** Landside door, metres, then world units. */
export const ENTRANCE_M = 4.2
export const ENTRANCE_W = ENTRANCE_M * WORLD_PER_METER
/** Jet-bridge door on each airside bay. */
export const GATE_DOOR_M = 2.6
export const GATE_DOOR_W = GATE_DOOR_M * WORLD_PER_METER

export interface FacadeOpening {
  kind: 'entrance' | 'gate'
  side: Dir
  c: number
  r: number
  /** Centre of the opening on the facade, world space. */
  x: number
  z: number
  /** Full width, world units. */
  width: number
}

/**
 * Yaw for a prop whose local forward offset is `(cos(yaw), -sin(yaw))`,
 * aimed out of the building on `side`.
 */
export function outwardYaw(side: Dir): number {
  if (side === 'e') return 0
  if (side === 's') return -Math.PI / 2
  if (side === 'w') return Math.PI
  return Math.PI / 2
}

export function facadeOpenings(info: TerminalInfo): FacadeOpening[] {
  const land = OPPOSITE[info.airside]
  const out: FacadeOpening[] = []
  const landEdges = info.edges.filter((e) => e.side === land)
  if (landEdges.length) {
    const mid = landEdges[Math.floor(landEdges.length / 2)]
    out.push(opening('entrance', mid.c, mid.r, mid.side, ENTRANCE_W))
  }
  for (const e of info.edges) {
    if (e.side !== info.airside) continue
    out.push(opening('gate', e.c, e.r, e.side, GATE_DOOR_W))
  }
  return out
}

function opening(kind: FacadeOpening['kind'], c: number, r: number, side: Dir, width: number): FacadeOpening {
  const v = DIR_VEC[side]
  return {
    kind,
    side,
    c,
    r,
    x: cellX(c) + v.dc * CELL * 0.5,
    z: cellZ(r) + v.dr * CELL * 0.5,
    width,
  }
}
