import * as THREE from 'three'
import { AIRCRAFT_LOOK } from '../look'
import type { Livery } from './specs'

/** Crown, airline band and belly colours for the fuselage loft. */
export function fuselagePaint(livery: Livery): { crown: string; body: string; belly: string } {
  // Solid schemes keep a darker shade of the body; two-tone jets get a polished light belly.
  const belly = livery.scheme === 'solid'
    ? `#${new THREE.Color(livery.body).multiplyScalar(AIRCRAFT_LOOK.bellyShade).getHexString()}`
    : `#${new THREE.Color(AIRCRAFT_LOOK.polishedBelly).lerp(new THREE.Color(livery.body), 0.1).getHexString()}`
  const crown = livery.crown ?? (livery.scheme === 'solid' ? livery.body : AIRCRAFT_LOOK.crown)
  return { crown, body: livery.body, belly }
}

/**
 * Curved plug or cargo door leaf, built in metres around the door centre (+X nose, +Y up,
 * outward = +side·Z). The outer skin follows the fuselage cross-section so a closed leaf sits
 * flush with a thin dark seam; behind it is real thickness, a grey inner face with a framed
 * structure, and on passenger doors a small viewing window. The outer face carries the fuselage
 * livery plate (U/V relative to the door centre; the instance adds `liveryShift`).
 */
export interface DoorLeafSpec {
  w: number
  h: number
  side: number
  kind: 'pax' | 'cargo'
  /** Fuselage semi-axes (m) and the loft station radius (unit) at the door. */
  rx: number
  ry: number
  r: number
  /** Door centre height above the loft centreline (m). */
  yRel: number
  /** Skin colours for the crown / airline band / belly split. */
  paint: { crown: string; body: string; belly: string }
  /** Fuselage plate span (m): U runs over `du`, V over `dv`. */
  du: number
  dv: number
}

const SEAM = 0.035
const THICK = 0.09
const PROUD = 0.016

