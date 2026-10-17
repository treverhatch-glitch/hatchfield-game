import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { AIRCRAFT_LOOK } from '../look'
import { sharedGeo } from './pool'

/**
 * Normalized fuselage stations, nose t=0 → tail t=1, radius 0–1.
 * Class sheets (turboprop, regional, narrowbody, widebody, jumbo, superjumbo,
 * heli) set the silhouette. Meters stay on the real airframe, not the sheet.
 */
const PROFILES: Record<string, { t: number; r: number; dy?: number }[]> = {
  // Single-aisle and twin-aisle tube: drooped radome, cockpit brow, long
  // parallel barrel, upswept tail cone with the APU high.
  tube: [
    { t: 0, r: 0.015, dy: -0.24 },
    { t: 0.008, r: 0.2, dy: -0.22 },
    { t: 0.02, r: 0.4, dy: -0.16 },
    { t: 0.04, r: 0.6, dy: -0.08 },
    { t: 0.065, r: 0.78, dy: 0.02 },
    { t: 0.095, r: 0.9, dy: 0.045 },
    { t: 0.13, r: 0.98, dy: 0.01 },
    { t: 0.17, r: 1 },
    { t: 0.73, r: 1 },
    { t: 0.8, r: 0.9, dy: 0.05 },
    { t: 0.86, r: 0.7, dy: 0.16 },
    { t: 0.92, r: 0.44, dy: 0.32 },
    { t: 0.97, r: 0.2, dy: 0.46 },
    { t: 1, r: 0.06, dy: 0.54 },
  ],
  // Regional jet: sharper nose, long slender barrel, cone that the rear fans sit on.
  rearjet: [
    { t: 0, r: 0.01, dy: -0.14 },
    { t: 0.012, r: 0.22, dy: -0.12 },
    { t: 0.035, r: 0.48, dy: -0.06 },
    { t: 0.07, r: 0.74, dy: 0.01 },
    { t: 0.11, r: 0.92, dy: 0.03 },
    { t: 0.16, r: 1 },
    { t: 0.6, r: 1 },
    { t: 0.7, r: 0.84, dy: 0.06 },
    { t: 0.8, r: 0.58, dy: 0.18 },
    { t: 0.9, r: 0.3, dy: 0.36 },
    { t: 1, r: 0.06, dy: 0.48 },
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
  // Turboprop: pointed nose, constant cabin, mild tail upsweep. Straight wing lives on the spec.
  prop: [
    { t: 0, r: 0.03, dy: -0.04 },
    { t: 0.035, r: 0.28, dy: -0.03 },
    { t: 0.08, r: 0.62, dy: -0.01 },
    { t: 0.14, r: 0.9 },
    { t: 0.2, r: 1 },
    { t: 0.68, r: 1 },
    { t: 0.78, r: 0.76, dy: 0.04 },
    { t: 0.88, r: 0.4, dy: 0.12 },
    { t: 0.95, r: 0.14, dy: 0.16 },
    { t: 1, r: 0.03, dy: 0.18 },
  ],
  // Helicopter: blunt cabin, then a long thin tail boom.
  helo: [
    { t: 0, r: 0.2, dy: -0.02 },
    { t: 0.04, r: 0.62 },
    { t: 0.1, r: 0.94 },
    { t: 0.2, r: 1 },
    { t: 0.36, r: 0.98 },
    { t: 0.46, r: 0.62, dy: 0.04 },
    { t: 0.56, r: 0.28, dy: 0.06 },
    { t: 0.72, r: 0.12, dy: 0.04 },
    { t: 0.88, r: 0.08, dy: 0.02 },
    { t: 1, r: 0.04 },
  ],
  // 747 forehead: rises off the nose, holds a flat upper deck, blends off near the wing.
  hump: [
    { t: 0, r: 0.05, dy: -0.2 },
    { t: 0.08, r: 0.42, dy: 0.02 },
    { t: 0.18, r: 0.88, dy: 0.1 },
    { t: 0.32, r: 1, dy: 0.06 },
    { t: 0.55, r: 0.92 },
    { t: 0.74, r: 0.55, dy: -0.06 },
    { t: 0.9, r: 0.22, dy: -0.1 },
    { t: 1, r: 0.04, dy: -0.12 },
  ],
  // Full-length double deck (A380): blunt level nose, tall barrel held aft, short upswept cone.
  deck: [
    { t: 0, r: 0.05, dy: 0.04 },
    { t: 0.02, r: 0.32, dy: 0.06 },
    { t: 0.05, r: 0.58, dy: 0.05 },
    { t: 0.09, r: 0.82, dy: 0.02 },
    { t: 0.14, r: 0.96 },
    { t: 0.18, r: 1 },
    { t: 0.8, r: 1 },
    { t: 0.86, r: 0.88, dy: 0.04 },
    { t: 0.92, r: 0.62, dy: 0.14 },
    { t: 0.97, r: 0.28, dy: 0.26 },
    { t: 1, r: 0.07, dy: 0.34 },
  ],
}


type Station = { t: number; r: number; dy?: number }

/** Panel-joint bands (t ranges) per family, drawn as thin darker rings on the painted loft. */
const PANEL_BANDS: Record<string, [number, number][]> = {}
const PANEL_W = 0.0025

/**
 * Smooth the cones: Catmull-Rom between the hand-set stations (3 sub-steps per span),
 * then add thin panel-joint rings along the parallel barrel.
 */
function refine(family: string, prof: Station[]): Station[] {
  const out: Station[] = []
  const at = (i: number) => prof[Math.max(0, Math.min(prof.length - 1, i))]
  const cr = (p0: number, p1: number, p2: number, p3: number, u: number) =>
    0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i]
    const b = prof[i + 1]
    out.push(a)
    const flat = Math.abs(a.r - b.r) < 1e-4 && (a.dy ?? 0) === (b.dy ?? 0)
    if (flat) {
      // Barrel: a panel joint every ~7% of the length.
      const bands: [number, number][] = (PANEL_BANDS[family] ??= [])
      const n = Math.max(1, Math.round((b.t - a.t) / 0.07))
      for (let k = 1; k < n; k++) {
        const t = a.t + ((b.t - a.t) * k) / n
        out.push({ t, r: a.r, dy: a.dy }, { t: t + PANEL_W, r: a.r, dy: a.dy })
        bands.push([t, t + PANEL_W])
      }
      continue
    }
    for (const u of [1 / 3, 2 / 3]) {
      const r = cr(at(i - 1).r, a.r, b.r, at(i + 2).r, u)
      const dy = cr(at(i - 1).dy ?? 0, a.dy ?? 0, b.dy ?? 0, at(i + 2).dy ?? 0, u)
      out.push({ t: a.t + (b.t - a.t) * u, r: Math.max(0.005, Math.min(1, r)), dy })
    }
  }
  out.push(prof[prof.length - 1])
  return out
}
for (const fam of Object.keys(PROFILES)) PROFILES[fam] = refine(fam, PROFILES[fam])

