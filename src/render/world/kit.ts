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
  body: THREE.BufferGeometry
  head: THREE.BufferGeometry
  bag: THREE.BufferGeometry
}

/** ~0.9 tall standing figure; seated figures reuse it with a squashed y scale. */
export function peopleGeo(): PeopleGeo {
  const body = new THREE.CapsuleGeometry(0.13, 0.36, 3, 8)
  body.translate(0, 0.33, 0)
  const head = new THREE.SphereGeometry(0.105, 8, 6)
  head.translate(0, 0.77, 0)
  const bag = merge([box(0.2, 0.3, 0.12, 0, 0.17, 0), box(0.02, 0.22, 0.02, 0, 0.42, 0.0)])
  return { body, head, bag }
}

export type PropPart = { geo: THREE.BufferGeometry; mat: string }

/** Geometry for each interior prop kind; `mat` keys into the building palette. */
export function propParts(): Record<string, PropPart[]> {
  return {
    counter: [
      { geo: box(1.15, 0.48, 0.45, 0, 0.24, 0), mat: 'desk' },
      { geo: box(1.2, 0.05, 0.5, 0, 0.5, 0), mat: 'deskTop' },
    ],
    monitor: [{ geo: box(0.32, 0.22, 0.04, 0, 0.64, 0), mat: 'screen' }],
    belt: [
      { geo: box(5.2, 0.2, 0.38, 0, 0.1, 0), mat: 'dark' },
      { geo: box(5.2, 0.03, 0.3, 0, 0.215, 0), mat: 'rubber' },
    ],
    stanchion: [
      { geo: merge([cyl(0.03, 0.04, 0.48, 6, -0.45, 0.24, 0), cyl(0.03, 0.04, 0.48, 6, 0.45, 0.24, 0)]), mat: 'chrome' },
      { geo: box(0.9, 0.05, 0.015, 0, 0.44, 0), mat: 'tape' },
    ],
    bench: [
      {
        geo: merge([
          box(1.3, 0.07, 0.42, 0, 0.25, 0),
          box(1.3, 0.36, 0.05, 0, 0.45, -0.19),
          box(0.05, 0.22, 0.3, -0.6, 0.11, 0),
          box(0.05, 0.22, 0.3, 0.6, 0.11, 0),
        ]),
        mat: 'seat',
      },
    ],
    podium: [
      { geo: box(0.9, 0.55, 0.45, 0, 0.275, 0), mat: 'desk' },
      { geo: box(0.3, 0.2, 0.04, 0, 0.66, 0.05), mat: 'screen' },
    ],
    board: [
      { geo: cyl(0.04, 0.05, 1.3, 6, 0, 0.65, 0), mat: 'chrome' },
      { geo: box(1.1, 0.58, 0.05, 0, 1.55, 0), mat: 'board' },
    ],
    xray: [
      { geo: box(0.62, 0.62, 1.4, 0, 0.31, 0), mat: 'machine' },
      { geo: box(0.5, 0.06, 2.3, 0, 0.42, 0), mat: 'rubber' },
    ],
    arch: [
      {
        geo: merge([box(0.09, 1.15, 0.12, -0.42, 0.575, 0), box(0.09, 1.15, 0.12, 0.42, 0.575, 0), box(0.93, 0.12, 0.14, 0, 1.2, 0)]),
        mat: 'machine',
      },
    ],
    kiosk: [
      { geo: box(1.2, 0.95, 1.7, 0, 0.475, 0), mat: 'kiosk' },
      { geo: box(1.26, 0.06, 1.76, 0, 0.98, 0), mat: 'deskTop' },
      { geo: box(0.08, 1.4, 1.7, -0.6, 0.7, 0), mat: 'shelf' },
    ],
    awning: [{ geo: box(0.4, 0.08, 1.8, 0, 1.55, 0), mat: 'kiosk' }],
    table: [
      { geo: cyl(0.3, 0.3, 0.04, 12, 0, 0.42, 0), mat: 'deskTop' },
      { geo: cyl(0.03, 0.12, 0.4, 6, 0, 0.2, 0), mat: 'chrome' },
    ],
    planter: [
      { geo: cyl(0.22, 0.17, 0.36, 10, 0, 0.18, 0), mat: 'pot' },
      { geo: new THREE.IcosahedronGeometry(0.32, 1).translate(0, 0.62, 0), mat: 'leaf' },
    ],
    light: [{ geo: box(1.6, 0.04, 0.3, 0, 3.8, 0), mat: 'lamp' }],
  }
}

export const PAX_COLORS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xd4ac0d, 0x8e44ad, 0xe67e22, 0x5d6d7e, 0xecf0f1]
export const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac]
export const STAFF_COLOR = 0x1f3a5f
export const KIOSK_COLORS = [0xc0392b, 0x16a085, 0xd68910, 0x7d3c98]
export const BAG_COLORS = [0x22262c, 0x8a1c1c, 0x1c3a6a, 0x5a5a5a, 0x2c5a3a]
