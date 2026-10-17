import type { RealDoor } from './realworld'
import { airframeStations, engineLayout } from './layout'
import {
  AIRCRAFT_VISUAL_SCALE,
  BRIDGE_CAB_M,
  CELL,
  STAND_ENVELOPE,
  WING_GAP_M,
  WORLD_PER_METER,
  type ModelSpec,
} from './specs'

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

/** Game stands are still S / M / L. Until a stand stores a letter: S→B, M→C, L→F. */
export function standLetter(cls: 'S' | 'M' | 'L'): IcaoCode {
  if (cls === 'S') return 'B'
  if (cls === 'L') return 'F'
  return 'C'
}

/** Empty jetway preview. S/B one low bridge, M/C one, L/F the A380 set. */
export function gatePreviewId(cls: 'S' | 'M' | 'L'): string {
  return standPreviewId(cls, cls === 'L' ? 'jumbo' : 'small')
}

/** Wide stands are code E. Legacy L stands with no scale stay code F. */
export function envelopeLetter(
  cls: 'S' | 'M' | 'L',
  scale?: 'small' | 'wide' | 'jumbo' | null,
): IcaoCode {
  if (scale === 'wide') return 'E'
  if (scale === 'jumbo' || cls === 'L') return 'F'
  if (cls === 'S') return 'B'
  return 'C'
}

/** Design aircraft whose door the empty-gate bridge aims at. */
export function standPreviewId(
  cls: 'S' | 'M' | 'L',
  scale?: 'small' | 'wide' | 'jumbo' | null,
): string {
  const letter = envelopeLetter(cls, scale)
  if (letter === 'F') return 'a380'
  if (letter === 'E') return 'b789'
  if (letter === 'B' || letter === 'A') return 'crj700'
  return 'b738'
}

/** Stand limit box in world units, including the aircraft visual scale. */
export function envelopeWorld(letter: IcaoCode): { width: number; depth: number; clearance: number } {
  const box = STAND_ENVELOPE[letter]
  const s = WORLD_PER_METER * AIRCRAFT_VISUAL_SCALE
  return {
    width: box.widthM * s,
    depth: box.depthM * s,
    clearance: box.clearanceM * s,
  }
}

/**
 * Yaw that points aircraft-local +Z (port) at a terminal cell.
 * World +X is +column and world +Z is +row, so θ = atan2(Δc, Δr).
 */
export function bridgeYawToward(
  from: { c: number; r: number },
  to: { c: number; r: number },
): number {
  return Math.atan2(to.c - from.c, to.r - from.r)
}

const WING_GAP = WING_GAP_M * WORLD_PER_METER

/** Visual half-span. The exaggeration is part of the footprint so wingtips still clear. */
function wingRadius(spanM: number): number {
  return (spanM * WORLD_PER_METER * AIRCRAFT_VISUAL_SCALE) / 2
}

/**
 * True when this wingspan disc meets another parked wingspan or a terminal tile.
 * Distances use the shared apron cell (METERS_PER_CELL × WORLD_PER_METER).
 */
export function wingDiscsClash(
  stand: { c: number; r: number },
  spanM: number,
  others: { c: number; r: number; spanM: number }[],
  blocks: { c: number; r: number }[],
): boolean {
  const aR = wingRadius(spanM)
  for (const o of others) {
    const d = Math.hypot((o.c - stand.c) * CELL, (o.r - stand.r) * CELL)
    if (d < aR + wingRadius(o.spanM) + WING_GAP) return true
  }
  const blockR = CELL * 0.5
  for (const b of blocks) {
    const d = Math.hypot((b.c - stand.c) * CELL, (b.r - stand.r) * CELL)
    if (d < aR + blockR + WING_GAP) return true
  }
  return false
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
  /** Plug-door swing direction when opened: +1 forward along the skin (default), −1 aft. */
  swing?: 1 | -1
}

/** Same boxes the close LOD instances, so a bridge cab meets the doorway. */
export function doorBoxes(spec: ModelSpec): DoorBox[] {
  return rawDoorBoxes(spec)
}

/**
 * Door boxes for drawing leaves and doorway cuts. Same as `doorBoxes` (which the sim's service
 * sockets read, so it must not move) except where a nominal station lands a leaf on a wing-root
 * fairing or a rear nacelle: then the drawn door slides a little clear, or is trimmed lower.
 */
export function renderDoorBoxes(spec: ModelSpec): DoorBox[] {
  return clearDoors(spec, rawDoorBoxes(spec))
}

interface Keepout {
  x0: number
  x1: number
  y0: number
  y1: number
  /** Side the obstacle sits on: +1 port, −1 starboard, 0 both. */
  side: number
  engine?: boolean
}

/** Wing-root fairings and fuselage-hugging nacelles a door leaf must not cut into. */
function doorKeepouts(spec: ModelSpec): Keepout[] {
  const out: Keepout[] = []
  const st = airframeStations(spec)
  if (spec.family !== 'helo' && spec.spanM > 0) {
    out.push({
      x0: st.wingX - spec.rootChord / 2 - 0.3,
      x1: st.wingX + spec.rootChord / 2 + 0.3,
      y0: st.wingY - spec.thickness / 2 - 0.3,
      y1: st.wingY + spec.thickness / 2 + 0.3,
      side: 0,
    })
  }
  const eng = spec.engines
  for (const p of engineLayout(spec)) {
    const r = eng.radius * 1.15
    if (Math.abs(p.z) - r > spec.rx + 0.35 || p.z === 0) continue
    out.push({ x0: p.x - eng.length * 0.6, x1: p.x + eng.length * 0.6, y0: p.y - r, y1: p.y + r, side: Math.sign(p.z), engine: true })
  }
  return out
}