/** True when unit-loft x (nose +0.5) lies in a panel-joint band. */
export function inPanelBand(family: string, x: number): boolean {
  const t = 0.5 - x
  for (const [a, b] of PANEL_BANDS[family] ?? PANEL_BANDS.tube ?? []) if (t > a - 1e-5 && t < b + 1e-5) return true
  return false
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
        ring[i * 3 + 1] = Math.sin(a) * station.r + (station.dy ?? 0)
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
    const noseY = profile[0].dy ?? 0
    const tailY = profile[profile.length - 1].dy ?? 0
    for (let i = 0; i < sides; i++) {
      const i2 = (i + 1) % sides
      const a = i * 3
      const b = i2 * 3
      pushTri(positions, 0.501, noseY, 0, nose[b], nose[b + 1], nose[b + 2], nose[a], nose[a + 1], nose[a + 2])
      pushTri(positions, -0.5, tailY, 0, tail[a], tail[a + 1], tail[a + 2], tail[b], tail[b + 1], tail[b + 2])
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
      const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
      // Panel joints read as hairline seams, a touch darker than the paint around them.
      const k0 = inPanelBand(family, x) ? 0.82 : 1
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = c.r * k0
        colors[(i + k) * 3 + 1] = c.g * k0
        colors[(i + k) * 3 + 2] = c.b * k0
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  })
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
  return sharedGeo(`${key}:af`, () => {
    const semi = span / 2
    const tanSweep = Math.tan((sweepDeg * Math.PI) / 180)
    const tanDih = Math.tan((dihedralDeg * Math.PI) / 180)
    // Real section: ~14% thick at the root, ~9% at the tip, never thinner than the spec slab.
    const rootT = Math.max(thickness * 1.3, rootChord * 0.14)
    const tipT = Math.max(0.06, tipChord * 0.09)
    const N = 12
    // Cosine spacing packs points at the rounded leading edge.
    const xs: number[] = []
    for (let i = 0; i <= N; i++) xs.push(0.5 * (1 - Math.cos((i / N) * Math.PI)))
    const yt = (x: number) => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
    // Section ring: upper surface TE -> LE, lower surface LE -> TE (chord units, LE at 0).
    const ring: [number, number][] = []
    for (let i = N; i >= 0; i--) ring.push([xs[i], yt(xs[i]) * 1.12 + 0.02 * Math.sin(Math.PI * xs[i])])
    for (let i = 1; i < N; i++) ring.push([xs[i], -yt(xs[i]) * 0.86 + 0.012 * Math.sin(Math.PI * xs[i])])
    const M = ring.length
    // Span stations; the first two blend flat out of the fairing before the dihedral starts.
    const fr = [0, 0.06, 0.14, 0.3, 0.5, 0.7, 0.88, 1]
    const pos: number[] = []
    for (const f of fr) {
      const z = f * semi
      const chord = rootChord + (tipChord - rootChord) * f
      const le = rootChord / 2 - tanSweep * z
      const blend = Math.min(1, f / 0.14)
      const lift = tanDih * Math.max(0, z - 0.07 * semi * (1 - blend)) * blend
      const t = (rootT + (tipT - rootT) * f) * (f < 0.1 ? 1.12 - f * 1.2 : 1)
      for (const [cx, cy] of ring) pos.push(le - cx * chord, lift + cy * t, z)
    }
    const idx: number[] = []
    for (let s = 0; s < fr.length - 1; s++) {
      for (let i = 0; i < M; i++) {
        const i2 = (i + 1) % M
        const a = s * M + i, b = s * M + i2, c = (s + 1) * M + i2, d = (s + 1) * M + i
        idx.push(a, c, b, a, d, c)
      }
    }
    // Rounded tip cap: fan to a point just outboard of the last ring.
    const last = (fr.length - 1) * M
    let cx = 0, cy = 0
    for (let i = 0; i < M; i++) { cx += pos[(last + i) * 3]; cy += pos[(last + i) * 3 + 1] }
    pos.push(cx / M, cy / M, semi + tipT * 0.4)
    const tipI = pos.length / 3 - 1
    for (let i = 0; i < M; i++) idx.push(last + i, last + ((i + 1) % M), tipI)
    const right = new THREE.BufferGeometry()
    right.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    right.setIndex(idx)
    right.computeVertexNormals()
    const left = right.clone().applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1))
    const li = left.getIndex()!
    for (let i = 0; i < li.count; i += 3) { const t = li.getX(i + 1); li.setX(i + 1, li.getX(i + 2)); li.setX(i + 2, t) }
    left.computeVertexNormals()
    const geo = mergeGeometries([right.toNonIndexed(), left.toNonIndexed()])!
    right.dispose(); left.dispose()
    return geo
  })
}

