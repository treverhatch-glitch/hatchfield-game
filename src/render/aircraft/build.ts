import * as THREE from 'three'
import { cylinderSides, fuselageSides, loftGeometry, wingGeometry } from './geom'
import {
  paintMesh,
  unitBox,
  unitCylinder,
  unitDisc,
  unitSphere,
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
    nose: spec.lengthM / 2,
    tailX: -spec.lengthM / 2,
    centerY,
    top,
    finH,
    wingX: spec.lengthM * (0.5 - spec.wingAt),
    wingY: spec.wingHigh ? centerY + spec.ry * 0.7 : centerY - spec.ry * 0.28,
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
    const x = tailX + spec.lengthM * 0.2
    const y = centerY + spec.ry * 0.08
    const z = spec.rx + eng.radius * 0.55
    pts.push(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, -z))
    return pts
  }
  if (eng.mount === 'tail') {
    const x = tailX + eng.length * 0.35
    const z = spec.rx * 0.42
    pts.push(new THREE.Vector3(x, centerY, z), new THREE.Vector3(x, centerY, -z))
    return pts
  }
  const y =
    spec.wingHigh && eng.kind === 'turboprop'
      ? wingY
      : wingY - eng.radius * (spec.wingHigh ? 0.85 : 0.95)
  const semi = spec.spanM / 2
  const fracs = eng.count === 4 ? [0.34, 0.68] : [0.4]
  for (const frac of fracs) {
    const z = semi * frac
    pts.push(new THREE.Vector3(wingX, y, z), new THREE.Vector3(wingX, y, -z))
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
  const mesh = new THREE.Mesh(loftGeometry(spec.family, sides))
  mesh.scale.set(spec.lengthM, spec.ry, spec.rx)
  mesh.position.set(0, frame.centerY, 0)
  mesh.name = 'fuselage'
  addMesh(frame, mesh, 'body', 'mesh', frame.tier === 'mid')
  if (spec.hump) {
    const hump = new THREE.Mesh(loftGeometry('hump', sides))
    hump.scale.set(spec.lengthM * 0.4, spec.ry * 0.52, spec.rx * 0.62)
    hump.position.set(spec.lengthM * 0.16, frame.top - spec.ry * 0.05, 0)
    hump.name = 'hump'
    addMesh(frame, hump, 'body', 'mesh', frame.tier === 'mid')
  }
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
      'body',
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
  addMesh(frame, mesh, 'body', 'mesh', true)
  if (spec.winglet !== 'none') {
    const semi = spec.spanM / 2
    const sweep = Math.tan((spec.sweep * Math.PI) / 180) * semi
    const lift = Math.tan((spec.dihedral * Math.PI) / 180) * semi
    const height = spec.winglet === 'fence' ? 1.15 : spec.winglet === 'raked' ? 1.7 : 2.05
    const lean = spec.winglet === 'raked' ? -0.7 : spec.winglet === 'blended' ? -0.35 : 0
    const tipX = wingX + spec.rootChord / 2 - sweep - spec.tipChord * 0.45
    for (const sign of [1, -1]) {
      addBox(
        frame,
        [0.22, height, 0.55],
        [tipX, wingY + lift + height * 0.45, sign * (semi - 0.15)],
        'stripe',
        'mesh',
        [0, 0, lean * sign],
      )
    }
  }
}

function addTail(frame: Frame) {
  if (frame.tier === 'high' || frame.spec.family === 'helo') return
  const { spec, tailX, top, finH, centerY } = frame
  const chord = Math.max(1.1, spec.lengthM * 0.11)
  const thick = Math.max(0.08, spec.rx * 0.08)
  const finX = tailX + chord * 0.55
  const sweep = -0.35
  if (spec.tail === 'twin') {
    const spread = Math.max(0.7, spec.rx * 0.85)
    for (const sign of [1, -1]) {
      addBox(
        frame,
        [chord * 0.85, finH, thick],
        [finX, top + finH / 2, sign * spread],
        'stripe',
        'mesh',
        [0, 0, sign * 0.12],
        frame.tier === 'mid',
      )
    }
  } else {
    const mesh = addBox(
      frame,
      [chord, finH, thick],
      [finX, top + finH / 2, 0],
      'stripe',
      'mesh',
      [0, 0, sweep],
      frame.tier === 'mid',
    )
    mesh.name = 'tail'
  }
  const stabY = spec.tail === 't' ? frame.spec.heightM - 0.12 : centerY + spec.ry * 0.2
  const stabChord = Math.max(0.8, spec.rootChord * 0.42)
  addBox(
    frame,
    [stabChord, Math.max(0.08, spec.thickness * 0.22), spec.tailSpan],
    [finX - chord * 0.15, stabY, 0],
    'stripe',
    'mesh',
  )
}

