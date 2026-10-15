/**
 * High / Ultra graphics: swap the low-poly terminal plan props for the
 * detailed instanced models in render/terminalProps. Each plan prop kind maps
 * to one detailed type, scaled down to fit the footprint the plan already
 * reserves for it, so layouts and walk lanes are unchanged. Low / Medium keep
 * the baked low-poly props.
 */
import * as THREE from 'three'
import { buildTerminalProps, capTerminalPropMetal, fitScale, TERMINAL_PROP_TYPES, type PropPlacement, type TerminalPropType } from '../terminalProps'
import { buildingReflectionsActive } from '../reflections'
import type { QualityLevel } from './quality'
import type { PropKind, Prop } from './plan'
import type { PropPart } from './kit'
import type { Room, RoomKind, RoomPlan } from './rooms'

/**
 * Plan prop kind → detailed model. Kinds not listed keep their low-poly mesh.
 * Desks (counter, monitor, podium) stay on the low-poly path: they are culled
 * per room for the cutaway (roomDraw DESK_KINDS).
 */
export const HI_DETAIL_KIND: Partial<Record<PropKind, TerminalPropType>> = {
  xray: 'xray_machine',
  arch: 'body_scanner',
  kiosk: 'menu_counter',
  board: 'departures_wall',
  bench: 'seat_row',
  planter: 'planter',
  bin: 'bin',
  stanchion: 'stanchion',
  wc: 'restroom_stall',
}
/** Kinds dropped at High because the detailed model already includes them. */
export const HI_DETAIL_ABSORBED: ReadonlySet<PropKind> = new Set<PropKind>(['awning'])

/** Detailed models stay on at every graphics tier. */
export function hiDetailOn(_level: QualityLevel | undefined): boolean {
  return true
}

/** Is this kind drawn by the detailed layer at this quality? */
export function hiDetailOwns(kind: PropKind, on: boolean): boolean {
  return on && (kind in HI_DETAIL_KIND || HI_DETAIL_ABSORBED.has(kind))
}

const footCache = new Map<string, { w: number; d: number }>()
/** Footprint in metres of the low-poly prop, from its part geometries. */
export function lowPolyFootprint(kind: string, parts: PropPart[] | undefined): { w: number; d: number } {
  const hit = footCache.get(kind)
  if (hit) return hit
  const box = new THREE.Box3()
  for (const p of parts ?? []) {
    if (!p.geo.boundingBox) p.geo.computeBoundingBox()
    if (p.geo.boundingBox) box.union(p.geo.boundingBox)
  }
  const size = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.getSize(new THREE.Vector3())
  const out = { w: Math.max(0.3, size.x), d: Math.max(0.3, size.z) }
  footCache.set(kind, out)
  return out
}

/** Slack over the low-poly footprint; the detailed models carry more trim. */
const SLACK = 1.35

const MENU_COUNTERS: TerminalPropType[] = ['menu_counter', 'menu_noodle', 'menu_brew', 'menu_grab']

/**
 * Detailed group for a plan's props, in world units (props are authored in
 * metres, the world is WORLD_PER_METER per metre).
 */
export function buildHiDetailProps(
  props: readonly Prop[],
  parts: Record<string, PropPart[]>,
  worldPerMeter: number,
  floorY: number,
): THREE.Group {
  // With the High studio probe, authored metalness reads correctly. Without it, full metal goes black.
  capTerminalPropMetal(buildingReflectionsActive() ? 1 : 0.4)
  const placements: PropPlacement[] = []
  let menus = 0
  for (const p of props) {
    let type = HI_DETAIL_KIND[p.kind]
    if (p.kind === 'kiosk') type = MENU_COUNTERS[menus++ % MENU_COUNTERS.length]
    if (!type) {
      // Gate podiums stay low-poly; a lit gate pylon stands beside each one.
      if (p.kind === 'podium') placements.push({ type: 'gate_pylon', x: p.x / worldPerMeter + Math.cos(p.yaw) * 1.4, z: p.z / worldPerMeter - Math.sin(p.yaw) * 1.4, y: floorY / worldPerMeter, yaw: p.yaw, scale: 0.6 })
      continue
    }
    const foot = lowPolyFootprint(p.kind, parts[p.kind])
    const fit = fitScale(type, foot.w * SLACK, foot.d * SLACK)
    placements.push({ type, x: p.x / worldPerMeter, z: p.z / worldPerMeter, y: floorY / worldPerMeter, yaw: p.yaw, scale: Math.max(0.35, fit) })
  }
  const g = buildTerminalProps(placements, { shadows: false })
  g.scale.setScalar(worldPerMeter)
  g.name = 'props-hidetail'
  return g
}

