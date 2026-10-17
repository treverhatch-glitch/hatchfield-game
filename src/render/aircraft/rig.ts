import * as THREE from 'three'
import type { AircraftMotion } from './motion'
import { paintMesh, unitBox, unitCylinder, unitSphere, type PaintedMesh, type PaintSlot } from './pool'
import type { ModelSpec, Livery } from './specs'
import { doorBoxes } from './stands'
import { airfoilGeometry, spinnerConeGeometry } from './geom'
import { AIRCRAFT_LOOK } from '../look'

/**
 * Animated airframe parts. Each kind is one InstancedMesh per aircraft and LOD
 * tier, so flaps, slats, reverser sleeves and door leaves cost one draw each.
 * Instance matrices are re-posed from the eased motion every frame.
 */
export type RigKind = 'flap' | 'slat' | 'reverser' | 'door' | 'cargo'

export interface RigPart {
  /** Hinge pose in airframe meters. */
  hinge: THREE.Matrix4
  /** Child centre relative to the hinge, hinge-local axes. */
  offset: THREE.Vector3
  /** Base orientation of the unit geometry before scale. */
  base: THREE.Quaternion
  size: THREE.Vector3
  /** +1 port, -1 starboard. */
  side: number
  /** Local chord or length, meters, for travel distances. */
  reach: number
}

export interface RigSet {
  kind: RigKind
  mesh: THREE.InstancedMesh
  parts: RigPart[]
  /** Last posed value, so a still aircraft does not rewrite its matrices. */
  posed: number
}

export interface RigFrame {
  spec: ModelSpec
  tier: 'low' | 'mid' | 'high'
  livery: Livery
  group: THREE.Group
  meshes: PaintedMesh[]
  lamps: THREE.Object3D[]
  rigs: RigSet[]
  nose: number
  tailX: number
  centerY: number
  wingX: number
  wingY: number
}

const _t = new THREE.Matrix4()
const _r = new THREE.Matrix4()
const _o = new THREE.Matrix4()
const _b = new THREE.Matrix4()
const _s = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _axis = new THREE.Vector3()
const IDENT = new THREE.Quaternion()
const CYL_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)

function hingeAt(x: number, y: number, z: number, yaw: number): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeRotationY(yaw)
  m.setPosition(x, y, z)
  return m
}

/** Deployment matrix for one part at value t (0..1), hinge-local. */
export function deployMatrix(kind: RigKind, part: RigPart, t: number, out: THREE.Matrix4): THREE.Matrix4 {
  out.identity()
  if (t <= 0.0005) return out
  const c = part.reach
  switch (kind) {
    case 'flap':
      // Fowler travel aft and down, then rotate the trailing edge down up to ~35 degrees.
      _t.makeTranslation(-0.32 * c * t, -0.06 * c * t, 0)
      _r.makeRotationZ(0.6 * t)
      return out.multiplyMatrices(_t, _r)
    case 'slat':
      _t.makeTranslation(0.14 * c * t, -0.07 * c * t, 0)
      _r.makeRotationZ(-0.32 * t)
      return out.multiplyMatrices(_t, _r)
    case 'reverser':
      return out.makeTranslation(-0.24 * c * t, 0, 0)
    case 'door':
      // Plug doors pop out, then swing forward along the skin.
      _t.makeTranslation(0, 0, part.side * 0.12 * t)
      _axis.set(0, 1, 0)
      _q.setFromAxisAngle(_axis, part.side * 1.75 * t)
      _r.makeRotationFromQuaternion(_q)
      return out.multiplyMatrices(_t, _r)
    case 'cargo':
      // Top-hinged, swings up and out.
      _axis.set(1, 0, 0)
      _q.setFromAxisAngle(_axis, -part.side * 1.9 * t)
      return out.makeRotationFromQuaternion(_q)
  }
}

const _d = new THREE.Matrix4()
const _m = new THREE.Matrix4()

