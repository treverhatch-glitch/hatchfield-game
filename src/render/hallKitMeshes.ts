/**
 * Terminal kit meshes — low-poly food counters, seats, and decorations.
 * Every part of every placed item is batched into one InstancedMesh per
 * (primitive, colour), so a food court of forty benches is a handful of draw calls.
 * Sizes are real meters.
 */
import * as THREE from 'three'
import { cellCenter, HALL_D, HALL_W, itemDef, type PlacedItem } from '../game/terminal'
import { itemSize } from '../game/terminalKit'
import { binFull } from '../game/litter'
import { TRASH_CAN } from '../game/litterData'

type Prim = 'box' | 'cyl' | 'cone' | 'ico'

interface Part {
  prim: Prim
  /** Width, height, depth in meters. */
  size: [number, number, number]
  /** Center offset from the item origin, y up from the floor. */
  pos: [number, number, number]
  color: string
}

const p = (prim: Prim, size: Part['size'], pos: Part['pos'], color: string): Part => ({
  prim,
  size,
  pos,
  color,
})

const counter = (color: string, awning: string): Part[] => [
  p('box', [2.6, 0.95, 1], [0, 0.48, 0.4], color),
  p('box', [2.6, 2.4, 0.2], [0, 1.2, -0.6], '#3a3430'),
  p('box', [2.8, 0.12, 1.2], [0, 2.5, -0.2], awning),
]

