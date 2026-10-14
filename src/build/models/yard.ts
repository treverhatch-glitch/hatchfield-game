/**
 * Yard clutter: instanced props per building type (pallets, ISO containers,
 * ULDs, forklifts, parked GSE, cones, barriers, fences, gate booths, signs,
 * lamp posts, planters, staff cars). Deterministic per lot (seeded by the lot
 * key), and kept off the building, its service points, its vehicle lanes and
 * queue slots. One InstancedMesh per prop part, so a busy yard costs a few
 * draw calls per building, not one per prop.
 */
import * as THREE from 'three'
import { SERVICE_POINTS } from '../servicePoints'
import type { Tile } from '../../game/types'
import { HALF, M, mat } from './kit'

type Part = { geo: 'box' | 'cyl' | 'cone'; w: number; h: number; d: number; c: string | (() => THREE.Material); x?: number; y?: number; z?: number; metal?: number }
interface Kind {
  /** Footprint half-sizes (x, z) before yaw. */
  fx: number
  fz: number
  parts: Part[]
  /** Snap yaw to the lot axes (rows), else small jitter. */
  axis?: boolean
  lamp?: number
}

const K: Record<string, Kind> = {
  pallet: { fx: 0.3, fz: 0.25, axis: true, parts: [
    { geo: 'box', w: 0.6, h: 0.08, d: 0.5, c: '#9a7a52' },
    { geo: 'box', w: 0.54, h: 0.4, d: 0.44, y: 0.08, c: '#c9b38a' },
    { geo: 'box', w: 0.56, h: 0.02, d: 0.46, y: 0.3, c: '#e9ecef' },
  ] },
  container: { fx: 1.05, fz: 0.45, axis: true, parts: [
    { geo: 'box', w: 2.0, h: 0.85, d: 0.82, c: '#b0533a', metal: 0.3 },
    { geo: 'box', w: 2.02, h: 0.05, d: 0.84, y: 0.85, c: '#7a3a2a' },
    { geo: 'box', w: 0.04, h: 0.8, d: 0.7, x: 1.0, c: '#5c2a1e' },
  ] },
  uld: { fx: 0.42, fz: 0.36, axis: true, parts: [
    { geo: 'box', w: 0.8, h: 0.08, d: 0.7, c: '#4a525b' },
    { geo: 'box', w: 0.78, h: 0.62, d: 0.68, y: 0.08, c: '#c3c9cf', metal: 0.5 },
    { geo: 'box', w: 0.5, h: 0.12, d: 0.68, x: 0.14, y: 0.7, c: '#c3c9cf', metal: 0.5 },
  ] },
  forklift: { fx: 0.45, fz: 0.3, parts: [
    { geo: 'box', w: 0.7, h: 0.35, d: 0.5, y: 0.1, c: '#e7b52a' },
    { geo: 'box', w: 0.32, h: 0.4, d: 0.46, x: -0.1, y: 0.45, c: '#1d2126' },
    { geo: 'box', w: 0.05, h: 0.9, d: 0.4, x: 0.38, y: 0.1, c: '#4a525b' },
    { geo: 'box', w: 0.4, h: 0.03, d: 0.3, x: 0.6, y: 0.12, c: '#4a525b' },
  ] },
  tug: { fx: 0.55, fz: 0.4, parts: [
    { geo: 'box', w: 1.1, h: 0.4, d: 0.7, y: 0.12, c: '#e7b52a' },
    { geo: 'box', w: 0.4, h: 0.45, d: 0.62, x: -0.25, y: 0.52, c: () => M.glass() },
    { geo: 'box', w: 1.12, h: 0.12, d: 0.72, y: 0.0, c: '#1d2126' },
  ] },
  dolly: { fx: 0.5, fz: 0.4, axis: true, parts: [
    { geo: 'box', w: 0.95, h: 0.06, d: 0.75, y: 0.22, c: '#4a525b' },
    { geo: 'box', w: 0.9, h: 0.5, d: 0.7, y: 0.28, c: '#9aa4ad', metal: 0.5 },
  ] },
  airstair: { fx: 0.9, fz: 0.4, parts: [
    { geo: 'box', w: 1.6, h: 0.35, d: 0.7, y: 0.1, c: '#eef1f4' },
    { geo: 'box', w: 1.4, h: 0.06, d: 0.5, x: 0.3, y: 0.9, c: '#9aa4ad' },
    { geo: 'box', w: 0.06, h: 1.2, d: 0.5, x: 0.95, y: 0.45, c: '#4a525b' },
  ] },
  car: { fx: 0.5, fz: 0.25, axis: true, parts: [
    { geo: 'box', w: 0.95, h: 0.28, d: 0.46, y: 0.08, c: 'car' },
    { geo: 'box', w: 0.5, h: 0.22, d: 0.42, x: -0.05, y: 0.36, c: () => M.glass() },
    { geo: 'box', w: 0.97, h: 0.08, d: 0.48, y: 0.02, c: '#1d2126' },
  ] },
  cone: { fx: 0.1, fz: 0.1, parts: [
    { geo: 'cone', w: 0.11, h: 0.32, d: 0.11, c: '#ff6a1a' },
    { geo: 'box', w: 0.2, h: 0.02, d: 0.2, c: '#1d2126' },
  ] },
  barrier: { fx: 0.5, fz: 0.15, axis: true, parts: [
    { geo: 'box', w: 1.0, h: 0.3, d: 0.26, c: '#cfccc4' },
    { geo: 'box', w: 1.0, h: 0.06, d: 0.27, y: 0.18, c: '#c0392b' },
  ] },
  planter: { fx: 0.3, fz: 0.3, parts: [
    { geo: 'box', w: 0.55, h: 0.3, d: 0.55, c: '#8a8f86' },
    { geo: 'cyl', w: 0.24, h: 0.55, d: 0.24, y: 0.3, c: '#3f7d3a' },
  ] },
  sign: { fx: 0.2, fz: 0.1, parts: [
    { geo: 'box', w: 0.05, h: 1.0, d: 0.05, c: '#4a525b' },
    { geo: 'box', w: 0.5, h: 0.35, d: 0.04, y: 0.85, c: '#2f6f9a' },
  ] },
  lamp: { fx: 0.12, fz: 0.12, lamp: 3.4, parts: [
    { geo: 'cyl', w: 0.06, h: 3.4, d: 0.06, c: '#5a636c', metal: 0.7 },
    { geo: 'box', w: 0.32, h: 0.08, d: 0.16, y: 3.4, c: () => M.frame() },
    { geo: 'box', w: 0.26, h: 0.02, d: 0.12, y: 3.38, c: () => M.glow('#fff4d6') },
  ] },
  gate: { fx: 0.45, fz: 0.35, parts: [
    { geo: 'box', w: 0.6, h: 0.9, d: 0.6, c: '#eef1f4' },
    { geo: 'box', w: 0.62, h: 0.06, d: 0.62, y: 0.9, c: '#2f6f9a' },
    { geo: 'box', w: 1.6, h: 0.06, d: 0.06, x: 1.1, y: 0.6, c: '#c0392b' },
  ] },
  fence: { fx: 0.5, fz: 0.05, parts: [
    { geo: 'box', w: 1.0, h: 0.9, d: 0.03, c: () => mat('#9aa4ad', { metal: 0.5, rough: 0.5, opacity: 0.45 }) },
    { geo: 'cyl', w: 0.04, h: 1.0, d: 0.04, x: 0.5, c: '#7d868f', metal: 0.6 },
  ] },
}