function addEngines(frame: Frame) {
  const { spec, tier } = frame
  const eng: EngineSpec = spec.engines
  if (eng.count === 0 || tier === 'high') return
  const pts = enginePoints(frame)
  const sides = cylinderSides(tier)
  const matrices = pts.map((p) =>
    compose(p.x, p.y, p.z, 0, 0, Math.PI / 2, eng.radius, eng.length, eng.radius),
  )
  const mesh = addInstances(frame, unitCylinder(sides), matrices, 'metal', 'mesh', 'engines')
  if (mesh) mesh.name = 'engines'
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
  addInstances(frame, unitCylinder(sides), intakes, 'dark', 'mesh', 'intakes')
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
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), blades)
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

function addGear(frame: Frame) {
  const { spec, tier, nose, tailX, wingX } = frame
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

  const mount = (x: number, z: number, bogie: boolean) => {
    // Close LOD only adds the extra bogie wheels and doors. The mid gear stays,
    // so detail fades in instead of swapping the whole leg.
    if (tier === 'high') {
      if (!bogie) return
      const strutLen = Math.max(0.3, spec.gear - wheelR)
      for (const step of [-1, 1]) {
        wheels.push(
          compose(x + step * wheelR * 1.15, localGround + wheelR, z, Math.PI / 2, 0, 0, wheelR, wheelR * 0.38, wheelR),
        )
      }
      const door = new THREE.Mesh(unitBox())
      door.scale.set(wheelR * 1.1, strutLen * 0.85, 0.06)
      door.position.set(x, localGround + wheelR + strutLen * 0.45, z + wheelR * 0.75)
      const paintedDoor = paintMesh(door, 'body', frame.livery, 'mesh', tier)
      gear.add(paintedDoor)
      frame.meshes.push(paintedDoor)
      return
    }
    if (tier === 'low') {
      lowBoxes.push(
        compose(x, localGround + spec.gear * 0.46, z, 0, 0, 0, wheelR * 1.4, spec.gear * 0.92, wheelR * 0.7),
      )
      return
    }
    const strutLen = Math.max(0.3, spec.gear - wheelR)
    struts.push(compose(x, localGround + wheelR + strutLen / 2, z, 0, 0, 0, 0.09, strutLen, 0.09))
    wheels.push(compose(x, localGround + wheelR, z, Math.PI / 2, 0, 0, wheelR, wheelR * 0.38, wheelR))
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

  if (!spec.tailWheel) mount(nose - spec.lengthM * 0.16, 0, false)
  const mainZ = Math.max(spec.rx * 0.95, spec.spanM * 0.07)
  mount(wingX, mainZ, spec.bogie)
  mount(wingX, -mainZ, spec.bogie)
  if (spec.bodyGear) {
    mount(wingX - spec.rootChord * 0.45, spec.rx * 0.28, spec.bogie)
    mount(wingX - spec.rootChord * 0.45, -spec.rx * 0.28, spec.bogie)
  }
  if (spec.tailWheel) {
    mount(tailX + 0.7, 0, false)
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
}

function addWindows(frame: Frame) {
  if (frame.tier === 'low' || frame.spec.family === 'helo') return
  const { spec, centerY, wingX } = frame
  if (frame.tier === 'mid' && spec.windows) {
    const band = addBox(
      frame,
      [spec.lengthM * 0.62, spec.ry * 0.22, spec.rx * 2.04],
      [spec.lengthM * 0.02, centerY + spec.ry * 0.18, 0],
      'dark',
      'band',
    )
    band.name = 'window-band'
    if (spec.decks === 2) {
      addBox(
        frame,
        [spec.lengthM * 0.5, spec.ry * 0.16, spec.rx * 2.02],
        [spec.lengthM * 0.04, centerY + spec.ry * 0.55, 0],
        'dark',
        'band',
      )
    }
    return
  }
  if (frame.tier !== 'high' || !spec.windows) return
  const count = Math.max(8, Math.round(spec.lengthM / 1.7))
  const matrices: THREE.Matrix4[] = []
  const x0 = spec.lengthM * 0.32
  const x1 = -spec.lengthM * 0.28
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * i) / (count - 1)
    if (Math.abs(x - wingX) < spec.rootChord * 0.28) continue
    for (const sign of [1, -1]) {
      for (let deck = 0; deck < spec.decks; deck++) {
        const y = centerY + spec.ry * (deck === 0 ? 0.16 : 0.52)
        matrices.push(compose(x, y, sign * (spec.rx + 0.03), 0, 0, 0, 0.42, 0.28, 0.05))
      }
    }
  }
  const mesh = addInstances(frame, unitBox(), matrices, 'glass', 'mesh', 'windows')
  if (mesh) mesh.name = 'windows'
  const doorH = Math.min(2.3, spec.ry * 1.15)
  for (const x of [spec.lengthM * 0.3, -spec.lengthM * 0.2]) {
    addBox(
      frame,
      [0.85, doorH, 0.06],
      [x, centerY - spec.ry * 0.05, spec.rx + 0.04],
      'stripe',
      'mesh',
    ).name = 'doors'
  }
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
    addBox(
      frame,
      [spec.lengthM * 0.55, spec.ry * 0.16, spec.rx * 2.02],
      [0, centerY + spec.ry * 0.42, 0],
      'stripe',
      'mesh',
    ).name = 'cheatline'
    addBox(
      frame,
      [spec.lengthM * 0.7, spec.ry * 0.28, spec.rx * 1.7],
      [0, spec.gear + spec.ry * 0.2, 0],
      'belly',
      'mesh',
    )
    const glassW = spec.family === 'point' ? spec.rx * 0.9 : spec.rx * 0.55
    const glass = spec.family === 'point'
      ? new THREE.Mesh(unitSphere())
      : new THREE.Mesh(unitBox())
    if (spec.family === 'point') glass.scale.set(1.15, 0.62, 0.7)
    else glass.scale.set(spec.lengthM * 0.07, spec.ry * 0.38, glassW)
    glass.position.set(nose - spec.lengthM * 0.1, centerY + spec.ry * 0.35, 0)
    glass.name = 'cockpit'
    addMesh(frame, glass, 'glass', 'mesh')
  }
}

