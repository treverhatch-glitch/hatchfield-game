/**
 * Round B: service-vehicle part poses.
 *
 * Pure functions of (model, part, deployment, clock). `ext` is 0 when the
 * vehicle is stowed for driving and 1 when fully deployed at the aircraft.
 * `clock` is the sim clock in seconds (deterministic and save-safe). Nothing
 * here allocates per call: callers pass `out` objects they own.
 */
import * as THREE from 'three'
import { MODEL_SIZE, type VehicleModel } from './vehicleModels'

export interface PartPose {
  /** Pivot in model metres. Rotation and scale happen about it. */
  px: number
  py: number
  pz: number
  /** Translation after rotation, model metres. */
  tx: number
  ty: number
  tz: number
  /** Euler angles, applied as yaw (Y) then pitch (Z) then roll (X). */
  rx: number
  ry: number
  rz: number
  sx: number
  sy: number
  sz: number
}

export function newPartPose(): PartPose {
  return { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
}

function reset(o: PartPose, px = 0, py = 0, pz = 0): PartPose {
  o.px = px
  o.py = py
  o.pz = pz
  o.tx = o.ty = o.tz = 0
  o.rx = o.ry = o.rz = 0
  o.sx = o.sy = o.sz = 1
  return o
}

/** Named parts each model animates. Everything else stays in the merged shell. */
export const ANIM_PARTS: Partial<Record<VehicleModel, readonly string[]>> = {
  fuel_tanker: ['hose_reel', 'hose'],
  hydrant_cart: ['lift_platform', 'hose_reel', 'hose'],
  belt_loader: ['belt', 'belt_bags'],
  catering_hilift: ['scissor', 'box', 'deck'],
  arff: ['lightbar', 'roof_turret', 'bumper_turret', 'locker_doors'],
  deice: ['boom', 'basket'],
  apron_bus: ['doors'],
  coach: ['doors'],
  box_truck: ['rollup_door', 'tail_lift'],
  towbar_tug: ['towbar'],
  towbarless_tug: ['cradle'],
  gpu: ['cable_reel'],
  stairs: ['stair', 'canopy'],
  k_loader: ['front_platform', 'rear_platform'],
}

export type ServiceState = 'drive' | 'dock' | 'work' | 'undock' | 'idle'

const RAMP = 0.15

/** Logistics phase + progress -> service state (approach/dock/work/undock). */
export function serviceStateOf(phase: string, u: number): ServiceState {
  if (phase === 'servicing') return u < RAMP ? 'dock' : u > 1 - RAMP ? 'undock' : 'work'
  if (phase === 'to_source' || phase === 'to_stand' || phase === 'to_dropoff' || phase === 'to_maintenance' || phase === 'towed') return 'drive'
  return 'idle'
}

/** Deployment 0..1 for a logistics phase: ramps up while docking, down while undocking. */
export function deployOf(phase: string, u: number): number {
  const s = serviceStateOf(phase, u)
  if (s === 'dock') return smooth(u / RAMP)
  if (s === 'undock') return smooth((1 - u) / RAMP)
  return s === 'work' ? 1 : 0
}

/** Legacy trucks: deployed while dwelling at the end of the path, with ~3 s ramps either side. */
export function truckDeploy(atStop: boolean, dwell: number, serviceFor: number | undefined): number {
  if (!atStop || !(dwell > 0)) return 0
  const total = serviceFor && serviceFor > 0 ? serviceFor : dwell
  const ramp = Math.max(0.5, Math.min(3, total * 0.2))
  return smooth(Math.min((total - dwell) / ramp, dwell / ramp))
}

function smooth(x: number): number {
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x
  return t * t * (3 - 2 * t)
}

/** Catering scissor travel, belt-loader rise etc. in metres at ext = 1. */
export const LIFT_M = { catering: 2.4, kFront: 1.9, kRear: 0.9, hydrant: 1.0 } as const

const _v = new THREE.Vector3()
const _e = new THREE.Euler(0, 0, 0, 'YZX')

/**
 * Pose for one part. Returns false when the part has no motion for this model
 * (the caller can use identity). `active` = beacons / light bar running.
 */
export function partPose(model: VehicleModel, part: string, ext: number, clock: number, active: boolean, out: PartPose): boolean {
  const [L, H, W] = MODEL_SIZE[model]
  const e = ext <= 0 ? 0 : ext >= 1 ? 1 : ext
  const working = e >= 0.999
  switch (model) {
    case 'fuel_tanker':
    case 'hydrant_cart': {
      const tanker = model === 'fuel_tanker'
      const reelX = tanker ? -L / 2 + 0.55 : -1.53
      if (part === 'hose_reel') {
        reset(out, reelX, tanker ? 2.2 : 1.87, 0).rz = -e * 9
        return true
      }
      if (part === 'hose') {
        reset(out, reelX, tanker ? 1.9 : 0.92, W / 2).sz = Math.max(0.02, e)
        return true
      }
      if (part === 'lift_platform') {
        reset(out).ty = e * LIFT_M.hydrant
        return true
      }
      return false
    }
    case 'belt_loader': {
      if (part !== 'belt' && part !== 'belt_bags') return false
      const pitch = 0.1737
      const rz = -pitch * 0.85 * (1 - e) + 0.1 * e
      reset(out, -3.6, 1.1, 0).rz = rz
      if (part === 'belt_bags') {
        // Bags ride up the belt while it runs; hidden when stowed.
        if (!working) {
          out.sx = out.sy = out.sz = 0.0001
          return true
        }
        const spacing = 0.3 * L
        const s = ((clock * 1.1) % spacing) - spacing / 2
        const a = pitch + rz
        out.tx = Math.cos(a) * s
        out.ty = Math.sin(a) * s
      }
      return true
    }
    case 'catering_hilift': {
      const lift = e * LIFT_M.catering
      if (part === 'scissor') {
        reset(out, 0, 0.63, 0).sy = 1 + lift / 0.74
        return true
      }
      if (part === 'box') {
        reset(out).ty = lift
        return true
      }
      if (part === 'deck') {
        reset(out).ty = lift
        out.tx = e * 0.9
        return true
      }
      return false
    }
    case 'k_loader':
      if (part === 'front_platform') {
        reset(out).ty = e * LIFT_M.kFront
        return true
      }
      if (part === 'rear_platform') {
        reset(out).ty = e * LIFT_M.kRear
        return true
      }
      return false
    case 'deice': {
      const px = 1.9
      const py = 1.65
      const rz = e * 0.75
      const ry = e * 0.6 * Math.sin(clock * 0.35)
      if (part === 'boom') {
        reset(out, px, py, 0)
        out.rz = rz
        out.ry = ry
        return true
      }
      if (part === 'basket') {
        // Basket rides the boom tip but stays level.
        const cx = L / 2 - 0.6
        const cy = H - 0.4
        _e.set(0, ry, rz, 'YZX')
        _v.set(cx - px, cy - py, 0).applyEuler(_e)
        reset(out)
        out.tx = _v.x + px - cx
        out.ty = _v.y + py - cy
        out.tz = _v.z
        return true
      }
      return false
    }
    case 'apron_bus':
    case 'coach':
      if (part !== 'doors') return false
      reset(out).tx = e * (model === 'coach' ? -0.85 : 0.72)
      return true
    case 'arff': {
      const spray = working && active
      if (part === 'lightbar') {
        reset(out, L / 2 - 1.4, H, 0)
        if (active && Math.floor(clock * 4) % 2 === 1) out.sx = out.sy = out.sz = 0.0001
        return true
      }
      if (part === 'roof_turret') {
        reset(out, 3.2, H + 0.18, 0)
        out.rz = spray ? 0.3 : 0
        out.ry = spray ? 0.7 * Math.sin(clock * 0.6) : 0
        return true
      }
      if (part === 'bumper_turret') {
        reset(out, L / 2 + 0.2, 1.07, 0)
        out.ry = spray ? 0.5 * Math.sin(clock * 0.9 + 1) : 0
        return true
      }
      if (part === 'locker_doors') {
        reset(out, 0, 2.82, 0).sy = 1 - 0.8 * e
        return true
      }
      return false
    }
    case 'box_truck':
      if (part === 'rollup_door') {
        reset(out, 0, H - 0.1, 0).sy = 1 - 0.88 * e
        return true
      }
      if (part === 'tail_lift') {
        reset(out).ty = -e * 0.75
        out.tx = -e * 0.5
        return true
      }
      return false
    case 'towbar_tug':
      if (part !== 'towbar') return false
      reset(out, 2.2, 0.37, 0).rz = (1 - e) * 1.1
      return true
    case 'towbarless_tug':
      if (part !== 'cradle') return false
      reset(out, -L * 0.25, 0.3, 0).ty = e * 0.35
      out.sz = 1 - 0.25 * e
      return true
    case 'gpu':
      if (part !== 'cable_reel') return false
      reset(out, L * 0.18, H + 0.15, 0).rz = -e * 6
      return true
    case 'stairs':
      if (part !== 'stair' && part !== 'canopy') return false
      reset(out, 1.9, 1.0, 0).rz = (1 - e) * 0.22
      return true
    default:
      return false
  }
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _t = new THREE.Vector3()

/** Local part matrix: T(pivot + t) * R * S * T(-pivot). Writes into `out`. */
export function partMatrix(p: PartPose, out: THREE.Matrix4): THREE.Matrix4 {
  _e.set(p.rx, p.ry, p.rz, 'YZX')
  _q.setFromEuler(_e)
  _s.set(p.sx, p.sy, p.sz)
  _t.set(p.px + p.tx, p.py + p.ty, p.pz + p.tz)
  out.compose(_t, _q, _s)
  _m.makeTranslation(-p.px, -p.py, -p.pz)
  return out.multiply(_m)
}

const _pose = newPartPose()

/** Pose every animated child of a vehicleRig() group in place. */
export function poseVehicleRig(rig: THREE.Object3D, model: VehicleModel, ext: number, clock: number, active = false) {
  for (const child of rig.children) {
    if (!child.name || child.name === 'body' || child.name === 'lights') continue
    if (!partPose(model, child.name, ext, clock, active, _pose)) continue
    child.matrixAutoUpdate = false
    partMatrix(_pose, child.matrix)
    child.matrixWorldNeedsUpdate = true
  }
}
