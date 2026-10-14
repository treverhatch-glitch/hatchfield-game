import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { AIRCRAFT_LOOK } from '../look'
import { sharedGeo } from './pool'

/** Normalized fuselage stations, nose t=0 → tail t=1, radius 0–1. */
const PROFILES: Record<string, { t: number; r: number }[]> = {
  tube: [
    { t: 0, r: 0.015 },
    { t: 0.018, r: 0.14 },
    { t: 0.04, r: 0.4 },
    { t: 0.07, r: 0.7 },
    { t: 0.1, r: 0.88 },
    { t: 0.14, r: 0.97 },
    { t: 0.18, r: 1 },
    { t: 0.74, r: 1 },
    { t: 0.8, r: 0.9 },
    { t: 0.86, r: 0.68 },
    { t: 0.92, r: 0.4 },
    { t: 0.97, r: 0.16 },
    { t: 1, r: 0.03 },
  ],
  rearjet: [
    { t: 0, r: 0.02 },
    { t: 0.025, r: 0.2 },
    { t: 0.06, r: 0.58 },
    { t: 0.1, r: 0.86 },
    { t: 0.15, r: 0.98 },
    { t: 0.2, r: 1 },
    { t: 0.56, r: 1 },
    { t: 0.66, r: 0.86 },
    { t: 0.76, r: 0.58 },
    { t: 0.86, r: 0.32 },
    { t: 0.94, r: 0.14 },
    { t: 1, r: 0.04 },
  ],
  point: [
    { t: 0, r: 0.01 },
    { t: 0.06, r: 0.12 },
    { t: 0.14, r: 0.38 },
    { t: 0.26, r: 0.82 },
    { t: 0.4, r: 1 },
    { t: 0.68, r: 0.9 },
    { t: 0.82, r: 0.5 },
    { t: 0.92, r: 0.22 },
    { t: 1, r: 0.08 },
  ],
  prop: [
    { t: 0, r: 0.12 },
    { t: 0.04, r: 0.42 },
    { t: 0.1, r: 0.78 },
    { t: 0.18, r: 1 },
    { t: 0.7, r: 1 },
    { t: 0.82, r: 0.72 },
    { t: 0.9, r: 0.4 },
    { t: 0.96, r: 0.16 },
    { t: 1, r: 0.05 },
  ],
  helo: [
    { t: 0, r: 0.16 },
    { t: 0.06, r: 0.62 },
    { t: 0.14, r: 0.95 },
    { t: 0.28, r: 1 },
    { t: 0.42, r: 0.78 },
    { t: 0.54, r: 0.36 },
    { t: 0.72, r: 0.16 },
    { t: 1, r: 0.06 },
  ],
  hump: [
    { t: 0, r: 0.12 },
    { t: 0.1, r: 0.55 },
    { t: 0.22, r: 0.9 },
    { t: 0.46, r: 1 },
    { t: 0.72, r: 0.82 },
    { t: 0.88, r: 0.48 },
    { t: 1, r: 0.16 },
  ],
}

function pushTri(
  out: number[],
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
) {
  out.push(ax, ay, az, bx, by, bz, cx, cy, cz)
}

/** Unit loft, nose at x=+0.5, radius 1. Shared per family and side count. */
export function loftGeometry(family: string, sides: number): THREE.BufferGeometry {
  return sharedGeo(`loft:${family}:${sides}`, () => {
    const profile = PROFILES[family] ?? PROFILES.tube
    const rings: Float32Array[] = []
    for (const station of profile) {
      const ring = new Float32Array(sides * 3)
      const x = 0.5 - station.t
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2
        ring[i * 3] = x
        ring[i * 3 + 1] = Math.sin(a) * station.r
        ring[i * 3 + 2] = Math.cos(a) * station.r
      }
      rings.push(ring)
    }
    const positions: number[] = []
    for (let s = 0; s < rings.length - 1; s++) {
      const A = rings[s]
      const B = rings[s + 1]
      for (let i = 0; i < sides; i++) {
        const i2 = (i + 1) % sides
        const a = i * 3
        const b = i2 * 3
        pushTri(
          positions,
          A[a], A[a + 1], A[a + 2],
          A[b], A[b + 1], A[b + 2],
          B[b], B[b + 1], B[b + 2],
        )
        pushTri(
          positions,
          A[a], A[a + 1], A[a + 2],
          B[b], B[b + 1], B[b + 2],
          B[a], B[a + 1], B[a + 2],
        )
      }
    }
    const nose = rings[0]
    const tail = rings[rings.length - 1]
    for (let i = 0; i < sides; i++) {
      const i2 = (i + 1) % sides
      const a = i * 3
      const b = i2 * 3
      pushTri(positions, 0.51, 0, 0, nose[b], nose[b + 1], nose[b + 2], nose[a], nose[a + 1], nose[a + 2])
      pushTri(positions, -0.51, 0, 0, tail[a], tail[a + 1], tail[a + 2], tail[b], tail[b + 1], tail[b + 2])
    }
    const soup = new THREE.BufferGeometry()
    soup.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    // Weld the rings so the normals are smooth: a round skin from few sides, at no draw cost.
    const geo = mergeVertices(soup)
    soup.dispose()
    geo.computeVertexNormals()
    return geo
  })
}

/**
 * Loft with the livery baked into vertex colours, one colour per triangle so the
 * split stays crisp: crown above `crownLine`, airline colour below, a darker belly.
 */