type Recipe = [kind: keyof typeof K, n: number, cluster?: number][]
const R: Record<string, Recipe> = {
  cargo: [['uld', 12, 3], ['pallet', 10, 4], ['container', 3, 1], ['forklift', 2], ['car', 4, 2], ['cone', 6], ['gate', 1]],
  hangar: [['tug', 2], ['airstair', 1], ['container', 2, 2], ['pallet', 4, 2], ['cone', 8], ['car', 5, 5]],
  fuel: [['barrier', 6, 3], ['cone', 6], ['sign', 2], ['car', 2, 2], ['gate', 1]],
  fire: [['car', 6, 3], ['cone', 6], ['planter', 4], ['sign', 1]],
  kitchen: [['pallet', 8, 4], ['container', 2, 2], ['car', 6, 3], ['forklift', 1], ['cone', 4], ['planter', 2]],
  bags: [['dolly', 8, 4], ['uld', 6, 3], ['tug', 3], ['cone', 6]],
  deice: [['cone', 10], ['barrier', 6, 3], ['container', 2, 2], ['sign', 2]],
  tower: [['car', 8, 4], ['planter', 4], ['sign', 1]],
  bus: [['planter', 4], ['sign', 2], ['barrier', 4, 2]],
  _: [['car', 3, 3], ['cone', 4], ['lamp', 1], ['planter', 2]],
}
const FENCED = new Set(['cargo', 'fuel', 'deice', 'hangar', 'bags'])
const CAR_COLORS = ['#eef1f4', '#1d2126', '#8a929a', '#2f6f9a', '#a8352a', '#c9ced3']

