import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import { logoMaterials, resolveBrand } from './branding'
import { doorBoxes } from './stands'
import { AIRCRAFT_LOOK } from '../look'
import { bladeGeometry, cylinderSides, finGeometry, intakeLipGeometry, spinnerConeGeometry, fuselageSides, loftFamily, loftStation, nacelleGeometry, paintedLoftGeometry, smoothSphere, stabGeometry, windowGeometry, wingGeometry, wingletGeometry } from './geom'
import type { LiveryBox } from './liveryUv'
import { airlineLogoUrl } from './airlineLogo'
import { selectLivery } from './airlineArt'
import { listedLivery } from './liveryFiles'
import { liveryPlateReady, resolveLiveryAirline } from './liveryTex'
import { mergeStaticShell } from './merge'
import { addRig, type RigSet } from './rig'
import { bayDoorsGeometry, doorwayGeometry, legGeometry, wellGeometry, type LegKind } from './gear'
import {
  paintMesh,
  paintVertexMesh,
  unitBox,
  unitCylinder,
  unitDisc,
  unitPlane,
  unitSphere,
  sharedMat,
  slotColor,
  type PaintedMesh,
  type PaintSlot,
} from './pool'
import type { EngineSpec, Livery, ModelSpec } from './specs'

export type Tier = 'low' | 'mid' | 'high'

export interface BuiltLevel {
  group: THREE.Group
  meshes: PaintedMesh[]
  spinners: THREE.Object3D[]
  gears: THREE.Object3D[]
  strobes: THREE.Object3D[]
  beacons: THREE.Object3D[]
  lamps: THREE.Object3D[]
  rigs: RigSet[]
}

interface Frame {
  spec: ModelSpec
  tier: Tier
  livery: Livery
  group: THREE.Group
  meshes: PaintedMesh[]
  spinners: THREE.Object3D[]
  gears: THREE.Object3D[]
  strobes: THREE.Object3D[]
  beacons: THREE.Object3D[]
  lamps: THREE.Object3D[]
  rigs: RigSet[]
  nose: number
  tailX: number
  centerY: number
  top: number
  finH: number
  wingX: number
  wingY: number
}

function frameFor(spec: ModelSpec, tier: Tier, livery: Livery): Frame {
  const group = new THREE.Group()
  const centerY = spec.gear + spec.ry
  const top = centerY + spec.ry
  const finH = Math.max(0.45, spec.heightM - top)
  return {
    spec,
    tier,
    livery,
    group,
    meshes: [],
    spinners: [],
    gears: [],
    strobes: [],
    beacons: [],
    lamps: [],
    rigs: [],
    nose: spec.lengthM / 2,
    tailX: -spec.lengthM / 2,
    centerY,
    top,
    finH,
    wingX: spec.lengthM * (0.5 - spec.wingAt),
    wingY: spec.wingHigh ? centerY + spec.ry * 0.7 : centerY - spec.ry * 0.28,
  }
}

function markLivery(mesh: THREE.Object3D, mode: 'fuselage' | 'tail' | 'engine', box?: LiveryBox) {
  mesh.userData.liveryMap = mode
  if (box) mesh.userData.liveryBox = box
}

function fuselageBox(frame: Frame): LiveryBox {
  const { spec, centerY, nose, tailX } = frame
  return {
    x0: nose,
    x1: tailX,
    y0: centerY - spec.ry,
    y1: centerY + spec.ry * (spec.hump ? 1.45 : 1),
  }
}

function addMesh(
  frame: Frame,
  mesh: THREE.Mesh,
  slot: PaintSlot,
  kind: string,
  shadow = false,
): PaintedMesh {
  const painted = paintMesh(mesh, slot, frame.livery, kind, frame.tier)
  painted.castShadow = shadow
  frame.group.add(painted)
  frame.meshes.push(painted)
  return painted
}

function addBox(
  frame: Frame,
  size: [number, number, number],
  pos: [number, number, number],
  slot: PaintSlot,
  kind: string,
  rot?: [number, number, number],
  shadow = false,
): PaintedMesh {
  const mesh = new THREE.Mesh(unitBox())
  mesh.scale.set(size[0], size[1], size[2])
  mesh.position.set(pos[0], pos[1], pos[2])
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2])
  return addMesh(frame, mesh, slot, kind, shadow)
}

function addCylinder(
  frame: Frame,
  radius: number,
  length: number,
  pos: [number, number, number],
  slot: PaintSlot,
  kind: string,
  axis: 'x' | 'y' | 'z',
): PaintedMesh {
  const mesh = new THREE.Mesh(unitCylinder(cylinderSides(frame.tier)))
  // Unit cylinder runs along Y. Scale Y is length.
  mesh.scale.set(radius, length, radius)
  mesh.position.set(pos[0], pos[1], pos[2])
  if (axis === 'x') mesh.rotation.z = Math.PI / 2
  else if (axis === 'z') mesh.rotation.x = Math.PI / 2
  return addMesh(frame, mesh, slot, kind)
}

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _m = new THREE.Matrix4()

function compose(
  x: number, y: number, z: number,
  rx: number, ry: number, rz: number,
  sx: number, sy: number, sz: number,
): THREE.Matrix4 {
  _e.set(rx, ry, rz)
  _q.setFromEuler(_e)
  _p.set(x, y, z)
  _s.set(sx, sy, sz)
  return _m.compose(_p, _q, _s).clone()
}

function enginePoints(frame: Frame): THREE.Vector3[] {
  const { spec, wingX, wingY, centerY, nose, tailX } = frame
  const eng = spec.engines
  if (eng.count === 0) return []
  const pts: THREE.Vector3[] = []
  if (eng.mount === 'nose') {
    pts.push(new THREE.Vector3(nose - eng.length * 0.15, centerY, 0))
    return pts
  }
  if (eng.mount === 'rear') {
    // High on the rear fuselage, ahead of the tail cone: CRJ, E-Jet, Citation.
    const x = tailX + spec.lengthM * 0.22
    const y = centerY + spec.ry * 0.38
    const z = spec.rx + eng.radius * 0.42
    pts.push(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, -z))
    return pts
  }
  if (eng.mount === 'tail') {
    const x = tailX + eng.length * 0.35
    const z = spec.rx * 0.42
    pts.push(new THREE.Vector3(x, centerY, z), new THREE.Vector3(x, centerY, -z))
    return pts
  }
  const semi = spec.spanM / 2
  // Inboard pair for quads (747, A380, C-130). Narrowbody twins sit closer to the root than widebody twins.
  const fracs = eng.count === 4 ? [0.25, 0.52] : [spec.spanM >= 55 ? 0.34 : 0.3]
  const tanSweep = Math.tan((spec.sweep * Math.PI) / 180)
  const tanDih = Math.tan((spec.dihedral * Math.PI) / 180)
  const fan = eng.kind !== 'turboprop'
  for (const frac of fracs) {
    const z = semi * frac
    // Follow the swept, dihedral leading edge so the pod hangs under the wing, not behind it.
    const chordAt = spec.rootChord + (spec.tipChord - spec.rootChord) * frac
    const le = wingX + spec.rootChord / 2 - tanSweep * z
    const wy = wingY + tanDih * z
    const x = fan ? le + eng.length * 0.12 : le - chordAt * 0.15 + eng.length * 0.2
    const y = spec.wingHigh
      ? (fan ? wy - eng.radius * 1.15 : wy - eng.radius * 0.2)
      : (fan ? wy - eng.radius * 1.3 - spec.thickness * 0.2 : wy + eng.radius * 0.1)
    pts.push(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, -z))
  }
  return pts
}

function addInstances(
  frame: Frame,
  geo: THREE.BufferGeometry,
  matrices: THREE.Matrix4[],
  slot: PaintSlot,
  kind: string,
  name: string,
): PaintedMesh | null {
  if (!matrices.length) return null
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), matrices.length)
  matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
  mesh.instanceMatrix.needsUpdate = true
  mesh.name = name
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  return addMesh(frame, mesh, slot, kind)
}

