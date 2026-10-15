/**
 * Boarding and deplaning pictures. The steps fill the flight phase the sim
 * already waits on (bridge, stairs, or bus). They do not add time.
 */
import { PAX_STREAM } from './crewConfig.ts'
import type { CrewPerson, CrewProp } from './present.ts'
import { placeLocal } from './present.ts'

export type PaxMode = 'bridge' | 'stairs' | 'bus'
export type PaxLeg = 'deplane' | 'board'

export interface PaxStepShare {
  id: 'extend' | 'walk' | 'retract' | 'ride' | 'clear'
  share: number
}

/** Bridge stays docked between deplane and board. It retracts only after boarding. */
export const PAX_SHARES: Record<PaxMode, Record<PaxLeg, readonly PaxStepShare[]>> = {
  bridge: {
    deplane: [
      { id: 'extend', share: 0.24 },
      { id: 'walk', share: 0.76 },
    ],
    board: [
      { id: 'walk', share: 0.78 },
      { id: 'retract', share: 0.22 },
    ],
  },
  stairs: {
    deplane: [
      { id: 'extend', share: 0.14 },
      { id: 'walk', share: 0.74 },
      { id: 'clear', share: 0.12 },
    ],
    board: [
      { id: 'extend', share: 0.12 },
      { id: 'walk', share: 0.76 },
      { id: 'clear', share: 0.12 },
    ],
  },
  bus: {
    deplane: [
      { id: 'extend', share: 0.1 },
      { id: 'walk', share: 0.22 },
      { id: 'ride', share: 0.46 },
      { id: 'clear', share: 0.22 },
    ],
    board: [
      { id: 'extend', share: 0.16 },
      { id: 'ride', share: 0.42 },
      { id: 'walk', share: 0.3 },
      { id: 'clear', share: 0.12 },
    ],
  },
}

export interface PaxDoor {
  /** Meters forward of the aircraft origin. */
  x: number
  /** Meters to port (+). */
  z: number
  /** Door sill, meters above the apron. */
  sill: number
}

export interface PaxClock {
  id: string
  mode: PaxMode
  leg: PaxLeg
  start: number
  end: number
  now: number
  aircraft: { x: number; y: number; heading: number }
  door: PaxDoor
  /** Hall or bus stop, in the same cell space as the aircraft. */
  gate: { x: number; y: number }
  /** Set while the apron bus is moving and the cabin is shut. */
  riding?: boolean
  metersPerUnit: number
}

export interface PaxSample {
  step: PaxStepShare['id']
  /** 0 retracted, 1 docked. Stairs trucks use the same 0–1 as "in position". */
  extend: number
  people: CrewPerson[]
  props: CrewProp[]
}

interface Span {
  id: PaxStepShare['id']
  start: number
  end: number
}

function spansOf(mode: PaxMode, leg: PaxLeg, start: number, end: number): Span[] {
  const shares = PAX_SHARES[mode][leg]
  const total = shares.reduce((sum, step) => sum + step.share, 0)
  const span = end - start
  let cursor = start
  return shares.map((step, index) => {
    const dur = index === shares.length - 1 ? end - cursor : (step.share / total) * span
    const out = { id: step.id, start: cursor, end: cursor + dur }
    cursor += dur
    return out
  })
}

function spanAt(spans: Span[], now: number, end: number): { span: Span; u: number } {
  if (now >= end) return { span: spans[spans.length - 1], u: 1 }
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (now < span.end || i === spans.length - 1) {
      const dur = span.end - span.start
      const u = dur <= 1e-9 ? 1 : Math.min(1, Math.max(0, (now - span.start) / dur))
      return { span, u }
    }
  }
  return { span: spans[spans.length - 1], u: 1 }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Terminal end of the bridge, in aircraft metres.
 * A hall that sits on the aircraft itself keeps a short stub off the door.
 */
function bridgeFarPoint(clock: PaxClock, door: PaxDoor): { x: number; y: number; z: number } {
  const origin = clock.aircraft
  const m = clock.metersPerUnit
  const dx = (clock.gate.x - origin.x) * m
  const dy = (clock.gate.y - origin.y) * m
  const h = origin.heading
  const fx = Math.cos(h)
  const fy = Math.sin(h)
  const lx = -Math.sin(h)
  const ly = Math.cos(h)
  const x = dx * fx + dy * fy
  const z = dx * lx + dy * ly
  if (Math.hypot(x - door.x, z - door.z) < 1.5) {
    const s = Math.sign(door.z || 1)
    return { x: door.x, y: door.sill, z: door.z + s * 9 }
  }
  return { x, y: door.sill, z }
}

