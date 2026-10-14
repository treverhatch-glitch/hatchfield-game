import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { sharedGeo } from './pool'

/**
 * Landing-gear legs as single vertex-coloured meshes: oleo cylinder, chrome piston,
 * torque links, side brace, bogie beam, tyres with hubs and a leg door.
 * Each leg pivots at its top so it can swing up into the bay; the nose leg's lower
 * half sits in its own group so it can steer.
 */
export type LegKind = 'nose' | 'single' | 'twin' | 'bogie4' | 'bogie6'

export interface LegShape {
  kind: LegKind
  /** Pivot to ground, meters. */
  height: number
  wheelR: number
  /** Door on the outboard side: +1 or -1 on Z. 0 = no door. */
  doorSide: number
  /** Skin radius the doors are curved to. */
  skinR?: number
}

const C = {
  /** Gear legs are painted gloss grey on most airliners. */
  oleo: new THREE.Color('#b9bec3'),
  chrome: new THREE.Color('#eef1f4'),
  link: new THREE.Color('#8e959c'),
  pin: new THREE.Color('#5d646b'),
  hose: new THREE.Color('#1c1d1f'),
  tyre: new THREE.Color('#1d1f21'),
  tread: new THREE.Color('#141516'),
  hub: new THREE.Color('#c3c8cd'),
  brake: new THREE.Color('#4a4642'),
  /** Doors: light grey belly paint so one leg mesh serves every livery. */
  door: new THREE.Color('#dfe2e5'),
  doorIn: new THREE.Color('#9fb0a0'),
  well: new THREE.Color('#2a2e31'),
  wellRib: new THREE.Color('#5b6166'),
}

/** Roughness / metalness per part, read by the gear material from a `pbr` vertex attribute. */
const PBR: Record<string, [number, number]> = {
  oleo: [0.42, 0.25], chrome: [0.18, 0.55], link: [0.5, 0.35], pin: [0.45, 0.45], hose: [0.7, 0],
  tyre: [0.92, 0], tread: [0.97, 0], hub: [0.35, 0.5], brake: [0.6, 0.4], door: [0.45, 0.05],
  doorIn: [0.6, 0.05], well: [0.85, 0.1], wellRib: [0.6, 0.3],
}

function paint(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 3)
  const pbr = new Float32Array(n * 2)
  const name = (Object.keys(C) as string[]).find((k) => (C as Record<string, THREE.Color>)[k] === color) ?? 'link'
  const [ro, me] = PBR[name] ?? [0.5, 0.3]
  for (let i = 0; i < n; i++) {
    col[i * 3] = color.r
    col[i * 3 + 1] = color.g
    col[i * 3 + 2] = color.b
    pbr[i * 2] = ro
    pbr[i * 2 + 1] = me
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('pbr', new THREE.BufferAttribute(pbr, 2))
  g.deleteAttribute('uv')
  return g
}

function cyl(r: number, h: number, sides: number, color: THREE.Color, m: THREE.Matrix4, r2 = r) {
  return paint(new THREE.CylinderGeometry(r, r2, h, sides).applyMatrix4(m), color)
}

function box(sx: number, sy: number, sz: number, color: THREE.Color, m: THREE.Matrix4) {
  return paint(new THREE.BoxGeometry(sx, sy, sz).applyMatrix4(m), color)
}

function ball(r: number, color: THREE.Color, m: THREE.Matrix4) {
  return paint(new THREE.SphereGeometry(r, 8, 5).applyMatrix4(m), color)
}

const T = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  )

/** Rod between two points, for braces, links and hoses. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, color: THREE.Color, sides = 8) {
  const d = new THREE.Vector3().subVectors(b, a)
  const len = d.length()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
  const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), q, new THREE.Vector3(1, 1, 1))
  return cyl(r, len, sides, color, m)
}

/** Hose through a few points: small tubes with ball joints so it reads as one bent line. */
function hose(pts: THREE.Vector3[], r: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < pts.length - 1; i++) parts.push(rod(pts[i], pts[i + 1], r, C.hose, 4))
  return parts
}

const TYRE_SEG = 20
/**
 * Aircraft tyre by lathe: bead, bulged sidewalls, rounded shoulders and a tread face
 * with circumferential grooves. Axle along Z.
 */
