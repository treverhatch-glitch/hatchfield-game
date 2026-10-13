import type { RealDoor } from './realworld'
import type { ModelSpec } from './specs'

export type { IcaoCode } from './realworld'
import type { IcaoCode } from './realworld'

/** Fixed-wing code letters, smallest wingspan first. H is a helipad, not a letter. */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export function icaoRank(code: IcaoCode): number {
  if (code === 'H') return -1
  return LETTERS.indexOf(code)
}

/**
 * A letter stand takes aircraft of that code or smaller.
 * Helicopters fit a helipad only, and a helipad does not take fixed-wing.
 */
export function standAccepts(stand: IcaoCode, aircraft: IcaoCode): boolean {
  if (aircraft === 'H' || stand === 'H') return stand === 'H' && aircraft === 'H'
  return icaoRank(aircraft) <= icaoRank(stand)
}

export interface DoorBox {
  door: RealDoor
  /** Meters, aircraft axes: +X nose, +Y up, +Z port. */
  x: number
  y: number
  z: number
  w: number
  h: number
  depth: number
  /** Floor of the doorway, meters above the wheels. */
  sillM: number
  upper: boolean
}

/** Same boxes the close LOD instances, so a bridge cab meets the doorway. */
export function doorBoxes(spec: ModelSpec): DoorBox[] {
  const nose = spec.lengthM / 2
  const centerY = spec.gear + spec.ry
  return spec.doors.map((door) => {
    const x = nose - door.t * spec.lengthM
    const upper = door.kind === 'upper'
    const bulky = door.kind === 'cargo' || door.kind === 'ramp'
    const h = upper
      ? Math.min(1.9, spec.ry * 0.7)
      : bulky
        ? Math.min(2.8, spec.ry * 1.25)
        : Math.min(2.05, Math.max(0.9, spec.ry * 1.02))
    const w = bulky
      ? Math.min(2.6, Math.max(1.15, spec.rx * 0.95))
      : Math.min(1.05, Math.max(0.62, spec.rx * 0.55))
    const y = upper
      ? centerY + spec.ry * 0.55
      : bulky
        ? centerY - spec.ry * 0.22
        : centerY - spec.ry * 0.08
    if (door.side === 0) {
      const along = door.kind === 'ramp' ? Math.min(2.2, spec.lengthM * 0.08) : 0.1
      const yPos = door.kind === 'ramp' ? Math.max(spec.gear * 0.55, y - spec.ry * 0.35) : y
      const xPos = door.kind === 'ramp' ? x - along * 0.35 : x
      const sillM = yPos - h / 2
      return { door, x: xPos, y: yPos, z: 0, w: along, h, depth: spec.rx * 1.5, sillM, upper }
    }
    const z = door.side * (spec.rx + 0.03)
    return { door, x, y, z, w, h, depth: 0.07, sillM: y - h / 2, upper }
  })
}

export interface BridgeStop {
  door: RealDoor
  x: number
  /** Cab center height, meters. */
  cabY: number
  /** Cab floor, meters. This is the doorway sill. */
  sillM: number
  cabH: number
  cabW: number
  /** Tunnel length reaching toward the terminal, meters. */
  tunnelM: number
  upper: boolean
}

const TUNNEL_M: Record<IcaoCode, number> = {
  A: 7,
  B: 9,
  C: 12,
  D: 15,
  E: 18,
  F: 21,
  H: 0,
}

/**
 * Regional and narrowbody: the forward port door.
 * Widebody (E, and D/F with two passenger doors): two main-deck bridges.
 * Upper deck (A380): those two plus the forward upper-deck bridge.
 */
export function bridgeStops(spec: ModelSpec): BridgeStop[] {
  if (spec.icao === 'H' || spec.family === 'helo') return []
  const boxes = doorBoxes(spec).filter((box) => box.door.side === 1 && (box.door.kind === 'pax' || box.door.kind === 'upper'))
  const main = boxes.filter((box) => !box.upper).sort((a, b) => a.door.t - b.door.t)
  const upper = boxes.filter((box) => box.upper).sort((a, b) => a.door.t - b.door.t)
  let chosen = main.slice(0, 1)
  if (upper.length) chosen = [...main.slice(0, 2), upper[0]]
  else if (spec.icao === 'D' || spec.icao === 'E' || spec.icao === 'F') chosen = main.slice(0, 2)
  const cabW = spec.icao === 'F' ? 2.4 : spec.icao === 'E' || spec.icao === 'D' ? 2.05 : 1.55
  return chosen.map((box) => ({
    door: box.door,
    x: box.x,
    cabY: box.y,
    sillM: box.sillM,
    cabH: box.h,
    cabW,
    tunnelM: TUNNEL_M[spec.icao],
    upper: box.upper,
  }))
}
