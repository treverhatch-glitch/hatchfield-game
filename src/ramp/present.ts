/**
 * Turn a service clock into apron positions. Coordinates in, coordinates out:
 * no meshes. The renderer places these in world units.
 */
import {
  BAG_TRIPS,
  CREW_IN_CAB,
  LINE_LOOK,
  SERVICE_POINTS,
  type CaterStandPhase,
  type CrewPose,
  type CrewRole,
  type CrewService,
  type CrewStepId,
} from './crewConfig.ts'
import { clampAim, isCaterStandPhase, sampleCateringStand, sampleService, type CrewMemberPose } from './crewActions.ts'
import { detAtan2, detCos, detHypot, detSin } from '../game/detMath.ts'

export interface CrewClock {
  id: string
  service: CrewService
  x: number
  y: number
  heading: number
  start: number
  end: number
  now: number
  aim?: { x: number; z: number }
}

export interface CrewPerson {
  id: string
  role: CrewRole
  service: CrewService
  /** Column, same space as a vehicle pose. */
  c: number
  /** Row. */
  r: number
  /** Meters above the apron. */
  alt: number
  /** World heading. 0 faces +column. */
  heading: number
  pose: CrewPose
}

export interface CrewProp {
  id: string
  kind: 'hose' | 'cable' | 'bar' | 'belt' | 'bag' | 'cart' | 'lift' | 'stairs' | 'chock' | 'cone'
  c: number
  r: number
  alt: number
  heading: number
  /** Tilt of the long axis, radians, up toward the far end. */
  pitch?: number
  /** Meters. */
  length: number
  /** 0..1 fill, shuttle, or colour mix. */
  fill: number
}

export interface CrewJobMark {
  id: string
  service: CrewService
  step: CrewStepId
  work: number
}

export interface CrewScene {
  people: CrewPerson[]
  props: CrewProp[]
  jobs: CrewJobMark[]
}

export interface AircraftAim {
  x: number
  y: number
  heading: number
  lengthM: number
  spanM: number
  wingAt: number
}

const EMPTY: CrewScene = { people: [], props: [], jobs: [] }

export function pathHeading(path: { c: number; r: number }[]): number {
  if (path.length < 2) return 0
  const a = path[path.length - 2]
  const b = path[path.length - 1]
  const dx = b.c - a.c
  const dy = b.r - a.r
  if (dx * dx + dy * dy < 1e-8) return 0
  return detAtan2(dy, dx)
}

/** Wing coupling in vehicle-local meters, a short walk off the truck. */
export function wingAimLocal(aircraft: AircraftAim, vehicle: { x: number; y: number; heading: number }, metersPerUnit: number): { x: number; z: number } {
  const along = aircraft.lengthM * (0.5 - aircraft.wingAt)
  const half = Math.min(9, Math.max(3.6, aircraft.spanM * 0.18))
  const h = aircraft.heading
  const fx = detCos(h)
  const fy = detSin(h)
  const lx = -detSin(h)
  const ly = detCos(h)
  const vx = (vehicle.x - aircraft.x) * metersPerUnit
  const vy = (vehicle.y - aircraft.y) * metersPerUnit
  const side = vx * lx + vy * ly < 0 ? -half : half
  const cx = aircraft.x + (along * fx + side * lx) / metersPerUnit
  const cy = aircraft.y + (along * fy + side * ly) / metersPerUnit
  return toLocal(vehicle, cx, cy, metersPerUnit)
}

function toLocal(
  vehicle: { x: number; y: number; heading: number },
  c: number,
  r: number,
  metersPerUnit: number,
): { x: number; z: number } {
  const dx = (c - vehicle.x) * metersPerUnit
  const dy = (r - vehicle.y) * metersPerUnit
  const h = vehicle.heading
  const fx = detCos(h)
  const fy = detSin(h)
  const lx = -detSin(h)
  const ly = detCos(h)
  return { x: dx * fx + dy * fy, z: dx * lx + dy * ly }
}

