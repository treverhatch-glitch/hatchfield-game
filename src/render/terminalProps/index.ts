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
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { stationSocketTable } from '../socketLayout'
import { mountSockets } from '../socketMount'
import { footprint, type Part, type Prim } from './parts'
import { material } from './materials'
import { readAnimSec } from '../interior/animClock'
import { MOVING_TRAYS, PROP_BUILDERS, TERMINAL_PROP_TYPES, type TerminalPropType, type TrayTrack } from './props'

export { TERMINAL_PROP_TYPES, MOVING_TRAYS, type TerminalPropType, type TrayTrack } from './props'
export { buildTerminalHall, buildTerminalExterior, type HallSpec } from './shell'
export { setupTerminalEnvironment } from './env'
export { capTerminalPropMetal } from './materials'

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
  gadget: 'shop_gadget',
  newsagent: 'shop_gadget',
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
  claim_carousel: 'baggage_carousel',
  bag_drop: 'bag_drop_kiosk',
  bagdrop: 'bag_drop_kiosk',
  passport_booth: 'passport_booth',
  fids: 'departures_board',
  departures_board: 'departures_board',
  sign: 'wayfinding_sign',
  plant: 'planter',
  planter: 'planter',
  trash_can: 'bin',
  bin: 'bin',
  queue: 'stanchion_queue',
  stanchion: 'stanchion',
  kiosk: 'kiosk_bank',
  self_checkin: 'self_checkin_kiosk',
  departures_wall: 'departures_wall',
  gate_sign: 'gate_pylon',
  jet_bridge: 'jet_bridge',
  airbridge: 'jet_bridge',
}

export interface PropPlacement {
  type: TerminalPropType
  x: number
  z: number
  /** Radians around +Y. */
  yaw?: number
  /** Floor height (multi-level terminals). */
  y?: number
  /** Uniform scale (fit a real-size prop into a smaller game cell). */
  scale?: number
}

/** Uniform scale (<= 1) that fits a prop's footprint inside w x d metres. */
export function fitScale(type: TerminalPropType, w: number, d: number): number {
  const s = terminalProp(type).size
  return Math.min(1, w / Math.max(0.01, s.w), d / Math.max(0.01, s.d))
}

const GEOM: Record<Prim, () => THREE.BufferGeometry> = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  rbox: () => new RoundedBoxGeometry(1, 1, 1, 3, 0.1),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
  cyl8: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  sphere: () => new THREE.SphereGeometry(0.5, 24, 16),
  cone: () => new THREE.ConeGeometry(0.5, 1, 12),
  torus: () => new THREE.TorusGeometry(0.4, 0.1, 12, 36),
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
    if (pl.scale && pl.scale !== 1) item.multiply(new THREE.Matrix4().makeScale(pl.scale, pl.scale, pl.scale))
    for (const part of terminalProp(pl.type).parts) {
      e.set(...(part.rot ?? [0, 0, 0]))
      q.setFromEuler(e)
      local.compose(new THREE.Vector3(...part.pos), q, new THREE.Vector3(...part.size))
      const key = `${part.prim}|${part.mat}|${part.near ? 1 : 0}`
      let list = buckets.get(key)
      if (!list) buckets.set(key, (list = []))
      list.push(item.clone().multiply(local))
    }
  }
  const group = new THREE.Group()
  group.name = 'terminalProps'
  for (const pl of placements) {
    const table = stationSocketTable(pl.type)
    if (!table) continue
    const rig = new THREE.Group()
    rig.name = `sockets:${pl.type}`
    mountSockets(rig, table)
    rig.position.set(pl.x, pl.y ?? 0, pl.z)
    rig.rotation.y = pl.yaw ?? 0
    if (pl.scale && pl.scale !== 1) rig.scale.setScalar(pl.scale)
    group.add(rig)
  }
  const moving = buildMovingTrays(placements, !!opts.shadows)
  if (moving) group.add(moving)
  for (const [key, mats] of buckets) {
    const [prim, mat, nearFlag] = key.split('|') as [Prim, string, string]
    const m = new THREE.InstancedMesh(geom(prim), material(mat), mats.length)
    mats.forEach((mx, i) => m.setMatrixAt(i, mx))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    m.castShadow = !!opts.shadows && !material(mat).transparent
    m.receiveShadow = !!opts.shadows
    m.name = key
    m.userData.nearDetail = nearFlag === '1'
    group.add(m)
  }
  return group
}