export const KIT_MESH: Record<string, Part[]> = {
  fast_food: [...counter('#d8d2c4', '#d4402c'), p('box', [1.8, 0.6, 0.06], [0, 1.9, -0.48], '#f2c230')],
  cafe: [...counter('#a07850', '#5a3a24'), p('cyl', [0.5, 0.75, 0.5], [-1.4, 0.38, 1.6], '#6a4a30')],
  restaurant: [
    ...counter('#e8e2d6', '#2a5a3a'),
    p('cyl', [1, 0.75, 1], [-1.4, 0.38, 1.8], '#8a6a4a'),
    p('cyl', [1, 0.75, 1], [1.4, 0.38, 1.8], '#8a6a4a'),
    p('box', [0.5, 0.45, 0.5], [-2.2, 0.23, 1.8], '#4a5a6a'),
    p('box', [0.5, 0.45, 0.5], [2.2, 0.23, 1.8], '#4a5a6a'),
  ],
  bench: [
    p('box', [1.8, 0.08, 0.5], [0, 0.45, 0], '#6a7a88'),
    p('box', [1.8, 0.5, 0.06], [0, 0.72, -0.24], '#6a7a88'),
    p('box', [0.08, 0.45, 0.45], [-0.8, 0.22, 0], '#2a2e32'),
    p('box', [0.08, 0.45, 0.45], [0.8, 0.22, 0], '#2a2e32'),
  ],
  seat_row: [
    p('box', [2.4, 0.1, 0.55], [0, 0.45, 0], '#2f5f9a'),
    p('box', [2.4, 0.55, 0.08], [0, 0.75, -0.25], '#2f5f9a'),
    p('box', [2.3, 0.4, 0.1], [0, 0.2, 0], '#2a2e32'),
  ],
  plant: [
    p('cyl', [0.6, 0.55, 0.6], [0, 0.28, 0], '#8a5a3a'),
    p('ico', [0.9, 1.1, 0.9], [0, 1.05, 0], '#3f8a46'),
  ],
  art: [
    p('box', [0.8, 1, 0.8], [0, 0.5, 0], '#e8e4dc'),
    p('ico', [0.7, 0.9, 0.7], [0, 1.5, 0], '#c9a227'),
  ],
  info_screen: [
    p('box', [0.12, 2.2, 0.12], [0, 1.1, 0], '#2a2e32'),
    p('box', [1.6, 0.9, 0.08], [0, 2.4, 0], '#10141a'),
    p('box', [1.45, 0.75, 0.02], [0, 2.4, 0.05], '#3a8ad8'),
  ],
  info_kiosk: [
    p('box', [0.5, 1.4, 0.4], [0, 0.7, 0], '#4a5560'),
    p('box', [0.42, 0.32, 0.03], [0, 1.2, 0.21], '#4ac0a0'),
  ],
  walkway: [
    p('box', [5.2, 0.12, 1.15], [0, 0.16, 0], '#2c3338'),
    p('box', [5.2, 0.08, 0.08], [0, 0.28, -0.52], '#c9a227'),
    p('box', [5.2, 0.08, 0.08], [0, 0.28, 0.52], '#c9a227'),
    p('box', [0.12, 0.7, 1.2], [-2.5, 0.4, 0], '#8a9aaa'),
    p('box', [0.12, 0.7, 1.2], [2.5, 0.4, 0], '#8a9aaa'),
  ],
  fountain: [
    p('cyl', [2.8, 0.5, 2.8], [0, 0.25, 0], '#b8b4aa'),
    p('cyl', [2.5, 0.05, 2.5], [0, 0.48, 0], '#4aa8d8'),
    p('cyl', [0.3, 1.4, 0.3], [0, 0.9, 0], '#b8b4aa'),
    p('cone', [0.9, 0.6, 0.9], [0, 1.75, 0], '#8ad0f0'),
  ],
  trash_can: [
    p('cyl', [0.5, 0.9, 0.5], [0, 0.45, 0], '#4a5a64'),
    p('cyl', [0.54, 0.06, 0.54], [0, 0.93, 0], '#2a2e32'),
  ],
  /** Full can: overflowing lid and a red band, readable from the camera. */
  trash_can_full: [
    p('cyl', [0.5, 0.9, 0.5], [0, 0.45, 0], '#4a5a64'),
    p('cyl', [0.52, 0.12, 0.52], [0, 0.7, 0], '#d4402c'),
    p('ico', [0.5, 0.3, 0.5], [0, 1.02, 0], '#e6dcc2'),
  ],
  checkin_belt: [
    p('box', [2.8, 0.92, 1.05], [0, 0.46, 0.15], '#a07850'),
    p('box', [2.6, 0.08, 0.42], [0, 0.96, -0.42], '#2a2e32'),
    p('box', [0.55, 0.35, 0.4], [0.9, 1.15, 0.2], '#3a8ec2'),
    p('box', [0.08, 1.1, 0.9], [-1.45, 0.55, 0.2], '#d8dde4'),
    p('box', [0.08, 1.1, 0.9], [1.45, 0.55, 0.2], '#d8dde4'),
  ],
  security_small: [
    p('box', [3.2, 0.08, 1.3], [0, 0.06, 0.2], '#1c1f24'),
    p('box', [2.2, 0.85, 0.7], [0, 0.48, -0.15], '#6a7580'),
    p('box', [0.7, 0.55, 0.55], [0.15, 0.85, -0.1], '#1a1e22'),
    p('box', [1.5, 0.1, 0.1], [0, 1.55, 0.55], '#d8dde4'),
    p('box', [0.1, 1.45, 0.1], [-0.7, 0.85, 0.55], '#d8dde4'),
    p('box', [0.1, 1.45, 0.1], [0.7, 0.85, 0.55], '#d8dde4'),
    p('box', [1.3, 0.22, 0.06], [0, 1.72, 0.55], '#f2c14a'),
  ],
  security_medium: [
    p('box', [4.4, 0.08, 1.4], [0, 0.06, 0.15], '#1c1f24'),
    p('box', [1.8, 0.85, 0.7], [-1.1, 0.48, -0.15], '#6a7580'),
    p('box', [1.8, 0.85, 0.7], [1.1, 0.48, -0.15], '#6a7580'),
    p('box', [1.4, 0.1, 0.1], [0, 1.5, 0.5], '#d8dde4'),
    p('box', [0.1, 1.4, 0.1], [-0.65, 0.8, 0.5], '#d8dde4'),
    p('box', [0.1, 1.4, 0.1], [0.65, 0.8, 0.5], '#d8dde4'),
  ],
  security_large: [
    p('box', [5.2, 0.08, 1.5], [0, 0.06, 0.1], '#1c1f24'),
    p('box', [1.6, 0.85, 0.7], [-1.7, 0.48, -0.2], '#6a7580'),
    p('box', [1.6, 0.85, 0.7], [0, 0.48, -0.2], '#6a7580'),
    p('box', [1.6, 0.85, 0.7], [1.7, 0.48, -0.2], '#6a7580'),
    p('box', [2.2, 0.1, 0.1], [0, 1.55, 0.55], '#d8dde4'),
    p('box', [0.1, 1.45, 0.1], [-1.05, 0.85, 0.55], '#d8dde4'),
    p('box', [0.1, 1.45, 0.1], [1.05, 0.85, 0.55], '#d8dde4'),
  ],
  bag_drop: [
    p('box', [2.4, 0.9, 0.9], [0, 0.45, 0.2], '#a07850'),
    p('box', [2.2, 0.08, 0.55], [0, 0.95, -0.35], '#e0b000'),
    p('box', [0.7, 0.4, 0.45], [0.7, 1.15, 0.15], '#3a8ec2'),
  ],
  scanner: [
    p('box', [1.4, 1.5, 0.9], [0, 0.75, 0], '#6a7580'),
    p('box', [0.9, 0.7, 0.7], [0, 0.9, 0], '#1a1e22'),
    p('box', [1.6, 0.12, 0.12], [0, 1.7, 0.5], '#d8dde4'),
    p('box', [0.12, 1.6, 0.12], [-0.74, 0.9, 0.5], '#d8dde4'),
    p('box', [0.12, 1.6, 0.12], [0.74, 0.9, 0.5], '#d8dde4'),
  ],
  wall: [
    p('box', [5.4, 3.05, 0.38], [0, 1.55, 0], '#d5ddd8'),
    p('box', [5.4, 0.16, 0.5], [0, 3.1, 0], '#e7eee9'),
  ],
  newsagent: [
    p('box', [2.2, 1.6, 0.7], [0, 0.8, -0.2], '#c4a574'),
    p('box', [2, 0.9, 0.08], [0, 1.3, 0.18], '#c45c5c'),
    p('box', [1.6, 0.9, 0.7], [0, 0.45, 0.45], '#8a6a4a'),
  ],
  toilet: [
    p('box', [3.6, 0.12, 2.6], [0, 0.06, 0], '#d5e4ea'),
    p('box', [3.4, 2.1, 0.12], [0, 1.1, -1.2], '#eef3f6'),
    p('box', [0.08, 1.6, 2.2], [-1.1, 0.9, 0.1], '#c5d5de'),
    p('box', [0.08, 1.6, 2.2], [0, 0.9, 0.1], '#c5d5de'),
    p('box', [0.08, 1.6, 2.2], [1.1, 0.9, 0.1], '#c5d5de'),
    p('box', [0.7, 1.4, 0.08], [-1.6, 0.8, 1.15], '#7eb0c8'),
    p('box', [0.7, 1.4, 0.08], [1.6, 0.8, 1.15], '#e090b0'),
  ],
  toilet_plus: [
    p('box', [3.6, 0.12, 2.6], [0, 0.06, 0], '#d5e4ea'),
    p('box', [3.4, 2.1, 0.12], [0, 1.1, -1.2], '#eef3f6'),
    p('box', [1.4, 1.5, 0.08], [0, 0.85, 1.15], '#7eb08a'),
  ],
  entrance: [
    p('box', [3.4, 2.6, 0.16], [0, 1.3, 0], '#d5ddd8'),
    p('box', [1.45, 2.15, 0.06], [-0.78, 1.08, 0.1], '#8ec8e8'),
    p('box', [1.45, 2.15, 0.06], [0.78, 1.08, 0.1], '#8ec8e8'),
    p('box', [3.6, 0.12, 0.28], [0, 2.55, 0], '#e7eee9'),
  ],
  queue_rail: [
    p('cyl', [0.08, 0.92, 0.08], [-0.75, 0.46, 0], '#d8dde4'),
    p('cyl', [0.08, 0.92, 0.08], [0.75, 0.46, 0], '#d8dde4'),
    p('box', [1.6, 0.05, 0.05], [0, 0.86, 0], '#c45c5c'),
  ],
  kiosk: [
    p('box', [0.95, 1.25, 0.55], [0, 0.64, 0], '#a07850'),
    p('box', [0.72, 0.42, 0.04], [0, 1.32, 0.28], '#3a8ec2'),
    p('box', [0.78, 0.22, 0.04], [0, 1.05, -0.28], '#c45c5c'),
  ],
  checkin_express: [
    p('box', [3.6, 0.95, 1.05], [0, 0.48, 0.15], '#a07850'),
    p('box', [3.4, 0.08, 0.42], [0, 0.98, -0.42], '#2a2e32'),
    p('box', [0.5, 0.32, 0.06], [-0.7, 1.18, 0.2], '#3a8ec2'),
    p('box', [0.5, 0.32, 0.06], [0.7, 1.18, 0.2], '#3a8ec2'),
  ],
  secure_exit: [
    p('box', [0.16, 2.3, 0.4], [-0.85, 1.15, 0], '#d5ddd8'),
    p('box', [0.16, 2.3, 0.4], [0.85, 1.15, 0], '#d5ddd8'),
    p('box', [1.86, 0.16, 0.4], [0, 2.22, 0], '#d5ddd8'),
    p('box', [1.5, 2.05, 0.06], [0, 1.05, 0], '#8ec8e8'),
  ],
  boarding_desk: [
    p('box', [1.6, 1.05, 0.7], [0, 0.54, 0], '#a07850'),
    p('box', [1.7, 0.06, 0.78], [0, 1.08, 0.04], '#e7e1d4'),
    p('box', [0.55, 0.32, 0.05], [0, 1.32, 0.28], '#3a8ec2'),
  ],
  claim_carousel: [
    p('cyl', [3.2, 0.35, 3.2], [0, 0.28, 0], '#2a2e32'),
    p('cyl', [2.15, 0.2, 2.15], [0, 0.42, 0], '#e7eee9'),
    p('box', [0.7, 0.9, 0.45], [2.4, 0.5, 0], '#a07850'),
  ],
  bag_system: [
    p('box', [6.2, 0.28, 0.9], [0, 0.2, 0], '#2a2e32'),
    p('box', [6.2, 0.08, 0.2], [0, 0.36, 0.28], '#c9a227'),
    p('box', [1.2, 1.1, 0.8], [-2.4, 0.6, -0.7], '#8f9aa6'),
  ],
  wayfinding: [
    p('box', [0.12, 2.4, 0.12], [0, 1.2, 0], '#2a2e32'),
    p('box', [1.4, 0.7, 0.08], [0, 2.15, 0], '#1b4f72'),
    p('box', [1.2, 0.5, 0.02], [0, 2.15, 0.05], '#f2c14a'),
  ],
}

