/**
 * Terminal prop registry. Look up any prop by item type and get its parts,
 * footprint, and an instanced Three.js group for any number of placements.
 *
 *   const g = buildTerminalProps([{ type: 'gate_seating', x: 10, z: 4, yaw: 0 }])
 *   scene.add(g)
 *
 * The hookup from src/terminal item ids to these types is one table; see
 * TERMINAL_ITEM_TO_PROP below and docs/TERMINAL_PROPS.md.
 */
import * as THREE from 'three'
import { footprint, type Part, type Prim } from './parts'
import { material } from './materials'
import { PROP_BUILDERS, TERMINAL_PROP_TYPES, type TerminalPropType } from './props'

export { TERMINAL_PROP_TYPES, type TerminalPropType } from './props'
export { buildTerminalHall, buildTerminalExterior, type HallSpec } from './shell'

export interface PropEntry {
  type: TerminalPropType
  parts: Part[]
  /** Axis-aligned size in metres at yaw 0. */
  size: { w: number; d: number; h: number }
}

const cache = new Map<TerminalPropType, PropEntry>()
export function terminalProp(type: TerminalPropType): PropEntry {
  let e = cache.get(type)
  if (!e) {
    const parts = PROP_BUILDERS[type]()
    e = { type, parts, size: footprint(parts) }
    cache.set(type, e)
  }
  return e
}

/** Every registered prop, keyed by type. */
export const TERMINAL_PROPS: { readonly [K in TerminalPropType]: () => PropEntry } = Object.fromEntries(
  TERMINAL_PROP_TYPES.map((t) => [t, () => terminalProp(t)]),
) as { [K in TerminalPropType]: () => PropEntry }

/**
 * Item ids used by src/game/terminalKit (and the playable terminal in
 * src/terminal) mapped to prop types. Hooking placement up is one lookup:
 * `TERMINAL_ITEM_TO_PROP[item.kind]`. Unknown ids return undefined and keep
 * their existing mesh.
 */
export const TERMINAL_ITEM_TO_PROP: Readonly<Record<string, TerminalPropType>> = {
  checkin: 'checkin_row',
  checkin_desk: 'checkin_row',
  security: 'security_lane',
  security_lane: 'security_lane',
  cafe: 'shop_coffee',
  coffee: 'shop_coffee',
  duty_free: 'shop_dutyfree',
  dutyfree: 'shop_dutyfree',
  shop: 'shop_news',
  news: 'shop_news',
  fast_food: 'shop_fastfood',
  restaurant: 'food_court',
  food_court: 'food_court',
  bench: 'seat_row',
  seat_row: 'seat_row',
  gate: 'gate_seating',
  gate_seating: 'gate_seating',
  charging: 'charging_post',
  restroom: 'restroom_block',
  restrooms: 'restroom_block',
  baggage_claim: 'baggage_carousel',
  baggage_reclaim: 'baggage_carousel',
  carousel: 'baggage_carousel',
  fids: 'departures_board',
  departures_board: 'departures_board',
  sign: 'wayfinding_sign',
  plant: 'planter',
  planter: 'planter',
  trash_can: 'bin',
  bin: 'bin',
  queue: 'stanchion_queue',
  stanchion: 'stanchion',
}

export interface PropPlacement {
  type: TerminalPropType
  x: number
  z: number
  /** Radians around +Y. */
  yaw?: number
  /** Floor height (multi-level terminals). */
  y?: number
}

const GEOM: Record<Prim, () => THREE.BufferGeometry> = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  cyl8: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  sphere: () => new THREE.SphereGeometry(0.5, 14, 10),
  cone: () => new THREE.ConeGeometry(0.5, 1, 12),
  torus: () => new THREE.TorusGeometry(0.4, 0.1, 8, 24),
  plane: () => new THREE.PlaneGeometry(1, 1),
}
const geomCache = new Map<Prim, THREE.BufferGeometry>()
const geom = (p: Prim) => {
  let g = geomCache.get(p)
  if (!g) geomCache.set(p, (g = GEOM[p]()))
  return g
}

/**
 * Build all placements into one group: one InstancedMesh per
 * (primitive, material). Returns the group plus a draw-call count.
 */
export function buildTerminalProps(placements: PropPlacement[], opts: { shadows?: boolean } = {}): THREE.Group {
  const buckets = new Map<string, THREE.Matrix4[]>()
  const item = new THREE.Matrix4()
  const local = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  for (const pl of placements) {
    item.makeRotationY(pl.yaw ?? 0).setPosition(pl.x, pl.y ?? 0, pl.z)
    for (const part of terminalProp(pl.type).parts) {
      e.set(...(part.rot ?? [0, 0, 0]))
      q.setFromEuler(e)
      local.compose(new THREE.Vector3(...part.pos), q, new THREE.Vector3(...part.size))
      const key = `${part.prim}|${part.mat}`
      let list = buckets.get(key)
      if (!list) buckets.set(key, (list = []))
      list.push(item.clone().multiply(local))
    }
  }
  const group = new THREE.Group()
  group.name = 'terminalProps'
  for (const [key, mats] of buckets) {
    const [prim, mat] = key.split('|') as [Prim, string]
    const m = new THREE.InstancedMesh(geom(prim), material(mat), mats.length)
    mats.forEach((mx, i) => m.setMatrixAt(i, mx))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    m.castShadow = !!opts.shadows && !material(mat).transparent
    m.receiveShadow = !!opts.shadows
    m.name = key
    group.add(m)
  }
  return group
}
