/**
 * Body parts as data. Every part is one shared geometry, drawn through one
 * InstancedMesh (or one Mesh in the static API) with a per-instance colour.
 * Coordinates are metres, feet at y = 0, the person faces +z.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { JointPose } from './pose.ts'
import type { PersonLook } from './types.ts'

export const HIP_Y = 0.88
export const SHOULDER_Y = 1.42
const ARM_X = 0.26
const LEG_X = 0.09

export type Attach = 'root' | 'upper' | 'legL' | 'legR' | 'armL' | 'armR'

export interface PartDef {
  id: string
  attach: Attach
  /** Levels (0 near, 1 mid, 2 block) that draw this part. */
  lods: readonly (0 | 1 | 2)[]
  when: (look: PersonLook) => boolean
  color: (look: PersonLook) => number
  build: () => THREE.BufferGeometry
}

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z)
}

function sphere(r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, wSeg = 8, hSeg = 6): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, wSeg, hSeg).scale(sx, sy, sz).translate(x, y, z)
}

function dome(r: number, y: number, z = 0, sy = 1, phi = Math.PI * 0.55): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, phi).scale(1, sy, 1).translate(0, y, z)
}

/** Merge pieces and give them a white colour attribute so one material fits all. */
function join(parts: THREE.BufferGeometry[], tint?: (piece: number) => number): THREE.BufferGeometry {
  parts.forEach((g, i) => {
    const n = g.getAttribute('position').count
    const rgb = new THREE.Color(tint ? tint(i) : 0xffffff)
    const arr = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) {
      arr[k * 3] = rgb.r
      arr[k * 3 + 1] = rgb.g
      arr[k * 3 + 2] = rgb.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  })
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false)
  merged.computeBoundingSphere()
  return merged
}

const any = () => true
const ALL: readonly (0 | 1 | 2)[] = [0, 1]
const NEAR: readonly (0 | 1 | 2)[] = [0]