function overlaps(a0: number, a1: number, b0: number, b1: number) {
  return a1 > b0 && a0 < b1
}

/**
 * Real-world door stations are nominal; on our proportions some land on a wing-root fairing or a
 * rear nacelle. Slide such a door clear (nearest side), and swing a plug door aft when the space
 * ahead of it is taken. Render-only: bridges, trucks and leaves all read these boxes.
 */
/** Beyond this slide, a door under a nacelle is trimmed instead (the docked truck stays put). */
const MAX_SLIDE_M = 1.6

function clearDoors(spec: ModelSpec, boxes: DoorBox[]): DoorBox[] {
  const keep = doorKeepouts(spec)
  if (!keep.length) return boxes
  const nose = spec.lengthM / 2
  const hits = (b: DoorBox, x0: number, x1: number, y1 = b.y + b.h / 2) =>
    keep.find((k) => (k.side === 0 || k.side === b.door.side) && overlaps(x0, x1, k.x0, k.x1) && overlaps(b.y - b.h / 2, y1, k.y0, k.y1))
  return boxes.map((b) => {
    if (b.door.side === 0 || b.door.kind === 'ramp') return b
    let x = b.x
    let h = b.h
    let y = b.y
    for (let pass = 0; pass < 3; pass++) {
      const k = hits({ ...b, y, h }, x - b.w / 2, x + b.w / 2)
      if (!k) break
      const fwd = k.x1 + b.w / 2 + 0.12
      const aft = k.x0 - b.w / 2 - 0.12
      const shift = Math.abs(fwd - x) <= Math.abs(aft - x) && fwd + b.w / 2 < nose - spec.lengthM * 0.06 ? fwd : aft
      // A small slide reads fine next to the docked truck; a big one would leave it at a blank wall,
      // so lower doors under a nacelle are trimmed to stop short of it instead (sill unchanged).
      const sill = y - h / 2
      const trimmed = k.y0 - 0.12 - sill
      if (Math.abs(shift - b.x) > MAX_SLIDE_M && k.engine && k.y0 > sill + 0.75) {
        h = Math.min(h, trimmed)
        y = sill + h / 2
      } else x = shift
    }
    const moved = { ...b, x, y, h }
    if (b.door.kind === 'cargo') {
      // Top-hinged leaves swing up and out; one trimmed under a nacelle opens as an inward plug.
      if (h < b.h - 0.01) moved.swing = -1
      return moved
    }
    if (hits(moved, x + b.w / 2, x + b.w * 1.5 + 0.15)) moved.swing = -1
    return moved
  })
}

function rawDoorBoxes(spec: ModelSpec): DoorBox[] {
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

/**
 * Outer end of the aircraft tunnel, in meters (nose +X, port +Z).
 * The terminal bridge stops here so the two tunnels meet.
 */
export function bridgeDockMeters(spec: ModelSpec): { x: number; z: number; y: number; h: number; w: number } | null {
  const stops = bridgeStops(spec)
  const main = stops.filter((stop) => !stop.upper)
  const stop = main[0] ?? stops[0]
  if (!stop) return null
  const skin = spec.rx + 0.2
  return {
    x: stop.x,
    z: skin + 1.6 + stop.tunnelM,
    y: stop.cabY,
    h: stop.cabH * 0.86,
    w: stop.cabW,
  }
}

export interface BridgeDoor {
  /** Meters forward of the aircraft origin. */
  x: number
  /** Bellows face, meters to port. Always outside the skin. */
  z: number
  /** Cab centre height, meters above the wheels. */
  y: number
  h: number
  w: number
  upper: boolean
}

/**
 * Where an apron bridge cab meets each bridge door, port side, forward main
 * door first. Starboard docking mirrors `z`.
 */
export function bridgeDoorsMeters(spec: ModelSpec): BridgeDoor[] {
  const face = spec.rx + BRIDGE_CAB_M.gapM
  return bridgeStops(spec).map((stop) => ({
    x: stop.x,
    z: face,
    y: stop.cabY,
    h: stop.cabH + BRIDGE_CAB_M.headroomM,
    w: stop.cabW,
    upper: stop.upper,
  }))
}

/**
 * +1 when local +Z (port) already faces the terminal.
 * -1 when the terminal is on the starboard side, so the bridges must flip.
 * `heading` is the flight heading (atan2(dRow, dCol)); the mesh yaws by -heading.
 */
export function bridgeMirror(
  heading: number,
  stand: { c: number; r: number },
  terminal: { c: number; r: number },
): 1 | -1 {
  const yaw = -heading
  const portC = Math.sin(yaw)
  const portR = Math.cos(yaw)
  const dot = portC * (terminal.c - stand.c) + portR * (terminal.r - stand.r)
  return dot >= 0 ? 1 : -1
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