/** Mesh variant for an item — a full trash can swaps to its overflowing look. */
export function kitMeshKey(item: PlacedItem): string {
  return item.def === TRASH_CAN && binFull(item) ? 'trash_can_full' : item.def
}

const GEOS: Record<Prim, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
}

const MATS = new Map<string, THREE.MeshLambertMaterial>()
function mat(color: string): THREE.MeshLambertMaterial {
  let m = MATS.get(color)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true })
    MATS.set(color, m)
  }
  return m
}

export function hasKitMesh(def: string): boolean {
  return def in KIT_MESH
}

/**
 * Center of an item inside its cell. A cell has four quarter slots;
 * items fill them in placement order.
 */
export function slotCenter(
  c: number,
  r: number,
  start: number,
  size: number,
  cols: number,
  rows: number,
): { x: number; z: number } {
  const base = cellCenter(c, r, cols, rows)
  if (size >= 4) return base
  const qx = HALL_W / cols / 4
  const qz = HALL_D / rows / 4
  const quad = (i: number) => ({ x: (i % 2 ? 1 : -1) * qx, z: (i >= 2 ? 1 : -1) * qz })
  const a = quad(start)
  const b = quad(Math.min(3, start + size - 1))
  return { x: base.x + (a.x + b.x) / 2, z: base.z + (a.z + b.z) / 2 }
}