function addFuselage(frame: Frame) {
  if (frame.tier === 'high') return
  const { spec } = frame
  const sides = fuselageSides(frame.tier)
  const family = loftFamily(spec)
  const mesh = new THREE.Mesh(paintedLoftGeometry(family, sides, fuselagePaint(frame.livery)))
  mesh.scale.set(spec.lengthM, spec.ry, spec.rx)
  mesh.position.set(0, frame.centerY, 0)
  mesh.name = 'fuselage'
  const body = addMesh(frame, mesh, 'body', 'mesh', frame.tier === 'mid')
  markLivery(body, 'fuselage', fuselageBox(frame))
  if (spec.hump) {
    const top = fuselagePaint(frame.livery).crown
    const hump = new THREE.Mesh(
      paintedLoftGeometry('hump', sides, { crown: top, body: top, belly: top }),
    )
    // Forehead from the cockpit back to the wing, wide enough to blend into the tube.
    hump.scale.set(spec.lengthM * 0.5, spec.ry * 0.48, spec.rx * 0.78)
    hump.position.set(spec.lengthM * 0.2, frame.top - spec.ry * 0.12, 0)
    hump.name = 'hump'
    markLivery(addMesh(frame, hump, 'body', 'mesh', frame.tier === 'mid'), 'fuselage', fuselageBox(frame))
  }
}

/** Crown, airline band and belly colours for the fuselage loft. */
function fuselagePaint(livery: Livery): { crown: string; body: string; belly: string } {
  const belly = `#${new THREE.Color(livery.body).multiplyScalar(AIRCRAFT_LOOK.bellyShade).getHexString()}`
  const crown = livery.scheme === 'solid' ? livery.body : AIRCRAFT_LOOK.crown
  return { crown, body: livery.body, belly }
}

function addWing(frame: Frame) {
  if (frame.tier === 'high' || frame.spec.family === 'helo') return
  const { spec, wingX, wingY } = frame
  if (frame.tier === 'low') {
    const chord = (spec.rootChord + spec.tipChord) / 2
    const mesh = addBox(
      frame,
      [chord, spec.thickness, spec.spanM],
      [wingX, wingY, 0],
      'wing',
      'mesh',
      undefined,
      false,
    )
    mesh.name = 'wing'
    return
  }
  const mesh = new THREE.Mesh(
    wingGeometry(spec.spanM, spec.rootChord, spec.tipChord, spec.sweep, spec.dihedral, spec.thickness),
  )
  mesh.position.set(wingX, wingY, 0)
  mesh.name = 'wing'
  addMesh(frame, mesh, 'wing', 'mesh', true)
  if (spec.winglet !== 'none') {
    const semi = spec.spanM / 2
    const sweep = Math.tan((spec.sweep * Math.PI) / 180) * semi
    const lift = Math.tan((spec.dihedral * Math.PI) / 180) * semi
    const tipX = wingX + spec.rootChord / 2 - sweep - spec.tipChord * 0.42
    const tipY = wingY + lift
    if (spec.winglet === 'raked') {
      const len = Math.max(2.4, spec.tipChord * 1.25)
      const reach = Math.min(len * 0.38, semi * 0.06)
      for (const sign of [1, -1] as const) {
        const device = new THREE.Mesh(wingletGeometry('raked'))
        device.scale.set(len, Math.max(0.14, spec.thickness * 0.4), sign * reach)
        device.position.set(tipX + spec.tipChord * 0.05, tipY, sign * (semi - 0.02))
        device.name = 'winglet'
        addMesh(frame, device, 'tail', 'mesh')
      }
    } else {
      const height = spec.winglet === 'fence'
        ? Math.max(1.35, spec.tipChord * 0.95)
        : Math.max(2.15, spec.tipChord * 1.3)
      const chord = Math.max(0.55, spec.tipChord * 0.62)
      const thick = Math.max(0.08, spec.thickness * 0.32)
      for (const sign of [1, -1] as const) {
        const device = new THREE.Mesh(wingletGeometry(spec.winglet))
        device.scale.set(chord, height, thick)
        device.position.set(tipX, tipY, sign * (semi - 0.06))
        device.name = 'winglet'
        addMesh(frame, device, 'tail', 'mesh')
      }
    }
  }
}

function addTail(frame: Frame) {
  if (frame.tier === 'high' || frame.spec.family === 'helo') return
  const { spec, tailX, top, finH, centerY } = frame
  const chord = Math.max(1.1, spec.lengthM * 0.11)
  const thick = Math.max(0.08, spec.rx * 0.08)
  const finX = tailX + chord * 0.55
  const tailPaint = frame.livery.tail || frame.livery.stripe
  const finBox: LiveryBox = {
    x0: finX + chord * 0.42,
    x1: finX - chord * 0.5,
    y0: top,
    y1: top + finH,
  }
  const placeFin = (z: number, name: string) => {
    const mesh = new THREE.Mesh(finGeometry(tailPaint, frame.livery.stripe))
    mesh.scale.set(chord, finH, thick)
    mesh.position.set(finX, top, z)
    mesh.name = name
    const painted = addMesh(frame, mesh, 'tail', 'mesh', frame.tier === 'mid')
    markLivery(painted, 'tail', finBox)
  }
  if (spec.tail === 'twin') {
    const spread = Math.max(0.7, spec.rx * 0.85)
    placeFin(spread, 'tail')
    placeFin(-spread, 'tail')
  } else {
    placeFin(0, 'tail')
  }
  const stabY = spec.tail === 't' ? frame.spec.heightM - 0.12 : centerY + spec.ry * 0.2
  const stabChord = Math.max(0.8, spec.rootChord * 0.42)
  const stab = new THREE.Mesh(stabGeometry())
  stab.scale.set(stabChord, Math.max(0.08, spec.thickness * 0.22), spec.tailSpan)
  stab.position.set(finX - chord * 0.15, stabY, 0)
  stab.name = 'stab'
  addMesh(frame, stab, 'tail', 'mesh')
}

function addEngines(frame: Frame) {
  const { spec, tier } = frame
  const eng: EngineSpec = spec.engines
  if (eng.count === 0 || tier === 'high') return
  const pts = enginePoints(frame)
  frame.group.userData.enginePoints = pts.map((p) => p.clone())
  const sides = cylinderSides(tier)
  const matrices = pts.map((p) =>
    compose(p.x, p.y, p.z, 0, 0, Math.PI / 2, eng.radius, eng.length, eng.radius),
  )
  const fanPod = eng.kind === 'turbofan' || eng.kind === 'turbojet'
  const mesh = addInstances(frame, fanPod && tier === 'mid' ? nacelleGeometry(sides) : unitCylinder(sides), matrices, 'metal', 'mesh', 'engines')
  if (mesh) {
    mesh.name = 'engines'
    markLivery(mesh, 'engine')
  }
  if (tier !== 'low' && eng.mount === 'wing') {
    const pylons: THREE.Matrix4[] = []
    const tanDih = Math.tan((spec.dihedral * Math.PI) / 180)
    for (const p of pts) {
      const nacelleTop = p.y + eng.radius * 0.7
      const h = frame.wingY + tanDih * Math.abs(p.z) - nacelleTop + 0.1
      if (h < 0.2) continue
      // Swept pylon: blade from the cowl back to the wing box, raked like the real strut.
      pylons.push(compose(p.x - eng.length * 0.28, nacelleTop + h / 2, p.z, 0, 0, 0.18, eng.length * 0.75, h, Math.max(0.16, eng.radius * 0.16)))
    }
    const pylon = addInstances(frame, unitBox(), pylons, 'metal', 'mesh', 'pylon')
    if (pylon) pylon.name = 'pylon'
  }
  if (tier !== 'low' && eng.kind !== 'turboprop' && !fanPod) {
    const nozzles = pts.map((p) =>
      compose(p.x - eng.length * 0.4, p.y, p.z, 0, 0, Math.PI / 2, eng.radius * 0.62, eng.length * 0.18, eng.radius * 0.62),
    )
    const nozzle = addInstances(frame, unitCylinder(sides), nozzles, 'dark', 'mesh', 'nozzle')
    if (nozzle) nozzle.name = 'nozzle'
  }
  if (tier === 'low') {
    if (eng.kind === 'turboprop') addPropDiscs(frame, pts, eng)
    return
  }
  const intakeR = eng.radius * 1.08
  const intakes = pts.map((p) =>
    compose(
      p.x + eng.length * 0.48,
      p.y,
      p.z,
      0,
      0,
      Math.PI / 2,
      intakeR,
      0.22,
      intakeR,
    ),
  )
  if (!fanPod) addInstances(frame, unitCylinder(sides), intakes, 'metal', 'mesh', 'intakes')
  if (eng.kind === 'turbofan' || eng.kind === 'turbojet') {
    const discs = pts.map((p) =>
      compose(
        p.x + eng.length * 0.39,
        p.y,
        p.z,
        0,
        0,
        Math.PI / 2,
        eng.radius * 0.8,
        0.04,
        eng.radius * 0.8,
      ),
    )
    addInstances(frame, unitCylinder(sides), discs, 'dark', 'mesh', 'fan-disc')
    if (fanPod) {
      // Separate spinner cone on the fan face and a bright rolled intake lip.
      const cones = pts.map((p) => compose(p.x + eng.length * 0.3, p.y, p.z, 0, 0, 0, eng.radius * 0.5, eng.radius * 0.3, eng.radius * 0.3))
      const cone = addInstances(frame, spinnerConeGeometry(), cones, 'metal', 'mesh', 'spinner')
      if (cone) cone.name = 'spinner'
      const lips = pts.map((p) => compose(p.x + eng.length * 0.5, p.y, p.z, 0, 0, 0, eng.radius * 0.99, eng.radius * 0.99, eng.radius * 0.99))
      const lip = addInstances(frame, intakeLipGeometry(), lips, 'metal', 'mesh', 'intake-lip')
      if (lip) lip.name = 'intake-lip'
    }
  }
  if (eng.kind === 'turboprop') addPropBlades(frame, pts, eng, 'prop')
}

