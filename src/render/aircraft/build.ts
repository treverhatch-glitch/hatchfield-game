import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import { logoMaterials, resolveBrand } from './branding'
import { heloCabin, renderDoorBoxes, type DoorBox } from './stands'
import { cylinderSides, fanBladeGeometry, propBladeGeometry, rotorBladeGeometry, spinBlurTexture, finGeometry, intakeLipGeometry, spinnerConeGeometry, fuselageSides, loftFamily, loftStation, nacelleGeometry, paintedLoftGeometry, smoothSphere, stabGeometry, windowGeometry, wingGeometry, wingletGeometry } from './geom'
import { navLightSprite } from '../world/nightArt'
import type { LiveryBox } from './liveryUv'
import { engineLayout, propRadius } from './layout'
import { fuselagePaint } from './doorLeaf'
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
  return engineLayout(frame.spec)
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


function addWing(frame: Frame) {
  if (frame.tier === 'high' || frame.spec.family === 'helo') return
  const { spec, wingX, wingY } = frame
  if (frame.tier === 'low') {
    // Two swept halves. One full-span box reads as a flat cross from above.
    const semi = spec.spanM / 2
    const chord = (spec.rootChord + spec.tipChord) / 2
    const sweep = Math.tan((spec.sweep * Math.PI) / 180) * semi * 0.45
    const lift = Math.tan((spec.dihedral * Math.PI) / 180) * semi * 0.5
    for (const sign of [1, -1] as const) {
      const mesh = addBox(
        frame,
        [chord, Math.max(0.12, spec.thickness), semi * 0.92],
        [wingX - sweep, wingY + lift, sign * semi * 0.48],
        'wing',
        'mesh',
        undefined,
        false,
      )
      mesh.name = 'wing'
    }
    return
  }
  const mesh = new THREE.Mesh(
    wingGeometry(spec.spanM, spec.rootChord, spec.tipChord, spec.sweep, spec.dihedral, spec.thickness),
  )
  mesh.position.set(wingX, wingY, 0)
  mesh.name = 'wing'
  addMesh(frame, mesh, 'wing', 'mesh', true)
  if (spec.winglet === 'none') return
  {
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
  const { spec } = frame
  const { chord, thick, finX, rootY: top, finH, stabX, stabY } = finPose(frame)
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
  const stabChord = Math.max(0.8, spec.rootChord * 0.42)
  const stab = new THREE.Mesh(stabGeometry())
  stab.scale.set(stabChord, Math.max(0.08, spec.thickness * 0.22), spec.tailSpan)
  stab.position.set(stabX, stabY, 0)
  stab.name = 'stab'
  // Tailplanes wear the wing grey, as on real liveries; the fin carries the airline colour.
  addMesh(frame, stab, 'wing', 'mesh')
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
  const mesh = addInstances(frame, fanPod && tier !== 'low' ? nacelleGeometry(sides) : unitCylinder(sides), matrices, 'metal', 'mesh', 'engines')
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
    addInstances(frame, unitCylinder(sides), discs, fanPod ? 'duct' : 'dark', 'mesh', 'fan-disc')
    if (fanPod) {
      // Separate spinner cone on the fan face and a bright rolled intake lip.
      // Silver spinner seated on the fan hub, its tip still inside the intake lip.
      const cones = pts.map((p) => compose(p.x + eng.length * 0.41, p.y, p.z, 0, 0, 0, Math.min(eng.radius * 0.42, eng.length * 0.08), eng.radius * 0.25, eng.radius * 0.25))
      const cone = addInstances(frame, spinnerConeGeometry(), cones, 'chrome', 'mesh', 'spinner')
      if (cone) cone.name = 'spinner'
      const lips = pts.map((p) => compose(p.x + eng.length * 0.5, p.y, p.z, 0, 0, 0, eng.radius * 0.99, eng.radius * 0.99, eng.radius * 0.99))
      const lip = addInstances(frame, intakeLipGeometry(), lips, 'lip', 'mesh', 'intake-lip')
      if (lip) lip.name = 'intake-lip'
    }
  }
  if (eng.kind === 'turboprop') addPropBlades(frame, pts, eng, 'prop')
}