/** Show or hide parts tagged for hall-camera range, including a dressing group. */
export function setNearPropDetail(root: THREE.Object3D, on: boolean) {
  root.traverse((obj) => {
    if (obj.userData.nearDetail) obj.visible = on
  })
}

/** Pure: positions (prop-local x) of the trays on a track at time t seconds. */
export function trayPositions(t: TrayTrack, time: number): number[] {
  const len = Math.abs(t.x1 - t.x0)
  const dir = Math.sign(t.x1 - t.x0) || 1
  const out: number[] = []
  for (let i = 0; i < t.n; i++) {
    const d = (((time * t.speed + (i * len) / t.n) % len) + len) % len
    out.push(t.x0 + dir * d)
  }
  return out
}

/**
 * Trays (and the bags in them on forward tracks) sliding along the x-ray
 * rollers and the return conveyor. onBeforeRender reads the sim's animSec,
 * which stays put while the game is paused.
 */
function buildMovingTrays(placements: PropPlacement[], shadows: boolean): THREE.Group | null {
  type Slot = { item: THREE.Matrix4; track: TrayTrack }
  const slots: Slot[] = []
  for (const pl of placements) {
    const tracks = MOVING_TRAYS[pl.type]
    if (!tracks) continue
    const item = new THREE.Matrix4().makeRotationY(pl.yaw ?? 0).setPosition(pl.x, pl.y ?? 0, pl.z)
    if (pl.scale && pl.scale !== 1) item.multiply(new THREE.Matrix4().makeScale(pl.scale, pl.scale, pl.scale))
    for (const track of tracks) slots.push({ item, track })
  }
  if (!slots.length) return null
  const nTray = slots.reduce((s, x) => s + x.track.n, 0)
  const nBag = slots.reduce((s, x) => s + (x.track.x1 > x.track.x0 ? x.track.n : 0), 0)
  const trays = new THREE.InstancedMesh(geom('box'), material('tray'), nTray)
  const bagMats = ['bagBlack', 'bagTeal', 'bagSilver', 'bagRed']
  const bags = bagMats.map((m) => new THREE.InstancedMesh(geom('box'), material(m), Math.max(1, Math.ceil(nBag / bagMats.length))))
  const g = new THREE.Group()
  g.name = 'movingTrays'
  trays.name = 'movingTrays|tray'
  trays.frustumCulled = false
  for (const b of bags) { b.frustumCulled = false; b.castShadow = shadows; g.add(b) }
  trays.castShadow = shadows
  g.add(trays)
  const m = new THREE.Matrix4(), tmp = new THREE.Matrix4()
  const sTray = new THREE.Vector3(0.56, 0.1, 0.4), sBag = new THREE.Vector3(0.4, 0.15, 0.27)
  const qI = new THREE.Quaternion()
  const update = (time: number) => {
    let ti = 0
    const bi = bags.map(() => 0)
    let bagK = 0
    for (const { item, track } of slots) {
      const xs = trayPositions(track, time)
      const fwd = track.x1 > track.x0
      for (const x of xs) {
        tmp.compose(new THREE.Vector3(x, track.y, track.z), qI, sTray)
        trays.setMatrixAt(ti++, m.copy(item).multiply(tmp))
        if (fwd) {
          const k = bagK++ % bags.length
          tmp.compose(new THREE.Vector3(x, track.y + 0.12, track.z), qI, sBag)
          bags[k].setMatrixAt(bi[k]++, m.copy(item).multiply(tmp))
        }
      }
    }
    trays.instanceMatrix.needsUpdate = true
    bags.forEach((b, k) => { b.count = bi[k]; b.instanceMatrix.needsUpdate = true })
  }
  update(readAnimSec())
  trays.onBeforeRender = () => update(readAnimSec())
  return g
}