export function poseRig(set: RigSet, t: number, force = false) {
  if (!force && Math.abs(set.posed - t) < 0.002) return
  set.posed = t
  set.parts.forEach((part, i) => {
    deployMatrix(set.kind, part, t, _d)
    _o.makeTranslation(part.offset.x, part.offset.y, part.offset.z)
    _b.makeRotationFromQuaternion(part.base)
    _s.makeScale(part.size.x, part.size.y, part.size.z)
    _m.copy(part.hinge).multiply(_d).multiply(_o).multiply(_b).multiply(_s)
    set.mesh.setMatrixAt(i, _m)
  })
  set.mesh.instanceMatrix.needsUpdate = true
}

export function rigValue(kind: RigKind, motion: AircraftMotion): number {
  switch (kind) {
    case 'flap':
      return motion.flaps
    case 'slat':
      return motion.slats
    case 'reverser':
      return motion.reverse
    case 'door':
      return motion.doors
    case 'cargo':
      return motion.cargo
  }
}

function addSet(frame: RigFrame, kind: RigKind, geo: THREE.BufferGeometry, parts: RigPart[], slot: PaintSlot, livery: Livery = frame.livery) {
  if (!parts.length) return
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), parts.length)
  mesh.name = `rig-${kind}`
  const set: RigSet = { kind, mesh, parts, posed: -1 }
  poseRig(set, 0, true)
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  // Deployed parts swing out past the stowed bounds.
  if (mesh.boundingSphere) mesh.boundingSphere.radius *= 1.6
  const painted = paintMesh(mesh, slot, livery, 'control', frame.tier)
  painted.userData.rig = kind
  frame.group.add(painted)
  frame.meshes.push(painted)
  frame.rigs.push(set)
}

function addStatic(
  frame: RigFrame,
  geo: THREE.BufferGeometry,
  matrices: THREE.Matrix4[],
  slot: PaintSlot,
  name: string,
) {
  if (!matrices.length) return
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), matrices.length)
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.instanceMatrix.needsUpdate = true
  mesh.name = name
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  const painted = paintMesh(mesh, slot, frame.livery, 'mesh', frame.tier)
  frame.group.add(painted)
  frame.meshes.push(painted)
}

function trs(x: number, y: number, z: number, q: THREE.Quaternion, sx: number, sy: number, sz: number) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz))
}

/** Wing planform helpers, all in airframe meters. f runs 0 at the root to 1 at the tip. */
function planform(frame: RigFrame) {
  const { spec, wingX, wingY } = frame
  const semi = spec.spanM / 2
  const sweep = Math.tan((spec.sweep * Math.PI) / 180) * semi
  const lift = Math.tan((spec.dihedral * Math.PI) / 180) * semi
  const teX = (f: number) => wingX + (-spec.rootChord / 2) * (1 - f) + (spec.rootChord / 2 - sweep - spec.tipChord) * f
  const leX = (f: number) => wingX + spec.rootChord / 2 - sweep * f
  const y = (f: number) => wingY + lift * f + spec.thickness * 0.08
  const chord = (f: number) => spec.rootChord * (1 - f) + spec.tipChord * f
  // Edge yaw: z axis along the hinge, x forward.
  const teYaw = Math.atan2(spec.rootChord - sweep - spec.tipChord, semi)
  const leYaw = Math.atan2(-sweep, semi)
  return { semi, teX, leX, y, chord, teYaw, leYaw }
}

function isJet(spec: ModelSpec) {
  return spec.engines.kind === 'turbofan' || spec.engines.kind === 'turbojet'
}

