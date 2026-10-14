/**
 * Round C turnaround crew. Places people from the shared passenger body
 * (src/people, PR #241: same body, crew outfits) around service vehicles and
 * the stand, synced to the vehicle deployment and a simple arrival timeline:
 * drivers in cabs, a marshaller with wands, belt and hold loaders, the fueler
 * at the hose, chocks and cones crew, a catering worker on the deck, the
 * de-ice operator in the basket.
 *
 * Pure placement: returns PeopleAgent records for PeopleRenderer. Everything
 * is computed in metres; pass `upm` (world units per metre) to scale.
 */
import { crewLook } from '../people/variants.ts'
import type { PeopleAgent } from '../people/renderer.ts'
import type { CrewKind, PersonLook, PersonPose } from '../people/types.ts'
import { newPartPose, partPose, poseInput } from './vehicleAnim'
import { beltGeom, cateringHinge, HOSE_M, lineAnchor, MODEL_SIZE, vehicleModel, type VehicleModel } from './vehicleModels'

export interface CrewVehicle {
  id: string
  kind: string
  x: number
  y?: number
  z: number
  /** Same convention as VehicleInstance.yaw (rotation about +Y, model +X forward). */
  yaw: number
  ext: number
  moving: boolean
}

/** Driver seat in model metres: x, seat height, z (left-hand drive). */
const SEAT: Partial<Record<VehicleModel, readonly [number, number, number]>> = (() => {
  const cab = (m: VehicleModel, base: number, len: number): [number, number, number] => {
    const [L, , W] = MODEL_SIZE[m]
    return [L / 2 - len * 0.45, base + 0.5, -W * 0.22]
  }
  const S = (m: VehicleModel) => MODEL_SIZE[m]
  return {
    fuel_tanker: cab('fuel_tanker', 0.7, 2.3),
    hydrant_cart: cab('hydrant_cart', 0.57, 1.8),
    catering_hilift: cab('catering_hilift', 0.65, 2.0),
    arff: cab('arff', 0.87, 3.0),
    deice: cab('deice', 0.7, 2.1),
    box_truck: cab('box_truck', 0.68, 2.0),
    stairs: cab('stairs', 0.62, 1.7),
    apron_bus: [S('apron_bus')[0] / 2 - 1.1, 0.8, -S('apron_bus')[2] * 0.25],
    coach: [S('coach')[0] / 2 - 1.1, 1.3, -S('coach')[2] * 0.25],
    van: [S('van')[0] / 2 - 1.1, 0.85, -S('van')[2] * 0.22],
    belt_loader: [-S('belt_loader')[0] * 0.05, 0.85, -S('belt_loader')[2] / 2 + 0.45],
    baggage_train: [S('baggage_train')[0] / 2 - 1.85, 0.85, 0],
    towbar_tug: [S('towbar_tug')[0] * 0.15, 0.95, -S('towbar_tug')[2] * 0.18],
    towbarless_tug: [S('towbarless_tug')[0] * 0.32, 1.0, -S('towbarless_tug')[2] * 0.28],
    k_loader: [S('k_loader')[0] / 2 - 0.45, S('k_loader')[1] - 0.75, -S('k_loader')[2] / 2 + 0.45],
  }
})()

/** Seated hips sit this far above the feet origin (people pose 'seated'). */
const SEATED_HIP = 0.48

const looks = new Map<string, PersonLook>()
function look(kind: CrewKind, id: string): PersonLook {
  const key = `${kind}:${id}`
  let l = looks.get(key)
  if (!l) looks.set(key, (l = crewLook(kind, id)))
  return l
}

const _pp = newPartPose()
const _pi = poseInput()