/** One passenger's slice of the walk, staggered so they do not stack. */
function walkerU(stepU: number, index: number): number | null {
  const start = (index / PAX_STREAM) * 0.62
  const end = start + 0.38
  if (stepU < start || stepU > end) return null
  return (stepU - start) / (end - start)
}

/**
 * Bridge, mobile stairs, or apron bus. `extend` docks the bridge or the stair
 * truck. Passengers are omitted while they are inside the cabin or the bus.
 */
export function samplePax(clock: PaxClock): PaxSample {
  const end = clock.end > clock.start ? clock.end : clock.start + 1e-6
  const now = Math.min(end, Math.max(clock.start, clock.now))
  const spans = spansOf(clock.mode, clock.leg, clock.start, end)
  const { span, u } = spanAt(spans, now, end)
  const boarding = clock.leg === 'board'
  let extend = 0
  if (clock.mode === 'bridge') {
    if (span.id === 'extend') extend = u
    else if (span.id === 'retract') extend = 1 - u
    else extend = 1
  } else if (span.id === 'extend') extend = u
  else if (span.id === 'clear') extend = 1 - u
  else extend = 1

  const people: CrewPerson[] = []
  const props: CrewProp[] = []
  const origin = clock.aircraft
  const door = clock.door
  const sill = door.sill
  const bridgeFar = bridgeFarPoint(clock, door)
  const stairFoot = { x: door.x - 0.4, y: 0, z: door.z + Math.sign(door.z || 1) * 1.6 }
  const stairTop = { x: door.x, y: sill, z: door.z }
  const apron = { x: door.x - 1.2, y: 0, z: door.z + Math.sign(door.z || 1) * 14 }

  if (clock.mode !== 'bridge' && extend > 0.05) {
    const at = placeLocal(origin, { x: stairFoot.x, y: sill * 0.45 * extend, z: stairFoot.z }, clock.metersPerUnit)
    props.push({
      id: `${clock.id}:stairs`,
      kind: 'stairs',
      c: at.c,
      r: at.r,
      alt: at.alt,
      heading: origin.heading,
      length: sill,
      fill: extend,
    })
  }

  const gateWalk = clock.mode === 'bus' && span.id === 'extend' && boarding && !clock.riding
  if ((span.id !== 'walk' && !gateWalk) || clock.riding) {
    return { step: span.id, extend, people, props }
  }

  for (let i = 0; i < PAX_STREAM; i++) {
    const t = walkerU(gateWalk ? u : u, i)
    if (t == null) continue
    if (gateWalk) {
      const shift = (i - (PAX_STREAM - 1) / 2) * 0.35
      people.push({
        id: `${clock.id}:pax:${i}`,
        role: 'pax',
        service: 'pax',
        c: clock.gate.x + shift * 0.04,
        r: clock.gate.y + t * 0.35,
        alt: 0,
        heading: origin.heading,
        pose: 'walk',
      })
      continue
    }
    // 0 is outside the aircraft, 1 is in the doorway.
    const along = boarding ? t : 1 - t
    let local = { x: door.x, y: sill, z: door.z }
    if (clock.mode === 'bridge') {
      local = {
        x: lerp(bridgeFar.x, door.x, along),
        y: sill,
        z: lerp(bridgeFar.z, door.z, along),
      }
    } else {
      const climb = along > 0.72
      if (!climb) {
        const p = along / 0.72
        local = {
          x: lerp(apron.x, stairFoot.x, p),
          y: 0,
          z: lerp(apron.z, stairFoot.z, p),
        }
      } else {
        const p = (along - 0.72) / 0.28
        local = {
          x: lerp(stairFoot.x, stairTop.x, p),
          y: lerp(0, sill, p),
          z: lerp(stairFoot.z, stairTop.z, p),
        }
      }
    }
    const at = placeLocal(origin, local, clock.metersPerUnit)
    people.push({
      id: `${clock.id}:pax:${i}`,
      role: 'pax',
      service: 'pax',
      c: at.c,
      r: at.r,
      alt: at.alt,
      heading: origin.heading + (boarding ? 0 : Math.PI),
      pose: 'walk',
    })
  }
  return { step: span.id, extend, people, props }
}

/** Docked bridge between deplane and the boarding retract. */
export function bridgeHold(): number {
  return 1
}