function addHelo(frame: Frame) {
  const { spec, tier, centerY, nose, tailX } = frame
  if (tier !== 'high') {
    const sides = fuselageSides(tier === 'low' ? 'low' : 'mid')
    const body = new THREE.Mesh(loftGeometry('helo', sides))
    body.scale.set(spec.lengthM, spec.ry, spec.rx)
    body.position.set(0, centerY, 0)
    body.name = 'fuselage'
    addMesh(frame, body, 'body', 'mesh', tier === 'mid')
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
          Math.cos(angle) * spec.rotor * 0.48,
          0.02,
          Math.sin(angle) * spec.rotor * 0.48,
          0,
          -angle,
          0,
          spec.rotor * 0.92,
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
            Math.cos(angle) * spec.rotor * 0.48,
            0.05,
            Math.sin(angle) * spec.rotor * 0.48,
            0,
            -angle,
            0,
            spec.rotor * 0.9,
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
    addBox(
      frame,
      [spec.lengthM * 0.16, spec.ry * 0.35, 0.05],
      [nose - spec.lengthM * 0.38, centerY + spec.ry * 0.05, spec.rx + 0.03],
      'stripe',
      'mesh',
    ).name = 'doors'
  }
}

function addLights(frame: Frame) {
  const { spec, wingY, centerY, top } = frame
  if (spec.family === 'helo') return
  const radius = Math.min(1.15, Math.max(0.75, spec.spanM * 0.016))
  const lamp = (slot: PaintSlot, pos: [number, number, number], kind: 'light' | 'strobe' | 'beacon', name: string) => {
    if (frame.tier === 'high') return
    if (frame.tier === 'low' && kind !== 'beacon') return
    const mesh = new THREE.Mesh(unitSphere())
    mesh.scale.setScalar(kind === 'beacon' ? radius * 0.7 : radius)
    mesh.position.set(pos[0], pos[1], pos[2])
    mesh.name = name
    mesh.userData.baseScale = mesh.scale.x
    const painted = addMesh(frame, mesh, slot, kind === 'light' ? 'light' : kind)
    if (kind === 'strobe') frame.strobes.push(painted)
    if (kind === 'beacon') frame.beacons.push(painted)
  }
  const semi = spec.spanM / 2
  lamp('navRed', [frame.wingX, wingY, semi - radius], 'light', 'nav-port')
  lamp('navGreen', [frame.wingX, wingY, -(semi - radius)], 'light', 'nav-starboard')
  lamp('navWhite', [frame.tailX + radius, centerY + spec.ry * 0.15, 0], 'light', 'nav-tail')
  lamp('navWhite', [frame.wingX, wingY + radius, semi - radius * 1.4], 'strobe', 'strobe')
  lamp('navWhite', [frame.wingX, wingY + radius, -(semi - radius * 1.4)], 'strobe', 'strobe')
  if (frame.tier !== 'low') {
    lamp('navWhite', [0, spec.gear + 0.2, 0], 'strobe', 'strobe')
  }
  lamp('beacon', [spec.lengthM * 0.02, Math.min(top + 0.02, spec.heightM - radius * 0.7), 0], 'beacon', 'beacon')
}

