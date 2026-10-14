/**
 * Service points per building: where vehicles dock, park, hook up or exit.
 * Coordinates are model-local (one cell = CELL world units, origin at the cell
 * centre, front = +z) so they line up with the procedural models; `worldPoints`
 * maps them through the building's real-world lot onto the tile grid.
 */
import type { Tile, Vec } from '../game/types'
import { CELL, WORLD_PER_METER } from '../render/aircraft/specs'
import { lotFrame, type Lot } from './footprints'

export type PointKind = 'hose' | 'door' | 'bay' | 'dock' | 'kerb' | 'hangar_door' | 'pad'
export type ServiceAction = 'refuel' | 'unload' | 'load' | 'backin' | 'exit' | 'park' | 'board' | 'tow' | 'spray'
export type VehicleKind = 'fuel' | 'bags' | 'catering' | 'fire' | 'deice' | 'termbus' | 'citycargo' | 'coach' | 'tow'

export interface LocalPoint {
  id: string
  kind: PointKind
  /** Where the vehicle stops (its centre). */
  x: number
  z: number
  /** Vehicle yaw at the stop, model-local (0 = facing +z / out the front). */
  heading: number
  action: ServiceAction
}

export interface ServiceSpec {
  serves: readonly VehicleKind[]
  points: readonly LocalPoint[]
  /** Approach lane entry (in front of the building). */
  approach: { x: number; z: number }
  /** Exit lane (offset from the approach so in/out do not cross). */
  exit: { x: number; z: number }
  /** Queue slots along the approach lane, head first. */
  queue: readonly { x: number; z: number }[]
}

const FRONT = CELL * 0.62
/**
 * Model units per metre for a lot of `scale` cells (see ../fleet: mPerUnit).
 * Round 6 lays every bay out in metres around the real vehicle sizes.
 */
const u = (m: number, scale: number) => (m * WORLD_PER_METER) / scale
/** Queue slots stepping outward along the approach lane: one vehicle length + 2.5 m apart. */
const lane = (x: number, n = 4, z0 = FRONT, step = 1.9) =>
  Array.from({ length: n }, (_, i) => ({ x, z: z0 + Math.max(1.6, step * 0.6) + i * step }))

const pts = (kind: PointKind, action: ServiceAction, heading: number, xs: number[], z: number, prefix = kind): LocalPoint[] =>
  xs.map((x, i) => ({ id: `${prefix}${i + 1}`, kind, x, z, heading, action }))