export function paintedLoftGeometry(
  family: string,
  sides: number,
  paint: { crown: string; body: string; belly: string },
): THREE.BufferGeometry {
  const key = `loft:${family}:${sides}:${paint.crown}:${paint.body}:${paint.belly}`
  return sharedGeo(key, () => {
    const geo = loftGeometry(family, sides).toNonIndexed()
    const pos = geo.getAttribute('position')
    const colors = new Float32Array(pos.count * 3)
    const crown = new THREE.Color(paint.crown)
    const body = new THREE.Color(paint.body)
    const belly = new THREE.Color(paint.belly)
    for (let i = 0; i < pos.count; i += 3) {
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
      const c = y > AIRCRAFT_LOOK.crownLine ? crown : y > AIRCRAFT_LOOK.bellyLine ? body : belly
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = c.r
        colors[(i + k) * 3 + 1] = c.g
        colors[(i + k) * 3 + 2] = c.b
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  })
}

function quad(
  out: number[],
  a: number[],
  b: number[],
  c: number[],
  d: number[],
) {
  pushTri(out, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  pushTri(out, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2])
}

function mirrorZ(src: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < src.length; i += 9) {
    const order = [0, 2, 1]
    for (const k of order) {
      out.push(src[i + k * 3], src[i + k * 3 + 1], -src[i + k * 3 + 2])
    }
  }
  return out
}

/** Tapered wing pair in meters, root on the centerline, nose toward +X. */
export function wingGeometry(
  span: number,
  rootChord: number,
  tipChord: number,
  sweepDeg: number,
  dihedralDeg: number,
  thickness: number,
): THREE.BufferGeometry {
  const key = [
    'wing',
    span.toFixed(2),
    rootChord.toFixed(2),
    tipChord.toFixed(2),
    sweepDeg.toFixed(1),
    dihedralDeg.toFixed(1),
    thickness.toFixed(2),
  ].join(':')
  return sharedGeo(key, () => {
    const semi = span / 2
    const sweep = Math.tan((sweepDeg * Math.PI) / 180) * semi
    const lift = Math.tan((dihedralDeg * Math.PI) / 180) * semi
    const yT = thickness / 2
    const yTip = Math.max(0.08, thickness * 0.28)
    const leR = [rootChord / 2, yT, 0]
    const teR = [-rootChord / 2, yT, 0]
    const leT = [rootChord / 2 - sweep, lift + yTip, semi]
    const teT = [rootChord / 2 - sweep - tipChord, lift + yTip * 0.8, semi]
    const leRb = [rootChord / 2, -yT * 0.35, 0]
    const teRb = [-rootChord / 2, -yT * 0.35, 0]
    const leTb = [rootChord / 2 - sweep, lift - yTip * 0.45, semi]
    const teTb = [rootChord / 2 - sweep - tipChord, lift - yTip * 0.35, semi]
    const right: number[] = []
    quad(right, leR, teR, teT, leT)
    quad(right, leRb, leTb, teTb, teRb)
    quad(right, leR, leT, leTb, leRb)
    quad(right, teR, teRb, teTb, teT)
    quad(right, leT, teT, teTb, leTb)
    const positions = right.concat(mirrorZ(right))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.computeVertexNormals()
    return geo
  })
}

export function cylinderSides(tier: 'low' | 'mid' | 'high'): number {
  if (tier === 'low') return 5
  if (tier === 'mid') return 7
  return 8
}

export function fuselageSides(tier: 'low' | 'mid'): number {
  return AIRCRAFT_LOOK.fuselageSides[tier]
}

/**
 * Swept fin in unit space: leading edge toward +X, root at y = 0, tip at y = 1.
 * Trailing-edge vertices take the stripe colour so the fin reads as tail art
 * before a tail.png is bound.
 */
export function finGeometry(tail: string, stripe: string): THREE.BufferGeometry {
  return sharedGeo(`fin:${tail}:${stripe}`, () => {
    const lead = 0.42
    const trail = -0.5
    const tipLead = -0.04
    const tipTrail = -0.4
    const z = 0.5
    const zTip = 0.32
    const root: number[][] = [
      [lead, 0, z],
      [trail, 0, z],
      [trail, 0, -z],
      [lead, 0, -z],
    ]
    const tip: number[][] = [
      [tipLead, 1, zTip],
      [tipTrail, 1, zTip],
      [tipTrail, 1, -zTip],
      [tipLead, 1, -zTip],
    ]
    const positions: number[] = []
    const colors: number[] = []
    const tailC = new THREE.Color(tail)
    const stripeC = new THREE.Color(stripe)
    const push = (a: number[], b: number[], c: number[], stripeFace: boolean) => {
      const col = stripeFace ? stripeC : tailC
      for (const p of [a, c, b]) {
        positions.push(p[0], p[1], p[2])
        colors.push(col.r, col.g, col.b)
      }
    }
    const quadFace = (a: number[], b: number[], c: number[], d: number[], stripeFace: boolean) => {
      push(a, b, c, stripeFace)
      push(a, c, d, stripeFace)
    }
    // Port, starboard, leading, trailing (stripe), root, tip.
    quadFace(root[0], root[1], tip[1], tip[0], false)
    quadFace(root[3], tip[3], tip[2], root[2], false)
    quadFace(root[3], root[0], tip[0], tip[3], false)
    quadFace(root[1], root[2], tip[2], tip[1], true)
    quadFace(root[0], root[3], root[2], root[1], false)
    quadFace(tip[0], tip[1], tip[2], tip[3], false)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  })
}