function addPropDiscs(frame: Frame, pts: THREE.Vector3[], eng: EngineSpec) {
  const radius = propRadius(frame.spec)
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
  const blades = name === 'fan' ? (eng.kind === 'turbojet' ? 18 : 22) : Math.max(2, frame.spec.blades || 4)
  const radius = name === 'fan' ? eng.radius * 0.78 : propRadius(frame.spec)
  for (const p of pts) {
    const hub = new THREE.Group()
    hub.name = name
    hub.position.set(p.x + (name === 'fan' ? eng.length * 0.42 : eng.length * 0.55), p.y, p.z)
    const matrices: THREE.Matrix4[] = []
    for (let i = 0; i < blades; i++) {
      const angle = (i / blades) * Math.PI * 2
      if (name === 'fan') {
        // Twisted wide-chord blades filling the duct (fan radius ≈ duct inner wall).
        const R = eng.radius * 0.83
        matrices.push(compose(0, 0, 0, angle, 0, 0, R, R, R))
        continue
      }
      // Tapered, twisted prop blades at the real diameter.
      matrices.push(compose(0, 0, 0, angle, 0, 0, radius, radius, radius))
      continue
      matrices.push(
        compose(
          0,
          Math.cos(angle) * radius * 0.48,
          Math.sin(angle) * radius * 0.48,
          angle,
          0,
          0,
          0.1,
          radius * 0.92,
          0.22,
        ),
      )
    }
    const mesh = new THREE.InstancedMesh(name === 'prop' ? propBladeGeometry() : fanBladeGeometry(), new THREE.MeshBasicMaterial(), blades)
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
    const painted = paintMesh(mesh, name === 'fan' ? 'fan' : 'dark', frame.livery, 'mesh', frame.tier)
    hub.add(painted)
    frame.meshes.push(painted)
    hub.userData.blades = [painted]
    if (name === 'prop') {
      // Spinner cone on the hub, and a soft motion-blur disc the LOD fades in with prop speed.
      const cone = new THREE.Mesh(spinnerConeGeometry())
      cone.scale.set(radius * 0.32, radius * 0.17, radius * 0.17)
      cone.position.x = -radius * 0.08
      cone.name = 'prop-spinner'
      const paintedCone = paintMesh(cone, 'lip', frame.livery, 'mesh', frame.tier)
      hub.add(paintedCone)
      frame.meshes.push(paintedCone)
      // The disc does not turn with the hub: a stationary blur reads steady and so does its shadow.
      const blur = spinBlurDisc('prop', radius * 1.02)
      blur.position.copy(hub.position)
      blur.position.x += 0.02
      frame.group.add(blur)
      hub.userData.blur = blur
    }
    frame.group.add(hub)
    frame.spinners.push(hub)
  }
}

/**
 * Motion-blur disc for a spinning prop or rotor: radial soft alpha (clear hub, faint body,
 * denser tip track, feathered rim). Hidden and fully transparent at rest; lod.ts fades it in
 * with spool. Its custom depth material uses hashed alpha, so a spinning disc throws a soft,
 * partial disc shadow (PCF blurs the hash) instead of the frozen blades.
 */
