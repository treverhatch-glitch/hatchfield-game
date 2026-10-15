/**
 * One shared base body, drawn as parts. Every part is one geometry drawn
 * through one InstancedMesh (or one Mesh in the static API) with a
 * per-instance colour. Passengers and crew use the same body: they differ only
 * in which clothing and gear parts switch on (see outfits.ts).
 *
 * Coordinates are metres, feet at y = 0, the person faces +z. Adult proportions
 * at 1.75 m: head ~1/7.4 of height, shoulders at 1.42 m, hips at 0.88 m,
 * tapered limbs, hands and feet. Limb geometry is local to its joint.
 * Symmetric parts list both sides in `attach` and share one mesh.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { JointPose } from './pose.ts'
import type { PersonLook } from './types.ts'

export const HIP_Y = 0.88
export const SHOULDER_Y = 1.42
const NECK_Y = 1.5
const ARM_X = 0.25
const LEG_X = 0.09

export type Attach = 'root' | 'hips' | 'upper' | 'head' | 'legL' | 'legR' | 'armL' | 'armR'

export interface PartDef {
  id: string
  attach: Attach | readonly Attach[]
  /** Levels (0 near, 1 mid, 2 block) that draw this part. */
  lods: readonly (0 | 1 | 2)[]
  when: (look: PersonLook) => boolean
  color: (look: PersonLook) => number
  build: () => THREE.BufferGeometry
}

const BOTH_ARMS = ['armL', 'armR'] as const
const BOTH_LEGS = ['legL', 'legR'] as const
/**
 * Right-hand socket. The arm joint is the named attachment; the grip is the
 * hand mesh centre, local (0, -0.62, 0). Carried bags are built in this frame
 * so the handle stays in the hand while the arm moves.
 */
export const HAND_SOCKET = 'armR' as const

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z)
}

function sphere(r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, wSeg = 8, hSeg = 6): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, wSeg, hSeg).scale(sx, sy, sz).translate(x, y, z)
}

function dome(r: number, y: number, z = 0, sy = 1, phi = Math.PI * 0.55): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, phi).scale(1, sy, 1).translate(0, y, z)
}

/**
 * A tapered limb or torso slice spanning yBottom..yTop, elliptical when
 * sx != sz. Caps are only paid for where they can be seen: 'top' for shoulders,
 * 'none' for joints that overlap a neighbour.
 */
function tapered(rTop: number, rBottom: number, yTop: number, yBottom: number, seg: number, sx = 1, sz = 1, caps: 'both' | 'top' | 'none' = 'both'): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(rTop, rBottom, yTop - yBottom, seg, 1, caps !== 'both').scale(sx, 1, sz).translate(0, (yTop + yBottom) / 2, 0)
  if (caps !== 'top') return body
  const lid = new THREE.CircleGeometry(rTop, seg).rotateX(-Math.PI / 2).scale(sx, 1, sz).translate(0, yTop, 0)
  return mergeGeometries([body, lid], false)
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
const NEAR: readonly (0 | 1 | 2)[] = [0]
const MID: readonly (0 | 1 | 2)[] = [1]
const has = (l: PersonLook, g: PersonLook['gear'][number]) => l.gear.includes(g)
const armColor = (l: PersonLook) => l.jacket || (l.sleeves || l.vest || l.crew ? l.top : l.skin)

/** Rounded cap over the skull, shared by the hair styles. */
const hairDome = () => new THREE.SphereGeometry(0.107, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.58).scale(0.95, 1.2, 1.03).translate(0, 1.635, -0.005)

/** Handle, rails and four wheels: nine pieces, tinted by index in the stroller part. */
const strollerParts = () => [
  box(0.5, 0.03, 0.03, 0, 1.1, 0.5),
  box(0.03, 0.55, 0.03, -0.24, 0.82, 0.55),
  box(0.03, 0.55, 0.03, 0.24, 0.82, 0.55),
  box(0.03, 0.03, 0.8, -0.24, 0.5, 0.85),
  box(0.03, 0.03, 0.8, 0.24, 0.5, 0.85),
  ...[-0.27, 0.27].flatMap((x) => [0.5, 1.2].map((z) => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6).rotateZ(Math.PI / 2).translate(x, 0.1, z))),
]