export function cylinderSides(tier: 'low' | 'mid' | 'high'): number {
  if (tier === 'low') return 8
  if (tier === 'mid') return 24
  return 32
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

/**
 * Turbofan nacelle in unit space: axis along Y, intake at y = -0.5, radius 1.
 * Rounded inlet lip, recessed fan face, tapered fan cowl, core cowl and exhaust plug.
 * Built on Y so it drops in where the unit cylinder used to go.
 */
export function nacelleGeometry(sides: number): THREE.BufferGeometry {
  return sharedGeo(`nacelle:${sides}`, () => {
    // [radius, y] from the fan face, out over the lip, aft to the plug tip.
    // Fan face recessed in the duct, rounded intake lip, cowl, core nozzle and a
    // tapered exhaust plug.
    const prof: [number, number][] = [
      [0.001, -0.3], [0.5, -0.3], [0.84, -0.31], [0.87, -0.4], [0.885, -0.47],
      [0.9, -0.5], [0.93, -0.517], [0.97, -0.52], [1.0, -0.51], [1.025, -0.49], [1.04, -0.45],
      [1.05, -0.36], [1.05, -0.2], [1.035, -0.02], [0.99, 0.12], [0.92, 0.24],
      [0.86, 0.27], [0.7, 0.28], [0.68, 0.33], [0.62, 0.42], [0.55, 0.48],
      [0.44, 0.5], [0.36, 0.55], [0.24, 0.61], [0.12, 0.66], [0.001, 0.69],
    ]
    const pts = prof.map(([r, y]) => new THREE.Vector2(r, y))
    const geo = new THREE.LatheGeometry(pts, Math.max(32, sides * 3))
    geo.computeVertexNormals()
    // Livery bake keeps the lip, fan face and plug in bare metal (merge.ts).
    geo.userData.nacelle = true
    return geo
  })
}

/** Oval cabin window decal facing +Z, 10 triangles. Scale is (width, height, 1). */
export function windowGeometry(): THREE.BufferGeometry {
  return sharedGeo('window-oval', () => new THREE.CircleGeometry(0.5, 18))
}

/**
 * Which loft to draw. A full-length double deck uses the deck stations.
 * The 747 forehead stays a separate hump on the tube, so its livery box is unchanged.
 */
export function loftFamily(spec: { family: string; decks?: number; hump?: boolean }): string {
  if (spec.decks === 2 && !spec.hump) return 'deck'
  return spec.family
}

/** Loft radius and centreline offset at fraction t (0 nose, 1 tail), unit space. */
export function loftStation(family: string, t: number): { r: number; dy: number } {
  const prof = PROFILES[family] ?? PROFILES.tube
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i]
    const b = prof[i + 1]
    if (t <= b.t) {
      const k = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return { r: a.r + (b.r - a.r) * k, dy: (a.dy ?? 0) + ((b.dy ?? 0) - (a.dy ?? 0)) * k }
    }
  }
  const last = prof[prof.length - 1]
  return { r: last.r, dy: last.dy ?? 0 }
}