export function doorLeafGeometry(d: DoorLeafSpec): THREE.BufferGeometry {
  const s = d.side >= 0 ? 1 : -1
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const luv: number[] = []
  const slot: number[] = []
  const uv: number[] = []
  const skinZ = (ly: number) => {
    const k = (d.yRel + ly) / d.ry
    return d.rx * Math.sqrt(Math.max(0.0004, d.r * d.r - k * k))
  }
  const z0 = skinZ(0)
  const outerZ = (ly: number) => s * (skinZ(ly) - z0 + PROUD)
  const skinNormal = (ly: number) => {
    const y = d.yRel + ly
    const z = skinZ(ly)
    return new THREE.Vector3(0, y / (d.ry * d.ry), z / (d.rx * d.rx)).normalize().multiply(new THREE.Vector3(1, 1, s))
  }
  const crown = new THREE.Color(d.paint.crown)
  const body = new THREE.Color(d.paint.body)
  const belly = new THREE.Color(d.paint.belly)
  const skinColor = (ly: number) => {
    const k = (d.yRel + ly) / d.ry
    return k > AIRCRAFT_LOOK.crownLine ? crown : k > AIRCRAFT_LOOK.bellyLine ? body : belly
  }
  const seam = new THREE.Color('#3b4148')
  const edge = new THREE.Color('#a3a9b0')
  const inner = new THREE.Color('#c3c7cc')
  const frame = new THREE.Color('#8b9299')
  const glass = new THREE.Color('#1c2b3a')
  const v = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()

  /** One triangle, wound so its face normal points along `facing`. */
  const tri = (
    a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3,
    facing: THREE.Vector3, color: THREE.Color | ((p: THREE.Vector3) => THREE.Color), livery: boolean,
    normals?: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
  ) => {
    e1.subVectors(b, a)
    e2.subVectors(c, a)
    v.crossVectors(e1, e2)
    let pts = [a, b, c]
    let ns = normals
    if (v.dot(facing) < 0) {
      pts = [a, c, b]
      if (ns) ns = [ns[0], ns[2], ns[1]]
    }
    const fn = v.clone().normalize().multiplyScalar(v.dot(facing) < 0 ? -1 : 1)
    pts.forEach((p, i) => {
      pos.push(p.x, p.y, p.z)
      const n = ns ? ns[i] : fn
      nor.push(n.x, n.y, n.z)
      const c0 = typeof color === 'function' ? color(p) : color
      col.push(c0.r, c0.g, c0.b)
      // +Z (port) runs U nose→tail reversed, matching outwardUv, so titles read outward.
      luv.push(livery ? (s > 0 ? p.x / d.du : -p.x / d.du) : 0, livery ? p.y / d.dv : 0)
      slot.push(livery ? 0 : 3)
      uv.push(p.x / 4.2, p.y / 2.1)
    })
  }
  const quad = (
    a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, e: THREE.Vector3,
    facing: THREE.Vector3, color: THREE.Color | ((p: THREE.Vector3) => THREE.Color), livery = false,
    normals?: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
  ) => {
    tri(a, b, c, facing, color, livery, normals && [normals[0], normals[1], normals[2]])
    tri(a, c, e, facing, color, livery, normals && [normals[0], normals[2], normals[3]])
  }

  const hw = d.w / 2
  const hh = d.h / 2
  const P = (x: number, y: number, dz = 0) => new THREE.Vector3(x, y, outerZ(y) - s * dz)
  const out = new THREE.Vector3(0, 0, s)
  const inn = new THREE.Vector3(0, 0, -s)

  // Outer skin: seam border plus a curved interior grid carrying the livery.
  const rows = Math.max(6, Math.round(d.h / 0.22))
  const xs = [-hw, -hw + SEAM, hw - SEAM, hw]
  const ys = [-hh, -hh + SEAM]
  for (let i = 1; i < rows; i++) ys.push(-hh + SEAM + ((d.h - 2 * SEAM) * i) / rows)
  ys.push(hh - SEAM, hh)
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const border = i === 0 || i === xs.length - 2 || j === 0 || j === ys.length - 2
      const y0 = ys[j]
      const y1 = ys[j + 1]
      const n0 = skinNormal(y0)
      const n1 = skinNormal(y1)
      quad(
        P(xs[i], y0, border ? 0.002 : 0), P(xs[i + 1], y0, border ? 0.002 : 0),
        P(xs[i + 1], y1, border ? 0.002 : 0), P(xs[i], y1, border ? 0.002 : 0),
        out, border ? seam : (p) => skinColor(p.y), !border, [n0, n0, n1, n1],
      )
    }
  }
  if (d.kind === 'pax') {
    // Small round viewing window, upper middle, just proud of the skin.
    const cy = hh * 0.42
    const rad = Math.min(0.13, d.w * 0.14)
    const c = P(0, cy, -0.004)
    const n = skinNormal(cy)
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2
      const a1 = ((k + 1) / 12) * Math.PI * 2
      tri(c, P(Math.cos(a0) * rad, cy + Math.sin(a0) * rad, -0.004), P(Math.cos(a1) * rad, cy + Math.sin(a1) * rad, -0.004), out, glass, false, [n, n, n])
    }
  }

  // Edge walls between the outer skin and the inner face.
  const ring: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = ring[k]
    const [bx, by] = ring[(k + 1) % 4]
    const steps = ay === by ? 1 : rows
    for (let i = 0; i < steps; i++) {
      const y0 = ay + ((by - ay) * i) / steps
      const y1 = ay + ((by - ay) * (i + 1)) / steps
      const x0 = ax + ((bx - ax) * i) / steps
      const x1 = ax + ((bx - ax) * (i + 1)) / steps
      const facing = new THREE.Vector3(ay === by ? 0 : Math.sign(ax), ay === by ? Math.sign(ay) : 0, 0)
      quad(P(x0, y0), P(x1, y1), P(x1, y1, THICK), P(x0, y0, THICK), facing, edge)
    }
  }

  // Inner face, following the same curve one leaf-thickness in.
  for (let j = 0; j < rows; j++) {
    const y0 = -hh + (d.h * j) / rows
    const y1 = -hh + (d.h * (j + 1)) / rows
    quad(P(-hw, y0, THICK), P(hw, y0, THICK), P(hw, y1, THICK), P(-hw, y1, THICK), inn, inner)
  }

  // Inner frame: perimeter rails and two cross beams, standing proud of the inner face.
  const bar = (x0: number, x1: number, y0: number, y1: number) => {
    const dz0 = THICK
    const dz1 = THICK + 0.05
    const ym = (y0 + y1) / 2
    const zIn = (dz: number) => outerZ(ym) - s * dz
    const q = (x: number, y: number, dz: number) => new THREE.Vector3(x, y, zIn(dz))
    quad(q(x0, y0, dz1), q(x1, y0, dz1), q(x1, y1, dz1), q(x0, y1, dz1), inn, frame)
    quad(q(x0, y0, dz0), q(x1, y0, dz0), q(x1, y0, dz1), q(x0, y0, dz1), new THREE.Vector3(0, -1, 0), frame)
    quad(q(x0, y1, dz0), q(x1, y1, dz0), q(x1, y1, dz1), q(x0, y1, dz1), new THREE.Vector3(0, 1, 0), frame)
    quad(q(x0, y0, dz0), q(x0, y1, dz0), q(x0, y1, dz1), q(x0, y0, dz1), new THREE.Vector3(-1, 0, 0), frame)
    quad(q(x1, y0, dz0), q(x1, y1, dz0), q(x1, y1, dz1), q(x1, y0, dz1), new THREE.Vector3(1, 0, 0), frame)
  }
  const rail = 0.07
  bar(-hw + 0.02, hw - 0.02, -hh + 0.02, -hh + 0.02 + rail)
  bar(-hw + 0.02, hw - 0.02, hh - 0.02 - rail, hh - 0.02)
  const railSegs = 3
  for (let j = 0; j < railSegs; j++) {
    const y0 = -hh + 0.02 + rail + ((d.h - 0.04 - 2 * rail) * j) / railSegs
    const y1 = -hh + 0.02 + rail + ((d.h - 0.04 - 2 * rail) * (j + 1)) / railSegs
    bar(-hw + 0.02, -hw + 0.02 + rail, y0, y1)
    bar(hw - 0.02 - rail, hw - 0.02, y0, y1)
  }
  for (const f of [-1 / 6, 1 / 6]) bar(-hw + 0.02 + rail, hw - 0.02 - rail, d.h * f - rail * 0.4, d.h * f + rail * 0.4)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setAttribute('liveryUv', new THREE.Float32BufferAttribute(luv, 2))
  geo.setAttribute('liverySlot', new THREE.Float32BufferAttribute(slot, 1))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setAttribute('grime', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1))
  geo.computeBoundingSphere()
  return geo
}
