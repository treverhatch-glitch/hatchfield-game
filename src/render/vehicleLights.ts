/**
 * Vehicle headlights. One instanced lamp draw for every truck and service
 * vehicle, plus a ground pool on Medium and High. Low keeps the lamps and
 * skips the pool. Brightness comes from the day/night sample.
 */
import * as THREE from 'three'

export interface HeadlightSpec {
  length: number
  width: number
  /** Roof height, world units (beacon halo sits on it). */
  height?: number
  /** Amber beacon running (moving or working at a stand). */
  beacon?: boolean
}

const BEACON_CAP = 160

/** Round F: amber beacon flash 0..1 for one vehicle; phase-offset per vehicle so a fleet doesn't blink in sync. */
export function beaconFlash(clock: number, seed: number): number {
  const t = (clock * 1.6 + seed * 0.37) % 1
  return t < 0.5 ? 0.35 + 0.65 * Math.sin(t * Math.PI * 2) : 0.35
}

const LAMP_CAP = 160
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _e = new THREE.Euler(0, 0, 0, 'YXZ')

export class VehicleHeadlights {
  readonly group = new THREE.Group()
  private lamps: THREE.InstancedMesh
  private lampMat: THREE.MeshBasicMaterial
  private pool: THREE.InstancedMesh | null = null
  private poolMat: THREE.MeshBasicMaterial | null = null
  private poolGeo: THREE.BufferGeometry | null = null
  private lampGeo: THREE.BufferGeometry
  private beaconGeo: THREE.BufferGeometry
  private beaconMat: THREE.PointsMaterial
  private beacons: THREE.Points

