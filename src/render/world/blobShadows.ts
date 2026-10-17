/**
 * Soft ground shadows for moving things (ground vehicles, aircraft on the ground).
 * One instanced quad per object, offset along the sun direction. Cheap, no depth pass,
 * so it works at every zoom and on every quality tier, by day and (softer) at night.
 */
import * as THREE from 'three'

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
  day: 0.7,
  night: 0.36,
  y: 0.05,
  /** Max ground offset as a multiple of caster height. */
  maxOffset: 2.2,
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
  private readonly dummy = new THREE.Object3D()
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
   * @param sunDir direction from the ground toward the sun (any length)
   * @param daylight 1 = day, 0 = night
   */
  sync(list: readonly BlobCaster[], sunDir: THREE.Vector3, daylight: number) {
    const n = Math.min(list.length, this.cap)
    const len = Math.hypot(sunDir.x, sunDir.y, sunDir.z) || 1
    const sy = Math.max(0.35, sunDir.y / len)
    const ox = -sunDir.x / len / sy
    const oz = -sunDir.z / len / sy
    const d = Math.max(0, Math.min(1, daylight))
    this.mat.opacity = BLOB_LOOK.night + (BLOB_LOOK.day - BLOB_LOOK.night) * d
    for (let i = 0; i < n; i++) {
      const c = list[i]
      const lift = c.lift ?? 0
      const k = Math.min(c.height * 0.55 + lift, BLOB_LOOK.maxOffset * Math.max(c.height, 0.01) + lift)
      // Shadow falls away from the sun; airborne casters shrink and fade with height.
      const shrink = 1 / (1 + lift * 0.12)
      this.dummy.position.set(c.x + ox * k, c.y - lift + BLOB_LOOK.y, c.z + oz * k)
      this.dummy.rotation.set(0, c.yaw, 0)
      this.dummy.scale.set((c.length * 1.2 + c.height * 0.5) * shrink, 1, (c.width * 1.45 + c.height * 0.3) * shrink)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.fade.setX(i, (c.alpha ?? 1) * Math.min(1, shrink * shrink * 1.1))
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
