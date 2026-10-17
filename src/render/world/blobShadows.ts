/**
 * Soft ground shadows for moving things (ground vehicles, aircraft on the ground).
 * One instanced quad per object, offset along the sun direction. Cheap, no depth pass,
 * so it works at every zoom and on every quality tier, by day and (softer) at night.
 */
import * as THREE from 'three'
import { shadowCast } from '../../core/sunPath.ts'

export interface BlobCaster {
  x: number
  y: number
  z: number
  yaw: number
  /** Footprint length (local X) and width (local Z), world units. */
  length: number
  width: number
  /** Height of the caster's mass above its base, world units (drives the sun offset). */
  height: number
  /** Extra lift of the caster above the ground (airborne aircraft), world units. */
  lift?: number
  /** Opacity multiplier, 0–1. */
  alpha?: number
}

export const BLOB_LOOK = {
  day: 0.9,
  night: 0.55,
  y: 0.05,
  /** Minimum sun-side spill (× caster height) so a shadow still shows beside the body under a high sun. */
  minSpill: 0.45,
} as const

let sharedTex: THREE.DataTexture | null = null
/** Rounded-rectangle soft blob (superellipse falloff), alpha in the red channel via alphaMap. */
export function blobTexture(size = 64): THREE.DataTexture {
  if (sharedTex) return sharedTex
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1
      const v = ((y + 0.5) / size) * 2 - 1
      const d = Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25)
      const a = Math.max(0, Math.min(1, (1 - d) / 0.45))
      const s = a * a * (3 - 2 * a)
      const i = (y * size + x) * 4
      const g = Math.round(s * 255)
      data[i] = g
      data[i + 1] = g
      data[i + 2] = g
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  sharedTex = tex
  return tex
}

export class BlobShadows {
  readonly mesh: THREE.InstancedMesh
  private readonly mat: THREE.MeshBasicMaterial
  private readonly fade: THREE.InstancedBufferAttribute
  private cap: number

  constructor(name: string, cap = 256) {
    this.cap = cap
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1)
    this.fade.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('blobAlpha', this.fade)
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      alphaMap: blobTexture(),
      transparent: true,
      opacity: BLOB_LOOK.day,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    })
    this.mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float blobAlpha;\nvarying float vBlobAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlobAlpha = blobAlpha;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vBlobAlpha;')
        .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vBlobAlpha;')
    }
    this.mesh = new THREE.InstancedMesh(geo, this.mat, cap)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this.mesh.castShadow = false
    this.mesh.receiveShadow = false
    this.mesh.count = 0
    this.mesh.name = name
  }

  /**
   * @param sunDir direction from the ground toward the sun or moon (any length), i.e. the rig's
   *   time-of-day light from `core/sunPath.sunDirection(hour, season)`.
   * @param daylight 1 = day, 0 = night (moonlight: softer, still visible)
   */
  sync(list: readonly BlobCaster[], sunDir: THREE.Vector3, daylight: number) {
    const n = Math.min(list.length, this.cap)
    const d = Math.max(0, Math.min(1, daylight))
    this.mat.opacity = BLOB_LOOK.night + (BLOB_LOOK.day - BLOB_LOOK.night) * d
    const e = this.mesh.instanceMatrix.array as Float32Array
    for (let i = 0; i < n; i++) {
      const c = list[i]
      const lift = c.lift ?? 0
      const shrink = 1 / (1 + lift * 0.12)
      // Low sun: long shadow; high sun: short. Airborne casters slide along the same heading.
      const cast = shadowCast(sunDir, c.height, lift)
      const ux = cast.ux
      const uz = cast.uz
      const len = (c.length * 1.25 + c.height * 0.7) * shrink
      const wid = (c.width * 1.6 + c.height * 0.55) * shrink
      // Footprint axes in world space (yaw about +Y).
      const cy = Math.cos(c.yaw)
      const sy = Math.sin(c.yaw)
      const ax = cy * len
      const az = -sy * len
      const bx = sy * wid
      const bz = cy * wid
      // Stretch the footprint along the shadow heading by the cast length.
      const ext = Math.hypot(ax * ux + az * uz, bx * ux + bz * uz) || 1
      const throwLen = cast.castLength * shrink
      const k = throwLen / ext
      const da = k * (ax * ux + az * uz)
      const db = k * (bx * ux + bz * uz)
      // Centre: half the throw out from the base, plus the airborne slide; never fully hidden under the body.
      const off = Math.max(throwLen * 0.5, BLOB_LOOK.minSpill * c.height * shrink) + cast.slide
      const px = c.x + ux * off
      const py = c.y - lift + BLOB_LOOK.y
      const pz = c.z + uz * off
      const o = i * 16
      e[o] = ax + da * ux
      e[o + 1] = 0
      e[o + 2] = az + da * uz
      e[o + 3] = 0
      e[o + 4] = 0
      e[o + 5] = 1
      e[o + 6] = 0
      e[o + 7] = 0
      e[o + 8] = bx + db * ux
      e[o + 9] = 0
      e[o + 10] = bz + db * uz
      e[o + 11] = 0
      e[o + 12] = px
      e[o + 13] = py
      e[o + 14] = pz
      e[o + 15] = 1
      // Long shadows spread their darkness; airborne ones fade with height.
      const spread = 1 / (1 + 0.12 * (throwLen / Math.max(ext, 1e-3)))
      this.fade.setX(i, (c.alpha ?? 1) * Math.min(1, shrink * shrink * 1.1) * (0.55 + 0.45 * spread))
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
    this.fade.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mat.dispose()
  }
}