export function placeLocal(
  origin: { x: number; y: number; heading: number },
  local: { x: number; y: number; z: number },
  metersPerUnit: number,
): { c: number; r: number; alt: number } {
  const h = origin.heading
  const fx = detCos(h)
  const fy = detSin(h)
  const lx = -detSin(h)
  const ly = detCos(h)
  return {
    c: origin.x + (local.x * fx + local.z * lx) / metersPerUnit,
    r: origin.y + (local.x * fy + local.z * ly) / metersPerUnit,
    alt: local.y,
  }
}

function personOf(clock: CrewClock, member: CrewMemberPose, metersPerUnit: number, service: CrewService): CrewPerson {
  const at = placeLocal(clock, member, metersPerUnit)
  const role = service === 'pushback' && member.role === 'helper' ? 'walker' : member.role
  return {
    id: `${clock.id}:${member.role}`,
    role,
    service,
    c: at.c,
    r: at.r,
    alt: at.alt,
    heading: clock.heading + member.heading,
    pose: member.pose,
  }
}

function segmentProp(
  id: string,
  kind: CrewProp['kind'],
  clock: CrewClock,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  metersPerUnit: number,
  fill: number,
): CrewProp {
  const a = placeLocal(clock, from, metersPerUnit)
  const b = placeLocal(clock, to, metersPerUnit)
  const dx = (b.c - a.c) * metersPerUnit
  const dy = (b.r - a.r) * metersPerUnit
  const dz = b.alt - a.alt
  const flat = detHypot(dx, dy)
  return {
    id,
    kind,
    c: (a.c + b.c) / 2,
    r: (a.r + b.r) / 2,
    alt: (a.alt + b.alt) / 2,
    heading: flat > 1e-6 ? detAtan2(b.r - a.r, b.c - a.c) : clock.heading,
    pitch: detAtan2(dz, flat),
    length: detHypot(dx, dy, dz),
    fill,
  }
}

/**
 * A hose or cable hanging between two points as short tilted segments.
 * `sag` is the mid-span drop in metres; the line never goes below the apron.
 */
export function sagLine(
  out: CrewProp[],
  id: string,
  kind: 'hose' | 'cable',
  clock: CrewClock,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  sag: number,
  metersPerUnit: number,
  fill: number,
  segments: number = LINE_LOOK.segments,
) {
  const at = (t: number) => ({
    x: lerp(from.x, to.x, t),
    y: Math.max(0.03, lerp(from.y, to.y, t) - sag * 4 * t * (1 - t)),
    z: lerp(from.z, to.z, t),
  })
  let prev = at(0)
  for (let i = 1; i <= segments; i++) {
    const next = at(i / segments)
    out.push(segmentProp(`${id}:${i}`, kind, clock, prev, next, metersPerUnit, fill))
    prev = next
  }
}