function addFlapsAndSlats(frame: RigFrame) {
  const { spec } = frame
  if (spec.family === 'helo' || spec.spanM < 8) return
  const p = planform(frame)
  const root = Math.min(0.45, (spec.rx * 1.05) / p.semi)
  const flapEnd = isJet(spec) ? 0.7 : 0.62
  const flapSegs = spec.spanM > 40 ? 3 : 2
  const flaps: RigPart[] = []
  const fairings: THREE.Matrix4[] = []
  for (const side of [1, -1]) {
    for (let i = 0; i < flapSegs; i++) {
      const f0 = root + ((flapEnd - root) * i) / flapSegs + 0.005
      const f1 = root + ((flapEnd - root) * (i + 1)) / flapSegs - 0.005
      const fm = (f0 + f1) / 2
      const c = p.chord(fm) * 0.26
      const spanLen = (f1 - f0) * p.semi / Math.cos(p.teYaw)
      const hinge = hingeAt(p.teX(fm) + c, p.y(fm), side * fm * p.semi, side * p.teYaw)
      flaps.push({
        hinge,
        offset: new THREE.Vector3(-c / 2, 0, 0),
        base: IDENT,
        size: new THREE.Vector3(c, Math.max(0.04, spec.thickness * 0.14), spanLen),
        side,
        reach: c * 2.2,
      })
      // Flap-track canoe fairings under the trailing edge on airliners.
      if (isJet(spec) && spec.spanM > 25) {
        const fx = p.teX(f1)
        const len = p.chord(f1) * 0.42
        fairings.push(trs(fx + len * 0.1, p.y(f1) - spec.thickness * 0.35, side * f1 * p.semi, IDENT, len, spec.thickness * 0.45, 0.32))
      }
    }
  }
  addSet(frame, 'flap', airfoilGeometry(), flaps, 'wing')
  addStatic(frame, unitBox(), fairings, 'wing', 'flap-fairings')

  // Slats on swept-wing jets only. Turboprops and GA have fixed leading edges.
  if (!isJet(spec) || spec.spanM < 20) return
  const slats: RigPart[] = []
  const slatSegs = spec.spanM > 50 ? 4 : 3
  const s0 = root + 0.08
  const s1 = 0.94
  for (const side of [1, -1]) {
    for (let i = 0; i < slatSegs; i++) {
      const f0 = s0 + ((s1 - s0) * i) / slatSegs + 0.004
      const f1 = s0 + ((s1 - s0) * (i + 1)) / slatSegs - 0.004
      const fm = (f0 + f1) / 2
      const c = p.chord(fm) * 0.12
      const spanLen = (f1 - f0) * p.semi / Math.cos(p.leYaw)
      slats.push({
        hinge: hingeAt(p.leX(fm) - c, p.y(fm) - spec.thickness * 0.05, side * fm * p.semi, side * p.leYaw),
        offset: new THREE.Vector3(c / 2, 0, 0),
        base: IDENT,
        size: new THREE.Vector3(c, Math.max(0.04, spec.thickness * 0.18), spanLen),
        side,
        reach: c * 3,
      })
    }
  }
  addSet(frame, 'slat', airfoilGeometry(), slats, 'wing')
}

function addReversers(frame: RigFrame, pts: THREE.Vector3[]) {
  const { spec } = frame
  if (!isJet(spec) || pts.length === 0 || spec.lengthM < 18) return
  const eng = spec.engines
  const parts: RigPart[] = pts.map((p) => ({
    hinge: new THREE.Matrix4().makeTranslation(p.x - eng.length * 0.18, p.y, p.z),
    offset: new THREE.Vector3(0, 0, 0),
    base: CYL_X,
    size: new THREE.Vector3(eng.radius * 0.985, eng.length * 0.3, eng.radius * 0.985),
    side: p.z >= 0 ? 1 : -1,
    reach: eng.length,
  }))
  addSet(frame, 'reverser', unitCylinder(12), parts, 'metal')
  // Cascade band revealed when the sleeve slides aft.
  const bands = pts.map((p) =>
    trs(p.x - eng.length * 0.02, p.y, p.z, CYL_X, eng.radius * 0.94, eng.length * 0.12, eng.radius * 0.94),
  )
  addStatic(frame, unitCylinder(10), bands, 'dark', 'cascades')
}

function addApu(frame: RigFrame) {
  const { spec } = frame
  if (spec.family === 'helo' || spec.lengthM < 18 || !isJet(spec)) return
  const r = Math.min(0.32, spec.ry * 0.09)
  // Tailcone is upswept (loft dy ≈ 0.64 at the tip), so the APU outlet sits high.
  const y = frame.centerY + spec.ry * (spec.family === 'tube' ? 0.62 : 0.6)
  addStatic(frame, unitCylinder(10), [trs(frame.tailX + 0.05, y, 0, CYL_X, r, 0.5, r)], 'dark', 'apu-exhaust')
}