export const PART_DEFS: readonly PartDef[] = [
  { id: 'torso', attach: 'upper', lods: ALL, when: any, color: (l) => l.top, build: () => join([box(0.4, 0.56, 0.22, 0, 1.15, 0)]) },
  { id: 'head', attach: 'upper', lods: [0], when: any, color: (l) => l.skin, build: () => join([sphere(0.115, 0, 1.62, 0.01, 0.95, 1.1, 1), box(0.07, 0.07, 0.07, 0, 1.5, 0)]) },
  { id: 'headLo', attach: 'upper', lods: [1], when: any, color: (l) => l.skin, build: () => join([box(0.2, 0.24, 0.22, 0, 1.6, 0)]) },
  { id: 'armL', attach: 'armL', lods: ALL, when: any, color: (l) => (l.sleeves || l.vest || l.crew ? l.top : l.skin), build: () => join([box(0.1, 0.58, 0.11, 0, -0.29, 0)]) },
  { id: 'armR', attach: 'armR', lods: ALL, when: any, color: (l) => (l.sleeves || l.vest || l.crew ? l.top : l.skin), build: () => join([box(0.1, 0.58, 0.11, 0, -0.29, 0)]) },
  { id: 'legL', attach: 'legL', lods: ALL, when: any, color: (l) => l.bottom, build: () => join([box(0.15, 0.82, 0.16, 0, -0.41, 0)]) },
  { id: 'legR', attach: 'legR', lods: ALL, when: any, color: (l) => l.bottom, build: () => join([box(0.15, 0.82, 0.16, 0, -0.41, 0)]) },
  { id: 'shoeL', attach: 'legL', lods: NEAR, when: any, color: (l) => l.shoes, build: () => join([box(0.16, 0.08, 0.27, 0, -0.84, 0.05)]) },
  { id: 'shoeR', attach: 'legR', lods: NEAR, when: any, color: (l) => l.shoes, build: () => join([box(0.16, 0.08, 0.27, 0, -0.84, 0.05)]) },
  // Hair.
  { id: 'hairShort', attach: 'upper', lods: NEAR, when: (l) => l.hair === 'short', color: (l) => l.hairColor, build: () => join([dome(0.125, 1.63, -0.005, 1.0)]) },
  {
    id: 'hairLong',
    attach: 'upper',
    lods: NEAR,
    when: (l) => l.hair === 'long',
    color: (l) => l.hairColor,
    build: () => join([dome(0.125, 1.63, -0.005, 1.0), box(0.25, 0.3, 0.07, 0, 1.5, -0.09)]),
  },
  {
    id: 'hairBun',
    attach: 'upper',
    lods: NEAR,
    when: (l) => l.hair === 'bun',
    color: (l) => l.hairColor,
    build: () => join([dome(0.125, 1.63, -0.005, 1.0), sphere(0.06, 0, 1.73, -0.1)]),
  },
  // Hats. Peaked covers the pilot and security caps, the colour tells them apart.
  { id: 'hatCap', attach: 'upper', lods: NEAR, when: (l) => l.hat === 'cap', color: (l) => l.hatColor, build: () => join([dome(0.13, 1.64, 0, 1, Math.PI * 0.5), box(0.2, 0.015, 0.12, 0, 1.64, 0.14)]) },
  { id: 'hatBeanie', attach: 'upper', lods: NEAR, when: (l) => l.hat === 'beanie', color: (l) => l.hatColor, build: () => join([dome(0.13, 1.63, 0, 1.15, Math.PI * 0.6)]) },
  {
    id: 'hatSun',
    attach: 'upper',
    lods: NEAR,
    when: (l) => l.hat === 'sunhat',
    color: (l) => l.hatColor,
    build: () => join([new THREE.CylinderGeometry(0.26, 0.26, 0.015, 10).translate(0, 1.7, 0), new THREE.CylinderGeometry(0.12, 0.13, 0.09, 10).translate(0, 1.745, 0)]),
  },
  {
    id: 'hatPeaked',
    attach: 'upper',
    lods: NEAR,
    when: (l) => l.hat === 'pilotCap' || l.hat === 'securityCap',
    color: (l) => l.hatColor,
    build: () => join([new THREE.CylinderGeometry(0.14, 0.135, 0.08, 10).translate(0, 1.725, 0), box(0.2, 0.012, 0.1, 0, 1.69, 0.15)], (i) => (i === 0 ? 0xffffff : 0x2a2a2a)),
  },
  { id: 'hatHelmet', attach: 'upper', lods: NEAR, when: (l) => l.hat === 'helmet', color: (l) => l.hatColor, build: () => join([dome(0.135, 1.635, 0, 1, Math.PI * 0.55), box(0.2, 0.015, 0.05, 0, 1.64, 0.13)]) },
  { id: 'hatBeret', attach: 'upper', lods: NEAR, when: (l) => l.hat === 'beret', color: (l) => l.hatColor, build: () => join([sphere(0.13, -0.015, 1.7, 0, 1.05, 0.38, 1.0, 8, 4)]) },
  // Clothing layers.
  { id: 'vest', attach: 'upper', lods: NEAR, when: (l) => l.vest !== 0, color: (l) => l.vest, build: () => join([box(0.425, 0.46, 0.24, 0, 1.17, 0), box(0.43, 0.04, 0.245, 0, 1.08, 0)], (i) => (i === 0 ? 0xffffff : 0xdddddd)) },
  { id: 'accent', attach: 'upper', lods: NEAR, when: (l) => l.accent !== 0, color: (l) => l.accent, build: () => join([box(0.06, 0.32, 0.01, 0, 1.28, 0.116)]) },
  { id: 'backpack', attach: 'upper', lods: NEAR, when: (l) => l.backpack, color: (l) => l.backpackColor, build: () => join([box(0.3, 0.4, 0.14, 0, 1.2, -0.18), box(0.2, 0.16, 0.04, 0, 1.12, -0.27)]) },
  // Marshaller wands ride on the hands.
  { id: 'wandL', attach: 'armL', lods: NEAR, when: (l) => l.wands, color: () => 0xff5a00, build: () => join([box(0.035, 0.035, 0.5, 0, -0.56, 0.2)]) },
  { id: 'wandR', attach: 'armR', lods: NEAR, when: (l) => l.wands, color: () => 0xff5a00, build: () => join([box(0.035, 0.035, 0.5, 0, -0.56, 0.2)]) },
  // Luggage hangs off the root.
  {
    id: 'roller',
    attach: 'root',
    lods: NEAR,
    when: (l) => l.carry === 'roller',
    color: (l) => l.carryColor,
    build: () => join([box(0.34, 0.5, 0.2, 0.3, 0.32, -0.5), box(0.3, 0.12, 0.01, 0.3, 0.35, -0.605)]),
  },
  {
    id: 'rollerHandle',
    attach: 'root',
    lods: NEAR,
    when: (l) => l.carry === 'roller',
    color: () => 0x374151,
    build: () => join([box(0.025, 0.42, 0.025, 0, 0, 0).rotateX(0.36).translate(0.3, 0.76, -0.4)]),
  },
  { id: 'duffel', attach: 'root', lods: NEAR, when: (l) => l.carry === 'duffel', color: (l) => l.carryColor, build: () => join([box(0.5, 0.26, 0.26, 0.36, 0.3, 0.02), box(0.3, 0.02, 0.02, 0.36, 0.5, 0.02)]) },
  {
    id: 'cartFrame',
    attach: 'root',
    lods: NEAR,
    when: (l) => l.carry === 'cart',
    color: () => 0x9ca3af,
    build: () => join([box(0.58, 0.04, 0.9, 0, 0.3, 0.85), box(0.58, 0.04, 0.04, 0, 0.95, 0.4), box(0.04, 0.65, 0.04, -0.27, 0.62, 0.4), box(0.04, 0.65, 0.04, 0.27, 0.62, 0.4)]),
  },
  { id: 'cartLoad', attach: 'root', lods: NEAR, when: (l) => l.carry === 'cart', color: (l) => l.carryColor, build: () => join([box(0.5, 0.3, 0.34, 0, 0.47, 0.95), box(0.4, 0.22, 0.3, 0, 0.73, 0.95)], (i) => (i === 0 ? 0xffffff : 0xc4b5a0)) },
  // Far people: one block, darker legs by vertex colour.
  {
    id: 'block',
    attach: 'root',
    lods: [2],
    when: any,
    color: (l) => (l.vest ? l.vest : l.top),
    build: () => join([box(0.42, 0.8, 0.26, 0, 1.2, 0), box(0.34, 0.8, 0.22, 0, 0.4, 0)], (i) => (i === 0 ? 0xffffff : 0x555566)),
  },
]

