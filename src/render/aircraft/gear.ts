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
}

const C = {
  oleo: new THREE.Color('#9aa1a8'),
  chrome: new THREE.Color('#d9dee3'),
  link: new THREE.Color('#5c636b'),
  tyre: new THREE.Color('#17191b'),
  hub: new THREE.Color('#b8bec4'),
  /** Leg doors: painted light grey so one leg mesh serves every livery. */
  door: new THREE.Color('#d4d8dc'),
}

function paint(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    col[i * 3] = color.r
    col[i * 3 + 1] = color.g
    col[i * 3 + 2] = color.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.deleteAttribute('uv')
  return g
}

function cyl(r: number, h: number, sides: number, color: THREE.Color, m: THREE.Matrix4) {
  return paint(new THREE.CylinderGeometry(r, r, h, sides).applyMatrix4(m), color)
}

function box(sx: number, sy: number, sz: number, color: THREE.Color, m: THREE.Matrix4) {
  return paint(new THREE.BoxGeometry(sx, sy, sz).applyMatrix4(m), color)
}

const T = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  )

/** Wheel stations (x, z) relative to the leg axis. */
export function wheelStations(kind: LegKind, wheelR: number): [number, number][] {
  const dz = wheelR * 0.52
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

/** Upper leg: oleo, side brace, door. Lower leg: piston, links, axle/bogie, wheels. */
export function legGeometry(shape: LegShape): THREE.BufferGeometry {
  const key = `leg:${shape.kind}:${shape.height.toFixed(2)}:${shape.wheelR.toFixed(2)}:${shape.doorSide}`
  const build = () => {
  const upper = (() => {
    const { height: H, wheelR: R } = shape
    const sR = Math.max(0.07, R * 0.2)
    const oleoLen = Math.max(0.2, (H - R) * 0.6)
    const parts = [cyl(sR, oleoLen, 10, C.oleo, T(0, -oleoLen / 2, 0))]
    if (shape.kind !== 'nose' && shape.kind !== 'single') {
      // Side brace from the oleo to the bay wall, inboard.
      const braceLen = oleoLen * 0.95
      const inb = -Math.sign(shape.doorSide || 1)
      parts.push(cyl(sR * 0.35, braceLen, 6, C.link, T(0, -oleoLen * 0.42, inb * braceLen * 0.32, inb * -0.75, 0, 0)))
    }
    if (shape.doorSide !== 0) {
      // Leg door rides on the outboard face of the strut.
      const dh = oleoLen * 1.05
      parts.push(
        box(R * 1.6, dh, 0.05, C.door, T(0, -dh / 2, shape.doorSide * (sR + 0.06))),
      )
    }
    return mergeGeometries(parts)!
  })()
  const lower = (() => {
    const { height: H, wheelR: R, kind } = shape
    const sR = Math.max(0.07, R * 0.2)
    const oleoLen = Math.max(0.2, (H - R) * 0.6)
    const axleY = -H + R
    const pistonTop = -oleoLen * 0.85
    const pistonLen = pistonTop - axleY
    const parts: THREE.BufferGeometry[] = [
      cyl(sR * 0.62, pistonLen, 8, C.chrome, T(0, (pistonTop + axleY) / 2, 0)),
    ]
    // Torque links: a scissor at the front of the oleo/piston joint.
    const linkLen = Math.max(0.12, pistonLen * 0.32)
    const lx = kind === 'nose' ? sR * 1.1 : -sR * 1.1
    parts.push(
      box(0.05, linkLen, sR * 0.5, C.link, T(lx, -oleoLen * 0.9 - linkLen * 0.3, 0, 0, 0, Math.sign(lx) * 0.45)),
      box(0.05, linkLen, sR * 0.5, C.link, T(lx, -oleoLen * 0.9 - linkLen * 0.95, 0, 0, 0, -Math.sign(lx) * 0.45)),
    )
    const stations = wheelStations(kind, R)
    const width = R * 0.4
    if (kind === 'bogie4' || kind === 'bogie6') {
      const xs = stations.map((s) => s[0])
      const span = Math.max(...xs) - Math.min(...xs) + R * 0.6
      parts.push(cyl(sR * 0.55, span, 8, C.oleo, T(0, axleY + R * 0.05, 0, 0, 0, Math.PI / 2)))
    }
    const zs = stations.map((s) => Math.abs(s[1]))
    for (const x of [...new Set(stations.map((s) => s[0]))]) {
      const reach = Math.max(...zs) * 2 + width
      if (reach > width) parts.push(cyl(R * 0.12, reach, 6, C.link, T(x, axleY, 0, Math.PI / 2, 0, 0)))
    }
    for (const [x, z] of stations) {
      parts.push(cyl(R, width, 14, C.tyre, T(x, axleY, z, Math.PI / 2, 0, 0)))
      parts.push(cyl(R * 0.55, width * 1.08, 10, C.hub, T(x, axleY, z, Math.PI / 2, 0, 0)))
    }
    return mergeGeometries(parts)!
  })()
  const whole = mergeGeometries([upper, lower])!
  upper.dispose()
  lower.dispose()
  return whole
  }
  return sharedGeo(key, build)
}

const WELL = new THREE.Color('#1b1e21')

/** Dark wheel-well recess, flush under the skin at the leg's attach point. Local origin = bay roof. Unshared: callers bake and merge it. */
export function wellGeometry(len: number, wid: number): THREE.BufferGeometry {
  return ((() => {
    const g = mergeGeometries([
      box(len, 0.06, wid, WELL, T(0, -0.03, 0)),
      // Bay rim, so the opening reads as a cut-out in the skin.
      box(len + 0.08, 0.03, 0.05, C.link, T(0, -0.055, wid / 2)),
      box(len + 0.08, 0.03, 0.05, C.link, T(0, -0.055, -wid / 2)),
      box(0.05, 0.03, wid, C.link, T(len / 2, -0.055, 0)),
      box(0.05, 0.03, wid, C.link, T(-len / 2, -0.055, 0)),
    ])!
    return g
  })())
}

/**
 * Bay doors hinged on the long edges of the well, hanging open and splayed outward.
 * Local origin = bay roof; the doors hang down (−Y), so scaling Y folds them shut.
 */
export function bayDoorsGeometry(len: number, wid: number, drop: number): THREE.BufferGeometry {
  return ((() => {
    const splay = 0.22
    const parts: THREE.BufferGeometry[] = []
    for (const s of [1, -1]) {
      parts.push(box(len * 0.96, drop, 0.04, C.door,
        T(0, -drop / 2 * Math.cos(splay), s * (wid / 2 + Math.sin(splay) * drop / 2), -s * splay, 0, 0)))
      // Hinge bar along the bay edge.
      parts.push(cyl(0.035, len * 0.9, 6, C.link, T(0, -0.04, s * wid / 2, 0, 0, Math.PI / 2)))
    }
    return mergeGeometries(parts)!
  })())
}