function rng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Rect { x0: number; z0: number; x1: number; z1: number }
const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0

/** Ground a docked vehicle covers: 3.8 long along its heading, 1.5 wide, plus margin. */
export function vehicleRect(x: number, z: number, heading: number): Rect {
  const along = Math.abs(Math.cos(heading)) > 0.5 ? 'z' : 'x'
  const hl = 2.0
  const hw = 0.85
  return along === 'z' ? { x0: x - hw, z0: z - hl, x1: x + hw, z1: z + hl } : { x0: x - hl, z0: z - hw, x1: x + hl, z1: z + hw }
}

/** Segment-to-point distance (2D). */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const l2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2))
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

export interface YardPlan {
  kind: string
  x: number
  z: number
  yaw: number
}

/** Ground-level footprints of everything already in the model (pad excluded). */
export function occupied(g: THREE.Group): Rect[] {
  g.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert()
  const out: Rect[] = []
  const b = new THREE.Box3()
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    b.copy(m.geometry.boundingBox!).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    if (b.max.y < 0.16 || b.min.y > 2.2) return // ground paint / pad, or roof-level parts
    if (b.max.x - b.min.x > HALF * 1.8 && b.max.z - b.min.z > HALF * 1.8) return
    out.push({ x0: b.min.x, z0: b.min.z, x1: b.max.x, z1: b.max.z })
  })
  return out
}

/** Pure planner: where each prop goes. Exported for tests. */
export function planYard(tile: string, seed: string, occ: Rect[]): YardPlan[] {
  const r = rng(`${tile}|${seed}`)
  const svcTile = (tile.startsWith('hangar') ? 'hangar' : tile) as Tile
  const spec = SERVICE_POINTS[svcTile]
  const lanes: [number, number, number, number][] = []
  const spots: Rect[] = []
  if (spec) {
    for (const p of spec.points) {
      lanes.push([spec.approach.x, spec.approach.z, p.x, p.z], [p.x, p.z, spec.exit.x, spec.exit.z])
      spots.push(vehicleRect(p.x, p.z, p.heading))
    }
    let prev = spec.approach
    for (const q of spec.queue) {
      lanes.push([prev.x, prev.z, q.x, q.z])
      prev = q
    }
    lanes.push([spec.approach.x, spec.approach.z, spec.exit.x, spec.exit.z])
  }
  const keepOut: Rect[] = []
  // Aircraft door apron in front of hangars stays clear.
  if (svcTile === 'hangar') keepOut.push({ x0: -1.9, z0: 2.0, x1: 2.7, z1: HALF + 1 })
  // De-ice: the aircraft parks on the pad centre.
  if (svcTile === 'deice') keepOut.push({ x0: -2.4, z0: -2.8, x1: 2.4, z1: HALF + 1 })
  const lim = HALF - 0.2
  const placed: Rect[] = []
  const plan: YardPlan[] = []
  const ok = (x: number, z: number, k: Kind, yaw: number): Rect | null => {
    const c = Math.abs(Math.cos(yaw))
    const s = Math.abs(Math.sin(yaw))
    const hx = k.fx * c + k.fz * s
    const hz = k.fx * s + k.fz * c
    if (Math.abs(x) + hx > lim || Math.abs(z) + hz > lim) return null
    const rc = { x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz }
    const pad = { x0: rc.x0 - 0.12, z0: rc.z0 - 0.12, x1: rc.x1 + 0.12, z1: rc.z1 + 0.12 }
    for (const o of occ) if (hit(pad, o)) return null
    for (const o of placed) if (hit(rc, o)) return null
    for (const o of keepOut) if (hit(rc, o)) return null
    const rad = Math.max(hx, hz)
    for (const [ax, az, bx, bz] of lanes) if (segDist(x, z, ax, az, bx, bz) < 0.8 + rad) return null
    for (const o of spots) if (hit(rc, o)) return null
    return rc
  }
  if (FENCED.has(svcTile)) {
    // Perimeter fence on the back and sides, panel by panel where free.
    for (let i = 0; i < 9; i++) {
      const a = -HALF + 0.55 + i * 1.0
      for (const [x, z, yaw] of [[a, -HALF + 0.12, 0], [-HALF + 0.12, a, Math.PI / 2], [HALF - 0.12, a, Math.PI / 2]] as const) {
        const rc = ok(x, z, K.fence, yaw)
        if (rc) {
          placed.push(rc)
          plan.push({ kind: 'fence', x, z, yaw })
        }
      }
    }
  }
  const recipe = R[svcTile] ?? R._
  for (const [kind, n, cluster = 1] of recipe) {
    const k = K[kind]
    let left = n
    for (let tries = 0; tries < 60 && left > 0; tries++) {
      const yaw = k.axis ? (r() < 0.5 ? 0 : Math.PI / 2) : r() * Math.PI * 2
      const x0 = (r() * 2 - 1) * lim
      const z0 = (r() * 2 - 1) * lim
      // Rows: step along the prop's long axis.
      const row = Math.min(cluster, left)
      const step = k.fx * 2 + 0.08
      for (let j = 0; j < row; j++) {
        const px = k.axis ? x0 + (yaw === 0 ? step * j : 0) : x0 + j * 0.5
        const z = k.axis ? z0 + (yaw !== 0 ? step * j : 0) : z0
        const rc = ok(px, z, k, yaw)
        if (!rc) break
        placed.push(rc)
        plan.push({ kind, x: px, z, yaw })
        left--
      }
    }
  }
  return plan
}