function addHeloLights(frame: Frame) {
  if (frame.spec.family !== 'helo' || frame.tier === 'high') return
  const radius = 0.55
  const { spec, centerY, tailX } = frame
  if (frame.tier === 'low') {
    const mesh = new THREE.Mesh(unitSphere())
    mesh.scale.setScalar(radius * 0.8)
    mesh.position.set(0, spec.heightM - radius, 0)
    mesh.name = 'beacon'
    mesh.userData.baseScale = mesh.scale.x
    frame.beacons.push(addMesh(frame, mesh, 'beacon', 'beacon'))
    return
  }
  const port = new THREE.Mesh(unitSphere())
  port.scale.setScalar(radius)
  port.position.set(spec.lengthM * 0.05, centerY, spec.rx + 0.1)
  port.name = 'nav-port'
  addMesh(frame, port, 'navRed', 'light')
  const star = port.clone()
  star.position.z *= -1
  star.name = 'nav-starboard'
  addMesh(frame, star, 'navGreen', 'light')
  const tail = port.clone()
  tail.position.set(tailX + 0.2, centerY, 0)
  tail.name = 'nav-tail'
  addMesh(frame, tail, 'navWhite', 'light')
  const beacon = port.clone()
  beacon.scale.setScalar(radius * 0.75)
  beacon.position.set(0, centerY + spec.ry + 0.15, 0)
  beacon.name = 'beacon'
  beacon.userData.baseScale = beacon.scale.x
  frame.beacons.push(addMesh(frame, beacon, 'beacon', 'beacon'))
  const strobe = port.clone()
  strobe.position.set(spec.lengthM * 0.12, centerY + spec.ry * 0.4, 0)
  strobe.name = 'strobe'
  strobe.userData.baseScale = strobe.scale.x
  frame.strobes.push(addMesh(frame, strobe, 'navWhite', 'strobe'))
}

export function buildAircraft(spec: ModelSpec, tier: Tier, livery: Livery): BuiltLevel {
  const frame = frameFor(spec, tier, livery)
  if (spec.family === 'helo') {
    addHelo(frame)
    addGear(frame)
    addHeloLights(frame)
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
    addLights(frame)
  }
  return {
    group: frame.group,
    meshes: frame.meshes,
    spinners: frame.spinners,
    gears: frame.gears,
    strobes: frame.strobes,
    beacons: frame.beacons,
  }
}
