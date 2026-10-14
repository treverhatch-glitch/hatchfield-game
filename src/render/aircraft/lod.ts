import * as THREE from 'three'
import { easeMotion, MOTION_RUNNING, type AircraftMotion } from './motion'
import type { PaintedMesh } from './pool'
import { poseRig, rigValue, type RigSet } from './rig'

/**
 * Camera-to-aircraft distance in world units.
 * The apron camera orbits between 22 and 150 (default 54), so the default
 * view sits on the close band and pulling back crosses into the mid mesh.
 *
 * High detail is additive (windows, doors, fans, bogies) on top of the mid
 * mesh, so the close transition cannot pop the silhouette. The cheap mesh
 * only replaces the mid mesh once the aircraft is small on screen, and the
 * two crossfade across `mid` → `low`.
 */
export const LOD_DIST = {
  /** Windows, doors, fans, and gear detail are fully in closer than this. */
  high: 46,
  /** High detail has finished fading out. Mid body stays fully visible. */
  highBlend: 68,
  /** Cheap silhouette starts to replace the mid mesh. */
  mid: 102,
  /** Only the cheap silhouette remains beyond this. */
  low: 128,
} as const

/** How fast displayed weights chase the distance target, per second. */
export const LOD_RESPONSE = 10

export type AircraftQuality = 'low' | 'med' | 'high'

const QUALITY_KEY = 'hatchfield-aircraft-quality'
let quality: AircraftQuality = 'high'

/** Low forces the cheap shell. Med never enters the close band. High uses every band. */
export function getAircraftQuality(): AircraftQuality {
  return quality
}

export function setAircraftQuality(next: AircraftQuality) {
  quality = next
  try {
    localStorage.setItem(QUALITY_KEY, next)
  } catch {
    // Storage is unavailable in some private windows.
  }
}

export function loadAircraftQuality() {
  try {
    const saved = localStorage.getItem(QUALITY_KEY)
    if (saved === 'low' || saved === 'med' || saved === 'high') quality = saved
  } catch {
    // Ignore storage failures and keep the in-memory setting.
  }
}

let night = false
/** 0 = day lamps, 1 = full nav and beacon. The sim sets this once per frame. */
let lamp = 0

/** Brightness for nav, strobe, and beacon lamps. Values above 0.45 count as night. */
export function setAircraftLamp(level: number) {
  lamp = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0))
  night = lamp > 0.45
}

/** Day/night lamp scale. The sim sets this once per frame. */
export function setAircraftNight(on: boolean) {
  setAircraftLamp(on ? 1 : 0)
}

export function aircraftIsNight(): boolean {
  return night
}

export function aircraftLamp(): number {
  return lamp
}

export interface LodWeights {
  high: number
  mid: number
  low: number
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Continuous weights. High is additive; mid + low blend to 1. Quality clamps the top band. */
export function lodWeights(distance: number): LodWeights {
  let high = 1 - smoothstep(LOD_DIST.high, LOD_DIST.highBlend, distance)
  const low = smoothstep(LOD_DIST.mid, LOD_DIST.low, distance)
  let mid = 1 - low
  if (quality === 'low') {
    high = 0
    mid = 0
    return { high, mid, low: 1 }
  }
  if (quality === 'med') high = 0
  return { high, mid, low }
}

export interface LodBuckets {
  lowGroup: THREE.Group
  midGroup: THREE.Group
  highGroup: THREE.Group
  low: PaintedMesh[]
  mid: PaintedMesh[]
  high: PaintedMesh[]
  spinners: THREE.Object3D[]
  gears: THREE.Object3D[]
  strobes: THREE.Object3D[]
  beacons: THREE.Object3D[]
  lamps: THREE.Object3D[]
  /** Flaps, slats, reversers and door leaves. */
  rigs?: RigSet[]
}

const _cam = new THREE.Vector3()
const _lod = new THREE.Vector3()
const _proj = new THREE.Matrix4()
const _frustum = new THREE.Frustum()

export function cameraDistance(object: THREE.Object3D, camera: THREE.Camera): number {
  _cam.setFromMatrixPosition(camera.matrixWorld)
  _lod.setFromMatrixPosition(object.matrixWorld)
  const zoom = (camera as THREE.PerspectiveCamera).zoom || 1
  return _cam.distanceTo(_lod) / zoom
}

function cullLamps(lamps: THREE.Object3D[], camera: THREE.Camera) {
  _proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  _frustum.setFromProjectionMatrix(_proj)
  for (const lamp of lamps) {
    if (!lamp.visible) continue
    const mesh = lamp as THREE.Mesh
    if (!mesh.isMesh) continue
    lamp.visible = _frustum.intersectsObject(mesh)
  }
}

function applyMeshes(meshes: PaintedMesh[], weight: number, nearHigh: number) {
  for (const mesh of meshes) {
    const band = mesh.userData.kind === 'band'
    const w = band ? weight * (1 - nearHigh) : weight
    mesh.userData.lodOpacity = w
    if (w <= 0.02) {
      mesh.visible = false
      continue
    }
    mesh.visible = true
    mesh.material = w >= 0.985 ? mesh.userData.opaqueMat : mesh.userData.fadeMat
  }
}

/**
 * Distance crossfade. Subclasses THREE.LOD so the renderer calls `update`
 * every frame, but does not hard-switch levels (that pops).
 */
export class CrossfadeLOD extends THREE.LOD {
  wHigh = 0
  wMid = 1
  wLow = 0
  gearT = 1
  posed = false
  lastT = -1
  buckets: LodBuckets | null = null
  /** Builds window instances the first time this aircraft enters the high band. */
  requestWindows: (() => void) | null = null
  windowsReady = false
  /** Eased motion actually drawn. */
  motion: AircraftMotion = { ...MOTION_RUNNING }
  spinAngle = 0
  motionPosed = false