const geos = new Map<string, THREE.BufferGeometry>()
function geoFor(p: Part): THREE.BufferGeometry {
  const key = `${p.geo}|${p.w}|${p.h}|${p.d}`
  let g = geos.get(key)
  if (!g) {
    g = p.geo === 'box' ? new THREE.BoxGeometry(p.w, p.h, p.d) : p.geo === 'cone' ? new THREE.ConeGeometry(p.w, p.h, 10) : new THREE.CylinderGeometry(p.w, p.w, p.h, 8)
    g.translate(0, p.h / 2, 0)
    geos.set(key, g)
  }
  return g
}

/** Add the instanced yard to a model (model-local). Returns the prop count. */
export function dressYard(g: THREE.Group, tile: string, seed: string): number {
  const plan = planYard(tile, seed, occupied(g))
  const byKind = new Map<string, YardPlan[]>()
  for (const p of plan) {
    let a = byKind.get(p.kind)
    if (!a) byKind.set(p.kind, (a = []))
    a.push(p)
  }
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const one = new THREE.Vector3(1, 1, 1)
  const lamps = (g.userData.lamps ??= []) as number[][]
  for (const [kind, list] of byKind) {
    const k = K[kind]
    k.parts.forEach((p, pi) => {
      const colored = p.c === 'car'
      const material = typeof p.c === 'function' ? p.c() : colored ? mat('#ffffff', { rough: 0.35, metal: 0.4 }) : mat(p.c, { rough: 0.55, metal: p.metal ?? 0.15 })
      const im = new THREE.InstancedMesh(geoFor(p), material, list.length)
      im.name = `yard:${kind}:${pi}`
      im.castShadow = kind !== 'fence' && kind !== 'cone'
      im.receiveShadow = true
      list.forEach((it, i) => {
        q.setFromAxisAngle(up, it.yaw)
        const off = new THREE.Vector3(p.x ?? 0, p.y ?? 0, p.z ?? 0).applyQuaternion(q)
        m4.compose(new THREE.Vector3(it.x + off.x, 0.12 + off.y, it.z + off.z), q, one)
        im.setMatrixAt(i, m4)
        if (colored) im.setColorAt(i, new THREE.Color(CAR_COLORS[Math.abs(i * 7 + Math.floor(it.x * 13)) % CAR_COLORS.length]))
      })
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
      g.add(im)
    })
    if (k.lamp) for (const it of list) lamps.push([it.x, 0.12 + k.lamp, it.z])
  }
  return plan.length
}
