/** Shared instancing helpers + prop / people geometry for the world layer. */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3()
const tmpP = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

export function trs(x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  tmpQ.setFromAxisAngle(UP, yaw)
  tmpS.set(sx, sy, sz)
  tmpP.set(x, y, z)
  return new THREE.Matrix4().compose(tmpP, tmpQ, tmpS)
}

export function setTrs(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  s = 1,
  sy = s,
) {
  tmpQ.setFromAxisAngle(UP, yaw)
  tmpS.set(s, sy, s)
  tmpP.set(x, y, z)
  tmpM.compose(tmpP, tmpQ, tmpS)
  mesh.setMatrixAt(i, tmpM)
}

const AXIS_X = new THREE.Vector3(1, 0, 0)
const qYaw = new THREE.Quaternion()
const qPitch = new THREE.Quaternion()
const qBoth = new THREE.Quaternion()

/** Yaw around +Y, then a local pitch. Used for a leg swinging from the hip. */
export function setYawPitch(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  s = 1,
  sy = s,
) {
  qYaw.setFromAxisAngle(UP, yaw)
  qPitch.setFromAxisAngle(AXIS_X, pitch)
  qBoth.multiplyQuaternions(qYaw, qPitch)
  tmpS.set(s, sy, s)
  tmpP.set(x, y, z)
  tmpM.compose(tmpP, qBoth, tmpS)
  mesh.setMatrixAt(i, tmpM)
}

/** Local offset rotated by yaw only (the hip, before the leg pitches). */
export function yawOffset(yaw: number, lx: number, ly: number, lz: number, out: THREE.Vector3) {
  const sn = Math.sin(yaw)
  const cs = Math.cos(yaw)
  out.set(lx * cs + lz * sn, ly, -lx * sn + lz * cs)
}

/** Opposite legs. `phase` is per person so a crowd does not march in step. */
export function walkSwing(time: number, phase: number, speed = 1): number {
  return Math.sin(time * 7 * speed + phase) * 0.55
}

export function instanced(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  matrices: readonly THREE.Matrix4[],
  colors?: readonly number[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length))
  mesh.count = matrices.length
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
  if (colors) {
    const c = new THREE.Color()
    colors.forEach((hex, i) => mesh.setColorAt(i, c.setHex(hex)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return g
}

function cyl(rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg)
  g.translate(x, y, z)
  return g
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  for (const p of clean) {
    for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') p.deleteAttribute(k)
  }
  const g = mergeGeometries(clean, false)!
  for (const p of parts) p.dispose()
  return g
}

export interface BakePiece {
  geo: THREE.BufferGeometry
  matrix: THREE.Matrix4
  color: number
}

/**
 * Static props never move, so bake them into one vertex-coloured geometry: one draw
 * call per building instead of one per prop part.
 */
export function bake(pieces: readonly BakePiece[], keepUv = false): THREE.BufferGeometry | null {
  if (!pieces.length) return null
  const c = new THREE.Color()
  const parts = pieces.map((p) => {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()).applyMatrix4(p.matrix)
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && !(keepUv && k === 'uv')) g.deleteAttribute(k)
    }
    c.setHex(p.color)
    const n = g.getAttribute('position').count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  })
  const out = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  out?.computeBoundingSphere()
  return out
}

/** Unit cube with its base at y = 0 (scale per instance for beams, mullions, slabs). */
export function unitBeam(): THREE.BufferGeometry {
  return box(1, 1, 1, 0, 0.5, 0)
}

export interface PeopleGeo {
  /** Torso, pelvis and both legs, for seated and standing people that do not animate. */
  body: THREE.BufferGeometry
  /** Chest and pelvis. The hip is the origin of each leg. */
  torso: THREE.BufferGeometry
  /** Hip at the origin, foot toward -Y. Place it at the hip and pitch it. */
  legL: THREE.BufferGeometry
  legR: THREE.BufferGeometry
  head: THREE.BufferGeometry
  bag: THREE.BufferGeometry
}

/** Hip in the 0.9-tall figure, before PERSON_SCALE. */
export const FIGURE_HIP_X = 0.08
export const FIGURE_HIP_Y = 0.3

