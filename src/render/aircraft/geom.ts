import * as THREE from 'three'
import { sharedGeo } from './pool'

/** Normalized fuselage stations, nose t=0 → tail t=1, radius 0–1. */
const PROFILES: Record<string, { t: number; r: number }[]> = {
  tube: [
    { t: 0, r: 0.05 },
    { t: 0.04, r: 0.45 },
    { t: 0.12, r: 0.9 },
    { t: 0.18, r: 1 },
    { t: 0.78, r: 1 },
    { t: 0.9, r: 0.58 },
    { t: 0.97, r: 0.2 },
    { t: 1, r: 0.05 },
  ],
  rearjet: [
    { t: 0, r: 0.06 },
    { t: 0.06, r: 0.55 },
    { t: 0.16, r: 1 },
    { t: 0.6, r: 1 },
    { t: 0.76, r: 0.7 },
    { t: 0.9, r: 0.36 },
    { t: 1, r: 0.08 },
  ],
  point: [
    { t: 0, r: 0.02 },
    { t: 0.1, r: 0.22 },
    { t: 0.24, r: 0.78 },
    { t: 0.42, r: 1 },
    { t: 0.7, r: 0.92 },
    { t: 0.86, r: 0.48 },
    { t: 1, r: 0.16 },
  ],
  prop: [
    { t: 0, r: 0.2 },
    { t: 0.08, r: 0.62 },
    { t: 0.18, r: 1 },
    { t: 0.74, r: 1 },
    { t: 0.9, r: 0.48 },
    { t: 1, r: 0.08 },
  ],
  helo: [
    { t: 0, r: 0.22 },
    { t: 0.1, r: 0.9 },
    { t: 0.28, r: 1 },
    { t: 0.46, r: 0.7 },
    { t: 0.58, r: 0.32 },
    { t: 0.78, r: 0.16 },
    { t: 1, r: 0.08 },
  ],
  hump: [
    { t: 0, r: 0.2 },
    { t: 0.18, r: 0.85 },
    { t: 0.5, r: 1 },
    { t: 0.82, r: 0.72 },
    { t: 1, r: 0.25 },
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
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.computeVertexNormals()
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
  return tier === 'low' ? 5 : 8
}