  constructor() {
    super()
    this.autoUpdate = true
  }

  update(camera: THREE.Camera) {
    const buckets = this.buckets
    if (!buckets) return
    const dist = cameraDistance(this, camera)
    const target = lodWeights(dist)
    const now = performance.now() * 0.001
    const dt = this.lastT < 0 ? 0 : Math.min(0.05, now - this.lastT)
    this.lastT = now
    const gearDown = this.parent?.userData.gearDown !== false
    if (!this.windowsReady && this.requestWindows && getAircraftQuality() === 'high' && target.high > 0.02) {
      this.windowsReady = true
      this.requestWindows()
    }
    if (!this.posed) {
      this.wHigh = target.high
      this.wMid = target.mid
      this.wLow = target.low
      this.gearT = gearDown ? 1 : 0
      this.posed = true
    } else {
      const k = 1 - Math.exp(-LOD_RESPONSE * dt)
      this.wHigh += (target.high - this.wHigh) * k
      this.wMid += (target.mid - this.wMid) * k
      this.wLow += (target.low - this.wLow) * k
      const gK = 1 - Math.exp(-8 * dt)
      const gTarget = gearDown ? 1 : 0
      this.gearT += (gTarget - this.gearT) * gK
    }

    buckets.lowGroup.visible = this.wLow > 0.02
    buckets.midGroup.visible = this.wMid > 0.02
    buckets.highGroup.visible = this.wHigh > 0.02
    if (buckets.lowGroup.visible) applyMeshes(buckets.low, this.wLow, this.wHigh)
    if (buckets.midGroup.visible) applyMeshes(buckets.mid, this.wMid, this.wHigh)
    if (buckets.highGroup.visible) applyMeshes(buckets.high, this.wHigh, this.wHigh)
    cullLamps(buckets.lamps, camera)

    const gearScale = Math.max(0.0001, this.gearT)
    for (const gear of buckets.gears) gear.scale.y = gearScale

    const goal = (this.parent?.userData.motion as AircraftMotion | undefined) ?? MOTION_RUNNING
    if (!this.motionPosed) {
      Object.assign(this.motion, goal)
      this.motionPosed = true
    } else {
      easeMotion(this.motion, goal, dt)
    }
    // Shut-down engines still windmill a little.
    this.spinAngle += dt * (0.04 + this.motion.spool * 0.96)
    const a = this.spinAngle
    for (const spinner of buckets.spinners) {
      if (spinner.name === 'rotor' || spinner.name === 'tail-rotor') {
        if (spinner.name === 'tail-rotor') spinner.rotation.z = a * 22
        else spinner.rotation.y = a * 11
      } else {
        spinner.rotation.x = a * (spinner.name === 'fan' ? 28 : 14)
      }
    }
    if (buckets.rigs) {
      for (const rig of buckets.rigs) {
        if (rig.posed >= 0 && rig.mesh.parent && !rig.mesh.parent.visible) continue
        poseRig(rig, rigValue(rig.kind, this.motion))
      }
    }

    const nightScale = 0.85 + lamp * 0.7
    for (const lamp of buckets.lamps) {
      const kind = lamp.userData.kind as string
      if (kind === 'strobe' || kind === 'beacon') continue
      const base = (lamp.userData.baseScale as number) || 1
      lamp.scale.setScalar(base * nightScale)
    }
    const strobe = Math.pow(Math.max(0, Math.sin(now * 9)), 18)
    const beacon = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 5))
    for (const lamp of buckets.strobes) {
      const base = (lamp.userData.baseScale as number) || 1
      lamp.scale.setScalar(base * nightScale * (0.7 + strobe * 1.15))
    }
    for (const lamp of buckets.beacons) {
      const base = (lamp.userData.baseScale as number) || 1
      lamp.scale.setScalar(base * nightScale * (0.75 + beacon * 0.45))
    }

    const ail = Math.sin(now * 0.7) * 0.18
    const elev = Math.sin(now * 0.5) * 0.12
    const rud = Math.sin(now * 0.4) * 0.15
    for (const mesh of buckets.mid) {
      const surface = mesh.userData.surface as string | undefined
      if (!surface) continue
      const sign = (mesh.userData.sign as number) || 1
      if (surface === 'aileron') mesh.rotation.z = ail * sign
      else if (surface === 'elevator') mesh.rotation.z = elev
      else if (surface === 'rudder') mesh.rotation.y = rud * sign
    }
  }
}