function addSpinnerCones(frame: RigFrame, pts: THREE.Vector3[]) {
  const { spec } = frame
  if (!isJet(spec) || pts.length === 0) return
  const eng = spec.engines
  const cones = pts.map((p) =>
    trs(p.x + eng.length * 0.3, p.y, p.z, IDENT, eng.radius * 0.5, eng.radius * 0.3, eng.radius * 0.3),
  )
  addStatic(frame, spinnerConeGeometry(), cones, 'metal', 'spinner-cones')
}

function addLandingLights(frame: RigFrame) {
  const { spec } = frame
  if (spec.family === 'helo' || spec.spanM < 10) return
  const p = planform(frame)
  const f = Math.min(0.3, (spec.rx * 1.6) / p.semi)
  const r = Math.min(0.28, Math.max(0.1, spec.rx * 0.1))
  for (const side of [1, -1]) {
    const mesh = new THREE.Mesh(unitSphere())
    mesh.scale.setScalar(r)
    mesh.position.set(p.leX(f) - 0.1, p.y(f) - spec.thickness * 0.2, side * f * p.semi)
    mesh.name = 'landing-light'
    mesh.userData.baseScale = r
    const painted = paintMesh(mesh, 'navWhite', frame.livery, 'light', frame.tier)
    frame.group.add(painted)
    frame.meshes.push(painted)
    frame.lamps.push(painted)
  }
}

function addDoorLeaves(frame: RigFrame) {
  const { spec } = frame
  const pax: RigPart[] = []
  const cargo: RigPart[] = []
  for (const box of doorBoxes(spec)) {
    const side = box.door.side
    if (side === 0) continue
    // Leaf sits proud of the doorway frame, with real thickness.
    // Closed, the leaf sits almost flush so it reads as a door outline, not a slab.
    const z = side * (box.z === 0 ? spec.rx : Math.abs(box.z)) + side * 0.035
    if (box.door.kind === 'cargo') {
      cargo.push({
        hinge: new THREE.Matrix4().makeTranslation(box.x, box.y + box.h / 2, z),
        offset: new THREE.Vector3(0, -box.h / 2, 0),
        base: IDENT,
        size: new THREE.Vector3(box.w * 1.04, box.h * 1.02, 0.07),
        side,
        reach: box.h,
      })
    } else {
      pax.push({
        hinge: new THREE.Matrix4().makeTranslation(box.x + box.w / 2, box.y, z),
        offset: new THREE.Vector3(-box.w / 2, 0, 0),
        base: IDENT,
        size: new THREE.Vector3(box.w * 1.04, box.h * 1.02, 0.07),
        side,
        reach: box.w,
      })
    }
  }
  // Doors wear the fuselage side colour (white crown on two-tone schemes), not the airline primary.
  const skin: Livery = { ...frame.livery, body: frame.livery.scheme === 'solid' ? frame.livery.body : (frame.livery.crown ?? AIRCRAFT_LOOK.crown) }
  addSet(frame, 'door', unitBox(), pax, 'body', skin)
  addSet(frame, 'cargo', unitBox(), cargo, 'body', skin)
}

/**
 * Detail and moving parts. Mid carries the silhouette parts you read from the
 * default camera (flaps, slats, reversers, APU, landing lights). High adds the
 * close-up parts (door leaves, windscreen panes, spinner cones).
 */
export function addRig(frame: RigFrame, enginePts: THREE.Vector3[]) {
  if (frame.tier === 'low') return
  if (frame.tier === 'mid') {
    addFlapsAndSlats(frame)
    addReversers(frame, enginePts)
    addApu(frame)
    addLandingLights(frame)
    return
  }
  addDoorLeaves(frame)
  addSpinnerCones(frame, enginePts)
}
