/**
 * Renderer-agnostic crew steps. Positions are meters in the vehicle frame:
 * +X forward, +Y up, +Z to the vehicle's left. Time is the caller's clock
 * (sim minutes or a dwell countdown). The steps always fill [start, end].
 */
import {
  BAG_TRIPS,
  CATER_STAND_PHASES,
  CREW_SHARES,
  type CaterStandPhase,
  type CrewPose,
  type CrewRole,
  type CrewService,
  type CrewStepId,
} from './crewConfig.ts'

export interface CrewStepSpan {
  id: CrewStepId
  start: number
  end: number
}

export interface CrewMemberPose {
  role: CrewRole
  x: number
  y: number
  z: number
  /** Radians in the vehicle frame. 0 faces forward (+X). */
  heading: number
  pose: CrewPose
}

export interface CrewSample {
  service: CrewService
  step: CrewStepId
  stepU: number
  /** 0 at the start of the service window, 1 at the end. */
  u: number
  /** Pump, bag move, or cart progress. 0 before the work step, 1 after it. */
  work: number
  /** Hose, belt, or lift. 0 before connect, 1 through the work, 0 after disconnect. */
  link: number
  crew: [CrewMemberPose, CrewMemberPose]
}

interface Pt {
  x: number
  y: number
  z: number
  pose: CrewPose
}

const ROLES: CrewRole[] = ['driver', 'helper']

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    pose: t < 0.5 ? a.pose : b.pose,
  }
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

/** Keep the coupling a short walk from the truck, on the side the caller aimed. */
export function clampAim(aim: { x: number; z: number } | undefined): { x: number; z: number } {
  const x = aim?.x ?? -0.6
  const z = aim?.z ?? 5.6
  const len = Math.hypot(x, z)
  if (len < 1e-4) return { x: -0.6, z: 5.6 }
  const clamped = Math.min(10, Math.max(3.4, len))
  return { x: (x / len) * clamped, z: (z / len) * clamped }
}

function seat(role: CrewRole): Pt {
  return { x: 2.35, y: 1.42, z: role === 'driver' ? 0.38 : -0.38, pose: 'seated' }
}

function door(role: CrewRole): Pt {
  return { x: 3.05, y: 0, z: role === 'driver' ? 1.25 : -1.25, pose: 'walk' }
}

function fuelWing(role: CrewRole, aim: { x: number; z: number }): Pt {
  return {
    x: aim.x + (role === 'helper' ? -0.55 : 0.15),
    y: 0,
    z: aim.z + (role === 'helper' ? -0.75 : 0.15),
    pose: 'reach',
  }
}

function bagBelt(role: CrewRole): Pt {
  return role === 'driver'
    ? { x: -0.25, y: 0, z: 3.5, pose: 'reach' }
    : { x: -0.95, y: 0, z: 3.15, pose: 'reach' }
}

function bagCart(): Pt {
  return { x: -1.85, y: 0, z: 1.2, pose: 'walk' }
}

function caterPad(role: CrewRole, y: number): Pt {
  return { x: -1.2, y, z: role === 'driver' ? -1.4 : -0.7, pose: y > 0.4 ? 'reach' : 'walk' }
}

function caterGalley(): Pt {
  return { x: -2.85, y: 2.8, z: -1.75, pose: 'reach' }
}

function tugNose(role: CrewRole): Pt {
  return { x: 1.15, y: 0, z: role === 'driver' ? 0.4 : 1.15, pose: 'idle' }
}

function cabin(role: CrewRole): Pt {
  return { x: -0.2, y: 2.65, z: role === 'driver' ? 0.4 : -0.4, pose: 'walk' }
}

const LIFT_Y = 2.65