export interface KitPlacement {
  item: PlacedItem
  x: number
  z: number
}

/** World position for every item, honouring shared cells. */
export function layoutItems(items: readonly PlacedItem[], cols: number, rows: number): KitPlacement[] {
  const load = new Map<string, number>()
  const out: KitPlacement[] = []
  for (const item of items) {
    if (item.hx != null && item.hz != null) {
      out.push({ item, x: item.hx, z: item.hz })
      continue
    }
    const key = `${item.c},${item.r}`
    const start = load.get(key) ?? 0
    const size = itemSize(itemDef(item.def))
    load.set(key, start + size)
    const at = slotCenter(item.c, item.r, start, size, cols, rows)
    out.push({ item, x: at.x, z: at.z })
  }
  return out
}

const tmpItem = new THREE.Matrix4()
const tmpPart = new THREE.Matrix4()
const tmpQuat = new THREE.Quaternion()
const up = new THREE.Vector3(0, 1, 0)

function partMatrix(part: Part, x: number, z: number, rot: number, out: THREE.Matrix4) {
  tmpQuat.setFromAxisAngle(up, (rot * Math.PI) / 2)
  tmpItem.compose(new THREE.Vector3(x, 0.07, z), tmpQuat, new THREE.Vector3(1, 1, 1))
  tmpPart.compose(
    new THREE.Vector3(...part.pos),
    new THREE.Quaternion(),
    new THREE.Vector3(...part.size),
  )
  return out.multiplyMatrices(tmpItem, tmpPart)
}