export function spinBlurDisc(kind: 'prop' | 'rotor', radius: number): THREE.Mesh {
  const alphaMap = spinBlurTexture(kind)
  const blur = new THREE.Mesh(
    unitDisc(kind === 'prop' ? 'prop-blur' : 'rotor-blur'),
    new THREE.MeshBasicMaterial({ color: kind === 'prop' ? '#24272b' : '#2a2c30', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, alphaMap }),
  )
  blur.customDepthMaterial = new THREE.MeshDepthMaterial({ alphaMap, alphaHash: true, opacity: 0, side: THREE.DoubleSide })
  blur.scale.setScalar(radius)
  blur.name = kind === 'prop' ? 'prop-blur' : 'rotor-blur'
  blur.visible = false
  blur.castShadow = false
  blur.receiveShadow = false
  blur.userData.ownMat = true
  blur.userData.blurMax = kind === 'prop' ? 0.42 : 0.3
  blur.raycast = () => {}
  return blur
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
    // Oleo length the touchdown squash shortens (metres, frame units).
    leg.userData.legH = legH
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
    // Skids sit under the cabin (not the boom) on two cross tubes that reach the belly.
    const cab = heloCabin(spec)
    const cabLen = cab.x1 - cab.x0
    const skidX = (cab.x0 + cab.x1) / 2
    const skidZ = spec.rx * 0.78
    const skidY = localGround + 0.04
    const push = (mesh: THREE.Mesh) => {
      const painted = paintMesh(mesh, 'metal', frame.livery, 'mesh', tier)
      gear.add(painted)
      frame.meshes.push(painted)
    }
    for (const sign of [1, -1]) {
      const skid = new THREE.Mesh(unitBox())
      skid.scale.set(cabLen * 1.18, 0.08, 0.1)
      skid.position.set(skidX, skidY, sign * skidZ)
      push(skid)
    }
    for (const f of [0.22, 0.74]) {
      const x = cab.x0 + cabLen * f
      const st = skinAt(frame, x)
      const bellyY = st.mid - spec.ry * st.r * 0.82 - spec.gear
      const bellyZ = spec.rx * st.r * 0.55
      for (const sign of [1, -1]) {
        const dz = skidZ - bellyZ
        const dy = bellyY - skidY
        const strut = new THREE.Mesh(unitBox())
        strut.scale.set(0.09, Math.hypot(dy, dz), 0.09)
        strut.position.set(x, (bellyY + skidY) / 2, sign * (skidZ + bellyZ) / 2)
        strut.rotation.x = sign * Math.atan2(dz, dy)
        push(strut)
      }
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
  const boxes = renderDoorBoxes(frame.spec)
  // Ramps and belly doors keep the plain dark cut; side doors get a framed doorway with
  // a cabin glimpse, seen when the leaf swings open.
  const plain = boxes.filter((b) => b.door.side === 0)
  if (plain.length) {
    addInstances(frame, unitBox(), plain.map((box) => compose(box.x, box.y, box.z, 0, 0, 0, box.w, box.h, box.depth)), 'dark', 'mesh', 'doors')
  }
  for (const cargo of [false, true]) addDoorways(frame, boxes.filter((b) => b.door.side !== 0 && !b.omit && (b.door.kind === 'cargo') === cargo), cargo)
}

/** Side half-width of the real loft at (x, y): where a door leaf or doorway meets the skin. */
function sideSkin(frame: Frame, x: number, y: number): number {
  const { spec } = frame
  const t = Math.max(0, Math.min(1, (frame.nose - x) / spec.lengthM))
  const st = loftStation(loftFamily(spec), t)
  const k = (y - (frame.centerY + spec.ry * st.dy)) / spec.ry
  return spec.rx * Math.sqrt(Math.max(0.0004, st.r * st.r - k * k))
}

/**
 * Framed doorway cut with a cabin glimpse, seated on the actual skin. Hidden while the leaf is
 * shut (the leaf then reads flush with a thin seam); the rig shows it as soon as the door cracks.
 */
function addDoorways(frame: Frame, boxes: DoorBox[], cargo: boolean) {
  const parts = boxes
    .map((b) => {
      const g = doorwayGeometry(b.w, b.h)
      const m = new THREE.Matrix4().makeTranslation(b.x, b.y, b.door.side * (sideSkin(frame, b.x, b.y) - 0.012))
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
    mesh.name = cargo ? 'doorways-cargo' : 'doorways'
    mesh.userData.ownGeo = true
    mesh.userData.reveal = cargo ? 'cargo' : 'door'
    parts.forEach((g) => g.dispose())
    frame.group.add(mesh)
    frame.meshes.push(mesh)
  }
}

/** Crown height and centreline of the real loft at group-space x (the tail cone sweeps up and narrows). */
function skinAt(frame: Pick<Frame, 'spec' | 'nose' | 'centerY'>, x: number): { top: number; mid: number; r: number } {
  const { spec } = frame
  const t = Math.max(0, Math.min(1, (frame.nose - x) / spec.lengthM))
  const st = loftStation(loftFamily(spec), t)
  return {
    top: frame.centerY + spec.ry * (st.dy + st.r),
    mid: frame.centerY + spec.ry * st.dy,
    r: st.r,
  }
}

/**
 * Fin, rudder, stabiliser and tail-logo stations. The fin root follows the actual
 * tail-cone crown (sunk slightly into the skin) so it never floats above a narrowing
 * cone, and the tip keeps the published height. The stabiliser sits on the cone centreline.
 */
function finPose(frame: Frame) {
  const chord = Math.max(1.1, frame.spec.lengthM * 0.11)
  const thick = Math.max(0.08, frame.spec.rx * 0.08)
  const finX = frame.tailX + chord * 0.55
  const twin = frame.spec.tail === 'twin'
  const rootY = twin ? frame.top : Math.min(frame.top, skinAt(frame, finX).top - frame.spec.ry * 0.06)
  const finH = frame.top + frame.finH - rootY
  const stabX = finX - chord * 0.15
  const cone = skinAt(frame, stabX)
  return {
    finX,
    chord,
    thick,
    rootY,
    finH,
    stabX,
    stabY: frame.spec.tail === 't' ? frame.spec.heightM - 0.12 : cone.mid + frame.spec.ry * cone.r * 0.2,
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
  const pose = finPose(frame)
  const { finX, chord, stabY, thick } = pose
  const elevator = addBox(
    frame,
    [Math.max(0.28, chord * 0.28), Math.max(0.05, spec.thickness * 0.16), spec.tailSpan * 0.72],
    [finX - chord * 0.42, stabY, 0],
    'wing',
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
        [Math.max(0.22, chord * 0.22), pose.finH * 0.55, thick * 0.8],
        [finX - chord * 0.2, pose.rootY + pose.finH * 0.62, sign * spread],
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
      [Math.max(0.22, chord * 0.22), pose.finH * 0.55, thick * 0.9],
      [finX - chord * 0.15, pose.rootY + pose.finH * 0.62, 0],
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
    // On the fin, flush with its skin (the boom is far too thin to carry a mark).
    const fin = frame.group.userData.heloFin as { x: number; y: number; h: number; chord: number } | undefined
    if (!fin) return
    const half = Math.max(0.1, frame.spec.rx * 0.1) * 0.5
    const size = Math.min(0.62, fin.h * 0.42, fin.chord * 0.5)
    place(fin.x - fin.chord * 0.12, fin.y + fin.h * 0.42, -(half + 0.02), size)
    return
  }
  const { finX, thick, rootY, finH } = finPose(frame)
  const size = Math.max(0.55, Math.min(finH * 0.38, frame.spec.rx * 0.85))
  const y = rootY + finH * 0.55
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
    // Cheatline as paint on each flank, not a box around the tube. Only for paint without an
    // airline plate: over a plate the flat strip sat proud of the curved skin and doubled the titles.
    const lineY = 0.42
    const plated = Boolean(frame.livery.airline)
    const lineZ = spec.rx * Math.sqrt(1 - lineY * lineY) + 0.008
    for (const sign of plated ? [] : [1, -1]) {
      const line = addBox(
        frame,
        [spec.lengthM * 0.56, spec.ry * 0.11, 0.012],
        [-spec.lengthM * 0.02, centerY + spec.ry * lineY, sign * lineZ],
        'stripe',
        'mesh',
      )
      line.name = 'cheatline'
      // Under an airline plate the strip takes the plate's own texels, so it never cuts across the titles.
      markLivery(line, 'fuselage', fuselageBox(frame))
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
  markLivery(addMesh(frame, mesh, 'belly', 'mesh'), 'fuselage', fuselageBox(frame))
}

/**
 * Flight-deck glazing laid on the nose skin: two front panes, two side panes and
 * a small aft pane each side, each oriented to the loft normal.
 */
function addCockpitWindows(frame: Frame) {
  const { spec, centerY, nose } = frame
  const lf = loftFamily(spec)
  const fam = lf === 'rearjet' || lf === 'prop' || lf === 'turboprop' ? lf : 'tube'
  const L = spec.lengthM
  const tAt = Math.min(0.065, 3.2 / L)
  const panes: THREE.Matrix4[] = []
  const at = (t: number, ang: number) => {
    const st = loftStation(fam, t)
    return { st, p: new THREE.Vector3(nose - t * L, centerY + spec.ry * (Math.sin(ang) * st.r + st.dy), spec.rx * Math.cos(ang) * st.r) }
  }
  const pane = (t: number, ang: number, w: number, h: number) => {
    const { st, p } = at(t, ang)
    const ahead = loftStation(fam, Math.max(0, t - 0.004))
    // Surface normal: radial part plus forward lean from the taper.
    const dr = ((st.r - ahead.r) * Math.max(spec.rx, spec.ry)) / (0.004 * L)
    const n = new THREE.Vector3(dr, Math.sin(ang) / spec.ry, Math.cos(ang) / spec.rx).normalize()
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize()
    const side = new THREE.Vector3().crossVectors(up, n).normalize()
    const basis = new THREE.Matrix4().makeBasis(side, up, n)
    const q = new THREE.Quaternion().setFromRotationMatrix(basis)
    panes.push(new THREE.Matrix4().compose(p.addScaledVector(n, 0.015), q, new THREE.Vector3(w, h, 0.05)))
  }
  const h = Math.max(0.22, spec.ry * 0.2)
  // The windscreen runs as one level band at ~0.45 ry: centre pane on the nose front, then the
  // side panes stepping aft round the curve, each as wide as the gap to its neighbour.
  const yRel = 0.45
  const ts = [0.5, 0.78, 1.06, 1.36].map((k) => tAt * k)
  const angOf = (t: number) => {
    const st = loftStation(fam, t)
    return Math.asin(Math.max(-0.98, Math.min(0.98, (yRel - st.dy) / Math.max(0.05, st.r))))
  }
  const angs = ts.map(angOf)
  const pts = ts.map((t, i) => at(t, angs[i]).p)
  for (const sign of [1, -1]) {
    ts.forEach((t, i) => {
      const nb = pts[Math.min(pts.length - 1, i + 1)].distanceTo(pts[Math.max(0, i - 1)]) / (i === 0 || i === pts.length - 1 ? 1 : 2)
      const ang = sign > 0 ? angs[i] : Math.PI - angs[i]
      pane(t, ang, nb * 1.02, h * (1 - i * 0.07))
    })
  }
  addInstances(frame, unitBox(), panes, 'glass', 'mesh', 'cockpit')
}

/** Main-rotor mast station: over the aft cabin, where the gearbox sits on a real AW139 / S-76. */
export function heloMastX(spec: ModelSpec): number {
  const cab = heloCabin(spec)
  // Over the aft cabin, but no further forward than lets the blade tips overhang the nose by
  // 5% of the length (keeps the overall rotors-turning length true to the published figure).
  const limit = spec.lengthM / 2 - spec.spanM / 2 + spec.lengthM * 0.05
  return Math.max(cab.x0 + 0.2, Math.min(cab.x0 + (cab.x1 - cab.x0) * 0.22, limit))
}

function addHelo(frame: Frame) {
  const { spec, tier, centerY, tailX } = frame
  if (tier !== 'high') {
    const sides = fuselageSides(tier === 'low' ? 'low' : 'mid')
    const body = new THREE.Mesh(paintedLoftGeometry('helo', sides, fuselagePaint(frame.livery)))
    body.scale.set(spec.lengthM, spec.ry, spec.rx)
    body.position.set(0, centerY, 0)
    body.name = 'fuselage'
    markLivery(addMesh(frame, body, 'body', 'mesh', tier === 'mid'), 'fuselage', fuselageBox(frame))
  }
  const mastX = heloMastX(spec)
  const roofY = skinAt(frame, mastX).top
  const rotorY = spec.heightM - 0.05
  if (tier === 'mid') {
    const cab = heloCabin(spec)
    // Flush cabin and cockpit side windows on the full-section cabin (the old glass block stood
    // proud of the boom taper).
    const panes: THREE.Matrix4[] = []
    const winY = centerY + spec.ry * 0.28
    const len = cab.x1 - cab.x0
    const wins = [
      { x: cab.x1 - len * 0.13, w: len * 0.16, h: spec.ry * 0.5 },
      { x: cab.x1 - len * 0.33, w: len * 0.13, h: spec.ry * 0.42 },
    ]
    // Skin half-width at a station, at the window's height, so panes follow the loft taper.
    const skinZAt = (x: number) => {
      const st = skinAt(frame, x)
      const k = Math.min(0.95, Math.abs(winY - st.mid) / (spec.ry * st.r))
      return spec.rx * st.r * Math.sqrt(1 - k * k) - 0.014
    }
    for (const side of [1, -1]) {
      for (const w of wins) {
        const za = skinZAt(w.x - w.w / 2)
        const zb = skinZAt(w.x + w.w / 2)
        const yaw = -side * Math.atan2(zb - za, w.w)
        panes.push(compose(w.x, winY, side * (za + zb) / 2, 0, yaw, 0, w.w, w.h, 0.04))
      }
    }
    addInstances(frame, unitBox(), panes, 'glass', 'mesh', 'cockpit')
    // Engine and gearbox cowling on the cabin roof, under the mast.
    const cowl = new THREE.Mesh(smoothSphere())
    cowl.scale.set(len * 0.36, spec.ry * 0.36, spec.rx * 0.62)
    cowl.position.set(mastX - len * 0.04, roofY - spec.ry * 0.08, 0)
    cowl.name = 'cowling'
    addMesh(frame, cowl, 'body', 'mesh', true)
    // Tail: swept fin at the boom end, small tailplane ahead of it.
    const finChord = Math.max(1, spec.lengthM * 0.085)
    const finH = Math.max(1.1, spec.ry * 1.15)
    const finX = tailX + finChord * 0.5
    const boomTop = skinAt(frame, finX).top
    const fin = new THREE.Mesh(finGeometry(frame.livery.tail || frame.livery.stripe, frame.livery.stripe))
    fin.scale.set(finChord, finH, Math.max(0.1, spec.rx * 0.1))
    fin.position.set(finX, boomTop - 0.05, 0)
    fin.name = 'tail'
    addMesh(frame, fin, 'tail', 'mesh', true)
    const stabX = tailX + spec.lengthM * 0.14
    const stab = new THREE.Mesh(stabGeometry())
    stab.scale.set(Math.max(0.5, spec.lengthM * 0.045), 0.08, spec.tailSpan)
    stab.position.set(stabX, skinAt(frame, stabX).mid, 0)
    stab.name = 'stab'
    addMesh(frame, stab, 'tail', 'mesh', true)
    frame.group.userData.heloFin = { x: finX, y: boomTop - 0.05, h: finH, chord: finChord }
  }
  if (tier !== 'high') {
    // Mast from the cowling up to the hub.
    addCylinder(frame, 0.16, rotorY - roofY + 0.1, [mastX, (roofY + rotorY) / 2, 0], 'metal', 'mesh', 'y')
  }
  if (tier === 'low') {
    const disc = new THREE.Mesh(unitDisc('rotor'))
    disc.scale.setScalar(spec.rotor)
    disc.position.set(mastX, rotorY, 0)
    disc.name = 'rotor'
    addMesh(frame, disc, 'dark', 'mesh')
    frame.spinners.push(disc)
    return
  }
  if (tier !== 'mid') return
  // Main rotor: every blade, tapered with swept tips and washout, on a hub with grips.
  const hub = new THREE.Group()
  hub.name = 'rotor'
  hub.position.set(mastX, rotorY, 0)
  const blades = Math.max(2, spec.blades || 4)
  const chord = spec.rotor * (blades >= 5 ? 0.082 : 0.074)
  const rootR = 0.55
  const bladeGeo = rotorBladeGeometry(spec.rotor, chord, rootR)
  const mats: THREE.Matrix4[] = []
  const grips: THREE.Matrix4[] = []
  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * Math.PI * 2
    mats.push(compose(0, 0.02, 0, 0, angle, 0, 1, 1, 1))
    grips.push(compose(Math.cos(angle) * 0.36, 0.02, -Math.sin(angle) * 0.36, 0, angle, 0, 0.42, 0.13, 0.2))
  }
  const bladeMesh = new THREE.InstancedMesh(bladeGeo, new THREE.MeshBasicMaterial(), blades)
  mats.forEach((m, i) => bladeMesh.setMatrixAt(i, m))
  bladeMesh.instanceMatrix.needsUpdate = true
  bladeMesh.name = 'rotor-blades'
  const paintedBlades = paintMesh(bladeMesh, 'dark', frame.livery, 'mesh', tier)
  hub.add(paintedBlades)
  frame.meshes.push(paintedBlades)
  const gripMesh = new THREE.InstancedMesh(unitBox(), new THREE.MeshBasicMaterial(), blades)
  grips.forEach((m, i) => gripMesh.setMatrixAt(i, m))
  gripMesh.instanceMatrix.needsUpdate = true
  const paintedGrips = paintMesh(gripMesh, 'metal', frame.livery, 'mesh', tier)
  hub.add(paintedGrips)
  frame.meshes.push(paintedGrips)
  const hubCore = new THREE.Mesh(unitCylinder(cylinderSides(tier)))
  hubCore.scale.set(0.34, 0.26, 0.34)
  hubCore.position.y = 0.02
  const paintedHub = paintMesh(hubCore, 'metal', frame.livery, 'mesh', tier)
  hub.add(paintedHub)
  frame.meshes.push(paintedHub)
  const cap = new THREE.Mesh(smoothSphere())
  cap.scale.set(0.24, 0.14, 0.24)
  cap.position.y = 0.17
  const paintedCap = paintMesh(cap, 'dark', frame.livery, 'mesh', tier)
  hub.add(paintedCap)
  frame.meshes.push(paintedCap)
  hub.userData.blades = [paintedBlades]
  frame.group.add(hub)
  frame.spinners.push(hub)
  const blur = spinBlurDisc('rotor', spec.rotor)
  blur.position.set(mastX, rotorY + 0.03, 0)
  frame.group.add(blur)
  hub.userData.blur = blur
  // Swashplate under the hub (static).
  addCylinder(frame, 0.3, 0.06, [mastX, rotorY - 0.32, 0], 'metal', 'mesh', 'y')

  const fin = frame.group.userData.heloFin as { x: number; y: number; h: number; chord: number }
  if (spec.fenestron) {
    // Shrouded fan in the fin.
    addCylinder(frame, Math.min(0.55, fin.h * 0.3), 0.22, [fin.x - fin.chord * 0.05, fin.y + fin.h * 0.32, 0], 'metal', 'mesh', 'z')
    return
  }
  // Conventional tail rotor on the port side of the fin.
  const tailR = Math.max(0.9, spec.rotor * 0.19)
  const tail = new THREE.Group()
  tail.name = 'tail-rotor'
  tail.position.set(fin.x - fin.chord * 0.12, fin.y + fin.h * 0.62, Math.max(0.1, spec.rx * 0.1) * 0.5 + 0.28)
  const tailBlades = 4
  const tm: THREE.Matrix4[] = []
  const edgeOn = new THREE.Matrix4().makeRotationX(Math.PI / 2)
  for (let i = 0; i < tailBlades; i++) {
    // Blade geometry spans +X with its chord on Z: stand the chord up (about X), then fan the
    // blades round the lateral (Z) axis the rotor spins on.
    tm.push(new THREE.Matrix4().makeRotationZ((i / tailBlades) * Math.PI * 2).multiply(edgeOn))
  }
  const tailMesh = new THREE.InstancedMesh(rotorBladeGeometry(tailR, tailR * 0.17, 0.12, 0), new THREE.MeshBasicMaterial(), tailBlades)
  tm.forEach((m, i) => tailMesh.setMatrixAt(i, m))
  tailMesh.instanceMatrix.needsUpdate = true
  const paintedTail = paintMesh(tailMesh, 'dark', frame.livery, 'mesh', tier)
  tail.add(paintedTail)
  frame.meshes.push(paintedTail)
  const tailHub = new THREE.Mesh(unitCylinder(cylinderSides(tier)))
  tailHub.scale.set(0.14, 0.2, 0.14)
  tailHub.rotation.x = Math.PI / 2
  const paintedTailHub = paintMesh(tailHub, 'metal', frame.livery, 'mesh', tier)
  tail.add(paintedTailHub)
  frame.meshes.push(paintedTailHub)
  tail.userData.blades = [paintedTail]
  frame.group.add(tail)
  frame.spinners.push(tail)
  const tailBlur = spinBlurDisc('rotor', tailR)
  tailBlur.rotation.x = Math.PI / 2
  tailBlur.position.copy(tail.position)
  tailBlur.position.z += 0.03
  frame.group.add(tailBlur)
  tail.userData.blur = tailBlur
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

/** Nav sheet billboard. False in Node, where the plate is not decoded. */
function hangNav(mesh: THREE.Object3D, cell: 'navRed' | 'navGreen' | 'navWhite' | 'beacon'): boolean {
  const sprite = navLightSprite(cell)
  if (!sprite) return false
  mesh.add(sprite)
  return true
}

/** Landing lamps are built in the rig. Give them the same night halo as the nav lights. */
function attachLandingGlow(frame: Frame) {
  if (frame.tier !== 'mid') return
  for (const lamp of frame.lamps) {
    if (lamp.name !== 'landing-light') continue
    if (lamp.children.some((child) => child.userData.glow)) continue
    if (!hangNav(lamp, 'navWhite')) lamp.add(lampGlow('#f5f8ff'))
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
  // No static open hold door: it hung a black box and a primary-colour flap on every jet, even in
  // flight. The animated cargo leaves in rig.ts open the real hold doors while the aircraft is serviced.
  void sideZ
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
    const hung = hangNav(painted, slot === 'beacon' ? 'beacon' : slot === 'navRed' ? 'navRed' : slot === 'navGreen' ? 'navGreen' : 'navWhite')
    if (!hung && kind === 'light' && frame.tier === 'mid') painted.add(lampGlow(slotColor(slot, frame.livery)))
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
    hangNav(painted, 'beacon')
    frame.beacons.push(painted)
    frame.lamps.push(painted)
    return
  }
  const cab = heloCabin(spec)
  const navX = cab.x0 + 0.35
  const navK = 0.05
  const navZ = spec.rx * Math.sqrt(Math.max(0, 0.9 * 0.9 - navK * navK))
  const port = new THREE.Mesh(unitSphere())
  port.scale.setScalar(radius)
  // Port (left) is -Z with the nose on +X. Lamps sit flush on the aft cabin flank, not out over the boom.
  port.position.set(navX, centerY + spec.ry * navK, -navZ)
  port.name = 'nav-port'
  port.userData.baseScale = radius
  const portPainted = addMesh(frame, port, 'navRed', 'light')
  if (!hangNav(portPainted, 'navRed')) portPainted.add(lampGlow(slotColor('navRed', frame.livery)))
  frame.lamps.push(portPainted)
  const star = port.clone()
  star.position.z *= -1
  star.name = 'nav-starboard'
  const starPainted = addMesh(frame, star, 'navGreen', 'light')
  if (!hangNav(starPainted, 'navGreen')) starPainted.add(lampGlow(slotColor('navGreen', frame.livery)))
  frame.lamps.push(starPainted)
  const tail = port.clone()
  const tailSt = loftStation('helo', 0.99)
  tail.position.set(tailX + spec.lengthM * 0.01, centerY + spec.ry * tailSt.dy, 0)
  tail.name = 'nav-tail'
  const tailPainted = addMesh(frame, tail, 'navWhite', 'light')
  if (!hangNav(tailPainted, 'navWhite')) tailPainted.add(lampGlow(slotColor('navWhite', frame.livery)))
  frame.lamps.push(tailPainted)
  const beacon = port.clone()
  beacon.scale.setScalar(radius * 0.75)
  // Anti-collision beacon on the fin tip.
  const fin = frame.group.userData.heloFin as { x: number; y: number; h: number; chord: number } | undefined
  if (fin) beacon.position.set(fin.x - fin.chord * 0.25, fin.y + fin.h + radius * 0.4, 0)
  else beacon.position.set(heloMastX(spec), skinAt(frame, heloMastX(spec)).top, 0)
  beacon.name = 'beacon'
  beacon.userData.baseScale = beacon.scale.x
  const paintedBeacon = addMesh(frame, beacon, 'beacon', 'beacon')
  hangNav(paintedBeacon, 'beacon')
  frame.beacons.push(paintedBeacon)
  frame.lamps.push(paintedBeacon)
  const strobe = port.clone()
  // Lower anti-collision strobe on the belly under the gearbox.
  strobe.position.set(heloMastX(spec), centerY - spec.ry * 0.97, 0)
  strobe.name = 'strobe'
  strobe.userData.baseScale = strobe.scale.x
  const paintedStrobe = addMesh(frame, strobe, 'navWhite', 'strobe')
  hangNav(paintedStrobe, 'navWhite')
  frame.strobes.push(paintedStrobe)
  frame.lamps.push(paintedStrobe)
}

/**
 * Where wear shows on this airframe, in group-space metres. Soft, low-contrast fields:
 * soot running aft of each engine exhaust and the APU, grime along the lower fuselage and
 * belly, and dirty halos round doors, hatches and the wing roots. The fin stays clean.
 */
function grimeMask(frame: Frame): ((x: number, y: number, z: number) => number) | undefined {
  if (frame.tier === 'low') return undefined
  const { spec, centerY, wingX, tailX } = frame
  const engines = spec.engines.count ? enginePoints(frame) : []
  const doors = renderDoorBoxes(spec).filter((b) => b.door.side !== 0 && !b.omit)
  const finRoot = frame.top
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  return (x, y, z) => {
    if (y > finRoot + 0.2 && Math.abs(z) < spec.rx * 0.6 && x < tailX + spec.lengthM * 0.2) return 0
    const onBody = Math.abs(z) <= spec.rx * 1.15
    let g = 0
    // Belly and lower fuselage staining.
    if (onBody) g = Math.max(g, 0.55 * smooth(centerY - spec.ry * 0.15, centerY - spec.ry * 0.95, y))
    // Wing-root halo.
    const dxw = Math.abs(x - wingX) / Math.max(1, spec.rootChord * 0.7)
    const dzw = Math.abs(Math.abs(z) - spec.rx) / 1.6
    g = Math.max(g, 0.5 * Math.max(0, 1 - Math.hypot(dxw, dzw)))
    // Door and hatch halos on the skin.
    for (const b of doors) {
      if (Math.sign(z) !== b.door.side) continue
      const ex = Math.max(0, Math.abs(x - b.x) - b.w / 2)
      const ey = Math.max(0, Math.abs(y - b.y) - b.h / 2)
      const d = Math.hypot(ex, ey)
      const k = b.door.kind === 'cargo' ? 0.75 : 0.55
      g = Math.max(g, k * Math.max(0, 1 - d / 0.45) * (ex + ey > 0 ? 1 : 0.3))
    }
    // Exhaust soot wakes: aft of each engine, widening and fading over ~14 m.
    for (const p of engines) {
      const aft = p.x - spec.engines.length * 0.5 - x
      if (aft < -0.3) continue
      const along = Math.max(0, aft)
      const width = spec.engines.radius * (1.1 + along * 0.06)
      const dz = Math.abs(z - p.z) / width
      const dy = Math.abs(y - p.y) / (width * 1.6)
      g = Math.max(g, 0.85 * Math.max(0, 1 - Math.hypot(dz, dy)) * Math.max(0, 1 - along / 14))
    }
    // APU exhaust at the tail cone.
    if (x < tailX + 3.5 && onBody) g = Math.max(g, 0.7 * smooth(tailX + 3.5, tailX, x))
    return g
  }
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
    for (const set of frame.rigs) {
      set.reveal = frame.group.children.find((o) => o.userData.reveal === set.kind)
      if (set.reveal) {
        set.reveal.visible = false
        set.reveal.userData.shut = true
      }
    }
    addLights(frame)
  }
  attachLandingGlow(frame)
  mergeStaticShell({
    grime: grimeMask(frame),
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
