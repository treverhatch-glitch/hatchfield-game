import { MRO_TAXI_MINUTES, type BaySize } from './config.ts'
import type { MroPhase } from './types.ts'
import { detAtan2, detHypot } from '../game/detMath.ts'

export interface TaxiPoint {
  c: number
  r: number
}

/**
 * Roll-in slot inside the hangar cell. +r faces the open door.
 * A narrowbody's nose reaches the back wall; wider jets sit further out
 * because one cell cannot cover a code-E or code-F fuselage.
 */
const SLOTS: Record<string, TaxiPoint> = {
  'narrow-a': { c: -0.28, r: 0.62 },
  'narrow-b': { c: 0.02, r: 0.58 },
  wide: { c: 0.22, r: 0.42 },
  jumbo: { c: 0.06, r: 0.28 },
}

export function bayOffset(bayId: string, size: BaySize): TaxiPoint {
  return SLOTS[bayId] ?? (size === 'jumbo' ? SLOTS.jumbo : size === 'wide' ? SLOTS.wide : SLOTS['narrow-a'])
}

/**
 * Taxiway cells, then a point outside the door, then the bay slot.
 * The aircraft rolls into the opening instead of appearing in the middle of the roof.
 */
export function mroRoute(
  stand: TaxiPoint,
  taxiway: readonly TaxiPoint[],
  hangar: TaxiPoint,
  bayId: string,
  size: BaySize,
): TaxiPoint[] {
  const slot = bayOffset(bayId, size)
  const bay = { c: hangar.c + slot.c, r: hangar.r + slot.r }
  const door = { c: hangar.c + slot.c, r: hangar.r + 0.72 }
  const path = taxiway.map((p) => ({ c: p.c, r: p.r }))
  if (!path.length || path[0].c !== stand.c || path[0].r !== stand.r) path.unshift({ c: stand.c, r: stand.r })
  const tail = path[path.length - 1]
  if (tail && tail.c === hangar.c && tail.r === hangar.r) path.pop()
  path.push(door, bay)
  return path
}

function segmentLength(a: TaxiPoint, b: TaxiPoint): number {
  return detHypot(b.c - a.c, b.r - a.r) || 1e-6
}

/** Point and heading at fraction t along a polyline. t is clamped to the path. */
export function pointAlong(path: readonly TaxiPoint[], t: number): { x: number; y: number; heading: number } {
  if (!path.length) return { x: 0, y: 0, heading: 0 }
  const clamped = Math.max(0, Math.min(1, t))
  if (path.length === 1 || clamped <= 0) {
    const p = path[0]
    const next = path[1] ?? p
    return { x: p.c, y: p.r, heading: detAtan2(next.r - p.r, next.c - p.c) }
  }
  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    const d = segmentLength(path[i], path[i + 1])
    lengths.push(d)
    total += d
  }
  let remain = clamped * total
  for (let i = 0; i < lengths.length; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (remain <= lengths[i] || i === lengths.length - 1) {
      const f = Math.max(0, Math.min(1, remain / lengths[i]))
      return {
        x: a.c + (b.c - a.c) * f,
        y: a.r + (b.r - a.r) * f,
        heading: detAtan2(b.r - a.r, b.c - a.c),
      }
    }
    remain -= lengths[i]
  }
  const last = path[path.length - 1]
  return { x: last.c, y: last.r, heading: 0 }
}

export interface TaxiPose {
  x: number
  y: number
  heading: number
  /** Aircraft is on the bay slot. This is what the hangar counts as occupied. */
  inBay: boolean
  atStand: boolean
  /** 0 shut, 1 open. The mesh only applies this when the camera is close. */
  door: number
}