function addPropDiscs(frame: Frame, pts: THREE.Vector3[], eng: EngineSpec) {
  const radius = eng.radius * 3.1
  for (const p of pts) {
    const disc = new THREE.Mesh(unitDisc('prop'))
    disc.scale.setScalar(radius)
    disc.position.set(p.x + eng.length * 0.55, p.y, p.z)
    disc.name = 'prop'
    addMesh(frame, disc, 'dark', 'mesh')
    frame.spinners.push(disc)
  }
}

function addPropBlades(
  frame: Frame,
  pts: THREE.Vector3[],
  eng: EngineSpec,
  name: 'prop' | 'fan',
) {
  const blades = name === 'fan' ? 8 : Math.max(4, frame.spec.blades || 4)
  const radius = name === 'fan' ? eng.radius * 0.78 : eng.radius * 3.05
  const geo = unitBox()
  for (const p of pts) {
    const hub = new THREE.Group()
    hub.name = name
    hub.position.set(p.x + (name === 'fan' ? eng.length * 0.42 : eng.length * 0.55), p.y, p.z)
    const matrices: THREE.Matrix4[] = []
    for (let i = 0; i < blades; i++) {
      const angle = (i / blades) * Math.PI * 2
      matrices.push(
        compose(
          0,
          Math.cos(angle) * radius * 0.48,
          Math.sin(angle) * radius * 0.48,
          angle,
          0,
          0,
          name === 'fan' ? 0.06 : 0.1,
          radius * 0.92,
          name === 'fan' ? 0.14 : 0.22,
        ),
      )
    }
    const mesh = new THREE.InstancedMesh(name === 'prop' ? bladeGeometry() : geo, new THREE.MeshBasicMaterial(), blades)
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
    const painted = paintMesh(mesh, 'dark', frame.livery, 'mesh', frame.tier)
    hub.add(painted)
    frame.meshes.push(painted)
    frame.group.add(hub)
    frame.spinners.push(hub)
  }
}

function addFans(frame: Frame) {
  if (frame.tier !== 'high') return
  const eng = frame.spec.engines
  if (eng.kind !== 'turbofan' && eng.kind !== 'turbojet') return
  if (eng.count === 0) return
  addPropBlades(frame, enginePoints(frame), eng, 'fan')
}

/**
 * Height above ground of the lowest airframe skin over (x, z): the fuselage loft,
 * the wing-to-body fairing or the wing's lower surface, whichever the leg meets first.
 */
const skinRay = new THREE.Raycaster()
export function skinUnderside(frame: Pick<Frame, 'spec' | 'nose' | 'centerY' | 'wingX' | 'wingY'> & { group?: THREE.Group }, x: number, z: number): number | null {
  const { spec, nose, centerY, wingX, wingY } = frame
  const hits: number[] = []
  // Ground truth first: the skin already built (fuselage, wing, tail), hit from below.
  if (frame.group) {
    frame.group.updateMatrixWorld(true)
    const skin: THREE.Object3D[] = []
    frame.group.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return
      for (let a: THREE.Object3D | null = o; a; a = a.parent) if (a.name.startsWith('gear') || a.name === 'engines') return
      skin.push(o)
    })
    skinRay.set(new THREE.Vector3(x, 0.01, z), new THREE.Vector3(0, 1, 0))
    const hit = skinRay.intersectObjects(skin, false)[0]
    if (hit && hit.point.y < centerY + spec.ry) hits.push(hit.point.y)
  }
  const fam = spec.family === 'rearjet' ? 'rearjet' : spec.family === 'prop' ? 'prop' : spec.family === 'helo' ? 'helo' : 'tube'
  const t = (nose - x) / spec.lengthM
  if (!frame.group && t >= 0 && t <= 1) {
    const st = loftStation(fam, t)
    const u = Math.abs(z) / (spec.rx * st.r)
    if (u < 0.98) hits.push(centerY + spec.ry * (st.dy - st.r * Math.sqrt(1 - u * u)))
  }
  if (spec.family === 'tube' && spec.engines.mount === 'wing' && spec.lengthM > 25) {
    const a = spec.rootChord * 0.95
    const c = spec.rx * 0.93
    const dx = (x - (wingX - spec.rootChord * 0.05)) / a
    const dz = z / c
    const q = 1 - dx * dx - dz * dz
    if (q > 0.02) hits.push(centerY - spec.ry * 0.7 - spec.ry * 0.42 * Math.sqrt(q))
  }
  if (!frame.group && !spec.wingHigh && spec.family !== 'helo') {
    const semi = spec.spanM / 2
    const az = Math.abs(z)
    if (az < semi) {
      const frac = az / semi
      const chord = spec.rootChord + (spec.tipChord - spec.rootChord) * frac
      const le = wingX + spec.rootChord / 2 - Math.tan((spec.sweep * Math.PI) / 180) * az
      if (x <= le + 0.1 && x >= le - chord - 0.1) {
        hits.push(wingY + Math.tan((spec.dihedral * Math.PI) / 180) * az - spec.thickness * 0.5)
      }
    }
  }
  // Nothing overhead (e.g. a wide-track leg on a high wing): use the belly line, sponson-style.
  if (!hits.length) return null
  return Math.max(0.4, Math.min(...hits))
}

/** Streamlined gear pods on both hips, blending the main legs into the fuselage. */
function addSponsons(frame: Frame, gear: THREE.Group, x: number, roof: number, wheelR: number, bogie: boolean) {
  const { spec } = frame
  for (const s of [1, -1]) {
    const pod = new THREE.Mesh(smoothSphere())
    pod.name = 'sponson'
    pod.scale.set(wheelR * (bogie ? 4.2 : 3), Math.max(0.3, spec.ry * 0.3), spec.rx * 0.32)
    pod.position.set(x, roof - spec.gear + pod.scale.y * 0.55, s * spec.rx * 0.82)
    const painted = paintMesh(pod, 'belly', frame.livery, 'mesh', frame.tier)
    gear.add(painted)
    frame.meshes.push(painted)
  }
}

/** Real 777s ride on six-wheel main bogies. */
const SIX_WHEEL_MAINS = new Set(['b77w'])