function track(service: CrewService, step: CrewStepId, role: CrewRole, aim: { x: number; z: number }): Pt[] {
  const s = seat(role)
  const d = door(role)
  if (service === 'fuel') {
    const w = fuelWing(role, aim)
    if (step === 'park' || step === 'drive_off') return [s, s]
    if (step === 'exit') return [s, d]
    if (step === 'walk') return [d, w]
    if (step === 'connect' || step === 'work' || step === 'disconnect') return [w, w]
    return [w, d, s]
  }
  if (service === 'bags') {
    const b = bagBelt(role)
    if (step === 'park' || step === 'drive_off') return [s, s]
    if (step === 'exit') return [s, d]
    if (step === 'walk') return [d, b]
    if (step === 'connect' || step === 'disconnect') return [b, b]
    if (step === 'work') return [b, b]
    return [b, d, s]
  }
  if (service === 'gpu') {
    const w = fuelWing(role, aim)
    if (step === 'park' || step === 'drive_off') return [s, s]
    if (step === 'exit') return [s, d]
    if (step === 'walk') return [d, w]
    if (step === 'connect' || step === 'work' || step === 'disconnect') return [w, w]
    return [w, d, s]
  }
  if (service === 'pushback') {
    const nose = tugNose(role)
    const wing = role === 'driver' ? nose : { x: aim.x, y: 0, z: aim.z, pose: 'walk' as const }
    if (step === 'park' || step === 'drive_off') return [s, s]
    if (step === 'exit') return [s, d]
    if (step === 'walk') return [d, wing]
    if (step === 'connect' || step === 'work' || step === 'disconnect') return [wing, wing]
    return [wing, d, s]
  }
  if (service === 'cleaning') {
    const stepDoor = { x: aim.x, y: 0, z: aim.z, pose: 'walk' as const }
    const inside = cabin(role)
    if (step === 'park' || step === 'drive_off') return [s, s]
    if (step === 'exit') return [s, d]
    if (step === 'walk') return [d, stepDoor]
    if (step === 'connect') return [stepDoor, inside]
    if (step === 'work') return [inside, inside]
    if (step === 'disconnect') return [inside, stepDoor]
    return [stepDoor, d, s]
  }
  if (service === 'pax') return [s, s]
  const ground = caterPad(role, 0)
  const high = caterPad(role, LIFT_Y)
  if (step === 'park' || step === 'drive_off') return [s, s]
  if (step === 'exit') return [s, d]
  if (step === 'walk') return [d, ground]
  if (step === 'connect') return [ground, high]
  if (step === 'work') return [high, high]
  if (step === 'disconnect') return [high, ground]
  return [ground, d, s]
}

function faceFor(service: CrewService, step: CrewStepId, aim: { x: number; z: number }): number {
  if (step === 'park' || step === 'drive_off' || step === 'exit' || step === 'board') return 0
  if (service === 'fuel' || service === 'gpu' || service === 'pushback' || service === 'cleaning') return Math.atan2(aim.z, aim.x)
  if (service === 'bags') return Math.atan2(3.4, -0.3)
  return Math.PI
}

function along(points: Pt[], u: number, face: number): Pt & { heading: number } {
  const uu = Math.min(1, Math.max(0, u))
  if (points.length === 1) return { ...points[0], heading: face }
  const lens: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const len = dist(points[i - 1], points[i])
    lens.push(len)
    total += len
  }
  if (total < 1e-5) return { ...points[0], heading: face }
  let remain = uu * total
  for (let i = 0; i < lens.length; i++) {
    const len = lens[i]
    if (remain <= len || i === lens.length - 1) {
      const t = len < 1e-5 ? 1 : Math.min(1, remain / len)
      const p = lerpPt(points[i], points[i + 1], t)
      const heading = len < 1e-4 ? face : Math.atan2(points[i + 1].z - points[i].z, points[i + 1].x - points[i].x)
      return { ...p, heading }
    }
    remain -= len
  }
  return { ...points[points.length - 1], heading: face }
}

/** Spans cover [start, end] exactly. The last step absorbs rounding. */
export function crewStepSpans(service: CrewService, start: number, end: number): CrewStepSpan[] {
  const shares = CREW_SHARES[service]
  const span = end - start
  const total = shares.reduce((sum, step) => sum + step.share, 0)
  let cursor = start
  return shares.map((step, index) => {
    const dur = index === shares.length - 1 ? end - cursor : (step.share / total) * span
    const out = { id: step.id, start: cursor, end: cursor + dur }
    cursor += dur
    return out
  })
}