function tyre(R: number, w: number, m: THREE.Matrix4): THREE.BufferGeometry[] {
  const h = w / 2
  const side: [number, number][] = [
    [R * 0.6, -h * 0.82], [R * 0.72, -h * 0.98], [R * 0.86, -h], [R * 0.95, -h * 0.9], [R * 0.99, -h * 0.68],
  ]
  const tread: [number, number][] = [[R, -h * 0.5], [R, -h * 0.34], [R * 0.975, -h * 0.3], [R * 0.975, -h * 0.18],
    [R, -h * 0.14], [R, h * 0.14], [R * 0.975, h * 0.18], [R * 0.975, h * 0.3], [R, h * 0.34], [R, h * 0.5]]
  const pts = [...side, ...tread, ...side.map(([r, y]) => [r, -y] as [number, number]).reverse()]
  const v = pts.map(([r, y]) => new THREE.Vector2(r, y))
  const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2)
  const full = new THREE.LatheGeometry(v, TYRE_SEG).applyMatrix4(rot).applyMatrix4(m)
  full.computeVertexNormals()
  // Tread band darker than the sidewall: split by face radius.
  const g = full.toNonIndexed()
  full.dispose()
  const pos = g.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const pbr = new Float32Array(pos.count * 2)
  const inv = new THREE.Matrix4().copy(m).invert()
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    let zs = 0
    for (let k = 0; k < 3; k++) zs += Math.abs(p.fromBufferAttribute(pos, i + k).applyMatrix4(inv).z)
    const c = zs / 3 < h * 0.52 ? C.tread : C.tyre
    const pr = c === C.tread ? PBR.tread : PBR.tyre
    for (let k = 0; k < 3; k++) {
      col.set([c.r, c.g, c.b], (i + k) * 3)
      pbr.set(pr, (i + k) * 2)
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('pbr', new THREE.BufferAttribute(pbr, 2))
  g.deleteAttribute('uv')
  return [g]
}

/** Dished wheel hub with a rim lip, centre cap and a brake stack behind it (inboard = -Z side). */
function hub(R: number, w: number, outward: number, m: THREE.Matrix4): THREE.BufferGeometry[] {
  const h = w / 2
  const o = outward
  const prof = [
    new THREE.Vector2(0.001, o * h * 0.55), new THREE.Vector2(R * 0.12, o * h * 0.55), new THREE.Vector2(R * 0.16, o * h * 0.42),
    new THREE.Vector2(R * 0.42, o * h * 0.3), new THREE.Vector2(R * 0.56, o * h * 0.62), new THREE.Vector2(R * 0.62, o * h * 0.86),
  ]
  if (o < 0) prof.reverse()
  const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2)
  const face = paint(new THREE.LatheGeometry(prof, 12).applyMatrix4(rot).applyMatrix4(m), C.hub)
  // Brake stack: carbon discs and housing filling the inboard half of the rim.
  const stack = cyl(R * 0.5, w * 0.62, 14, C.brake, new THREE.Matrix4().multiplyMatrices(m, T(0, 0, -o * h * 0.25, Math.PI / 2, 0, 0)))
  const bolts: THREE.BufferGeometry[] = []
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    bolts.push(cyl(R * 0.025, w * 0.08, 5, C.pin,
      new THREE.Matrix4().multiplyMatrices(m, T(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28, o * h * 0.36, Math.PI / 2, 0, 0))))
  }
  return [face, stack, ...bolts]
}

/**
 * Curved door panel in local X (len) by Y (arc), bowed toward +Z like a strip of skin of
 * radius `rs`. Outer face in door paint, inner face in primer.
 */
function curvedPanel(len: number, arc: number, rs: number, color: THREE.Color, m: THREE.Matrix4, thick = 0.035) {
  const bow = (g: THREE.BufferGeometry, dz: number) => {
    const pos = g.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      pos.setZ(i, Math.sqrt(Math.max(0, rs * rs - y * y)) - rs + dz)
    }
    g.computeVertexNormals()
    return g
  }
  const outer = bow(new THREE.PlaneGeometry(len, arc, 1, 10), 0)
  const inner = bow(new THREE.PlaneGeometry(len, arc, 1, 10), -thick)
  // Flip winding of the inner face so it faces -Z.
  const ii = inner.getIndex()!
  for (let i = 0; i < ii.count; i += 3) {
    const t = ii.getX(i + 1); ii.setX(i + 1, ii.getX(i + 2)); ii.setX(i + 2, t)
  }
  inner.computeVertexNormals()
  return [paint(outer.applyMatrix4(m), color), paint(inner.applyMatrix4(m), C.doorIn)]
}