function addGear(frame: Frame) {
  const { spec, tier, nose, tailX } = frame
  const gear = new THREE.Group()
  gear.name = 'gear'
  gear.position.set(0, spec.gear, 0)
  frame.group.add(gear)
  frame.gears.push(gear)

  const wheelR = Math.max(0.28, spec.gear * 0.2)
  const localGround = -spec.gear
  const lowBoxes: THREE.Matrix4[] = []
  const struts: THREE.Matrix4[] = []
  const wheels: THREE.Matrix4[] = []
  const bays: THREE.BufferGeometry[] = []

  const mount = (x: number, z: number, bogie: boolean, role: 'nose' | 'main' | 'body' = 'main') => {
    // Close LOD reuses the mid legs; they already carry links, hubs and doors.
    if (tier === 'high') return
    if (tier === 'low') {
      lowBoxes.push(
        compose(x, localGround + spec.gear * 0.46, z, 0, 0, 0, wheelR * 1.4, spec.gear * 0.92, wheelR * 0.7),
      )
      return
    }
    const airliner = spec.lengthM > 20 && spec.family !== 'point'
    const six = (role === 'main' && SIX_WHEEL_MAINS.has(spec.id)) || (role === 'body' && spec.lengthM > 68)
    const kind: LegKind = role === 'nose'
      ? (airliner ? 'nose' : 'single')
      : bogie ? (six ? 'bogie6' : 'bogie4') : airliner ? 'twin' : 'single'
    // Built for the starboard side; port legs mirror on Z so both share one geometry.
    const doorSide = role === 'main' && spec.family !== 'helo' ? 1 : 0
    // The leg hangs from the real skin above it (fuselage, belly fairing or wing), not
    // from a fixed height, so the oleo starts inside the bay and the tyres sit on the ground.
    let roof = skinUnderside(frame, x, z)
    if (roof === null || (spec.wingHigh && role === 'main' && Math.abs(z) > spec.rx * 0.7)) {
      // Nothing overhead (high wing, or a leg aft of the wing): tuck it under the hip
      // in a sponson, like the ATR, C-130 and C-17 gear pods.
      z = Math.sign(z || 1) * spec.rx * 0.78
      roof = skinUnderside(frame, x, z) ?? Math.max(spec.gear, frame.centerY - spec.ry * 0.85)
      if (role === 'main' && z > 0) addSponsons(frame, gear, x, roof, wheelR, bogie)
    }
    const embed = Math.max(0.12, wheelR * 0.35)
    const legH = roof + embed
    const geo = legGeometry({
      kind,
      height: legH,
      wheelR: role === 'nose' ? wheelR * 0.8 : wheelR,
      doorSide,
      skinR: Math.max(spec.rx, spec.ry),
    })
    const leg = new THREE.Group()
    leg.name = `gear-${role}`
    leg.position.set(x, legH - spec.gear, z)
    if (z < 0) leg.scale.z = -1
    // Nose swings forward about Z; mains fold inboard about X.
    leg.userData.retract = role === 'nose'
      ? { axis: 'z', angle: spec.tailWheel ? -1.5 : 1.5 }
      : { axis: 'x', angle: (z >= 0 ? 1 : -1) * 1.5 }
    // One mesh per leg. The nose leg steers about its own vertical axis (Euler YXZ),
    // which only applies while the gear is fully down.
    const mesh = paintVertexMesh(new THREE.Mesh(geo), 'mid', 'mesh', 'gear')
    mesh.name = 'leg'
    leg.add(mesh)
    frame.meshes.push(mesh)
    leg.rotation.order = 'YXZ'
    if (role === 'nose' && !spec.tailWheel) leg.userData.steer = true
    gear.add(leg)
    frame.gears.push(leg)
    // Wheel well and open bay doors at the skin, merged into one mesh for all legs below.
    const r = role === 'nose' ? wheelR * 0.8 : wheelR
    const span = kind === 'bogie6' ? r * 5.6 : kind === 'bogie4' ? r * 3.4 : r * 2.4
    const wid = kind === 'single' ? r * 1.1 : r * 1.9
    const at = new THREE.Matrix4().makeTranslation(x, roof + 0.02 - spec.gear, z)
    if (role === 'nose') {
      // The nose skin curves up fast: sample it fore, aft and both sides of the well,
      // then raise and tilt the plate so it sits on the skin instead of under it.
      const s = (dx: number, dz: number) => skinUnderside(frame, x + dx, z + dz) ?? roof
      const fwd = s(span / 2, 0)
      const aft = s(-span / 2, 0)
      const stbd = s(0, wid / 2)
      const port = s(0, -wid / 2)
      const lift = (fwd + aft + stbd + port) / 4
      const pitch = Math.atan2(fwd - aft, span)
      const roll = Math.atan2(port - stbd, wid)
      at.compose(
        new THREE.Vector3(x, Math.max(roof, lift) + 0.02 - spec.gear, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(roll, 0, pitch)),
        new THREE.Vector3(1, 1, 1),
      )
    }
    bays.push(wellGeometry(span, wid).applyMatrix4(at))
    if (spec.family !== 'helo') bays.push(bayDoorsGeometry(span * 0.9, wid, Math.min(r * 1.5, legH * 0.45), Math.max(spec.rx, spec.ry)).applyMatrix4(at))
  }

  if (spec.skids) {
    if (tier === 'high') return
    for (const sign of [1, -1]) {
      const skid = new THREE.Mesh(unitBox())
      skid.scale.set(spec.lengthM * 0.46, 0.08, 0.1)
      skid.position.set(0, localGround + 0.04, sign * spec.rx * 0.75)
      const painted = paintMesh(skid, 'metal', frame.livery, 'mesh', tier)
      gear.add(painted)
      frame.meshes.push(painted)
    }
    return
  }

  // Wheelbase is nose-to-main for tricycle gear, main-to-tail for taildraggers.
  const inset = Math.min(2.4, spec.lengthM * 0.11)
  let forwardX: number
  let aftX: number
  if (spec.tailWheel) {
    aftX = tailX + Math.min(0.7, spec.lengthM * 0.04)
    forwardX = aftX + spec.wheelbaseM
  } else {
    forwardX = nose - inset
    aftX = forwardX - spec.wheelbaseM
  }
  const axle = Math.abs(forwardX - aftX)
  gear.userData.wheelbase = axle
  frame.group.userData.wheelbase = axle
  const mainZ = spec.family === 'helo'
    ? Math.max(spec.rx * 0.7, 0.55)
    : spec.wingHigh
      ? Math.max(spec.rx * 0.95, spec.spanM * 0.07)
      : Math.max(spec.rx * 1.2, spec.spanM * 0.09)

  if (spec.family === 'helo') {
    mount(forwardX, mainZ, false)
    mount(forwardX, -mainZ, false)
    mount(aftX, mainZ, false)
    mount(aftX, -mainZ, false)
  } else if (spec.tailWheel) {
    mount(forwardX, mainZ, false)
    mount(forwardX, -mainZ, false)
    mount(aftX, 0, false)
  } else {
    mount(forwardX, 0, false, 'nose')
    mount(aftX, mainZ, spec.bogie)
    mount(aftX, -mainZ, spec.bogie)
    if (spec.bodyGear) {
      const bodyX = aftX - Math.min(spec.rootChord * 0.35, spec.lengthM * 0.08)
      mount(bodyX, spec.rx * 0.32, spec.bogie, 'body')
      mount(bodyX, -spec.rx * 0.32, spec.bogie, 'body')
    }
  }

  const park = (geo: THREE.BufferGeometry, matrices: THREE.Matrix4[], slot: PaintSlot) => {
    if (!matrices.length) return
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), matrices.length)
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
    const painted = paintMesh(mesh, slot, frame.livery, 'mesh', tier)
    gear.add(painted)
    frame.meshes.push(painted)
  }
  park(unitBox(), lowBoxes, 'metal')
  park(unitCylinder(cylinderSides(tier === 'low' ? 'low' : 'mid')), struts, 'metal')
  park(unitCylinder(8), wheels, 'rubber')
  if (bays.length) {
    const bay = new THREE.Group()
    bay.name = 'gear-bay'
    // Never swings; hidden once the gear is up and the doors shut.
    bay.userData.bay = true
    const merged = mergeGeometries(bays)!
    bays.forEach((g) => g.dispose())
    const mesh = paintVertexMesh(new THREE.Mesh(merged), 'mid', 'mesh', 'gear')
    mesh.name = 'bay-doors'
    mesh.userData.ownGeo = true
    bay.add(mesh)
    frame.meshes.push(mesh)
    gear.add(bay)
    frame.gears.push(bay)
  }
  if (tier === 'mid') gear.userData.legs = true
}

