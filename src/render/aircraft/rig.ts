import * as THREE from 'three'
import type { AircraftMotion } from './motion'
import { paintMesh, paintVertexMesh, sharedGeo, unitCylinder, unitSphere, type PaintedMesh, type PaintSlot } from './pool'
import type { ModelSpec, Livery } from './specs'
import { renderDoorBoxes } from './stands'
import { airfoilGeometry, loftFamily, loftStation, smoothSphere } from './geom'
import { doorLeafGeometry, fuselagePaint } from './doorLeaf'

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
  /** Plug doors: +1 swing forward along the skin, −1 aft. */
  swing?: number
}

export interface RigSet {
  kind: RigKind
  mesh: THREE.InstancedMesh
  parts: RigPart[]
  /** Last posed value, so a still aircraft does not rewrite its matrices. */
  posed: number
  /** Doorway cut shown only while this leaf set is open. */
  reveal?: THREE.Object3D
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

function hingeAt(x: number, y: number, z: number, yaw: number, roll = 0): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeRotationY(yaw)
  // Roll about the hinge's chord axis so a segment follows the wing's dihedral along its span.
  if (roll) m.multiply(new THREE.Matrix4().makeRotationX(roll))
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
    case 'door': {
      // A320 / 737-style plug door on a parallel-arm hinge: it pops out of the frame, then the
      // arm carries it outward and round to lie flat against the skin beside the doorway,
      // outer (livery) face still outboard. The leaf keeps its orientation, with a slight yaw
      // mid-swing, like the real linkage.
      const sw = part.swing ?? 1
      const pop = Math.min(1, t / 0.18)
      const arc = Math.max(0, (t - 0.18) / 0.82)
      const a = (arc * arc * (3 - 2 * arc)) * Math.PI
      // Hinge-local: the closed leaf centre sits at x = -sw·c/2 and ends at +sw·(c/2 + 0.03).
      const centre = -sw * (c / 2) * Math.cos(a) + sw * 0.03 * (1 - Math.cos(a))
      const cz = part.side * (0.07 * pop + (c / 2) * 0.55 * Math.sin(a) + 0.12 * arc)
      _t.makeTranslation(centre + sw * (c / 2), 0, cz)
      _axis.set(0, 1, 0)
      _q.setFromAxisAngle(_axis, part.side * sw * 0.22 * Math.sin(a))
      _r.makeRotationFromQuaternion(_q)
      return out.multiplyMatrices(_t, _r)
    }
    case 'cargo':
      if (part.swing === -1) {
        // Inward plug (under a rear nacelle): drops in, then slides up inside the skin.
        return out.makeTranslation(0, c * 0.92 * Math.max(0, (t - 0.2) / 0.8), -part.side * 0.2 * Math.min(1, t * 5))
      }
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
  if (set.reveal) {
    set.reveal.userData.shut = t <= 0.01
    set.reveal.visible = t > 0.01
  }
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
  // Same blended dihedral as wingGeometry (flat out of the fairing, then the full angle), so
  // stowed flaps and slats sit in the wing instead of poking above or below it near the root.
  const y = (f: number) => {
    const blend = Math.min(1, f / 0.14)
    return wingY + (lift / semi) * Math.max(0, f * semi - 0.07 * semi * (1 - blend)) * blend
  }
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
  // One chord for every segment, so the hinge line runs straight and parallel to the trailing
  // edge: varying chords per segment stepped the stowed flaps into a sawtooth.
  const flapC = p.chord((root + flapEnd) / 2) * 0.24
  for (const side of [1, -1]) {
    for (let i = 0; i < flapSegs; i++) {
      const f0 = root + ((flapEnd - root) * i) / flapSegs + 0.002
      const f1 = root + ((flapEnd - root) * (i + 1)) / flapSegs - 0.002
      const fm = (f0 + f1) / 2
      const c = flapC
      const spanLen = (f1 - f0) * p.semi / Math.cos(p.teYaw)
      const roll = -side * Math.atan2(p.y(f1) - p.y(f0), (f1 - f0) * p.semi)
      const hinge = hingeAt(p.teX(fm) + c, p.y(fm), side * fm * p.semi, side * p.teYaw, roll)
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
        fairings.push(trs(fx + len * 0.05, p.y(f1) - spec.thickness * 0.3, side * f1 * p.semi, IDENT, len * 0.55, spec.thickness * 0.26, 0.17))
      }
    }
  }
  addSet(frame, 'flap', airfoilGeometry(), flaps, 'wing')
  // Rounded canoe fairings (elongated spheroids), not boxes.
  addStatic(frame, smoothSphere(), fairings, 'wing', 'flap-fairings')

  // Slats on swept-wing jets only. Turboprops and GA have fixed leading edges.
  if (!isJet(spec) || spec.spanM < 20) return
  const slats: RigPart[] = []
  const slatSegs = spec.spanM > 50 ? 4 : 3
  const s0 = root + 0.08
  const s1 = 0.94
  const slatC = p.chord((s0 + s1) / 2) * 0.11
  for (const side of [1, -1]) {
    for (let i = 0; i < slatSegs; i++) {
      const f0 = s0 + ((s1 - s0) * i) / slatSegs + 0.004
      const f1 = s0 + ((s1 - s0) * (i + 1)) / slatSegs - 0.004
      const fm = (f0 + f1) / 2
      const c = slatC
      const spanLen = (f1 - f0) * p.semi / Math.cos(p.leYaw)
      slats.push({
        hinge: hingeAt(p.leX(fm) - c, p.y(fm) - spec.thickness * 0.05, side * fm * p.semi, side * p.leYaw, -side * Math.atan2(p.y(f1) - p.y(f0), (f1 - f0) * p.semi)),
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
  const { spec, livery } = frame
  const family = loftFamily(spec)
  const paint = fuselagePaint(livery)
  const du = frame.nose - frame.tailX
  const y0 = frame.centerY - spec.ry
  const dv = spec.ry * (spec.hump ? 2.45 : 2)
  // Leaves that share a cross-section share one curved geometry and one instanced draw.
  const sets = new Map<string, { geo: () => THREE.BufferGeometry; parts: RigPart[]; shift: number[]; kind: RigKind }>()
  for (const box of renderDoorBoxes(spec)) {
    const side = box.door.side
    if (side === 0 || box.omit) continue
    const t = Math.max(0, Math.min(1, (frame.nose - box.x) / spec.lengthM))
    const st = loftStation(family, t)
    const mid = frame.centerY + spec.ry * st.dy
    const yRel = box.y - mid
    const k = yRel / spec.ry
    const skin = spec.rx * Math.sqrt(Math.max(0.0004, st.r * st.r - k * k))
    const cargo = box.door.kind === 'cargo'
    const kind: RigKind = cargo ? 'cargo' : 'door'
    const r = Math.round(st.r * 50) / 50
    const yr = Math.round(yRel * 20) / 20
    const key = `${kind}:${side}:${r}:${yr}:${box.w.toFixed(2)}:${box.h.toFixed(2)}`
    let set = sets.get(key)
    if (!set) {
      const leaf = { w: box.w, h: box.h, side, kind: cargo ? 'cargo' as const : 'pax' as const, rx: spec.rx, ry: spec.ry, r, yRel: yr, paint, du, dv }
      set = {
        geo: () => sharedGeo(`door-leaf:${spec.id}:${key}:${paint.crown}:${paint.body}:${paint.belly}:${spec.hump ? 1 : 0}`, () => doorLeafGeometry(leaf)),
        parts: [],
        shift: [],
        kind,
      }
      sets.set(key, set)
    }
    const z = side * skin
    const sw = box.swing ?? 1
    if (cargo) {
      set.parts.push({
        hinge: new THREE.Matrix4().makeTranslation(box.x, box.y + box.h / 2, z),
        offset: new THREE.Vector3(0, -box.h / 2, 0),
        base: IDENT,
        size: new THREE.Vector3(1, 1, 1),
        side,
        reach: box.h,
        swing: box.swing,
      })
    } else {
      set.parts.push({
        hinge: new THREE.Matrix4().makeTranslation(box.x + (sw * box.w) / 2, box.y, z),
        offset: new THREE.Vector3((-sw * box.w) / 2, 0, 0),
        base: IDENT,
        size: new THREE.Vector3(1, 1, 1),
        side,
        reach: box.w,
        swing: sw,
      })
    }
    // Plate UV of this door's centre (outwardUv: +Z flips U).
    const u = (frame.nose - box.x) / du
    set.shift.push(side > 0 ? 1 - u : u, (box.y - y0) / dv)
  }
  for (const set of sets.values()) addLeafSet(frame, set.kind, set.geo(), set.parts, set.shift)
}

function addLeafSet(frame: RigFrame, kind: RigKind, geo: THREE.BufferGeometry, parts: RigPart[], shift: number[]) {
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), parts.length)
  mesh.geometry = geo
  mesh.name = `rig-${kind}`
  // Per-instance plate offset; the geometry's own livery UVs are relative to the door centre.
  const inst = geo.clone()
  mesh.geometry = inst
  inst.setAttribute('liveryShift', new THREE.InstancedBufferAttribute(new Float32Array(shift), 2))
  mesh.userData.ownGeo = true
  const set: RigSet = { kind, mesh, parts, posed: -1 }
  poseRig(set, 0, true)
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  if (mesh.boundingSphere) mesh.boundingSphere.radius *= 1.6
  const painted = paintVertexMesh(mesh, 'mid', 'control', 'paint', frame.livery.airline, frame.livery.wear ?? 0, 'door')
  painted.userData.airline = frame.livery.airline
  painted.userData.rig = kind
  frame.group.add(painted)
  frame.meshes.push(painted)
  frame.rigs.push(set)
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
}