/** ~0.9 tall standing figure; seated figures reuse it with a squashed y scale. */
export function peopleGeo(): PeopleGeo {
  const torso = box(0.32, 0.34, 0.18, 0, 0.52, 0)
  const pelvis = box(0.28, 0.1, 0.16, 0, 0.32, 0)
  const leg = box(0.1, 0.28, 0.11, 0, -0.14, 0)
  const legL = leg
  const legR = leg.clone()
  const body = merge([
    torso.clone(),
    pelvis.clone(),
    leg.clone().translate(-FIGURE_HIP_X, FIGURE_HIP_Y, 0),
    leg.clone().translate(FIGURE_HIP_X, FIGURE_HIP_Y, 0),
  ])
  const upper = merge([torso, pelvis])
  const head = new THREE.SphereGeometry(0.105, 8, 6)
  head.translate(0, 0.77, 0)
  // Roller case tipped onto its wheels, handle leaning toward the walker (+z).
  const bag = merge([
    box(0.2, 0.32, 0.12, 0, 0.16, 0),
    box(0.02, 0.28, 0.02, 0, 0.42, 0.02),
    box(0.16, 0.03, 0.03, 0, 0.55, 0.04),
    box(0.04, 0.04, 0.04, -0.06, 0.03, 0.05),
    box(0.04, 0.04, 0.04, 0.06, 0.03, 0.05),
  ])
  bag.rotateX(0.38)
  return { body, torso: upper, legL, legR, head, bag }
}

export type PropSurface = 'wood' | 'wall' | 'shop' | 'steel' | 'fabric' | 'rubber' | 'glass' | 'granite'

/** Photo surface for a part. Chrome and seat cloth pick one up even without a tag. */
export function partSurface(part: PropPart): PropSurface | undefined {
  if (part.surface) return part.surface
  if (part.mat === 'chrome') return 'steel'
  if (part.mat === 'seat') return 'fabric'
  return undefined
}

export type PropPart = {
  geo: THREE.BufferGeometry
  mat: string
  /** Wood and plaster pick up the shared surface map. */
  surface?: PropSurface
  /** Close-up only. The coarse parts stay in the baked mesh at every LOD. */
  detail?: boolean
}

const d = (geo: THREE.BufferGeometry, mat: string, surface?: PropSurface): PropPart => ({
  geo,
  mat,
  surface,
  detail: true,
})