function addWindows(frame: Frame) {
  if (frame.tier !== 'mid' || !frame.spec.windows || frame.spec.family === 'helo') return
  const { spec } = frame
  // Same stations as the close-up window mesh so the two LODs overlap exactly.
  const matrices = windowMatrices(spec, Math.min(spec.decks, 2))
  const band = addInstances(frame, windowGeometry(), matrices, 'glass', 'band', 'window-band')
  if (band) band.name = 'window-band'
}

/** Pack door stations, one instanced mesh. Close LOD only. */
function addRealDoors(frame: Frame) {
  if (frame.tier !== 'high' || frame.spec.doors.length === 0) return
  const boxes = doorBoxes(frame.spec)
  // Ramps and belly doors keep the plain dark cut; side doors get a framed doorway with
  // a cabin glimpse, seen when the leaf swings open.
  const plain = boxes.filter((b) => b.door.side === 0)
  if (plain.length) {
    addInstances(frame, unitBox(), plain.map((box) => compose(box.x, box.y, box.z, 0, 0, 0, box.w, box.h, box.depth)), 'dark', 'mesh', 'doors')
  }
  const parts = boxes
    .filter((b) => b.door.side !== 0)
    .map((b) => {
      const g = doorwayGeometry(b.w, b.h)
      const m = new THREE.Matrix4().makeTranslation(b.x, b.y, b.door.side * frame.spec.rx * 0.985)
      if (b.door.side < 0) m.multiply(new THREE.Matrix4().makeScale(1, 1, -1))
      g.applyMatrix4(m)
      if (b.door.side < 0) {
        // Mirroring flips the winding; swap it back so faces stay outward.
        const pos = g.getAttribute('position')
        for (let i = 0; i < pos.count; i += 3) {
          for (const attr of Object.values(g.attributes)) {
            const a = attr as THREE.BufferAttribute
            for (let c = 0; c < a.itemSize; c++) {
              const t = a.getComponent(i + 1, c)
              a.setComponent(i + 1, c, a.getComponent(i + 2, c))
              a.setComponent(i + 2, c, t)
            }
          }
        }
        g.computeVertexNormals()
      }
      return g
    })
  if (parts.length) {
    const mesh = paintVertexMesh(new THREE.Mesh(mergeGeometries(parts)!), 'mid', 'mesh', 'gear')
    mesh.name = 'doorways'
    mesh.userData.ownGeo = true
    parts.forEach((g) => g.dispose())
    frame.group.add(mesh)
    frame.meshes.push(mesh)
  }
}

function finPose(frame: Frame) {
  const chord = Math.max(1.1, frame.spec.lengthM * 0.11)
  const thick = Math.max(0.08, frame.spec.rx * 0.08)
  return {
    finX: frame.tailX + chord * 0.55,
    chord,
    thick,
    stabY: frame.spec.tail === 't' ? frame.spec.heightM - 0.12 : frame.centerY + frame.spec.ry * 0.2,
  }
}

function addControls(frame: Frame) {
  if (frame.tier !== 'mid' || frame.spec.family === 'helo') return
  const { spec, wingX, wingY } = frame
  const semi = spec.spanM / 2
  const f = 0.8
  const sweepFull = Math.tan((spec.sweep * Math.PI) / 180) * semi
  const lift = Math.tan((spec.dihedral * Math.PI) / 180) * semi * f
  // Trailing edge at span fraction f, on the tapered, swept planform.
  const teX = wingX - (spec.rootChord / 2) * (1 - f) + (spec.rootChord / 2 - sweepFull - spec.tipChord) * f
  const teYaw = Math.atan2(spec.rootChord - sweepFull - spec.tipChord, semi)
  const chordAt = spec.rootChord * (1 - f) + spec.tipChord * f
  const aileronSpan = Math.max(0.7, spec.spanM * 0.1)
  const aileronChord = Math.max(0.28, chordAt * 0.24)
  for (const sign of [1, -1] as const) {
    const mesh = addBox(
      frame,
      [aileronChord, Math.max(0.05, spec.thickness * 0.14), aileronSpan],
      [teX + aileronChord * 0.45, wingY + lift + spec.thickness * 0.05, sign * semi * f],
      'wing',
      'control',
      [0, sign * teYaw, 0],
    )
    mesh.name = 'aileron'
    mesh.userData.surface = 'aileron'
    mesh.userData.sign = sign
  }
  const { finX, chord, stabY, thick } = finPose(frame)
  const elevator = addBox(
    frame,
    [Math.max(0.28, chord * 0.28), Math.max(0.05, spec.thickness * 0.16), spec.tailSpan * 0.72],
    [finX - chord * 0.42, stabY, 0],
    'tail',
    'control',
  )
  elevator.name = 'elevator'
  elevator.userData.surface = 'elevator'
  elevator.userData.sign = 1
  if (spec.tail === 'twin') {
    const spread = Math.max(0.7, spec.rx * 0.85)
    for (const sign of [1, -1] as const) {
      const rudder = addBox(
        frame,
        [Math.max(0.22, chord * 0.22), frame.finH * 0.55, thick * 0.8],
        [finX - chord * 0.2, frame.top + frame.finH * 0.62, sign * spread],
        'tail',
        'control',
      )
      rudder.name = 'rudder'
      rudder.userData.surface = 'rudder'
      rudder.userData.sign = sign
    }
  } else {
    const rudder = addBox(
      frame,
      [Math.max(0.22, chord * 0.22), frame.finH * 0.55, thick * 0.9],
      [finX - chord * 0.15, frame.top + frame.finH * 0.62, 0],
      'tail',
      'control',
    )
    rudder.name = 'rudder'
    rudder.userData.surface = 'rudder'
    rudder.userData.sign = 1
  }
}

function fileLogoMaterials(url: string): { opaque: THREE.Material; fade: THREE.Material } {
  const opaque = sharedMat(`logo:file:${url}`, () => {
    const map = new THREE.TextureLoader().load(url)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    return new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    })
  })
  const fade = sharedMat(`fade:logo:file:${url}`, () => {
    const copy = opaque.clone()
    copy.transparent = true
    copy.depthWrite = true
    return copy
  })
  return { opaque, fade }
}

function addLogo(frame: Frame) {
  if (frame.tier !== 'mid') return
  const brand = resolveBrand(frame.livery)
  const airlineId = (frame.livery.airline ?? '').split('@')[0]
  const logoUrl = airlineId && !listedLivery(airlineId) ? airlineLogoUrl(airlineId) : null
  const { opaque, fade } =
    logoUrl && typeof document !== 'undefined' ? fileLogoMaterials(logoUrl) : logoMaterials(brand)
  const place = (x: number, y: number, z: number, size: number) => {
    const mesh = new THREE.Mesh(unitPlane())
    mesh.scale.set(size, size, 1)
    mesh.position.set(x, y, z)
    mesh.name = 'logo'
    mesh.userData.paint = brand.tail
    mesh.material = opaque
    mesh.userData.opaqueMat = opaque
    mesh.userData.fadeMat = fade
    mesh.userData.lodOpacity = 1
    mesh.userData.kind = 'decal'
    mesh.userData.tier = frame.tier
    mesh.userData.airline = frame.livery.airline
    const fadeMat = fade as THREE.Material & { opacity: number }
    mesh.onBeforeRender = () => {
      const airline = resolveLiveryAirline(mesh.userData.airline as string | undefined)
      const id = airline?.split('@')[0]
      // A photographed tail already carries the mark. Procedural fins keep the decal.
      const photo = Boolean(id && listedLivery(id) && liveryPlateReady(id))
      mesh.visible = !photo
      if (mesh.material === fadeMat) fadeMat.opacity = mesh.userData.lodOpacity as number
    }
    frame.group.add(mesh)
    frame.meshes.push(mesh as PaintedMesh)
  }
  if (frame.spec.family === 'helo') {
    place(frame.tailX + frame.spec.lengthM * 0.08, frame.centerY + frame.spec.ry * 0.15, frame.spec.rx + 0.04, 0.7)
    return
  }
  const { finX, thick } = finPose(frame)
  const size = Math.max(0.55, Math.min(frame.finH * 0.38, frame.spec.rx * 0.85))
  const y = frame.top + frame.finH * 0.55
  if (frame.spec.tail === 'twin') {
    const spread = Math.max(0.7, frame.spec.rx * 0.85)
    place(finX, y, spread + thick * 0.6, size * 0.7)
    place(finX, y, -(spread + thick * 0.6), size * 0.7)
  } else {
    place(finX, y, 0, size)
  }
}