/** Model-local point + facing -> agent in world. Facing is a local direction angle (0 = +X). */
function place(
  out: PeopleAgent[],
  id: string,
  kind: CrewKind,
  pose: PersonPose,
  v: { x: number; y?: number; z: number; yaw: number },
  lx: number,
  ly: number,
  lz: number,
  face: number,
  upm: number,
  speed = 0,
) {
  const c = Math.cos(v.yaw)
  const s = Math.sin(v.yaw)
  const fx = Math.cos(face)
  const fz = Math.sin(face)
  const wdx = fx * c + fz * s
  const wdz = -fx * s + fz * c
  out.push({
    id,
    look: look(kind, id),
    x: v.x + (lx * c + lz * s) * upm,
    y: (v.y ?? 0) + ly * upm,
    z: v.z + (-lx * s + lz * c) * upm,
    yaw: Math.atan2(wdx, wdz),
    pose,
    speed,
  })
}

/** Driver plus the people who work this vehicle's service, for the current deployment. */
export function vehicleCrew(v: CrewVehicle, clock: number, out: PeopleAgent[], upm = 1): PeopleAgent[] {
  const model = vehicleModel(v.kind)
  const [L, H, W] = MODEL_SIZE[model]
  const seat = SEAT[model]
  const crewKind: CrewKind = model === 'fuel_tanker' || model === 'hydrant_cart' ? 'fuel' : model === 'arff' ? 'maintenance' : 'ground'
  if (seat) place(out, `${v.id}:driver`, crewKind, 'seated', v, seat[0], seat[1] - SEATED_HIP, seat[2], 0, upm)
  const e = v.ext
  if (v.moving || e < 0.6) return out
  switch (model) {
    case 'belt_loader': {
      const g = beltGeom(L, H)
      // one at the foot feeding bags, one up in the hold door stacking them
      place(out, `${v.id}:belt`, 'ground', 'reach', v, g.lowX - 0.7, 0, W * 0.15 + 0.15, 0, upm)
      _pi.ext = e
      partPose(model, 'belt', _pi, _pp)
      // Hold loader stands on the top of the belt, just short of the door sill, outside the fuselage,
      // facing the hold and passing bags in.
      const hx = L / 2 - 1.1
      const top = g.lowY + Math.tan(g.pitch + _pp.rz) * (hx - g.lowX)
      place(out, `${v.id}:hold`, 'ground', (Math.floor(clock / 1.6) % 2 ? 'reach' : 'push'), v, hx, Math.max(0, top + 0.12), -W * 0.12, 0, upm)
      break
    }
    case 'k_loader':
      place(out, `${v.id}:uld`, 'ground', 'push', v, L / 2 - 2.4, 1.56 + 0.3 + e * 1.9, 0.3, 0, upm)
      break
    case 'fuel_tanker':
    case 'hydrant_cart': {
      const hose = lineAnchor(model, 'hose')
      const x = hose ? hose[0] : model === 'fuel_tanker' ? -L / 2 + 0.55 : -1.53
      place(out, `${v.id}:fueler`, 'fuel', 'reach', v, x + 0.5, 0, W / 2 + HOSE_M * e + 0.3, Math.PI / 2, upm)
      break
    }
    case 'catering_hilift': {
      const h = cateringHinge(L)
      place(out, `${v.id}:cater`, 'ground', 'push', v, h.x - 0.5 + Math.sin(clock * 0.8) * 0.4, h.y + 0.12 + e * 2.4, 0.3, 0, upm)
      break
    }
    case 'deice': {
      _pi.ext = e
      _pi.clock = clock
      partPose(model, 'basket', _pi, _pp)
      place(out, `${v.id}:basket`, 'ground', 'reach', v, L / 2 - 0.7 + _pp.tx, H - 0.8 + _pp.ty, _pp.tz, 0, upm)
      break
    }
    case 'gpu':
      place(out, `${v.id}:gpu`, 'maintenance', 'idle', v, 0.4, 0, W / 2 + 0.7, Math.PI / 2, upm)
      break
    default:
      break
  }
  return out
}

/** Arrival timeline in seconds since the aircraft started its final taxi onto the stand. */
export const STAND_T = { taxi: 6, chocksWalk: 6.6, chocksOn: 9, conesStart: 7.5, conePer: 2.2, marshalOff: 8 } as const