/** Geometry for each interior prop kind; `mat` keys into the building palette. */
export function propParts(): Record<string, PropPart[]> {
  return {
    counter: [
      { geo: box(1.15, 0.42, 0.42, 0, 0.21, 0), mat: 'desk', surface: 'steel' },
      { geo: box(1.2, 0.05, 0.5, 0, 0.44, 0.02), mat: 'deskTop', surface: 'granite' },
      { geo: new THREE.PlaneGeometry(0.72, 0.28).translate(0, 0.22, 0.27), mat: 'logo' },
      { geo: new THREE.PlaneGeometry(0.34, 0.5).translate(-0.38, 0.78, 0.28), mat: 'deskHeader' },
      { geo: box(1.15, 0.32, 0.04, 0, 0.2, -0.2), mat: 'dark' },
      { geo: box(0.28, 0.08, 0.22, 0.35, 0.12, 0.16), mat: 'rubber' },
      d(box(0.22, 0.02, 0.1, -0.2, 0.48, 0.08), 'dark'),
      d(box(0.16, 0.1, 0.08, 0.28, 0.52, 0), 'screen'),
    ],
    monitor: [
      { geo: box(0.32, 0.22, 0.04, 0, 0.64, 0), mat: 'screen' },
      { geo: box(0.08, 0.06, 0.06, 0, 0.5, 0), mat: 'dark' },
      d(box(0.28, 0.16, 0.01, 0, 0.64, 0.025), 'screen'),
    ],
    belt: [
      { geo: box(5.2, 0.18, 0.42, 0, 0.09, 0), mat: 'dark' },
      { geo: box(5.2, 0.04, 0.28, 0, 0.2, 0), mat: 'rubber', surface: 'rubber' },
      { geo: box(0.08, 0.16, 0.46, -2.5, 0.1, 0), mat: 'chrome' },
      { geo: box(0.08, 0.16, 0.46, 2.5, 0.1, 0), mat: 'chrome' },
      d(box(5.0, 0.01, 0.04, 0, 0.23, 0.08), 'tape'),
    ],
    stanchion: [
      { geo: merge([cyl(0.03, 0.04, 0.48, 6, -0.45, 0.24, 0), cyl(0.03, 0.04, 0.48, 6, 0.45, 0.24, 0)]), mat: 'chrome' },
      { geo: box(0.9, 0.05, 0.015, 0, 0.44, 0), mat: 'tape' },
      d(cyl(0.07, 0.07, 0.02, 6, -0.45, 0.01, 0), 'dark'),
      d(cyl(0.07, 0.07, 0.02, 6, 0.45, 0.01, 0), 'dark'),
    ],
    bench: [
      { geo: box(1.3, 0.06, 0.42, 0, 0.42, 0), mat: 'seat' },
      { geo: box(1.3, 0.32, 0.06, 0, 0.58, -0.18), mat: 'seat' },
      { geo: box(0.06, 0.4, 0.36, -0.6, 0.2, 0), mat: 'chrome' },
      { geo: box(0.06, 0.4, 0.36, 0.6, 0.2, 0), mat: 'chrome' },
      { geo: box(0.04, 0.22, 0.04, -0.32, 0.52, -0.16), mat: 'chrome' },
      { geo: box(0.04, 0.22, 0.04, 0.32, 0.52, -0.16), mat: 'chrome' },
      d(box(0.28, 0.04, 0.36, -0.45, 0.46, 0.01), 'seat'),
      d(box(0.28, 0.04, 0.36, 0, 0.46, 0.01), 'seat'),
      d(box(0.28, 0.04, 0.36, 0.45, 0.46, 0.01), 'seat'),
    ],
    podium: [
      { geo: box(0.7, 0.9, 0.4, 0, 0.45, 0), mat: 'desk', surface: 'steel' },
      { geo: box(0.76, 0.04, 0.46, 0, 0.92, 0.02), mat: 'deskTop', surface: 'granite' },
      { geo: box(0.28, 0.18, 0.03, 0, 1.08, 0.12), mat: 'screen' },
      d(box(0.5, 0.08, 0.02, 0, 1.28, 0.1), 'kiosk'),
    ],
    board: [
      { geo: cyl(0.04, 0.05, 1.3, 6, 0, 0.65, 0), mat: 'chrome' },
      { geo: box(1.15, 0.62, 0.06, 0, 1.52, 0), mat: 'dark' },
      { geo: box(1.02, 0.5, 0.02, 0, 1.52, 0.035), mat: 'board' },
      d(box(0.18, 0.08, 0.02, -0.38, 1.7, 0.05), 'lamp'),
    ],
    xray: [
      { geo: box(0.7, 0.7, 1.15, 0, 0.4, 0), mat: 'machine' },
      { geo: box(0.46, 0.4, 0.9, 0, 0.42, 0), mat: 'dark' },
      { geo: box(0.5, 0.06, 2.2, 0, 0.48, 0), mat: 'rubber', surface: 'rubber' },
      { geo: box(0.62, 0.08, 0.08, 0, 0.78, 0.5), mat: 'tape' },
      d(box(0.22, 0.04, 0.32, 0.15, 0.56, 0.7), 'deskTop'),
      d(box(0.22, 0.04, 0.32, 0.15, 0.61, 0.7), 'deskTop'),
    ],
    arch: [
      {
        geo: merge([
          box(0.08, 1.2, 0.1, -0.4, 0.6, 0),
          box(0.08, 1.2, 0.1, 0.4, 0.6, 0),
          box(0.88, 0.1, 0.12, 0, 1.22, 0),
          box(0.2, 0.04, 0.2, -0.4, 0.02, 0),
          box(0.2, 0.04, 0.2, 0.4, 0.02, 0),
        ]),
        mat: 'machine',
      },
      d(box(0.06, 0.06, 0.02, 0, 1.05, 0.06), 'lamp'),
    ],
    kiosk: [
      { geo: box(1.05, 0.85, 0.55, 0, 0.42, 0), mat: 'wood', surface: 'wood' },
      { geo: box(1.12, 0.05, 0.62, 0, 0.87, 0.04), mat: 'deskTop', surface: 'granite' },
      { geo: box(0.7, 0.42, 0.04, 0, 1.2, 0.26), mat: 'screen' },
      { geo: box(0.78, 0.5, 0.04, 0, 1.22, -0.26), mat: 'kiosk' },
      { geo: box(0.16, 0.7, 0.5, -0.55, 0.7, 0), mat: 'shelf', surface: 'shop' },
      d(box(0.22, 0.28, 0.2, 0.28, 1.05, 0), 'dark'),
      d(cyl(0.06, 0.05, 0.16, 6, -0.2, 0.98, 0.1), 'chrome'),
    ],
    awning: [{ geo: box(0.45, 0.06, 1.7, 0, 1.7, 0), mat: 'kiosk' }],
    stool: [
      { geo: cyl(0.14, 0.14, 0.04, 8, 0, 0.42, 0), mat: 'seat' },
      { geo: cyl(0.03, 0.04, 0.4, 6, 0, 0.2, 0), mat: 'chrome' },
    ],
    table: [
      { geo: cyl(0.32, 0.32, 0.04, 10, 0, 0.72, 0), mat: 'deskTop' },
      { geo: cyl(0.03, 0.08, 0.7, 6, 0, 0.35, 0), mat: 'chrome' },
    ],
    planter: [
      { geo: cyl(0.22, 0.16, 0.32, 8, 0, 0.16, 0), mat: 'pot' },
      { geo: cyl(0.18, 0.18, 0.04, 8, 0, 0.34, 0), mat: 'dark' },
      { geo: new THREE.IcosahedronGeometry(0.28, 0).translate(0, 0.62, 0), mat: 'leaf' },
      d(new THREE.IcosahedronGeometry(0.16, 0).translate(0.12, 0.78, 0.06), 'leaf'),
    ],
    light: [{ geo: box(1.6, 0.04, 0.3, 0, 3.8, 0), mat: 'lamp' }],
    bin: [
      { geo: cyl(0.16, 0.14, 0.42, 8, 0, 0.21, 0), mat: 'dark' },
      { geo: cyl(0.18, 0.18, 0.04, 8, 0, 0.44, 0), mat: 'chrome' },
      d(box(0.1, 0.06, 0.08, 0.04, 0.5, 0), 'tape'),
    ],
    wc: [
      { geo: box(1.35, 1.15, 0.08, 0, 0.7, -0.35), mat: 'wall', surface: 'wall' },
      { geo: box(0.08, 1.15, 0.7, -0.64, 0.7, 0), mat: 'wall', surface: 'wall' },
      { geo: box(0.08, 1.15, 0.7, 0.64, 0.7, 0), mat: 'wall', surface: 'wall' },
      { geo: box(0.04, 1.05, 0.7, 0, 0.65, 0), mat: 'wall', surface: 'wall' },
      { geo: box(0.58, 0.9, 0.04, -0.32, 0.55, 0.32), mat: 'wood', surface: 'wood' },
      { geo: box(0.58, 0.9, 0.04, 0.32, 0.55, 0.32), mat: 'seat' },
      { geo: box(1.2, 0.16, 0.28, 0, 0.85, -0.18), mat: 'deskTop' },
      d(cyl(0.08, 0.06, 0.12, 6, -0.4, 0.2, 0.1), 'chrome'),
      d(cyl(0.08, 0.06, 0.12, 6, 0.4, 0.2, 0.1), 'chrome'),
    ],
    bag: [
      { geo: box(0.38, 0.28, 0.22, 0, 0.16, 0), mat: 'bag' },
      { geo: box(0.16, 0.04, 0.16, 0, 0.32, 0), mat: 'dark' },
      d(box(0.06, 0.1, 0.04, 0, 0.38, 0.06), 'chrome'),
      d(cyl(0.03, 0.03, 0.04, 6, -0.12, 0.03, 0.08), 'dark'),
      d(cyl(0.03, 0.03, 0.04, 6, 0.12, 0.03, 0.08), 'dark'),
    ],
  }
}

export const PAX_COLORS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xd4ac0d, 0x8e44ad, 0xe67e22, 0x5d6d7e, 0xecf0f1]
export const TROUSER_COLORS = [0x243044, 0x3a332c, 0x2c3a32, 0x1c2838, 0x4a3a32]
export const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac]
export const STAFF_COLOR = 0x1f3a5f
export const KIOSK_COLORS = [0xc0392b, 0x16a085, 0xd68910, 0x7d3c98]
export const BAG_COLORS = [0x22262c, 0x8a1c1c, 0x1c3a6a, 0x5a5a5a, 0x2c5a3a]