/** Smooth unit sphere for fairings and radomes. */
export function smoothSphere(): THREE.BufferGeometry {
  return sharedGeo('sphere:smooth', () => new THREE.SphereGeometry(1, 14, 8))
}

/** Spinner cone, base radius 1 at x = 0, tip at x = 1 (+X forward). */
export function spinnerConeGeometry(): THREE.BufferGeometry {
  return sharedGeo('spinner-cone', () => {
    const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0.92, 0.3), new THREE.Vector2(0.78, 0.55), new THREE.Vector2(0.55, 0.78), new THREE.Vector2(0.28, 0.93), new THREE.Vector2(0.001, 1)]
    // Lathe spins about +Y; turn the axis to +X so the tip points forward.
    const cone = new THREE.LatheGeometry(pts, 14).rotateZ(-Math.PI / 2)
    cone.computeVertexNormals()
    return cone
  })
}

/** Intake lip ring facing +X, ring radius 1, tube radius 0.07. */
export function intakeLipGeometry(): THREE.BufferGeometry {
  return sharedGeo('intake-lip', () => new THREE.TorusGeometry(1, 0.07, 5, 20).rotateY(Math.PI / 2))
}

type WingletKind = 'fence' | 'blended' | 'raked'

function pushQuad(out: number[], a: number[], b: number[], c: number[], d: number[]) {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  out.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2])
}

/** LE+, TE+, TE−, LE−. Vertical plates run up +Y; horizontal plates run out on Z. */
function plateRing(le: number, te: number, span: number, half: number, vertical: boolean): number[][] {
  if (vertical) {
    return [
      [le, span, half],
      [te, span, half],
      [te, span, -half],
      [le, span, -half],
    ]
  }
  return [
    [le, half, span],
    [te, half, span],
    [te, -half, span],
    [le, -half, span],
  ]
}

function connectRings(out: number[], a: number[][], b: number[][], flip = false) {
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    if (flip) pushQuad(out, a[i], a[j], b[j], b[i])
    else pushQuad(out, a[i], b[i], b[j], a[j])
  }
}

function capRing(out: number[], ring: number[][], flip: boolean) {
  if (flip) pushQuad(out, ring[0], ring[3], ring[2], ring[1])
  else pushQuad(out, ring[0], ring[1], ring[2], ring[3])
}

/**
 * Unit wingtip device, scaled by the builder.
 * Fence and blended: root at y = 0, tip at y = 1, LE toward +X, thickness ±0.5 on Z.
 * Raked: root at z = 0, tip at z = side, sweeping aft (−X), thickness on Y.
 */