export interface StandState {
  /** 0..1 progress of the taxi-in (eased); 1 = on the stop line. */
  planeU: number
  marshal: 'guide' | 'stop' | 'gone'
  chocks: boolean
  /** Cones placed so far (0..4: nose, left tip, right tip, tail). */
  cones: number
}

export function standTimeline(t: number): StandState {
  const u = Math.min(1, Math.max(0, t / STAND_T.taxi))
  const planeU = 1 - (1 - u) * (1 - u)
  const marshal = t < STAND_T.taxi ? 'guide' : t < STAND_T.marshalOff ? 'stop' : 'gone'
  const cones = t < STAND_T.conesStart ? 0 : Math.min(4, Math.floor((t - STAND_T.conesStart) / STAND_T.conePer) + 1)
  return { planeU, marshal, chocks: t >= STAND_T.chocksOn, cones }
}

export interface StandFrame {
  /** Stop-line position of the aircraft origin (world) and its yaw (+X = nose). */
  x: number
  y?: number
  z: number
  yaw: number
  /** Metres from the aircraft origin to the nose, the nose gear and a wingtip; tail is negative. */
  nose: number
  noseGear: number
  semiSpan: number
  tail: number
}

/** Cone spots in aircraft-local metres, in placing order. */
export function conePoints(f: StandFrame): [number, number][] {
  return [
    [f.nose + 1.5, 0],
    [0, -f.semiSpan - 1],
    [0, f.semiSpan + 1],
    [f.tail - 1.5, 0],
  ]
}

/** Marshaller, chocks pair and cone walker for one stand. */
export function standCrew(f: StandFrame, t: number, out: PeopleAgent[], upm = 1): PeopleAgent[] {
  const st = standTimeline(t)
  if (st.marshal !== 'gone') {
    // Faces the aircraft (-X) from ahead of the stop line, wands waving until it stops.
    place(out, 'stand:marshal', 'marshaller', st.marshal === 'guide' ? 'wave' : 'idle', f, f.nose + 9, 0, 0, Math.PI, upm)
  }
  // Chocks pair: wait at the stand edge, walk in once the aircraft stops, kneel at the nose gear.
  for (const side of [-1, 1]) {
    const id = `stand:chock${side}`
    const sx = f.nose + 6
    const sz = side * 7
    const gx = f.noseGear
    const gz = side * 0.9
    if (t < STAND_T.chocksWalk) place(out, id, 'ground', 'idle', f, sx, 0, sz, Math.PI, upm)
    else if (t < STAND_T.chocksOn) {
      const k = (t - STAND_T.chocksWalk) / (STAND_T.chocksOn - STAND_T.chocksWalk)
      place(out, id, 'ground', 'walk', f, sx + (gx - sx) * k, 0, sz + (gz - sz) * k, Math.atan2(gz - sz, gx - sx), upm, 1.4)
    } else place(out, id, 'ground', t < STAND_T.chocksOn + 2 ? 'reach' : 'idle', f, gx, 0, gz + side * 0.5, -side * Math.PI / 2, upm)
  }
  // Cone walker: goes spot to spot, bending to place each.
  if (t >= STAND_T.conesStart - 1) {
    const pts = conePoints(f)
    const k = Math.max(0, (t - STAND_T.conesStart) / STAND_T.conePer)
    const i = Math.min(3, Math.floor(k))
    const a = i === 0 ? ([f.nose + 6, 7] as [number, number]) : pts[i - 1]
    const b = pts[i]
    const w = Math.min(1, (k - i) / 0.75)
    const walking = k < 4 && w < 1
    const px = a[0] + (b[0] - a[0]) * w
    const pz = a[1] + (b[1] - a[1]) * w
    place(out, 'stand:cones', 'ground', walking ? 'walk' : 'reach', f, px, 0, pz + 0.6, walking ? Math.atan2(b[1] - a[1], b[0] - a[0]) : -Math.PI / 2, upm, walking ? 1.6 : 0)
  }
  return out
}