export const PART_DEFS: readonly PartDef[] = [
  // Body: chest, hips, neck and head, limbs, hands, feet.
  { id: 'torso', attach: 'upper', lods: NEAR, when: any, color: (l) => l.top, build: () => join([tapered(0.2, 0.15, 1.44, 0.8, 8, 1, 0.62, 'top')]) },
  // Mid detail: chest and both arms as one rigid piece, so mid is three meshes.
  {
    id: 'torsoLo',
    attach: 'upper',
    lods: MID,
    when: any,
    color: (l) => l.top,
    build: () => join([tapered(0.19, 0.16, 1.44, 0.86, 5, 1, 0.62, 'top'), tapered(0.048, 0.035, 1.4, 0.82, 3, 1, 1, 'none').translate(-0.25, 0, 0), tapered(0.048, 0.035, 1.4, 0.82, 3, 1, 1, 'none').translate(0.25, 0, 0)]),
  },
  { id: 'head', attach: 'head', lods: NEAR, when: any, color: (l) => l.skin, build: () => join([sphere(0.1, 0, 1.63, 0.005, 0.92, 1.18, 1.0, 7, 5), tapered(0.045, 0.05, 1.55, 1.46, 6, 1, 1, 'none')]) },
  { id: 'headLo', attach: 'head', lods: MID, when: any, color: (l) => l.skin, build: () => join([box(0.19, 0.23, 0.2, 0, 1.63, 0)]) },
  {
    id: 'arm',
    attach: BOTH_ARMS,
    lods: NEAR,
    when: any,
    color: armColor,
    build: () => join([tapered(0.052, 0.042, 0, -0.29, 6, 1, 1, 'none'), tapered(0.042, 0.034, -0.29, -0.57, 6, 1, 1, 'none')]),
  },
  { id: 'hand', attach: BOTH_ARMS, lods: NEAR, when: any, color: (l) => l.skin, build: () => join([sphere(0.036, 0, -0.62, 0, 1, 1.2, 0.8, 5, 3)]) },
  {
    id: 'leg',
    attach: BOTH_LEGS,
    lods: NEAR,
    when: any,
    color: (l) => l.bottom,
    build: () => join([tapered(0.088, 0.064, 0, -0.44, 7, 1, 1, 'none'), tapered(0.064, 0.044, -0.44, -0.8, 7, 1, 1, 'none')]),
  },
  // Shorts: bare skin over the lower leg of the trouser tube.
  { id: 'calf', attach: BOTH_LEGS, lods: NEAR, when: (l) => l.shorts, color: (l) => l.skin, build: () => join([tapered(0.067, 0.047, -0.46, -0.8, 7, 1, 1, 'none')]) },
  { id: 'legLo', attach: BOTH_LEGS, lods: MID, when: any, color: (l) => l.bottom, build: () => join([tapered(0.08, 0.045, 0, -0.88, 3, 1, 1, 'none')]) },
  // Shoes carry a short ankle cuff; boots (gear) are told apart by colour.
  { id: 'shoe', attach: BOTH_LEGS, lods: NEAR, when: any, color: (l) => l.shoes, build: () => join([sphere(0.05, 0, -0.838, 0.045, 1.1, 0.85, 2.5, 6, 3), tapered(0.054, 0.052, -0.74, -0.84, 6, 1, 1, 'none')]) },
  // Hair.
  { id: 'hairShort', attach: 'head', lods: NEAR, when: (l) => l.hair === 'short', color: (l) => l.hairColor, build: () => join([hairDome()]) },
  {
    id: 'hairLong',
    attach: 'head',
    lods: NEAR,
    when: (l) => l.hair === 'long',
    color: (l) => l.hairColor,
    build: () => join([hairDome(), tapered(0.1, 0.075, 1.64, 1.36, 6, 1, 0.55).translate(0, 0, -0.07)]),
  },
  { id: 'hairBun', attach: 'head', lods: NEAR, when: (l) => l.hair === 'bun', color: (l) => l.hairColor, build: () => join([hairDome(), sphere(0.055, 0, 1.745, -0.09, 1, 1, 1, 6, 4)]) },
  // Hats. Peaked covers the pilot and security caps, the colour tells them apart.
  { id: 'hatCap', attach: 'head', lods: NEAR, when: (l) => l.hat === 'cap', color: (l) => l.hatColor, build: () => join([dome(0.123, 1.655, 0, 1.05, Math.PI * 0.5), box(0.18, 0.012, 0.1, 0, 1.65, 0.12)]) },
  // Beanie and beret are one soft-cap mesh.
  {
    id: 'hatSoft',
    attach: 'head',
    lods: NEAR,
    when: (l) => l.hat === 'beanie' || l.hat === 'beret',
    color: (l) => l.hatColor,
    build: () => join([dome(0.123, 1.65, 0, 1.15, Math.PI * 0.6)]),
  },
  {
    id: 'hatSun',
    attach: 'head',
    lods: NEAR,
    when: (l) => l.hat === 'sunhat',
    color: (l) => l.hatColor,
    build: () => join([new THREE.CylinderGeometry(0.25, 0.25, 0.015, 10).translate(0, 1.715, 0), new THREE.CylinderGeometry(0.115, 0.125, 0.09, 10).translate(0, 1.76, 0)]),
  },
  {
    id: 'hatPeaked',
    attach: 'head',
    lods: NEAR,
    when: (l) => l.hat === 'pilotCap' || l.hat === 'securityCap',
    color: (l) => l.hatColor,
    build: () => join([new THREE.CylinderGeometry(0.135, 0.128, 0.08, 10).translate(0, 1.74, 0), box(0.19, 0.012, 0.1, 0, 1.705, 0.145)], (i) => (i === 0 ? 0xffffff : 0x2a2a2a)),
  },
  { id: 'hatHelmet', attach: 'head', lods: NEAR, when: (l) => l.hat === 'helmet', color: (l) => l.hatColor, build: () => join([dome(0.13, 1.65, 0, 1.0, Math.PI * 0.55), box(0.2, 0.015, 0.05, 0, 1.655, 0.13)]) },
  // Clothing layers.
  // Jacket or hi-vis vest: one outer layer, a reflective band across the belly.
  {
    id: 'outer',
    attach: 'upper',
    lods: NEAR,
    when: (l) => l.jacket !== 0 || l.vest !== 0,
    color: (l) => l.jacket || l.vest,
    build: () => join([tapered(0.215, 0.185, 1.45, 0.88, 8, 1, 0.66, 'top'), tapered(0.2, 0.2, 1.12, 1.06, 8, 1, 0.68, 'none')], (i) => (i === 0 ? 0xffffff : 0xdddddd)),
  },
  // Tie, scarf or stripe: deep enough to clear a jacket front.
  { id: 'accent', attach: 'upper', lods: NEAR, when: (l) => l.accent !== 0, color: (l) => l.accent, build: () => join([box(0.05, 0.3, 0.04, 0, 1.25, 0.13)]) },
  { id: 'backpack', attach: 'upper', lods: NEAR, when: (l) => l.backpack, color: (l) => l.backpackColor, build: () => join([box(0.36, 0.5, 0.18, 0, 1.18, -0.2), box(0.22, 0.18, 0.05, 0, 1.08, -0.31), box(0.06, 0.42, 0.04, -0.16, 1.22, -0.1), box(0.06, 0.42, 0.04, 0.16, 1.22, -0.1)]) },
  // Gear. Headsets and ear defenders ride on the head, badges on the chest.
  {
    id: 'headset',
    attach: 'head',
    lods: NEAR,
    when: (l) => has(l, 'headset'),
    color: (l) => l.gearColor,
    build: () =>
      join([
        new THREE.TorusGeometry(0.105, 0.008, 4, 6, Math.PI).scale(1, 1.15, 1).translate(0, 1.63, 0),
        sphere(0.03, -0.103, 1.63, 0, 0.55, 1, 1, 6, 4),
        sphere(0.03, 0.103, 1.63, 0, 0.55, 1, 1, 6, 4),
        box(0.006, 0.006, 0.07, 0.085, 1.585, 0.05),
      ]),
  },
  {
    id: 'earDefenders',
    attach: 'head',
    lods: NEAR,
    when: (l) => has(l, 'earDefenders'),
    color: (l) => l.gearColor,
    build: () =>
      join([
        new THREE.TorusGeometry(0.108, 0.012, 4, 6, Math.PI).scale(1, 1.15, 1).translate(0, 1.63, 0),
        new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8).rotateZ(Math.PI / 2).translate(-0.108, 1.63, 0),
        new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8).rotateZ(Math.PI / 2).translate(0.108, 1.63, 0),
      ]),
  },
  {
    id: 'lanyard',
    attach: 'upper',
    lods: NEAR,
    when: (l) => has(l, 'lanyard'),
    color: (l) => l.gearColor,
    build: () =>
      join(
        [
          box(0.012, 0.26, 0.008).rotateZ(0.235).translate(-0.03, 1.345, 0.121),
          box(0.012, 0.26, 0.008).rotateZ(-0.235).translate(0.03, 1.345, 0.121),
          box(0.055, 0.075, 0.008, 0, 1.2, 0.122),
        ],
        (i) => (i < 2 ? 0xffffff : 0xd9d9d9),
      ),
  },
  // Marshaller wands ride on the hands.
  { id: 'wand', attach: BOTH_ARMS, lods: NEAR, when: (l) => l.wands, color: () => 0xff5a00, build: () => join([box(0.035, 0.035, 0.5, 0, -0.62, 0.2)]) },
  // Luggage hangs off the right-hand socket (arm local, grip at the hand).
  {
    id: 'roller',
    attach: HAND_SOCKET,
    lods: NEAR,
    when: (l) => l.carry === 'roller',
    color: (l) => l.carryColor,
    build: () =>
      join(
        [
          box(0.34, 0.5, 0.22, 0.05, -1.19, 0.14),
          box(0.3, 0.1, 0.012, 0.05, -1.16, 0.255),
          box(0.02, 0.46, 0.02, 0.02, -0.9, 0.06),
          box(0.05, 0.05, 0.06, 0, -0.62, 0),
          new THREE.CylinderGeometry(0.045, 0.045, 0.04, 6).rotateZ(Math.PI / 2).translate(-0.08, -1.4, 0.05),
          new THREE.CylinderGeometry(0.045, 0.045, 0.04, 6).rotateZ(Math.PI / 2).translate(0.16, -1.4, 0.05),
        ],
        (i) => (i < 2 ? 0xffffff : 0x4b5563),
      ),
  },
  {
    id: 'duffel',
    attach: HAND_SOCKET,
    lods: NEAR,
    when: (l) => l.carry === 'duffel',
    color: (l) => l.carryColor,
    build: () => join([box(0.42, 0.22, 0.22, 0.04, -0.78, 0.02), box(0.02, 0.16, 0.02, 0.02, -0.68, 0.02)]),
  },
  {
    id: 'briefcase',
    attach: HAND_SOCKET,
    lods: NEAR,
    when: (l) => l.carry === 'briefcase',
    color: (l) => l.carryColor,
    build: () => join([box(0.34, 0.26, 0.1, 0.02, -0.74, 0.04), box(0.16, 0.03, 0.02, 0.02, -0.6, 0.04)], (i) => (i === 0 ? 0xffffff : 0x9ca3af)),
  },
  {
    id: 'cart',
    attach: 'root',
    lods: NEAR,
    when: (l) => l.carry === 'cart',
    color: () => 0xffffff,
    build: () =>
      join(
        [
          box(0.58, 0.04, 0.9, 0, 0.3, 0.85),
          box(0.58, 0.04, 0.04, 0, 0.95, 0.4),
          box(0.04, 0.65, 0.04, -0.27, 0.62, 0.4),
          box(0.04, 0.65, 0.04, 0.27, 0.62, 0.4),
          box(0.5, 0.3, 0.34, 0, 0.47, 0.95),
          box(0.4, 0.22, 0.3, 0, 0.73, 0.95),
        ],
        (i) => (i < 4 ? 0x9ca3af : i === 4 ? 0x8b6b4a : 0xc4b5a0),
      ),
  },
  {
    id: 'stroller',
    attach: 'root',
    lods: NEAR,
    when: (l) => l.carry === 'stroller',
    color: (l) => l.carryColor,
    build: () => join([...strollerParts(), box(0.42, 0.18, 0.6, 0, 0.58, 0.85), new THREE.SphereGeometry(0.23, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1, 1.1).translate(0, 0.66, 0.68)], (i) => (i < 5 ? 0x8a8f98 : i < 9 ? 0x2a2f3a : 0xffffff)),
  },
  // Far people: one block, darker legs by vertex colour.
  {
    id: 'block',
    attach: 'root',
    lods: [2],
    when: any,
    color: (l) => l.vest || l.jacket || l.top,
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
const _head = new THREE.Matrix4()
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

function joint(attach: Attach): THREE.Matrix4 {
  switch (attach) {
    case 'root':
      return _root
    case 'hips':
      return _hips
    case 'upper':
      return _upper
    case 'head':
      return _head
    case 'legL':
      return _legL
    case 'legR':
      return _legR
    case 'armL':
      return _armL
    case 'armR':
      return _armR
  }
}

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
  _upper.copy(_hips).multiply(_t.makeTranslation(0, HIP_Y, 0)).multiply(_r.makeRotationX(joints.lean + look.stoop)).multiply(_t.makeTranslation(0, -HIP_Y, 0))
  _head.copy(_upper).multiply(_t.makeTranslation(0, NECK_Y, 0)).multiply(_r.makeScale(look.headScale, look.headScale, look.headScale)).multiply(_t.makeTranslation(0, -NECK_Y, 0))
  _legL.copy(_hips).multiply(_t.makeTranslation(-LEG_X, HIP_Y, 0)).multiply(_r.makeRotationX(joints.legL))
  _legR.copy(_hips).multiply(_t.makeTranslation(LEG_X, HIP_Y, 0)).multiply(_r.makeRotationX(joints.legR))
  _armL.copy(_upper).multiply(_t.makeTranslation(-ARM_X, SHOULDER_Y, 0)).multiply(_r.makeRotationX(joints.armL)).multiply(_r.makeRotationZ(-joints.armLRaise))
  _armR.copy(_upper).multiply(_t.makeTranslation(ARM_X, SHOULDER_Y, 0)).multiply(_r.makeRotationX(joints.armR)).multiply(_r.makeRotationZ(joints.armRRaise))
  for (const def of partsFor(look, lod)) {
    const color = def.color(look)
    if (typeof def.attach === 'string') sink(def, joint(def.attach), color)
    else for (const a of def.attach) sink(def, joint(a), color)
  }
}