/** Wheel stations (x, z) relative to the leg axis. */
export function wheelStations(kind: LegKind, wheelR: number): [number, number][] {
  const dz = wheelR * 0.6
  const dx = wheelR * 1.12
  switch (kind) {
    case 'single':
      return [[0, 0]]
    case 'nose':
    case 'twin':
      return [[0, dz], [0, -dz]]
    case 'bogie4':
      return [[-dx, dz], [-dx, -dz], [dx, dz], [dx, -dz]]
    case 'bogie6':
      return [[-dx * 2, dz], [-dx * 2, -dz], [0, dz], [0, -dz], [dx * 2, dz], [dx * 2, -dz]]
  }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/**
 * One leg in leg space: pivot (trunnion, inside the bay) at the origin, ground at -height,
 * +X forward, +Z outboard for mains. Trunnion, painted shock strut with collar, chrome
 * piston, two-piece drag and side braces with knee joints, torque-link scissor,
 * hydraulic lines, axle or bogie beam with pitch trimmer, lathe tyres, hubs with brake
 * stacks, and a curved leg door matching the skin.
 */
export function legGeometry(shape: LegShape): THREE.BufferGeometry {
  const rs = shape.skinR ?? 3
  const key = `leg3:${shape.kind}:${shape.height.toFixed(2)}:${shape.wheelR.toFixed(2)}:${shape.doorSide}:${rs.toFixed(1)}`
  return sharedGeo(key, () => {
    const { height: H, wheelR: R, kind } = shape
    const nose = kind === 'nose'
    const bogie = kind === 'bogie4' || kind === 'bogie6'
    const sR = Math.max(0.06, R * (nose ? 0.26 : 0.3))
    const top = -0.04
    const axleY = -H + R
    const beamY = bogie ? axleY + R * 0.12 : axleY
    const oleoLen = Math.max(0.25, (H - R) * 0.58)
    const yO = top - oleoLen
    const parts: THREE.BufferGeometry[] = []
    const inb = shape.doorSide === 0 ? -1 : -Math.sign(shape.doorSide)

    // Trunnion pin across the bay and the shock strut with its gland collar.
    parts.push(cyl(sR * 0.55, sR * 6, 12, C.oleo, T(0, top, 0, 0, 0, Math.PI / 2)))
    parts.push(cyl(sR, oleoLen, 18, C.oleo, T(0, top - oleoLen / 2, 0), sR * 0.94))
    parts.push(cyl(sR * 1.12, Math.max(0.05, sR * 0.5), 18, C.link, T(0, yO, 0)))
    // Chrome piston down to the axle or bogie pivot.
    const pistonBot = beamY + (bogie ? sR * 0.4 : 0)
    if (nose) {
      parts.push(rod(V(0, yO, 0), V(-R * 0.7, pistonBot, 0), sR * 0.72, C.chrome, 12))
    } else {
      parts.push(cyl(sR * 0.72, yO - pistonBot, 16, C.chrome, T(0, (yO + pistonBot) / 2, 0)))
    }

    // Drag brace (fore-aft) and side brace (inboard), each folding at a knee.
    const brace = (end: THREE.Vector3, r: number) => {
      const start = V(0, top - oleoLen * 0.55, 0)
      const knee = start.clone().lerp(end, 0.5).add(V(0, oleoLen * 0.08, 0))
      parts.push(rod(start, knee, r, C.link, 10), rod(knee, end, r * 0.9, C.link, 10), ball(r * 1.5, C.pin, T(knee.x, knee.y, knee.z)))
      parts.push(ball(r * 1.4, C.pin, T(start.x, start.y, start.z)))
    }
    brace(V(nose ? oleoLen * 0.7 : -oleoLen * 0.7, -0.02, 0), sR * 0.34)
    if (!nose && kind !== 'single') brace(V(0, -0.02, inb * oleoLen * 0.7), sR * 0.3)

    // Torque links: upper and lower arm meeting at an apex pin, in front (nose) or aft (mains).
    const lx = nose ? 1 : -1
    const lt = V(lx * sR * 1.05, yO - 0.02, 0)
    const lb = V(lx * sR * 0.8, pistonBot + Math.min(0.15, (yO - pistonBot) * 0.15), 0)
    const apex = V(lx * (sR * 1.05 + (yO - pistonBot) * 0.35), (lt.y + lb.y) / 2, 0)
    parts.push(rod(lt, apex, sR * 0.2, C.link, 6), rod(apex, lb, sR * 0.2, C.link, 6))
    for (const q of [lt, apex, lb]) parts.push(ball(sR * 0.26, C.pin, T(q.x, q.y, q.z)))

    // Hydraulic lines down the strut to the brakes.
    for (const sz of [1, -1]) {
      const hz = sz * sR * 1.15
      parts.push(...hose([V(-sR * 0.3, top, hz), V(-sR * 0.4, yO + 0.05, hz), V(-sR * 1.1, (yO + beamY) / 2, hz * 1.4), V(-sR * 0.6, beamY + R * 0.25, hz * 2)], Math.max(0.012, sR * 0.07)))
    }

    // Nose strut rakes aft so the tyre sits behind the trunnion, like a real oleo.
    const rake = nose ? R * 0.7 : 0
    const stations = wheelStations(kind, R).map(([x, z]) => [x - rake, z] as [number, number])
    const w = R * (nose ? 0.6 : 0.7)
    if (bogie) {
      const xs = stations.map((st) => st[0])
      const span = Math.max(...xs) - Math.min(...xs) + R * 0.5
      parts.push(cyl(sR * 0.6, span, 12, C.oleo, T(0, beamY, 0, 0, 0, Math.PI / 2)))
      for (const ex of [span / 2, -span / 2]) parts.push(ball(sR * 0.62, C.oleo, T(ex, beamY, 0)))
      parts.push(ball(sR * 0.8, C.pin, T(0, beamY, 0)))
      // Pitch trimmer from the strut to the aft end of the beam.
      parts.push(rod(V(-sR * 0.9, yO + 0.05, 0), V(-span * 0.32, beamY + sR * 0.4, 0), sR * 0.22, C.chrome, 8))
    }
    const zs = stations.map((st) => Math.abs(st[1]))
    for (const x of [...new Set(stations.map((st) => st[0]))]) {
      const reach = Math.max(...zs) * 2
      if (reach > 0) parts.push(cyl(R * 0.13, reach, 10, C.link, T(x, axleY, 0, Math.PI / 2, 0, 0)))
    }
    for (const [x, z] of stations) {
      const m = T(x, axleY, z)
      parts.push(...tyre(R, w, m))
      parts.push(...hub(R, w, z === 0 ? 1 : Math.sign(z), m))
    }

    // Curved leg door on the outboard face, bowed like the belly skin.
    if (shape.doorSide !== 0) {
      const dh = oleoLen * 1.05
      const flip = shape.doorSide > 0 ? 0 : Math.PI
      parts.push(...curvedPanel(R * 1.6, dh, rs, C.door, T(0, top - dh / 2, shape.doorSide * (sR + 0.09), 0, flip, 0)))
      // Door struts back to the leg.
      for (const fy of [0.3, 0.75]) parts.push(rod(V(0, top - dh * fy, shape.doorSide * sR * 0.9), V(0, top - dh * fy, shape.doorSide * (sR + 0.07)), sR * 0.12, C.link, 6))
    }
    return mergeGeometries(parts)!
  })
}

/**
 * Wheel-well tub flush under the skin: dark ceiling with structural ribs and walls dropping
 * a little below the skin so the opening reads as a cavity from low angles. Origin = bay roof.
 * Unshared: callers bake and merge it.
 */
export function wellGeometry(len: number, wid: number): THREE.BufferGeometry {
  const d = Math.min(0.18, wid * 0.12)
  const parts = [box(len, 0.04, wid, C.well, T(0, 0.02, 0))]
  for (let k = 1; k < 4; k++) parts.push(box(0.05, 0.05, wid * 0.96, C.wellRib, T(-len / 2 + (len * k) / 4, -0.01, 0)))
  parts.push(box(len * 0.9, 0.035, 0.035, C.wellRib, T(0, -0.02, 0)))
  for (const s of [1, -1]) {
    parts.push(box(len, d, 0.03, C.well, T(0, -d / 2, s * wid / 2)))
    parts.push(box(0.03, d, wid, C.well, T(s * len / 2, -d / 2, 0)))
  }
  return mergeGeometries(parts)!
}

/**
 * Bay doors hinged on the long edges of the well, hanging open and splayed outward,
 * curved to the skin radius `rs`. Origin = bay roof. Unshared.
 */
export function bayDoorsGeometry(len: number, wid: number, drop: number, rs = 3): THREE.BufferGeometry {
  const splay = 0.22
  const parts: THREE.BufferGeometry[] = []
  for (const s of [1, -1]) {
    const zc = s * (wid / 2 + Math.sin(splay) * drop / 2)
    parts.push(...curvedPanel(len * 0.96, drop, rs, C.door, T(0, -drop / 2 * Math.cos(splay), zc, -s * splay, s > 0 ? 0 : Math.PI, 0)))
    parts.push(cyl(0.035, len * 0.9, 6, C.pin, T(0, -0.03, s * wid / 2, 0, 0, Math.PI / 2)))
    // Door actuator from the well wall to the door.
    parts.push(rod(V(0, -0.02, s * wid * 0.3), V(0, -drop * 0.55, zc), 0.025, C.chrome, 6))
  }
  return mergeGeometries(parts)!
}

const CAB = {
  wall: new THREE.Color('#d9ccb5'),
  floor: new THREE.Color('#5e5248'),
  galley: new THREE.Color('#b8b2a8'),
  light: new THREE.Color('#fff4dc'),
  reveal: new THREE.Color('#3a3f44'),
  frame: new THREE.Color('#c9ced3'),
  seal: new THREE.Color('#202224'),
}
for (const [k, v] of Object.entries(CAB)) {
  ;(C as Record<string, THREE.Color>)[`cab_${k}`] = v
}
Object.assign(PBR, {
  cab_wall: [0.8, 0], cab_floor: [0.9, 0], cab_galley: [0.35, 0.4], cab_light: [0.3, 0],
  cab_reveal: [0.7, 0.1], cab_frame: [0.3, 0.6], cab_seal: [0.9, 0],
})

/**
 * Doorway seen with the leaf open, facing +Z with the skin at z = 0: a thick frame with a
 * rubber seal, reveal walls giving the cut its depth, and a lit cabin glimpse behind
 * (cream wall, galley panel, ceiling light strip, dark floor). Unshared.
 */
export function doorwayGeometry(w: number, h: number): THREE.BufferGeometry {
  const d = 0.12
  const f = Math.max(0.06, w * 0.08)
  const parts = [
    // Cabin glimpse at the back of the cut.
    box(w, h * 0.78, 0.01, CAB.wall, T(0, h * 0.06, 0.005)),
    box(w, h * 0.16, 0.012, CAB.floor, T(0, -h * 0.42, 0.006)),
    box(w * 0.42, h * 0.5, 0.02, CAB.galley, T(-w * 0.18, 0, 0.012)),
    box(w * 0.9, h * 0.035, 0.02, CAB.light, T(0, h * 0.43, 0.012)),
    // Reveal walls: the skin's thickness around the opening.
    box(0.02, h, d, CAB.reveal, T(w / 2, 0, d / 2)),
    box(0.02, h, d, CAB.reveal, T(-w / 2, 0, d / 2)),
    box(w, 0.02, d, CAB.reveal, T(0, h / 2, d / 2)),
    box(w, 0.025, d, CAB.floor, T(0, -h / 2, d / 2)),
  ]
  // Raised frame with a dark seal just inside it.
  for (const s of [1, -1]) {
    parts.push(box(f, h + f * 2, 0.05, CAB.frame, T(s * (w / 2 + f / 2), 0, d + 0.015)))
    parts.push(box(w + f * 2, f, 0.05, CAB.frame, T(0, s * (h / 2 + f / 2), d + 0.015)))
    parts.push(box(0.025, h, 0.03, CAB.seal, T(s * (w / 2 - 0.012), 0, d + 0.005)))
  }
  return mergeGeometries(parts)!
}