export const SERVICE_POINTS: Partial<Record<Tile, ServiceSpec>> = {
  fuel: {
    serves: ['fuel'],
    points: pts('hose', 'refuel', Math.PI / 2, [-2.0, 2.0], 3.4),
    approach: { x: -4.2, z: FRONT },
    exit: { x: 4.2, z: FRONT },
    queue: lane(-4.2, 4, FRONT, u(12.5, 3)),
  },
  bags: {
    serves: ['bags'],
    points: pts('door', 'unload', Math.PI, [-2.2, 0, 2.2], 3.05),
    approach: { x: -4.0, z: FRONT + 0.6 },
    exit: { x: 4.0, z: FRONT + 0.6 },
    queue: lane(-4.0, 4, FRONT, u(12.1, 2)),
  },
  kitchen: {
    serves: ['catering'],
    points: pts('bay', 'load', Math.PI, [1.4, 3.4], 1.8),
    approach: { x: -4.0, z: FRONT },
    exit: { x: 4.0, z: FRONT },
    queue: lane(-4.0, 4, FRONT, u(11.1, 2)),
  },
  snack: {
    serves: ['catering'],
    points: pts('bay', 'load', Math.PI / 2, [0], 3.75),
    approach: { x: -3.6, z: FRONT },
    exit: { x: 3.6, z: FRONT },
    queue: lane(-3.6, 4, FRONT, u(11.1, 1)),
  },
  cargo: {
    serves: ['citycargo'],
    points: pts('dock', 'backin', 0, [-3.0, -1.0, 1.0, 3.0], 3.0),
    approach: { x: -4.4, z: FRONT + 0.8 },
    exit: { x: 4.4, z: FRONT + 0.8 },
    queue: lane(-4.4, 4, FRONT + 0.8, u(11, 2)),
  },
  fire: {
    serves: ['fire'],
    points: pts('bay', 'exit', 0, [-2.8, -0.6, 1.6], -0.9),
    approach: { x: -0.6, z: FRONT },
    exit: { x: -0.6, z: FRONT + 0.8 },
    queue: [],
  },
  deice: {
    serves: ['deice'],
    points: pts('pad', 'spray', 0, [-3.4, 3.4], 1.4),
    approach: { x: 0, z: FRONT },
    exit: { x: 0, z: FRONT },
    queue: lane(0, 4, FRONT, u(11.7, 3)),
  },
  termbus: {
    serves: ['termbus'],
    points: pts('bay', 'park', Math.PI, [-2.8, 0, 2.8], 2.3),
    approach: { x: -4.0, z: FRONT },
    exit: { x: 4.0, z: FRONT },
    queue: lane(-4.0, 4, FRONT, u(16.5, 2)),
  },
  xferbus: {
    serves: ['termbus'],
    points: pts('bay', 'park', Math.PI, [-2.8, 0, 2.8], 2.3),
    approach: { x: -4.0, z: FRONT },
    exit: { x: 4.0, z: FRONT },
    queue: lane(-4.0, 4, FRONT, u(16.5, 2)),
  },
  bus: {
    serves: ['coach'],
    // Sawtooth nose-in bays: coaches point at the island (heading π), side by side.
    points: pts('kerb', 'board', Math.PI, [-1.6, 1.6], 1.45),
    approach: { x: -4.6, z: FRONT },
    exit: { x: 4.6, z: FRONT },
    queue: lane(-4.6, 2, FRONT, u(14.9, 1)),
  },
  hangar: {
    serves: ['tow'],
    points: [{ id: 'door1', kind: 'hangar_door', x: 0, z: 0, heading: Math.PI, action: 'tow' }],
    approach: { x: 0, z: FRONT + 1.5 },
    exit: { x: 0, z: FRONT + 1.5 },
    // Tow tugs wait their turn off to the side of the door apron.
    queue: lane(3.4, 3, FRONT, u(10.3, 3)),
  },
  mro: {
    serves: ['tow'],
    points: [
      { id: 'door1', kind: 'hangar_door', x: -2.2, z: -1.0, heading: Math.PI, action: 'tow' },
      { id: 'door2', kind: 'hangar_door', x: 2.2, z: -1.0, heading: Math.PI, action: 'tow' },
    ],
    approach: { x: 0, z: FRONT + 1.5 },
    exit: { x: 0, z: FRONT + 1.5 },
    queue: lane(4.0, 3, FRONT, u(10.3, 1)),
  },
}

export interface WorldPoint {
  id: string
  kind: PointKind
  action: ServiceAction
  /** Grid coords (cells, fractional). */
  c: number
  r: number
  /** Heading in grid space: atan2(dr, dc) of the vehicle nose. */
  heading: number
}

export interface WorldSpec {
  serves: readonly VehicleKind[]
  points: WorldPoint[]
  approach: { c: number; r: number }
  exit: { c: number; r: number }
  queue: { c: number; r: number }[]
}

/** Map local model coords (x,z) through the lot transform onto grid cells. */
export function toGrid(anchor: Vec, lot: Lot | null | undefined, x: number, z: number): { c: number; r: number } {
  const f = lot ? lotFrame(lot) : { dc: 0, dr: 0, yaw: 0, scale: 1 }
  const sx = (x * f.scale) / CELL
  const sz = (z * f.scale) / CELL
  // three.js yaw about +y: x' = x cos + z sin, z' = -x sin + z cos.
  const cos = Math.cos(f.yaw)
  const sin = Math.sin(f.yaw)
  return { c: anchor.c + f.dc + sx * cos + sz * sin, r: anchor.r + f.dr - sx * sin + sz * cos }
}

export function worldPoints(tile: Tile, anchor: Vec, lot?: Lot | null): WorldSpec | null {
  const spec = SERVICE_POINTS[tile]
  if (!spec) return null
  const yaw = lot ? lotFrame(lot).yaw : 0
  const conv = (p: { x: number; z: number }) => toGrid(anchor, lot, p.x, p.z)
  return {
    serves: spec.serves,
    points: spec.points.map((p) => {
      const g = conv(p)
      // Local heading h (0 = +z) → grid direction; +z local = +r grid when yaw = 0.
      const h = p.heading + yaw
      return { id: p.id, kind: p.kind, action: p.action, c: g.c, r: g.r, heading: Math.atan2(Math.cos(h), Math.sin(h)) }
    }),
    approach: conv(spec.approach),
    exit: conv(spec.exit),
    queue: spec.queue.map(conv),
  }
}