export function poseForPhase(input: {
  phase: MroPhase
  remaining: number
  path: readonly TaxiPoint[]
  taxiMinutes?: number
}): TaxiPose {
  const taxi = input.taxiMinutes ?? MRO_TAXI_MINUTES
  const path = input.path.length ? input.path : [{ c: 0, r: 0 }]
  const span = taxi > 0 ? taxi : 1
  const frac = 1 - Math.min(1, Math.max(0, input.remaining) / span)
  let along
  let door = 0
  let inBay = false
  let atStand = false
  if (input.phase === 'taxi_in') {
    along = pointAlong(path, frac)
    door = frac > 0.62 ? 1 : frac > 0.45 ? (frac - 0.45) / 0.17 : 0
    inBay = frac >= 1
    atStand = frac <= 0
  } else if (input.phase === 'in_bay') {
    along = pointAlong(path, 1)
    door = 1
    inBay = true
  } else {
    const back = [...path].reverse()
    along = pointAlong(back, frac)
    door = frac < 0.38 ? 1 : frac < 0.55 ? 1 - (frac - 0.38) / 0.17 : 0
    atStand = frac >= 1
    inBay = frac <= 0
  }
  return { x: along.x, y: along.y, heading: along.heading, inBay, atStand, door }
}

export type TaxiLeg = 'enter' | 'service' | 'exit' | 'done'

export interface TaxiMachine {
  leg: TaxiLeg
  /** 0 at the start of enter/exit, 1 at the end of that leg. */
  progress: number
  serviceLeft: number
  serviceRate: number
  path: TaxiPoint[]
  taxiMinutes: number
}

export function createTaxiMachine(
  path: readonly TaxiPoint[],
  serviceMinutes: number,
  serviceRate = 1,
  taxiMinutes = MRO_TAXI_MINUTES,
): TaxiMachine {
  return {
    leg: 'enter',
    progress: 0,
    serviceLeft: Math.max(0, serviceMinutes),
    serviceRate: Math.max(0, serviceRate),
    path: path.map((p) => ({ c: p.c, r: p.r })),
    taxiMinutes: taxiMinutes > 0 ? taxiMinutes : 1,
  }
}

/**
 * Walks enter → service → exit. Position only ever comes from the path,
 * so a step cannot jump from the stand to the bay.
 */
export function stepTaxiMachine(machine: TaxiMachine, minutes: number): TaxiMachine {
  const dt = Math.max(0, minutes)
  if (!(dt > 0) || machine.leg === 'done') return machine
  if (machine.leg === 'enter') {
    const progress = Math.min(1, machine.progress + dt / machine.taxiMinutes)
    if (progress >= 1) return { ...machine, leg: 'service', progress: 0 }
    return { ...machine, progress }
  }
  if (machine.leg === 'service') {
    if (machine.serviceRate <= 0) return machine
    const left = machine.serviceLeft - dt * machine.serviceRate
    if (left <= 1e-6) return { ...machine, leg: 'exit', progress: 0, serviceLeft: 0 }
    return { ...machine, serviceLeft: left }
  }
  const progress = Math.min(1, machine.progress + dt / machine.taxiMinutes)
  if (progress >= 1) return { ...machine, leg: 'done', progress: 1 }
  return { ...machine, progress }
}

export function machinePose(machine: TaxiMachine): TaxiPose {
  if (machine.leg === 'enter') {
    return poseForPhase({
      phase: 'taxi_in',
      remaining: (1 - machine.progress) * machine.taxiMinutes,
      path: machine.path,
      taxiMinutes: machine.taxiMinutes,
    })
  }
  if (machine.leg === 'service') {
    return poseForPhase({ phase: 'in_bay', remaining: machine.serviceLeft, path: machine.path, taxiMinutes: machine.taxiMinutes })
  }
  if (machine.leg === 'done') {
    return poseForPhase({ phase: 'taxi_out', remaining: 0, path: machine.path, taxiMinutes: machine.taxiMinutes })
  }
  return poseForPhase({
    phase: 'taxi_out',
    remaining: (1 - machine.progress) * machine.taxiMinutes,
    path: machine.path,
    taxiMinutes: machine.taxiMinutes,
  })
}

/** How far two poses are, in cells. Used to prove a step stayed on the path. */
export function poseDelta(a: TaxiPose, b: TaxiPose): number {
  return detHypot(a.x - b.x, a.y - b.y)
}