/** One InstancedMesh per (primitive, colour) for all kit items in the hall. */
export function buildKitInstances(placed: readonly KitPlacement[]): THREE.Group {
  const batches = new Map<string, { prim: Prim; color: string; mats: THREE.Matrix4[] }>()
  for (const { item, x, z } of placed) {
    const parts = KIT_MESH[kitMeshKey(item)]
    if (!parts) continue
    for (const part of parts) {
      const key = `${part.prim}|${part.color}`
      let b = batches.get(key)
      if (!b) {
        b = { prim: part.prim, color: part.color, mats: [] }
        batches.set(key, b)
      }
      b.mats.push(partMatrix(part, x, z, item.rot ?? 0, new THREE.Matrix4()))
    }
  }
  const group = new THREE.Group()
  for (const b of batches.values()) {
    const mesh = new THREE.InstancedMesh(GEOS[b.prim], mat(b.color), b.mats.length)
    b.mats.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)
  }
  return group
}

/** Frees instance buffers. Shared geometries and materials stay cached. */
export function disposeKitInstances(group: THREE.Group) {
  for (const child of group.children) (child as THREE.InstancedMesh).dispose?.()
  group.clear()
}

/** Translucent preview of an item. Recoloured green / red by the caller. */
export function buildGhost(def: string, material: THREE.Material): THREE.Group {
  const group = new THREE.Group()
  const parts = KIT_MESH[def] ?? [p('box', [1.6, 1.2, 1.6], [0, 0.6, 0], '#ffffff')]
  for (const part of parts) {
    const mesh = new THREE.Mesh(GEOS[part.prim], material)
    mesh.position.set(...part.pos)
    mesh.scale.set(...part.size)
    group.add(mesh)
  }
  return group
}
