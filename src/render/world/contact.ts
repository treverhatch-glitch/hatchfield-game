/** Baked contact shadows: one multiply disc per terminal and stand. No depth pass. */
import * as THREE from 'three'
import { CONTACT_LOOK } from '../look'
import { clusterCenter, stands, terminals } from './layout'
import { trs } from './kit'
import { CELL, cellX, cellZ, type WorldView } from './view'

export interface ContactSpot {
  x: number
  z: number
  sx: number
  sz: number
}

/** Soft ovals under terminals (the big read) and a tighter one on each stand. */
export function contactSpots(view: WorldView): ContactSpot[] {
  const spots: ContactSpot[] = []
  for (const t of terminals(view)) {
    const c = clusterCenter(t.cluster)
    const w = (t.cluster.maxC - t.cluster.minC + 1) * CELL
    const d = (t.cluster.maxR - t.cluster.minR + 1) * CELL
    spots.push({ x: c.x, z: c.z, sx: w * 1.12, sz: d * 1.12 })
  }
  for (const s of stands(view)) {
    const span = s.cls === 'L' ? 2.2 : s.cls === 'M' ? 1.7 : 1.3
    spots.push({ x: cellX(s.c), z: cellZ(s.r), sx: CELL * span, sz: CELL * span * 0.82 })
  }
  return spots
}

function contactTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  const strength = CONTACT_LOOK.strength
  const power = CONTACT_LOOK.power
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      const falloff = Math.pow(Math.max(0, 1 - d), power)
      const alpha = Math.round(strength * falloff * 255)
      const i = (y * size + x) * 4
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = alpha
    }
  }
  const tex = new THREE.DataTexture(data, size, size)
  tex.colorSpace = THREE.NoColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/**
 * Premultiplied multiply: centre darkens the ground, the rim is unchanged.
 * `premultipliedAlpha` is required for three's MultiplyBlending.
 */
export class ContactShadows {
  readonly mesh: THREE.InstancedMesh
  private geo: THREE.BufferGeometry
  private mat: THREE.MeshBasicMaterial
  private tex: THREE.DataTexture
  private capacity: number

  constructor(capacity = 96) {
    this.capacity = capacity
    this.geo = new THREE.PlaneGeometry(1, 1)
    this.geo.rotateX(-Math.PI / 2)
    this.tex = contactTexture()
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      premultipliedAlpha: true,
      blending: THREE.MultiplyBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
    this.mat.userData.noGrade = true
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
    this.mesh.name = 'world-contact'
    this.mesh.receiveShadow = false
    this.mesh.castShadow = false
  }

  sync(spots: readonly ContactSpot[]) {
    const n = Math.min(spots.length, this.capacity)
    const y = CONTACT_LOOK.y
    for (let i = 0; i < n; i++) {
      const s = spots[i]
      this.mesh.setMatrixAt(i, trs(s.x, y, s.z, 0, s.sx, 1, s.sz))
    }
    this.mesh.count = n
    this.mesh.visible = n > 0
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.geo.dispose()
    this.mat.dispose()
    this.tex.dispose()
    this.mesh.dispose()
  }
}