  constructor() {
    this.group.name = 'vehicle-headlights'
    this.lampGeo = new THREE.SphereGeometry(0.11, 6, 4)
    this.lampMat = new THREE.MeshBasicMaterial({
      color: 0xfff1c2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    })
    this.lamps = new THREE.InstancedMesh(this.lampGeo, this.lampMat, LAMP_CAP)
    this.lamps.name = 'vehicle-headlight-lamps'
    this.lamps.frustumCulled = false
    this.lamps.count = 0
    this.lamps.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.group.add(this.lamps)
    // Round F: beacon halos. One Points draw for the whole fleet, additive, colour = brightness.
    this.beaconGeo = new THREE.BufferGeometry()
    this.beaconGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BEACON_CAP * 3), 3).setUsage(THREE.DynamicDrawUsage))
    this.beaconGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(BEACON_CAP * 3), 3).setUsage(THREE.DynamicDrawUsage))
    this.beaconGeo.setDrawRange(0, 0)
    this.beaconMat = new THREE.PointsMaterial({
      size: 2.6,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      map: haloTexture(),
    })
    this.beaconMat.userData.noGrade = true
    this.beacons = new THREE.Points(this.beaconGeo, this.beaconMat)
    this.beacons.name = 'vehicle-beacon-halos'
    this.beacons.frustumCulled = false
    this.beacons.renderOrder = 6
    this.group.add(this.beacons)
  }

  /**
   * `roots` are vehicle groups already placed in world space.
   * `userData.headlight` supplies the footprint; missing specs use a van.
   */
  sync(roots: readonly THREE.Object3D[], level: number, pools: boolean, clock = 0) {
    const on = level > 0.04 && roots.length > 0
    this.group.visible = on
    this.lampMat.opacity = Math.min(1, level)
    if (!on) {
      this.lamps.count = 0
      if (this.pool) this.pool.count = 0
      this.beaconGeo.setDrawRange(0, 0)
      return
    }
    this.syncBeacons(roots, level, clock)
    const usePools = pools && level > 0.08
    if (usePools) this.ensurePools()
    else if (this.pool) this.pool.count = 0

    let lamps = 0
    let poolsN = 0
    for (const root of roots) {
      if (lamps + 2 > LAMP_CAP) break
      const spec = headlightSpec(root)
      const yaw = root.rotation.y
      const fx = Math.cos(yaw)
      const fz = -Math.sin(yaw)
      const sx = Math.sin(yaw)
      const sz = Math.cos(yaw)
      const reach = spec.length * 0.46
      const side = Math.max(0.18, spec.width * 0.28)
      const hy = 0.42
      _e.set(0, yaw, 0)
      _q.setFromEuler(_e)
      _s.set(1, 1, 1)
      for (const hand of [-1, 1]) {
        _p.set(
          root.position.x + fx * reach + sx * side * hand,
          hy,
          root.position.z + fz * reach + sz * side * hand,
        )
        _m.compose(_p, _q, _s)
        this.lamps.setMatrixAt(lamps, _m)
        lamps += 1
      }
      if (usePools && this.pool && poolsN < LAMP_CAP / 2) {
        _p.set(root.position.x + fx * (reach + 1.5), 0.07, root.position.z + fz * (reach + 1.5))
        _m.compose(_p, _q, _s.set(1.1, 1, 2.4))
        _s.set(1, 1, 1)
        this.pool.setMatrixAt(poolsN, _m)
        poolsN += 1
      }
    }
    this.lamps.count = lamps
    this.lamps.instanceMatrix.needsUpdate = true
    if (this.pool && this.poolMat) {
      this.pool.count = poolsN
      this.pool.visible = poolsN > 0
      this.pool.instanceMatrix.needsUpdate = true
      this.poolMat.opacity = Math.min(0.6, level * 0.55)
    }
  }

  /** Beacon halos on vehicles whose beacon runs; brightness follows the night level. */
  private syncBeacons(roots: readonly THREE.Object3D[], level: number, clock: number) {
    const pos = this.beaconGeo.getAttribute('position') as THREE.BufferAttribute
    const col = this.beaconGeo.getAttribute('color') as THREE.BufferAttribute
    let n = 0
    for (let i = 0; i < roots.length && n < BEACON_CAP; i++) {
      const root = roots[i]
      const spec = headlightSpec(root)
      if (!spec.beacon) continue
      const f = beaconFlash(clock, i)
      pos.setXYZ(n, root.position.x, root.position.y + (spec.height ?? 1.2) + 0.1, root.position.z)
      col.setXYZ(n, 1.0 * f, 0.62 * f, 0.12 * f)
      n++
    }
    this.beaconGeo.setDrawRange(0, n)
    pos.needsUpdate = n > 0
    col.needsUpdate = n > 0
    this.beaconMat.opacity = Math.min(1, level * 1.2)
    this.beacons.visible = n > 0
  }

  /** Beacon halos drawn this frame (tests, perf overlay). */
  get beaconCount(): number {
    return this.beaconGeo.drawRange.count
  }

  dispose() {
    this.beaconGeo.dispose()
    this.beaconMat.map?.dispose()
    this.beaconMat.dispose()
    this.lamps.dispose()
    this.lampGeo.dispose()
    this.lampMat.dispose()
    this.pool?.dispose()
    this.poolGeo?.dispose()
    this.poolMat?.map?.dispose()
    this.poolMat?.dispose()
    this.group.removeFromParent()
  }

  private ensurePools() {
    if (this.pool) return
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    this.poolGeo = geo
    // Round F: soft round falloff instead of a hard-edged quad.
    this.poolMat = new THREE.MeshBasicMaterial({
      map: haloTexture(),
      color: 0xffe2a8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    this.pool = new THREE.InstancedMesh(geo, this.poolMat, LAMP_CAP / 2)
    this.pool.name = 'vehicle-headlight-pools'
    this.pool.frustumCulled = false
    this.pool.count = 0
    this.pool.renderOrder = 3
    this.pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.group.add(this.pool)
  }
}

function headlightSpec(root: THREE.Object3D): HeadlightSpec {
  const raw = root.userData.headlight as Partial<HeadlightSpec> | undefined
  const length = raw && Number.isFinite(raw.length) ? raw.length! : 2.4
  const width = raw && Number.isFinite(raw.width) ? raw.width! : 1.1
  const height = raw && Number.isFinite(raw.height) ? raw.height : undefined
  return { length: Math.max(0.4, length), width: Math.max(0.3, width), height, beacon: raw?.beacon === true }
}

/** Soft round sprite for the beacon halos (built once, 32 px). */
function haloTexture(): THREE.DataTexture {
  const N = 32
  const data = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2)
      const a = Math.max(0, 1 - d)
      const i = (y * N + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(255 * a * a)
    }
  const tex = new THREE.DataTexture(data, N, N)
  tex.needsUpdate = true
  return tex
}