export function wingletGeometry(kind: WingletKind): THREE.BufferGeometry {
  return sharedGeo(`winglet:${kind}`, () => {
    const vertical = kind !== 'raked'
    const secs = kind === 'fence'
      ? [
          { s: 0, le: 0.48, te: -0.42, h: 0.5 },
          { s: 0.48, le: 0.08, te: -0.36, h: 0.32 },
          { s: 1, le: -0.12, te: -0.32, h: 0.16 },
        ]
      : kind === 'blended'
        ? [
            { s: 0, le: 0.5, te: -0.48, h: 0.5 },
            { s: 0.2, le: 0.26, te: -0.42, h: 0.36 },
            { s: 0.55, le: -0.02, te: -0.38, h: 0.24 },
            { s: 1, le: -0.34, te: -0.5, h: 0.12 },
          ]
        : [
            { s: 0, le: 0.2, te: -0.42, h: 0.5 },
            { s: 0.42, le: -0.18, te: -0.55, h: 0.32 },
            { s: 1, le: -0.62, te: -0.82, h: 0.16 },
          ]
    const rings = secs.map((sec) => plateRing(sec.le, sec.te, sec.s, sec.h, vertical))
    const pos: number[] = []
    capRing(pos, rings[0], true)
    for (let i = 0; i < rings.length - 1; i++) connectRings(pos, rings[i], rings[i + 1], false)
    capRing(pos, rings[rings.length - 1], false)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.computeVertexNormals()
    return geo
  })
}

/**
 * Horizontal stabilizer. Chord 1 on X (LE +0.5), thickness 1 on Y, span 1 on Z.
 * Swept tips move aft. Scaled per airframe; one mesh is shared.
 */
export function stabGeometry(): THREE.BufferGeometry {
  return sharedGeo('stab', () => {
    const sweep = 0.48
    const tipChord = 0.42
    const root = plateRing(0.5, -0.5, 0, 0.5, false)
    const tipAt = (z: number) => {
      const le = 0.5 - sweep * Math.sign(z || 1)
      return plateRing(le, le - tipChord, z, 0.22, false)
    }
    const pos: number[] = []
    connectRings(pos, root, tipAt(0.5), false)
    connectRings(pos, root, tipAt(-0.5), true)
    capRing(pos, tipAt(0.5), false)
    capRing(pos, tipAt(-0.5), true)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.computeVertexNormals()
    return geo
  })
}

/**
 * Propeller blade centered on the hub matrix. Tip toward +Y, wider at the root.
 * Extents match the unit box the blade replaces.
 */
export function bladeGeometry(): THREE.BufferGeometry {
  return sharedGeo('prop-blade', () => {
    const root = plateRing(0.5, -0.5, -0.5, 0.5, true)
    const mid = plateRing(0.32, -0.32, 0.08, 0.36, true)
    const tip = plateRing(0.12, -0.12, 0.5, 0.2, true)
    const pos: number[] = []
    capRing(pos, root, true)
    connectRings(pos, root, mid, false)
    connectRings(pos, mid, tip, false)
    capRing(pos, tip, false)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.computeVertexNormals()
    return geo
  })
}

/**
 * Airfoil slab for flaps and slats in unit-box space: chord along X (rounded
 * nose at +X, sharp trailing edge at -X), thickness along Y, span along Z.
 */
export function airfoilGeometry(): THREE.BufferGeometry {
  return sharedGeo('airfoil-slab', () => {
    const n = 10
    const upper: THREE.Vector2[] = []
    const lower: THREE.Vector2[] = []
    for (let i = 0; i <= n; i++) {
      const u = 1 - Math.cos((i / n) * Math.PI * 0.5)
      // NACA-ish half thickness, peak near 30% chord; x = 0.5 at the nose.
      const t = 0.5 * 5 * 0.2 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4) / 0.1
      const x = 0.5 - u
      upper.push(new THREE.Vector2(x, Math.max(0.01, t) * 1.05 + 0.04 * (1 - u)))
      lower.push(new THREE.Vector2(x, -Math.max(0.01, t) * 0.75))
    }
    const shape = new THREE.Shape([...upper, ...lower.reverse().slice(1, -1)])
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 })
    geo.translate(0, 0, -0.5)
    geo.computeVertexNormals()
    return geo
  })
}