const geometryCache = new Map<string, THREE.BufferGeometry>()

export function partGeometry(def: PartDef): THREE.BufferGeometry {
  let geo = geometryCache.get(def.id)
  if (!geo) {
    geo = def.build()
    geometryCache.set(def.id, geo)
  }
  return geo
}

export function disposePartGeometry(): void {
  for (const geo of geometryCache.values()) geo.dispose()
  geometryCache.clear()
}

export const PARTS_BY_LOD: Record<0 | 1 | 2, PartDef[]> = {
  0: PART_DEFS.filter((p) => p.lods.includes(0)),
  1: PART_DEFS.filter((p) => p.lods.includes(1)),
  2: PART_DEFS.filter((p) => p.lods.includes(2)),
}

/** Parts a look draws at a level, honouring each part's predicate. */
export function partsFor(look: PersonLook, lod: 0 | 1 | 2): PartDef[] {
  return PARTS_BY_LOD[lod].filter((p) => p.when(look))
}

const _root = new THREE.Matrix4()
const _hips = new THREE.Matrix4()
const _upper = new THREE.Matrix4()
const _legL = new THREE.Matrix4()
const _legR = new THREE.Matrix4()
const _armL = new THREE.Matrix4()
const _armR = new THREE.Matrix4()
const _t = new THREE.Matrix4()
const _r = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

export type PartSink = (def: PartDef, matrix: THREE.Matrix4, color: number) => void

/**
 * Pose a person once, then emit every drawn part. Joint matrices are computed
 * a single time per person and shared by all of that person's parts.
 * `scale` converts metres to world units.
 */
export function emitPerson(
  look: PersonLook,
  lod: 0 | 1 | 2,
  joints: JointPose,
  x: number,
  y: number,
  z: number,
  yaw: number,
  scale: number,
  sink: PartSink,
): void {
  _q.setFromAxisAngle(_up, yaw)
  _p.set(x, y, z)
  _s.set(scale * look.width, scale * look.height, scale * look.width)
  _root.compose(_p, _q, _s)
  if (lod === 2) {
    for (const def of partsFor(look, 2)) sink(def, _root, def.color(look))
    return
  }
  _hips.copy(_root).multiply(_t.makeTranslation(0, joints.bob - joints.drop, 0))
  _upper.copy(_hips).multiply(_t.makeTranslation(0, HIP_Y, 0)).multiply(_r.makeRotationX(joints.lean)).multiply(_t.makeTranslation(0, -HIP_Y, 0))
  _legL.copy(_hips).multiply(_t.makeTranslation(-LEG_X, HIP_Y, 0)).multiply(_r.makeRotationX(joints.legL))
  _legR.copy(_hips).multiply(_t.makeTranslation(LEG_X, HIP_Y, 0)).multiply(_r.makeRotationX(joints.legR))
  _armL.copy(_upper).multiply(_t.makeTranslation(-ARM_X, SHOULDER_Y, 0)).multiply(_r.makeRotationX(joints.armL)).multiply(_r.makeRotationZ(-joints.armLRaise))
  _armR.copy(_upper).multiply(_t.makeTranslation(ARM_X, SHOULDER_Y, 0)).multiply(_r.makeRotationX(joints.armR)).multiply(_r.makeRotationZ(joints.armRRaise))
  for (const def of partsFor(look, lod)) {
    const m = def.attach === 'root' ? _root : def.attach === 'upper' ? _upper : def.attach === 'legL' ? _legL : def.attach === 'legR' ? _legR : def.attach === 'armL' ? _armL : _armR
    sink(def, m, def.color(look))
  }
}