function roomSpan(plan: RoomPlan, room: Room) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const s of room.squares) {
    const i = s % plan.w
    const j = Math.floor(s / plan.w)
    const x = plan.x0 + i * plan.size
    const z = plan.z0 + j * plan.size
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x + plan.size)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z + plan.size)
  }
  return { minX, maxX, minZ, maxZ }
}

function biggestRoom(plan: RoomPlan, kind: RoomKind): Room | null {
  let best: Room | null = null
  for (const room of plan.rooms) {
    if (room.kind !== kind) continue
    if (!best || room.squares.length > best.squares.length) best = room
  }
  return best
}

/**
 * Render-only furniture the room plan does not already place: arrivals
 * wayfinding and a claim carousel in check-in, a lounge in the concourse,
 * cubicles in the staff office. Hidden outside hall-camera range.
 * Plan squares, sockets, and footprints are not moved.
 */
export function buildInteriorDressing(plan: RoomPlan, worldPerMeter: number, floorY: number): THREE.Group {
  capTerminalPropMetal(buildingReflectionsActive() ? 1 : 0.4)
  const placements: PropPlacement[] = []
  const anchors: Record<string, { x: number; z: number }> = {}
  const push = (type: TerminalPropType, x: number, z: number, yaw: number, scale: number, anchor?: string) => {
    if (scale < 0.22) return
    placements.push({ type, x: x / worldPerMeter, z: z / worldPerMeter, y: floorY / worldPerMeter, yaw, scale })
    if (anchor) anchors[anchor] = { x, z }
  }
  const checkin = biggestRoom(plan, 'checkin')
  if (checkin) {
    const s = roomSpan(plan, checkin)
    const alongX = s.maxX - s.minX >= s.maxZ - s.minZ
    const cx = (s.minX + s.maxX) / 2
    const cz = (s.minZ + s.maxZ) / 2
    const along = alongX ? s.maxX - s.minX : s.maxZ - s.minZ
    const across = alongX ? s.maxZ - s.minZ : s.maxX - s.minX
    const end = (t: number) => {
      const d = (t - 0.5) * along
      return alongX ? { x: cx + d, z: cz } : { x: cx, z: cz + d }
    }
    const sign = end(0.18)
    push('arrivals_sign', sign.x, sign.z, alongX ? 0 : Math.PI / 2, 1, 'arrivals')
    const claim = end(0.82)
    const carousel = fitScale('baggage_carousel', (along / worldPerMeter) * 0.38, (across / worldPerMeter) * 0.72)
    push('baggage_carousel', claim.x, claim.z, alongX ? 0 : Math.PI / 2, Math.min(0.7, carousel), 'claim')
  }
  const airside = biggestRoom(plan, 'airside')
  if (airside) {
    const s = roomSpan(plan, airside)
    const w = (s.maxX - s.minX) / worldPerMeter
    const d = (s.maxZ - s.minZ) / worldPerMeter
    push('lounge_cluster', airside.x, airside.z, 0, Math.min(1, fitScale('lounge_cluster', w * 0.55, d * 0.55)), 'lounge')
  }
  const office = biggestRoom(plan, 'office')
  if (office) {
    const s = roomSpan(plan, office)
    const w = (s.maxX - s.minX) / worldPerMeter
    const d = (s.maxZ - s.minZ) / worldPerMeter
    push('staff_office', office.x, office.z, 0, Math.min(1, fitScale('staff_office', w * 0.7, d * 0.7)), 'office')
  }
  const shops = biggestRoom(plan, 'shops')
  if (shops) {
    const s = roomSpan(plan, shops)
    const alongX = s.maxX - s.minX >= s.maxZ - s.minZ
    const span = (alongX ? s.maxX - s.minX : s.maxZ - s.minZ) / worldPerMeter
    const across = (alongX ? s.maxZ - s.minZ : s.maxX - s.minX) / worldPerMeter
    const cx = (s.minX + s.maxX) / 2
    const cz = (s.minZ + s.maxZ) / 2
    const yaw = alongX ? Math.PI / 2 : 0
    const at = (t: number) => {
      const d = (t - 0.5) * span * worldPerMeter * 0.46
      return alongX ? { x: cx + d, z: cz } : { x: cx, z: cz + d }
    }
    const fit = (type: TerminalPropType, portion: number) => {
      const slotA = span * portion
      const slotB = across * 0.82
      return Math.min(1, fitScale(type, slotA, slotB), fitScale(type, slotB, slotA))
    }
    const gadget = at(0.24)
    const food = at(0.76)
    push('shop_gadget', gadget.x, gadget.z, yaw, fit('shop_gadget', 0.42), 'gadget')
    push('food_court', food.x, food.z, yaw + Math.PI, fit('food_court', 0.46), 'food')
  }
  const preferred: Partial<Record<TerminalPropType, RoomKind>> = {
    checkin_row: 'checkin',
    checkin_desk: 'checkin',
    self_checkin_kiosk: 'checkin',
    kiosk_bank: 'checkin',
    stanchion_queue: 'checkin',
    departures_board: 'checkin',
    wayfinding_sign: 'checkin',
    wayfinding_totem: 'checkin',
    baggage_trolley: 'checkin',
    restroom_block: 'checkin',
    security_lane: 'security',
    security_lane_ct: 'security',
    walkthrough_arch: 'security',
    divest_station: 'security',
    shop_coffee: 'shops',
    shop_dutyfree: 'shops',
    shop_news: 'shops',
    shop_fastfood: 'shops',
    cafe_table: 'shops',
    cafe_counter: 'shops',
    shop_gondola: 'shops',
    shop_kiosk: 'shops',
    menu_noodle: 'shops',
    menu_brew: 'shops',
    menu_grab: 'shops',
    gate_seating: 'airside',
    charging_post: 'airside',
    gate_podium: 'airside',
    gate_pylon: 'airside',
    planter_long: 'airside',
    jet_bridge: 'airside',
  }
  const placed = new Set(placements.map((p) => p.type))
  const pending = TERMINAL_PROP_TYPES.filter((type) => !placed.has(type))
  const fallback = plan.rooms[0] ?? null
  const byRoom = new Map<number, TerminalPropType[]>()
  for (const type of pending) {
    const kind = preferred[type] ?? 'checkin'
    const room = biggestRoom(plan, kind) ?? biggestRoom(plan, 'checkin') ?? fallback
    if (!room) continue
    const list = byRoom.get(room.id) ?? []
    list.push(type)
    byRoom.set(room.id, list)
  }
  for (const [id, types] of byRoom) {
    const room = plan.rooms.find((r) => r.id === id)
    if (!room) continue
    const s = roomSpan(plan, room)
    const alongX = s.maxX - s.minX >= s.maxZ - s.minZ
    const span = (alongX ? s.maxX - s.minX : s.maxZ - s.minZ) / worldPerMeter
    const across = (alongX ? s.maxZ - s.minZ : s.maxX - s.minX) / worldPerMeter
    const cx = (s.minX + s.maxX) / 2
    const cz = (s.minZ + s.maxZ) / 2
    types.forEach((type, i) => {
      const t = (i + 0.5) / types.length
      const along = (t - 0.5) * span * worldPerMeter * 0.72
      const side = (i % 2 === 0 ? 0.36 : -0.36) * across * worldPerMeter
      const x = alongX ? cx + along : cx + side
      const z = alongX ? cz + side : cz + along
      const outside = type === 'jet_bridge' ? (alongX ? 0 : Math.sign(side || 1) * across * worldPerMeter * 0.65) : 0
      const fit = Math.min(0.48, fitScale(type, Math.max(1.2, span / types.length), Math.max(1.2, across * 0.42)))
      push(type, x + (alongX ? 0 : outside), z + (alongX ? outside : 0), alongX ? Math.PI / 2 : 0, Math.max(0.24, fit), type)
    })
  }
  const g = buildTerminalProps(placements, { shadows: false })
  g.scale.setScalar(worldPerMeter)
  g.name = 'interior-dressing'
  g.userData.anchors = anchors
  g.userData.types = placements.map((p) => p.type)
  return g
}
