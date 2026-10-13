import * as THREE from 'three'
import type { PaintedMesh } from './pool'

/**
 * Camera-to-aircraft distance in world units.
 * The apron camera orbits between 28 and 160 (default 88), so the default
 * view sits in the mid band and zooming in crosses into high detail.
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

/** Continuous weights. High is additive; mid + low blend to 1. */
export function lodWeights(distance: number): LodWeights {
  const high = 1 - smoothstep(LOD_DIST.high, LOD_DIST.highBlend, distance)
  const low = smoothstep(LOD_DIST.mid, LOD_DIST.low, distance)
  const mid = 1 - low
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
}

const _cam = new THREE.Vector3()
const _lod = new THREE.Vector3()

export function cameraDistance(object: THREE.Object3D, camera: THREE.Camera): number {
  _cam.setFromMatrixPosition(camera.matrixWorld)
  _lod.setFromMatrixPosition(object.matrixWorld)
  const zoom = (camera as THREE.PerspectiveCamera).zoom || 1
  return _cam.distanceTo(_lod) / zoom
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

    const gearScale = Math.max(0.0001, this.gearT)
    for (const gear of buckets.gears) gear.scale.y = gearScale

    for (const spinner of buckets.spinners) {
      if (spinner.name === 'rotor' || spinner.name === 'tail-rotor') {
        const speed = spinner.name === 'tail-rotor' ? 22 : 11
        if (spinner.name === 'tail-rotor') spinner.rotation.z = now * speed
        else spinner.rotation.y = now * speed
      } else {
        spinner.rotation.x = now * (spinner.name === 'fan' ? 28 : 14)
      }
    }

    const strobe = Math.pow(Math.max(0, Math.sin(now * 9)), 18)
    const beacon = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 5))
    for (const lamp of buckets.strobes) {
      const base = (lamp.userData.baseScale as number) || 1
      lamp.scale.setScalar(base * (0.7 + strobe * 1.15))
    }
    for (const lamp of buckets.beacons) {
      const base = (lamp.userData.baseScale as number) || 1
      lamp.scale.setScalar(base * (0.75 + beacon * 0.45))
    }
  }
}