/** Cabin window stations: a dark band of oval windows, skipping the wing box. */
function windowMatrices(spec: ModelSpec, decks: number): THREE.Matrix4[] {
  const centerY = spec.gear + spec.ry
  const wingX = spec.lengthM * (0.5 - spec.wingAt)
  const pitch = 0.86
  const x0 = spec.lengthM * 0.32
  const x1 = -spec.lengthM * 0.28
  const count = Math.max(8, Math.round((x0 - x1) / pitch))
  const matrices: THREE.Matrix4[] = []
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * i) / (count - 1)
    if (Math.abs(x - wingX) < spec.rootChord * 0.12) continue
    for (const sign of [1, -1]) {
      for (let deck = 0; deck < decks; deck++) {
        const k = deck === 0 ? 0.16 : 0.56
        const z = spec.rx * Math.sqrt(1 - k * k) + 0.01
        matrices.push(compose(x, centerY + spec.ry * k, sign * z, 0, sign > 0 ? 0 : Math.PI, 0, 0.3, 0.42, 1))
      }
    }
  }
  return matrices
}

/** Individual windows. Built on demand so mid-range aircraft skip the instance buffer. */
export function createWindowMesh(spec: ModelSpec, livery: Livery): THREE.InstancedMesh | null {
  if (!spec.windows || spec.family === 'helo') return null
  const matrices = windowMatrices(spec, spec.decks)
  if (!matrices.length) return null
  const mesh = new THREE.InstancedMesh(windowGeometry(), new THREE.MeshBasicMaterial(), matrices.length)
  matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
  mesh.instanceMatrix.needsUpdate = true
  mesh.name = 'windows'
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  paintMesh(mesh, 'glass', livery, 'mesh', 'high')
  return mesh
}

function addCargoDoor(frame: Frame) {
  if (!frame.spec.cargoDoor || frame.tier === 'high') return
  const { spec, centerY } = frame
  addBox(
    frame,
    [Math.min(3.2, spec.lengthM * 0.12), spec.ry * 1.15, 0.08],
    [spec.lengthM * 0.12, centerY - spec.ry * 0.05, spec.rx + 0.02],
    'stripe',
    'mesh',
  ).name = 'cargo-door'
}

function addFeatures(frame: Frame) {
  if (frame.tier === 'high') return
  const { spec, centerY, nose, tailX, top } = frame
  if (spec.noseVisor) {
    addBox(
      frame,
      [spec.lengthM * 0.1, spec.ry * 0.45, spec.rx * 1.1],
      [nose - spec.lengthM * 0.06, top - spec.ry * 0.1, 0],
      'metal',
      'mesh',
    )
  }
  if (spec.boom) {
    // Mostly tucked under the tail so the published length still matches.
    addBox(
      frame,
      [spec.lengthM * 0.16, 0.16, 0.16],
      [tailX + spec.lengthM * 0.01, spec.gear + 0.35, 0],
      'metal',
      'mesh',
    ).name = 'boom'
  }
  if (spec.sponsons || spec.floats) {
    for (const sign of [1, -1]) {
      addBox(
        frame,
        [spec.lengthM * (spec.floats ? 0.28 : 0.34), spec.ry * 0.45, spec.rx * 0.55],
        [frame.wingX, spec.gear * 0.55, sign * (spec.rx + spec.rx * 0.35)],
        'belly',
        'mesh',
      )
    }
  }
  if (spec.hopper) {
    addBox(
      frame,
      [spec.lengthM * 0.28, spec.ry * 0.55, spec.rx * 1.3],
      [frame.wingX, spec.gear * 0.65, 0],
      'belly',
      'mesh',
    ).name = 'hopper'
  }
  if (spec.floats) {
    addBox(
      frame,
      [spec.lengthM * 0.72, spec.ry * 0.55, spec.rx * 1.7],
      [0, spec.gear * 0.35, 0],
      'belly',
      'mesh',
    ).name = 'hull'
  }
  if (frame.tier === 'mid') {
    // Cheatline as paint on each flank, not a box around the tube.
    const lineY = 0.42
    const lineZ = spec.rx * Math.sqrt(1 - lineY * lineY) + 0.02
    for (const sign of [1, -1]) {
      addBox(
        frame,
        [spec.lengthM * 0.56, spec.ry * 0.11, 0.04],
        [-spec.lengthM * 0.02, centerY + spec.ry * lineY, sign * lineZ],
        'stripe',
        'mesh',
      ).name = 'cheatline'
    }
    if (spec.family === 'tube' && spec.engines.mount === 'wing' && spec.lengthM > 25) addBellyFairing(frame)
    if (spec.family === 'point') {
      const glass = new THREE.Mesh(smoothSphere())
      glass.scale.set(1.15, 0.62, 0.7)
      glass.position.set(nose - spec.lengthM * 0.1, centerY + spec.ry * 0.35, 0)
      glass.name = 'cockpit'
      addMesh(frame, glass, 'glass', 'mesh')
    } else {
      addCockpitWindows(frame)
    }
  }
}

/** Wing-to-body fairing: a smooth blister under the wing box. */
function addBellyFairing(frame: Frame) {
  const { spec, centerY, wingX } = frame
  const mesh = new THREE.Mesh(smoothSphere())
  mesh.scale.set(spec.rootChord * 0.95, spec.ry * 0.42, spec.rx * 0.93)
  mesh.position.set(wingX - spec.rootChord * 0.05, centerY - spec.ry * 0.7, 0)
  mesh.name = 'wing-body-fairing'
  addMesh(frame, mesh, 'belly', 'mesh')
}

/**
 * Flight-deck glazing laid on the nose skin: two front panes, two side panes and
 * a small aft pane each side, each oriented to the loft normal.
 */
function addCockpitWindows(frame: Frame) {
  const { spec, centerY, nose } = frame
  const fam = spec.family === 'rearjet' ? 'rearjet' : spec.family === 'prop' ? 'prop' : 'tube'
  const L = spec.lengthM
  const tAt = Math.min(0.065, 3.2 / L)
  const panes: THREE.Matrix4[] = []
  const pane = (t: number, ang: number, w: number, h: number) => {
    const st = loftStation(fam, t)
    const ahead = loftStation(fam, Math.max(0, t - 0.004))
    const x = nose - t * L
    const y = centerY + spec.ry * (Math.sin(ang) * st.r + st.dy)
    const z = spec.rx * Math.cos(ang) * st.r
    // Surface normal: radial part plus forward lean from the taper.
    const dr = ((st.r - ahead.r) * Math.max(spec.rx, spec.ry)) / (0.004 * L)
    const n = new THREE.Vector3(dr, Math.sin(ang) / spec.ry, Math.cos(ang) / spec.rx).normalize()
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize()
    const side = new THREE.Vector3().crossVectors(up, n).normalize()
    const basis = new THREE.Matrix4().makeBasis(side, up, n)
    const q = new THREE.Quaternion().setFromRotationMatrix(basis)
    const pos = new THREE.Vector3(x, y, z).addScaledVector(n, 0.015)
    panes.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(w, h, 0.05)))
  }
  const h = Math.max(0.22, spec.ry * 0.2)
  const w = Math.max(0.3, spec.rx * 0.3)
  // Angle runs from +Z toward +Y; the port side mirrors it to (π − a).
  for (const sign of [1, -1]) {
    const a = (v: number) => (sign > 0 ? v : Math.PI - v)
    pane(tAt * 0.72, a(1.18), w, h)
    pane(tAt * 0.95, a(0.78), w * 0.95, h * 0.95)
    pane(tAt * 1.22, a(0.55), w * 0.6, h * 0.8)
  }
  addInstances(frame, unitBox(), panes, 'glass', 'mesh', 'cockpit')
}

