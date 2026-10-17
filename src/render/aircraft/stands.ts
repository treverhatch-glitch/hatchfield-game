import type { RealDoor } from './realworld'
import { airframeStations, engineLayout, propRadius } from './layout'
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
  /** Plug-door swing direction when opened: +1 forward along the skin (default), −1 aft. Cargo: −1 is an inward plug. */
  swing?: 1 | -1
  /** Drawn door left off: no clean station exists on this airframe (render-only). */
  omit?: boolean
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

/** Axis-aligned volume in airframe metres (+X nose, +Y up, +Z port). */
export interface Vol {
  x0: number
  x1: number
  y0: number
  y1: number
  z0: number
  z1: number
  what: string
}

function vol(what: string, xa: number, xb: number, ya: number, yb: number, za: number, zb: number): Vol {
  return { what, x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: Math.min(ya, yb), y1: Math.max(ya, yb), z0: Math.min(za, zb), z1: Math.max(za, zb) }
}

export function volsOverlap(a: Vol, b: Vol): boolean {
  return a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1 && a.z1 > b.z0 && a.z0 < b.z1
}

/**
 * Everything a door leaf must stay clear of, closed or open: the wing near the body (with its
 * real root thickness and a margin), the wing-to-body fairing, nacelles and propeller discs.
 */
export function airframeKeepouts(spec: ModelSpec): Vol[] {
  const out: Vol[] = []
  const st = airframeStations(spec)
  const { rx } = spec
  if (spec.family !== 'helo' && spec.spanM > 0) {
    const semi = spec.spanM / 2
    const tanSweep = Math.tan((spec.sweep * Math.PI) / 180)
    const reach = Math.min(semi, rx + 3.2)
    const f = reach / semi
    const le0 = st.wingX + spec.rootChord / 2
    const te0 = st.wingX - spec.rootChord / 2
    const le1 = le0 - tanSweep * reach
    const te1 = st.wingX + (-spec.rootChord / 2) * (1 - f) + (spec.rootChord / 2 - tanSweep * semi - spec.tipChord) * f
    const t = Math.max(spec.thickness * 1.3, spec.rootChord * 0.14)
    for (const s of [1, -1]) {
      out.push(vol('wing', Math.max(le0, le1) + 0.3, Math.min(te0, te1) - 0.3, st.wingY - t * 0.55 - 0.25, st.wingY + t * 0.6 + 0.25, 0, s * (rx + 3.2)))
    }
  }
  if (spec.family === 'tube' && spec.engines.mount === 'wing' && spec.lengthM > 25) {
    const cx = st.wingX - spec.rootChord * 0.05
    const cy = st.centerY - spec.ry * 0.7
    for (const s of [1, -1]) out.push(vol('fairing', cx - spec.rootChord * 0.95, cx + spec.rootChord * 0.95, cy - spec.ry * 0.42, cy + spec.ry * 0.42 + 0.2, 0, s * (rx * 0.93 + 0.15)))
  }
  const eng = spec.engines
  const prop = eng.kind === 'turboprop'
  const R = prop ? propRadius(spec) : 0
  for (const p of engineLayout(spec)) {
    const r = eng.radius * 1.15
    out.push(vol('nacelle', p.x - eng.length * 0.6, p.x + eng.length * 0.6, p.y - r, p.y + r, p.z - r, p.z + r))
    if (prop && eng.mount !== 'nose') {
      const hub = p.x + eng.length * 0.55
      out.push(vol('prop', hub - 0.3, hub + 0.3, p.y - R - 0.15, p.y + R + 0.15, p.z - R - 0.15, p.z + R + 0.15))
    }
  }
  return out
}

/** Closed leaf plus the space its opening swing sweeps through. */
export function doorVolumes(spec: ModelSpec, b: DoorBox): Vol[] {
  const s = b.door.side
  const rx = spec.rx
  const vols = [vol('closed', b.x - b.w / 2, b.x + b.w / 2, b.y - b.h / 2, b.y + b.h / 2, s * (rx - 0.25), s * (rx + 0.12))]
  if (b.door.kind === 'cargo') {
    if (b.swing !== -1) vols.push(vol('open', b.x - b.w / 2, b.x + b.w / 2, b.y + b.h / 2 - 0.1, b.y + b.h / 2 + b.h * 0.4, s * rx, s * (rx + b.h + 0.1)))
  } else {
    const sw = b.swing ?? 1
    vols.push(vol('open', b.x - sw * (b.w / 2), b.x + sw * (b.w * 1.5 + 0.15), b.y - b.h / 2, b.y + b.h / 2, s * (rx - 0.1), s * (rx + 0.55)))
  }
  return vols
}

function doorClear(spec: ModelSpec, b: DoorBox, keep: Vol[], placed: DoorBox[]): boolean {
  const vols = doorVolumes(spec, b)
  if (vols.some((v) => keep.some((k) => volsOverlap(v, k)))) return false
  const mine = vols[0]
  return !placed.some((o) => o.door.side === b.door.side && !o.omit && volsOverlap(mine, doorVolumes(spec, o)[0]))
}

/**
 * Real-world door stations are nominal; on our proportions some land on a wing root, the
 * fairing, a nacelle or a prop disc, or open into one. Find the nearest clean placement for the
 * drawn leaf: first a different opening (aft swing, inward plug), then a slide along the skin,
 * and as a last resort (an over-wing exit with nowhere to go) leave it off. Render-only: the sim's
 * service sockets read `doorBoxes`, which stays on the published stations.
 */
function clearDoors(spec: ModelSpec, boxes: DoorBox[]): DoorBox[] {
  if (spec.family === 'helo') return boxes
  const keep = airframeKeepouts(spec)
  const nose = spec.lengthM / 2
  const xMax = nose - spec.lengthM * 0.07
  const xMin = -nose + spec.lengthM * 0.1
  const placed: DoorBox[] = []
  for (const b of boxes) {
    if (b.door.side === 0 || b.door.kind === 'ramp') {
      placed.push(b)
      continue
    }
    const configs: (1 | -1 | undefined)[] = b.door.kind === 'cargo' ? [undefined, -1] : [1, -1]
    let found: DoorBox | null = null
    for (let step = 0; step <= 80 && !found; step++) {
      const dxs = step === 0 ? [0] : [step * 0.25, -step * 0.25]
      for (const dx of dxs) {
        const x = b.x + dx
        if (x + b.w / 2 > xMax || x - b.w / 2 < xMin) continue
        for (const swing of configs) {
          const cand: DoorBox = { ...b, x, swing }
          if (doorClear(spec, cand, keep, placed)) {
            found = cand
            break
          }
        }
        if (found) break
      }
    }
    placed.push(found ?? { ...b, omit: true })
  }
  return placed
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
