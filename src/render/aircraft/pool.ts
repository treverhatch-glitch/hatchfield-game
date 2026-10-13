import * as THREE from 'three'
import type { Livery } from './specs'

const geos = new Map<string, THREE.BufferGeometry>()
const mats = new Map<string, THREE.Material>()

export function sharedGeo(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = geos.get(key)
  if (!geo) {
    geo = build()
    geo.name = key
    geos.set(key, geo)
  }
  return geo
}

export function sharedMat(key: string, build: () => THREE.Material): THREE.Material {
  let mat = mats.get(key)
  if (!mat) {
    mat = build()
    mat.name = key
    mats.set(key, mat)
  }
  return mat
}

export function unitBox(): THREE.BufferGeometry {
  return sharedGeo('box', () => new THREE.BoxGeometry(1, 1, 1))
}

export function unitCylinder(sides: number): THREE.BufferGeometry {
  return sharedGeo(`cyl:${sides}`, () => new THREE.CylinderGeometry(1, 1, 1, sides))
}

export function unitSphere(): THREE.BufferGeometry {
  return sharedGeo('sphere', () => new THREE.SphereGeometry(1, 6, 5))
}

export function unitPlane(): THREE.BufferGeometry {
  return sharedGeo('plane', () => new THREE.PlaneGeometry(1, 1))
}

/** Prop disc lies in YZ so it can spin on local X. Rotor disc lies in XZ. */
export function unitDisc(kind: 'prop' | 'rotor'): THREE.BufferGeometry {
  return sharedGeo(`disc:${kind}`, () => {
    const geo = new THREE.CircleGeometry(1, kind === 'rotor' ? 10 : 7)
    if (kind === 'prop') geo.rotateY(Math.PI / 2)
    else geo.rotateX(-Math.PI / 2)
    return geo
  })
}

export type PaintSlot =
  | 'body'
  | 'stripe'
  | 'tail'
  | 'belly'
  | 'metal'
  | 'dark'
  | 'glass'
  | 'rubber'
  | 'navRed'
  | 'navGreen'
  | 'navWhite'
  | 'beacon'

function shade(hex: string, factor: number): string {
  const color = new THREE.Color(hex)
  color.multiplyScalar(factor)
  return `#${color.getHexString()}`
}

export function slotColor(slot: PaintSlot, livery: Livery): string {
  switch (slot) {
    case 'body':
      return livery.body
    case 'stripe':
      return livery.stripe
    case 'tail':
      return livery.tail || livery.stripe
    case 'belly':
      return shade(livery.body, 0.58)
    case 'metal':
      return '#4a545c'
    case 'dark':
      return '#14181d'
    case 'glass':
      return '#1a3c52'
    case 'rubber':
      return '#1a1c1e'
    case 'navRed':
      return '#ff2a2a'
    case 'navGreen':
      return '#39f07a'
    case 'navWhite':
      return '#f5f8ff'
    case 'beacon':
      return '#ff4036'
    default:
      return '#888888'
  }
}

function isLamp(slot: PaintSlot): boolean {
  return slot === 'beacon' || slot.startsWith('nav')
}

export interface PaintedMesh extends THREE.Mesh {
  userData: THREE.Mesh['userData'] & {
    opaqueMat: THREE.Material
    fadeMat: THREE.Material
    lodOpacity: number
    kind: string
    tier: string
  }
}

/**
 * Far shells stay unlit. The mid shell is one standard material (paint or bare metal).
 * Gear, lamps, and control surfaces stay Lambert so the close view does not compile a shader per part.
 * A bump map for panel lines cost about 3 FPS on SwiftShader, so the shell stays smooth.
 */
export function vertexMaterials(
  tier: 'low' | 'mid',
  finish: 'paint' | 'metal' = 'paint',
): { opaque: THREE.Material; fade: THREE.Material } {
  const unlit = tier === 'low'
  const metal = !unlit && finish === 'metal'
  const key = unlit ? 'vc:basic' : metal ? 'vc:metal' : 'vc:standard'
  const mat = sharedMat(key, () => {
    if (unlit) return new THREE.MeshBasicMaterial({ vertexColors: true })
    // Nacelles stay Lambert so the close view compiles one physical shader, on the painted shell.
    if (metal) return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.18,
      roughness: 0.46,
    })
  })
  const fade = sharedMat(`fade:${key}`, () => {
    const copy = mat.clone()
    copy.transparent = true
    copy.opacity = 1
    copy.depthWrite = true
    return copy
  })
  return { opaque: mat, fade }
}

export function paintMesh(
  mesh: THREE.Mesh,
  slot: PaintSlot,
  livery: Livery,
  kind: string,
  tier: string,
): PaintedMesh {
  const color = slotColor(slot, livery)
  const unlit = tier === 'low' || isLamp(slot)
  const key = `${unlit ? 'basic' : 'lambert'}:${slot}:${color}`
  const mat = sharedMat(key, () =>
    unlit
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshLambertMaterial({ color, flatShading: true }),
  )
  mesh.userData.paint = color
  mesh.userData.slot = slot
  if (isLamp(slot)) mesh.frustumCulled = true
  const fade = sharedMat(`fade:${key}`, () => {
    const copy = mat.clone()
    copy.transparent = true
    copy.opacity = 1
    copy.depthWrite = true
    return copy
  }) as THREE.Material & { opacity: number }
  mesh.material = mat
  mesh.userData.opaqueMat = mat
  mesh.userData.fadeMat = fade
  mesh.userData.lodOpacity = 1
  mesh.userData.kind = kind
  mesh.userData.tier = tier
  mesh.onBeforeRender = () => {
    if (mesh.material === fade) fade.opacity = mesh.userData.lodOpacity as number
  }
  return mesh as PaintedMesh
}

/** One shared material for a baked shell. Colors live on the geometry. */
export function paintVertexMesh(
  mesh: THREE.Mesh,
  tier: 'low' | 'mid',
  kind: string,
  finish: 'paint' | 'metal' = 'paint',
): PaintedMesh {
  const { opaque, fade } = vertexMaterials(tier, finish)
  const fadeMat = fade as THREE.Material & { opacity: number }
  mesh.material = opaque
  mesh.userData.opaqueMat = opaque
  mesh.userData.fadeMat = fadeMat
  mesh.userData.lodOpacity = 1
  mesh.userData.kind = kind
  mesh.userData.tier = tier
  mesh.onBeforeRender = () => {
    if (mesh.material === fadeMat) fadeMat.opacity = mesh.userData.lodOpacity as number
  }
  return mesh as PaintedMesh
}

export function libraryStats(): { geometries: number; materials: number } {
  return { geometries: geos.size, materials: mats.size }
}

/** Drop pooled GPU buffers. Safe after every aircraft has been released. */
export function disposeAircraftLibrary() {
  for (const geo of geos.values()) geo.dispose()
  geos.clear()
  for (const mat of mats.values()) mat.dispose()
  mats.clear()
}

/**
 * Detach an aircraft without disposing shared geometries or materials.
 * Instanced meshes still release their own instance buffers.
 */
export function releaseAircraft(root: THREE.Object3D) {
  root.traverse((obj) => {
    obj.onBeforeRender = () => {}
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      ;(obj as THREE.InstancedMesh).dispose()
    }
  })
  root.removeFromParent()
}