function addHelo(frame: Frame) {
  const { spec, tier, centerY, nose, tailX } = frame
  if (tier !== 'high') {
    const sides = fuselageSides(tier === 'low' ? 'low' : 'mid')
    const body = new THREE.Mesh(paintedLoftGeometry('helo', sides, fuselagePaint(frame.livery)))
    body.scale.set(spec.lengthM, spec.ry, spec.rx)
    body.position.set(0, centerY, 0)
    body.name = 'fuselage'
    markLivery(addMesh(frame, body, 'body', 'mesh', tier === 'mid'), 'fuselage', fuselageBox(frame))
  }
  if (tier === 'mid') {
    addBox(
      frame,
      [spec.lengthM * 0.22, spec.ry * 0.55, spec.rx * 1.7],
      [nose - spec.lengthM * 0.42, centerY + spec.ry * 0.15, 0],
      'glass',
      'mesh',
    ).name = 'cockpit'
  }
  const mastH = Math.max(0.4, spec.heightM - (centerY + spec.ry))
  if (tier !== 'high') {
    addCylinder(
      frame,
      0.12,
      mastH,
      [0, centerY + spec.ry + mastH / 2, 0],
      'metal',
      'mesh',
      'y',
    )
  }
  const rotorY = spec.heightM - 0.05
  if (tier === 'low') {
    const disc = new THREE.Mesh(unitDisc('rotor'))
    disc.scale.setScalar(spec.rotor)
    disc.position.set(0, rotorY, 0)
    disc.name = 'rotor'
    addMesh(frame, disc, 'dark', 'mesh')
    frame.spinners.push(disc)
  } else if (tier === 'mid') {
    const hub = new THREE.Group()
    hub.name = 'rotor'
    hub.position.set(0, rotorY, 0)
    const blades = Math.max(2, Math.min(4, spec.blades || 4))
    const matrices: THREE.Matrix4[] = []
    for (let i = 0; i < blades; i++) {
      const angle = (i / blades) * Math.PI * 2
      matrices.push(
        compose(
          Math.cos(angle) * spec.rotor * 0.5,
          0.02,
          Math.sin(angle) * spec.rotor * 0.5,
          0,
          -angle,
          0,
          spec.rotor,
          0.06,
          0.18,
        ),
      )
    }
    const mesh = new THREE.InstancedMesh(unitBox(), new THREE.MeshBasicMaterial(), blades)
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
    const painted = paintMesh(mesh, 'dark', frame.livery, 'mesh', tier)
    hub.add(painted)
    frame.meshes.push(painted)
    frame.group.add(hub)
    frame.spinners.push(hub)
    if (spec.fenestron) {
      addCylinder(frame, 0.55, 0.18, [tailX + 0.4, centerY, 0], 'metal', 'mesh', 'z')
    } else {
      const tail = new THREE.Group()
      tail.name = 'tail-rotor'
      tail.position.set(tailX + 0.15, centerY + spec.ry * 0.2, spec.rx + 0.15)
      const mini: THREE.Matrix4[] = []
      for (let i = 0; i < 2; i++) {
        mini.push(compose(0, 0, 0, 0, 0, i * Math.PI * 0.5, 1.3, 0.08, 0.12))
      }
      const bladesMesh = new THREE.InstancedMesh(unitBox(), new THREE.MeshBasicMaterial(), 2)
      mini.forEach((matrix, i) => bladesMesh.setMatrixAt(i, matrix))
      bladesMesh.instanceMatrix.needsUpdate = true
      const paintedTail = paintMesh(bladesMesh, 'dark', frame.livery, 'mesh', tier)
      tail.add(paintedTail)
      frame.meshes.push(paintedTail)
      frame.group.add(tail)
      frame.spinners.push(tail)
    }
  } else {
    // Close-up: extra blades fade in on the same axis.
    const hub = new THREE.Group()
    hub.name = 'rotor'
    hub.position.set(0, rotorY, 0)
    const extra = Math.max(0, (spec.blades || 4) - 4)
    if (extra > 0) {
      const matrices: THREE.Matrix4[] = []
      for (let i = 0; i < extra; i++) {
        const angle = Math.PI / (extra + 1) + (i * Math.PI) / extra
        matrices.push(
          compose(
            Math.cos(angle) * spec.rotor * 0.5,
            0.05,
            Math.sin(angle) * spec.rotor * 0.5,
            0,
            -angle,
            0,
            spec.rotor,
            0.05,
            0.16,
          ),
        )
      }
      const mesh = new THREE.InstancedMesh(unitBox(), new THREE.MeshBasicMaterial(), extra)
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
      mesh.instanceMatrix.needsUpdate = true
      const painted = paintMesh(mesh, 'dark', frame.livery, 'mesh', tier)
      hub.add(painted)
      frame.meshes.push(painted)
      frame.group.add(hub)
      frame.spinners.push(hub)
    }
  }
}

let glowTex: THREE.DataTexture | null = null
function glowTexture(): THREE.DataTexture {
  if (glowTex) return glowTex
  const n = 32
  const data = new Uint8Array(n * n * 4)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(i - n / 2 + 0.5, j - n / 2 + 0.5) / (n / 2)
      const a = Math.max(0, 1 - d) ** 2.2
      const o = (j * n + i) * 4
      data[o] = data[o + 1] = data[o + 2] = 255
      data[o + 3] = Math.round(a * 255)
    }
  }
  glowTex = new THREE.DataTexture(data, n, n)
  glowTex.needsUpdate = true
  return glowTex
}

/** Landing lamps are built in the rig. Give them the same night halo as the nav lights. */
function attachLandingGlow(frame: Frame) {
  if (frame.tier !== 'mid') return
  for (const lamp of frame.lamps) {
    if (lamp.name !== 'landing-light') continue
    if (lamp.children.some((child) => child.userData.glow)) continue
    lamp.add(lampGlow('#f5f8ff'))
  }
}

/** Additive halo sprite on a nav lamp. Opacity follows the night lamp level (see lod.ts). */
function lampGlow(color: string): THREE.Sprite {
  const mat = sharedMat(`lamp-glow:${color}`, () => new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  })) as THREE.SpriteMaterial
  const sprite = new THREE.Sprite(mat)
  sprite.name = 'lamp-glow'
  sprite.scale.setScalar(7)
  sprite.userData.glow = true
  sprite.raycast = () => {}
  return sprite
}

/** Open forward hold door, under-wing fuel panel and nose GPU socket where round E trucks hook up. */
function addServicePoints(frame: Frame) {
  const { spec, tier, nose, centerY } = frame
  if (tier !== 'mid' || spec.family === 'helo' || spec.lengthM < 20) return
  const sideZ = spec.rx * 0.97
  // Forward hold door, starboard, swung up on its top hinge (belt loader side).
  const doorX = nose - spec.lengthM * 0.24
  const dw = Math.min(1.8, spec.lengthM * 0.045)
  const dh = Math.min(1.7, spec.ry * 0.7)
  const sill = centerY - spec.ry * 0.25
  addBox(frame, [dw, dh, 0.06], [doorX, sill - dh / 2, sideZ + 0.01], 'dark', 'mesh').name = 'hold-opening'
  addBox(frame, [dw, dh, 0.06], [doorX, sill + 0.05, sideZ + dh * 0.45], 'body', 'mesh', [-1.25, 0, 0]).name = 'hold-door-open'
  // Single-point fuel panel under each wing, at the span the fuel hose aims for.
  const panelZ = Math.min(9, Math.max(3.6, spec.spanM * 0.18))
  if (panelZ < spec.spanM / 2 - 0.5) {
    for (const s of [1, -1]) {
      const under = skinUnderside(frame, frame.wingX, s * panelZ) ?? frame.wingY - spec.thickness * 0.5
      addBox(frame, [0.6, 0.05, 0.4], [frame.wingX, under - 0.02, s * panelZ], 'dark', 'mesh').name = 'fuel-panel'
      addBox(frame, [0.14, 0.12, 0.14], [frame.wingX, under - 0.08, s * panelZ], 'stripe', 'mesh').name = 'fuel-coupling'
    }
  }
  // External power socket on the lower nose, starboard of the nose gear.
  const gx = nose - spec.lengthM * 0.1
  const gz = spec.rx * 0.45
  const belly = skinUnderside(frame, gx, gz) ?? centerY - spec.ry * 0.8
  addBox(frame, [0.4, 0.04, 0.3], [gx, belly - 0.01, gz], 'dark', 'mesh').name = 'gpu-socket'
  addBox(frame, [0.12, 0.1, 0.12], [gx, belly - 0.06, gz], 'stripe', 'mesh').name = 'gpu-plug'
}