function pushService(out: CrewScene, clock: CrewClock, metersPerUnit: number, aircraft?: AircraftAim) {
  if (!(clock.end > clock.start) || clock.now < clock.start || clock.now > clock.end) return
  const aim = clock.aim ?? (aircraft ? wingAimLocal(aircraft, clock, metersPerUnit) : undefined)
  const sample = sampleService(clock.service, clock.start, clock.end, clock.now, aim)
  out.jobs.push({ id: clock.id, service: clock.service, step: sample.step, work: sample.work })
  if (CREW_IN_CAB.has(sample.step)) return
  for (const member of sample.crew) {
    out.people.push(personOf(clock, member, metersPerUnit, clock.service))
    if (clock.service === 'cleaning' && member.pose === 'carry') {
      // Bin bag held in front at hip height.
      const hands = { x: member.x + detCos(member.heading) * 0.42, y: 0.72, z: member.z + detSin(member.heading) * 0.42 }
      out.props.push({
        id: `${clock.id}:${member.role}:binbag`,
        kind: 'bag',
        ...placeLocal(clock, hands, metersPerUnit),
        heading: clock.heading + member.heading,
        length: 0.45,
        fill: 1,
      })
    }
  }
  if (sample.link > 0.02 && (clock.service === 'fuel' || clock.service === 'gpu')) {
    // Fuel hose up to the underwing coupling; ground-power cable across the apron to the nose.
    const coupling = clampAim(aim)
    const fuel = clock.service === 'fuel'
    const reel = fuel ? SERVICE_POINTS.hoseReel : SERVICE_POINTS.gpuSocket
    const plugY = fuel ? SERVICE_POINTS.wingCouplingY : SERVICE_POINTS.gpuPlugY
    const tip = {
      x: lerp(reel.x, coupling.x, sample.link),
      y: lerp(reel.y, plugY, sample.link),
      z: lerp(reel.z, coupling.z, sample.link),
    }
    const run = detHypot(tip.x - reel.x, tip.z - reel.z)
    const sag = Math.min(run * 0.35, fuel ? LINE_LOOK.hoseSag : LINE_LOOK.cableSag)
    sagLine(out.props, `${clock.id}:${fuel ? 'hose' : 'cable'}`, fuel ? 'hose' : 'cable', clock, reel, tip, sag, metersPerUnit, sample.link)
    out.props.push({
      id: `${clock.id}:bar`,
      kind: 'bar',
      ...placeLocal(clock, { x: coupling.x, y: 0, z: coupling.z }, metersPerUnit),
      heading: clock.heading,
      length: 1.35,
      fill: sample.work,
    })
  }
  if (sample.link > 0.02 && clock.service === 'bags') {
    const cart = { x: -1.85, y: 0.45, z: 1.2 }
    const hold = { x: -0.3, y: 1.85, z: 3.6 }
    const tip = {
      x: lerp(cart.x, hold.x, sample.link),
      y: lerp(cart.y, hold.y, sample.link),
      z: lerp(cart.z, hold.z, sample.link),
    }
    out.props.push(segmentProp(`${clock.id}:belt`, 'belt', clock, cart, tip, metersPerUnit, sample.link))
    const parked = placeLocal(clock, { x: cart.x, y: 0.35, z: cart.z }, metersPerUnit)
    out.props.push({
      id: `${clock.id}:cart`,
      kind: 'cart',
      ...parked,
      heading: clock.heading,
      length: 1.4,
      fill: 1,
    })
    if (sample.step === 'work') {
      // Each bag waits on the cart, is lifted onto the belt foot by the helper, then rides up to the hold.
      const trips = sample.work * BAG_TRIPS
      for (let i = 0; i < BAG_TRIPS; i++) {
        const local = trips - i
        const u = Math.min(1, Math.max(0, local / 1.5))
        let bag: { x: number; y: number; z: number }
        if (local < 0.5) bag = { x: cart.x, y: 0.85, z: cart.z + (i - 1) * 0.35 }
        else if (local < 1) {
          const k = (local - 0.5) / 0.5
          bag = { x: cart.x, y: 0.85 + detSin(k * Math.PI) * 0.45 + k * 0.05, z: cart.z + (i - 1) * 0.35 * (1 - k) }
        } else {
          const k = Math.min(1, local - 1) / 0.5
          bag = { x: lerp(cart.x, hold.x, Math.min(1, k)), y: lerp(0.9, 2.0, Math.min(1, k)), z: lerp(cart.z, hold.z, Math.min(1, k)) }
        }
        if (local >= 1.5) continue
        const at = placeLocal(clock, bag, metersPerUnit)
        out.props.push({
          id: `${clock.id}:bag:${i}`,
          kind: 'bag',
          c: at.c,
          r: at.r,
          alt: at.alt,
          heading: clock.heading,
          length: 0.55,
          fill: u,
        })
      }
    }
  }
  if (clock.service === 'catering' && (sample.step === 'connect' || sample.step === 'work' || sample.step === 'disconnect')) {
    const lift = sample.step === 'work' ? 1 : sample.link
    const platformY = 0.45 + lift * 2.35
    out.props.push({
      id: `${clock.id}:lift`,
      kind: 'lift',
      ...placeLocal(clock, { x: -1.2, y: platformY, z: -1.15 }, metersPerUnit),
      heading: clock.heading,
      length: 1.8,
      fill: lift,
    })
    const intoDoor = sample.step === 'work' ? sample.work : 0
    const cart = {
      x: lerp(-1.2, -2.7, intoDoor),
      y: lerp(platformY, 2.7, intoDoor),
      z: lerp(-1.15, -1.7, intoDoor),
    }
    out.props.push({
      id: `${clock.id}:cart`,
      kind: 'cart',
      ...placeLocal(clock, cart, metersPerUnit),
      heading: clock.heading + Math.PI,
      length: 0.8,
      fill: intoDoor,
    })
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export interface CateringClock {
  id: string
  x: number
  y: number
  heading: number
  phase: string
  /** 0 at the start of the phase, 1 at the end. The phase durations are the sim's. */
  phaseU: number
}

function pushCatering(out: CrewScene, clock: CateringClock, metersPerUnit: number) {
  if (!isCaterStandPhase(clock.phase)) return
  const phase = clock.phase as CaterStandPhase
  const sample = sampleCateringStand(phase, clock.phaseU)
  const origin = { x: clock.x, y: clock.y, heading: clock.heading, id: clock.id }
  if (phase !== 'parking') {
    for (const member of sample.crew) {
      const at = placeLocal(origin, member, metersPerUnit)
      out.people.push({
        id: `${clock.id}:${member.role}`,
        role: member.role,
        service: 'catering',
        c: at.c,
        r: at.r,
        alt: at.alt,
        heading: clock.heading + member.heading,
        pose: member.pose,
      })
    }
  }
  if (sample.cart > 0.02 && sample.cart < 0.98) {
    const from = { x: -1.15, y: 1.1 + sample.lift * 1.5, z: -1.15 }
    const to = { x: -2.7, y: 2.7, z: -1.7 }
    const u = sample.cart
    out.props.push({
      id: `${clock.id}:cart`,
      kind: 'cart',
      ...placeLocal(origin, { x: lerp(from.x, to.x, u), y: lerp(from.y, to.y, u), z: lerp(from.z, to.z, u) }, metersPerUnit),
      heading: clock.heading + Math.PI,
      length: 0.7,
      fill: u,
    })
  }
  out.jobs.push({
    id: clock.id,
    service: 'catering',
    step: cateringStep(phase),
    work: phase === 'carts_out' ? clock.phaseU : phase === 'carts_in' ? 1 : phase === 'lift_lower' || phase === 'crew_board' ? 1 : 0,
  })
}

function cateringStep(phase: CaterStandPhase): CrewStepId {
  if (phase === 'parking') return 'park'
  if (phase === 'crew_exit') return 'exit'
  if (phase === 'lift_raise') return 'connect'
  if (phase === 'carts_out' || phase === 'carts_in') return 'work'
  if (phase === 'lift_lower') return 'disconnect'
  return 'board'
}

export function assembleCrew(input: {
  services: CrewClock[]
  catering: CateringClock[]
  metersPerUnit: number
  aircraftFor?: (x: number, y: number) => AircraftAim | undefined
}): CrewScene {
  const out: CrewScene = { people: [], props: [], jobs: [] }
  for (const clock of input.services) {
    pushService(out, clock, input.metersPerUnit, input.aircraftFor?.(clock.x, clock.y))
  }
  for (const clock of input.catering) pushCatering(out, clock, input.metersPerUnit)
  return out
}

export { EMPTY }