function spanAt(spans: CrewStepSpan[], now: number, end: number): { span: CrewStepSpan; u: number } {
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

function workOf(step: CrewStepId, stepU: number, spans: CrewStepSpan[], now: number): number {
  if (step === 'work') return stepU
  const work = spans.find((span) => span.id === 'work')
  if (!work || now < work.start) return 0
  return 1
}

function linkOf(step: CrewStepId, stepU: number): number {
  if (step === 'connect') return stepU
  if (step === 'work') return 1
  if (step === 'disconnect') return 1 - stepU
  return 0
}

/**
 * One sample of a fuel, bag, or catering service.
 * `aim` is the coupling point in vehicle meters (wing, hold, or door).
 */
export function sampleService(
  service: CrewService,
  start: number,
  end: number,
  now: number,
  aim?: { x: number; z: number },
): CrewSample {
  const safeEnd = end > start ? end : start + 1e-6
  const spans = crewStepSpans(service, start, safeEnd)
  const clamped = Math.min(safeEnd, Math.max(start, now))
  const { span, u } = spanAt(spans, clamped, safeEnd)
  const coupling = clampAim(aim)
  const face = faceFor(service, span.id, coupling)
  const crew = ROLES.map((role) => {
    let placed = along(track(service, span.id, role, coupling), u, face)
    if (service === 'bags' && role === 'helper' && span.id === 'work') {
      const swing = (1 - Math.cos(u * Math.PI * 2 * BAG_TRIPS)) / 2
      const home = bagBelt(role)
      const cart = bagCart()
      placed = {
        ...lerpPt(home, cart, swing),
        heading: Math.atan2(cart.z - home.z, cart.x - home.x),
        pose: swing > 0.08 && swing < 0.92 ? 'walk' : 'reach',
      }
    }
    if (service === 'catering' && role === 'helper' && span.id === 'work') {
      const swing = (1 - Math.cos(u * Math.PI * 2 * 2)) / 2
      const home = caterPad(role, LIFT_Y)
      const door = caterGalley()
      placed = {
        ...lerpPt(home, door, swing),
        heading: Math.PI,
        pose: 'reach',
      }
    }
    if (service === 'cleaning' && span.id === 'work') {
      const swing = (1 - Math.cos(u * Math.PI * 4)) / 2
      const inside = cabin(role)
      const outside = { x: coupling.x, y: 0, z: coupling.z, pose: 'walk' as const }
      placed = {
        ...lerpPt(inside, outside, swing),
        heading: Math.atan2(outside.z - inside.z, outside.x - inside.x),
        pose: 'walk',
      }
    }
    return { role, x: placed.x, y: placed.y, z: placed.z, heading: placed.heading, pose: placed.pose }
  }) as [CrewMemberPose, CrewMemberPose]
  const window = safeEnd - start
  return {
    service,
    step: span.id,
    stepU: u,
    u: window <= 1e-9 ? 1 : (clamped - start) / window,
    work: workOf(span.id, u, spans, clamped),
    link: linkOf(span.id, u),
    crew,
  }
}

export interface CaterSample {
  phase: CaterStandPhase
  crew: [CrewMemberPose, CrewMemberPose]
  /** 0 on the ground, 1 at the door sill. */
  lift: number
  /** 0 at the truck, 1 in the galley. */
  cart: number
}

function member(role: CrewRole, p: Pt, heading: number): CrewMemberPose {
  return { role, x: p.x, y: p.y, z: p.z, heading, pose: p.pose }
}

/**
 * Positions for one catering-module phase. Neighbouring phases share an
 * endpoint, so a crew member never jumps when the phase clock rolls.
 */
export function sampleCateringStand(phase: CaterStandPhase, u: number): CaterSample {
  const t = Math.min(1, Math.max(0, u))
  const crew = ROLES.map((role) => {
    const s = seat(role)
    const g = { x: 0.55, y: 0, z: role === 'driver' ? 1.55 : 0.9, pose: 'idle' as const }
    const high = caterPad(role, LIFT_Y)
    const low = caterPad(role, 0)
    if (phase === 'parking') return member(role, s, 0)
    if (phase === 'crew_exit') {
      const p = lerpPt(s, g, t)
      return member(role, { ...p, pose: t > 0.15 && t < 0.9 ? 'walk' : p.pose }, Math.atan2(g.z - s.z, g.x - s.x))
    }
    if (phase === 'lift_raise') {
      const p = lerpPt(g, high, t)
      return member(role, { ...p, pose: 'reach' }, Math.PI)
    }
    if (phase === 'carts_out' || phase === 'carts_in') {
      if (role === 'driver') return member(role, { ...high, pose: 'reach' }, Math.PI)
      const door = caterGalley()
      const from = phase === 'carts_out' ? high : door
      const to = phase === 'carts_out' ? door : high
      const p = lerpPt(from, to, t)
      return member(role, { ...p, pose: 'reach' }, Math.PI)
    }
    if (phase === 'lift_lower') {
      const p = lerpPt(high, low, t)
      return member(role, { ...p, pose: 'reach' }, Math.PI)
    }
    const p = lerpPt(low, s, t)
    return member(role, { ...p, pose: t > 0.75 ? 'seated' : 'walk' }, 0)
  }) as [CrewMemberPose, CrewMemberPose]
  let lift = 0
  if (phase === 'lift_raise') lift = t
  else if (phase === 'carts_out' || phase === 'carts_in') lift = 1
  else if (phase === 'lift_lower') lift = 1 - t
  let cart = 0
  if (phase === 'carts_out') cart = t
  else if (phase === 'carts_in') cart = 1 - t
  return { phase, crew, lift, cart }
}

export function isCaterStandPhase(phase: string): phase is CaterStandPhase {
  return (CATER_STAND_PHASES as readonly string[]).includes(phase)
}