function addLights(frame: Frame) {
  const { spec, wingY, centerY, top } = frame
  if (spec.family === 'helo') return
  // Real nav lamps are fist-sized; scale with the fuselage so they stay on the airframe's scale.
  const radius = Math.min(0.35, Math.max(0.12, spec.rx * 0.12))
  const lamp = (slot: PaintSlot, pos: [number, number, number], kind: 'light' | 'strobe' | 'beacon', name: string) => {
    if (frame.tier === 'high') return
    if (frame.tier === 'low' && kind !== 'beacon') return
    const mesh = new THREE.Mesh(unitSphere())
    mesh.scale.setScalar(kind === 'beacon' ? radius * 0.7 : radius)
    mesh.position.set(pos[0], pos[1], pos[2])
    mesh.name = name
    mesh.userData.baseScale = mesh.scale.x
    const painted = addMesh(frame, mesh, slot, kind === 'light' ? 'light' : kind)
    if (kind === 'light' && frame.tier === 'mid') painted.add(lampGlow(slotColor(slot, frame.livery)))
    frame.lamps.push(painted)
    if (kind === 'strobe') frame.strobes.push(painted)
    if (kind === 'beacon') frame.beacons.push(painted)
  }
  const semi = spec.spanM / 2
  // Wingtips sit aft and up on swept, dihedral wings.
  const tipX = frame.wingX + spec.rootChord / 2 - Math.tan((spec.sweep * Math.PI) / 180) * semi - spec.tipChord * 0.25
  const tipY = wingY + Math.tan((spec.dihedral * Math.PI) / 180) * semi
  // Nose is +X and up is +Y, so starboard (right) is +Z and port (left) is -Z.
  lamp('navRed', [tipX, tipY, -(semi - radius * 0.5)], 'light', 'nav-port')
  lamp('navGreen', [tipX, tipY, semi - radius * 0.5], 'light', 'nav-starboard')
  const fam = loftFamily(spec)
  const cone = loftStation(fam, 0.995)
  lamp('navWhite', [frame.tailX + spec.lengthM * 0.005, centerY + spec.ry * cone.dy, 0], 'light', 'nav-tail')
  lamp('navWhite', [tipX - spec.tipChord * 0.4, tipY + radius * 0.4, semi - radius * 0.6], 'strobe', 'strobe')
  lamp('navWhite', [tipX - spec.tipChord * 0.4, tipY + radius * 0.4, -(semi - radius * 0.6)], 'strobe', 'strobe')
  if (frame.tier !== 'low') {
    lamp('beacon', [0, spec.gear, 0], 'beacon', 'beacon-belly')
  }
  lamp('beacon', [spec.lengthM * 0.02, Math.min(top + 0.02, spec.heightM - radius * 0.7), 0], 'beacon', 'beacon')
}

function addHeloLights(frame: Frame) {
  if (frame.spec.family !== 'helo' || frame.tier === 'high') return
  const { spec, centerY, tailX } = frame
  const radius = Math.min(0.25, Math.max(0.1, spec.rx * 0.12))
  if (frame.tier === 'low') {
    const mesh = new THREE.Mesh(unitSphere())
    mesh.scale.setScalar(radius * 0.8)
    mesh.position.set(0, spec.heightM - radius, 0)
    mesh.name = 'beacon'
    mesh.userData.baseScale = mesh.scale.x
    const painted = addMesh(frame, mesh, 'beacon', 'beacon')
    frame.beacons.push(painted)
    frame.lamps.push(painted)
    return
  }
  const port = new THREE.Mesh(unitSphere())
  port.scale.setScalar(radius)
  // Port (left) is -Z with the nose on +X. Lamps sit flush on the cabin flank.
  port.position.set(spec.lengthM * 0.05, centerY, -spec.rx * 0.95)
  port.name = 'nav-port'
  port.userData.baseScale = radius
  const portLamp = addMesh(frame, port, 'navRed', 'light')
  frame.lamps.push(portLamp)
  const star = port.clone()
  star.position.z *= -1
  star.name = 'nav-starboard'
  const starLamp = addMesh(frame, star, 'navGreen', 'light')
  frame.lamps.push(starLamp)
  const tail = port.clone()
  const tailSt = loftStation('helo', 0.99)
  tail.position.set(tailX + spec.lengthM * 0.01, centerY + spec.ry * tailSt.dy, 0)
  tail.name = 'nav-tail'
  const tailLamp = addMesh(frame, tail, 'navWhite', 'light')
  frame.lamps.push(tailLamp)
  portLamp.add(lampGlow(slotColor('navRed', frame.livery)))
  starLamp.add(lampGlow(slotColor('navGreen', frame.livery)))
  tailLamp.add(lampGlow(slotColor('navWhite', frame.livery)))
  const beacon = port.clone()
  beacon.scale.setScalar(radius * 0.75)
  beacon.position.set(0, centerY + spec.ry * 0.97, 0)
  beacon.name = 'beacon'
  beacon.userData.baseScale = beacon.scale.x
  const paintedBeacon = addMesh(frame, beacon, 'beacon', 'beacon')
  frame.beacons.push(paintedBeacon)
  frame.lamps.push(paintedBeacon)
  const strobe = port.clone()
  strobe.position.set(spec.lengthM * 0.12, centerY + spec.ry * 0.4, 0)
  strobe.name = 'strobe'
  strobe.userData.baseScale = strobe.scale.x
  const paintedStrobe = addMesh(frame, strobe, 'navWhite', 'strobe')
  frame.strobes.push(paintedStrobe)
  frame.lamps.push(paintedStrobe)
}

function paintForAirframe(paint: Livery, modelId: string): Livery {
  return selectLivery(paint, modelId)
}

export function buildAircraft(spec: ModelSpec, tier: Tier, paint: Livery): BuiltLevel {
  const livery = paintForAirframe(paint, spec.id)
  const frame = frameFor(spec, tier, livery)
  if (spec.family === 'helo') {
    addHelo(frame)
    addGear(frame)
    addHeloLights(frame)
    addRealDoors(frame)
    addRig(frame, [])
    addLogo(frame)
  } else {
    addFuselage(frame)
    addWing(frame)
    addTail(frame)
    addEngines(frame)
    addFans(frame)
    addGear(frame)
    addWindows(frame)
    addCargoDoor(frame)
    addFeatures(frame)
    addControls(frame)
    addLogo(frame)
    addRealDoors(frame)
    addServicePoints(frame)
    addRig(frame, frame.spec.engines.count ? enginePoints(frame) : [])
    addLights(frame)
  }
  attachLandingGlow(frame)
  mergeStaticShell({
    tier: frame.tier,
    specId: frame.spec.id,
    livery: frame.livery,
    group: frame.group,
    meshes: frame.meshes,
    gears: frame.gears,
    spinners: frame.spinners,
  })
  return {
    group: frame.group,
    meshes: frame.meshes,
    spinners: frame.spinners,
    gears: frame.gears,
    strobes: frame.strobes,
    beacons: frame.beacons,
    lamps: frame.lamps,
    rigs: frame.rigs,
  }
}
