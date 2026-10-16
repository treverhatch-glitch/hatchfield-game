/**
 * Hall view: placed catalog items that have a detailed terminalProps model
 * draw that model at scale 1 (one unit is one metre). Low-poly KIT_MESH
 * covers the rest. Nothing here is shrunk to fit a cell.
 */
import * as THREE from 'three'
import { buildTerminalProps, capTerminalPropMetal, type PropPlacement, type TerminalPropType } from './terminalProps'
import type { KitPlacement } from './hallKitMeshes'

/** Catalog item id → detailed model. */
export const HALL_ITEM_PROP: Readonly<Record<string, TerminalPropType>> = {
  kiosk: 'kiosk_bank',
  checkin_belt: 'checkin_pair',
  checkin_express: 'checkin_pair',
  security_small: 'security_lane',
  security_medium: 'security_lane',
  security_large: 'security_lane_ct',
  scanner: 'body_scanner',
  seat_row: 'seat_row',
  bench: 'seat_row',
  boarding_desk: 'gate_podium',
  claim_carousel: 'baggage_carousel',
  bag_drop: 'bag_drop_kiosk',
  passport_booth: 'passport_booth',
  toilet: 'restroom_block',
  toilet_plus: 'restroom_block',
  cafe: 'shop_coffee',
  fast_food: 'shop_fastfood',
  restaurant: 'food_court',
  newsagent: 'shop_gadget',
  wayfinding: 'wayfinding_sign',
  info_screen: 'departures_board',
  departures_wall: 'departures_wall',
  gate_pylon: 'gate_pylon',
  plant: 'planter',
  trash_can: 'bin',
}

/**
 * Service kit that must read at its authored metres beside the 1.6 m check-in
 * counters (the PR #125 list). In the hall every prop is scale 1, so this set
 * is what the scale audit pins footprints for, not a scale floor.
 */
export const HALL_REAL_SIZE: ReadonlySet<TerminalPropType> = new Set<TerminalPropType>([
  'checkin_pair',
  'security_lane',
  'security_lane_ct',
  'body_scanner',
  'bag_drop_kiosk',
  'baggage_carousel',
  'passport_booth',
  'shop_coffee',
  'shop_fastfood',
  'shop_gadget',
  'food_court',
])

export function hallItemProp(def: string): TerminalPropType | undefined {
  return HALL_ITEM_PROP[def]
}

/**
 * Click volume for a service fitting, metres (width, height, depth).
 * These match the detailed prop footprints so a click on the lane, desk,
 * bag drop, or claim belt hits the fitting, not the person standing on it.
 */
export const HALL_SERVICE_PICK_M: Partial<Record<TerminalPropType, { w: number; h: number; d: number }>> = {
  security_lane: { w: 14.2, h: 2.4, d: 6.2 },
  security_lane_ct: { w: 16.2, h: 2.4, d: 7.4 },
  checkin_pair: { w: 6.7, h: 2.4, d: 5.8 },
  bag_drop_kiosk: { w: 1.9, h: 2.4, d: 1.9 },
  baggage_carousel: { w: 15.2, h: 2.4, d: 4.6 },
}

/** Service fittings that stay on the low-poly kit. Sized to that mesh, metres. */
const HALL_KIT_PICK_M: Record<string, { w: number; h: number; d: number }> = {
  bag_system: { w: 6.2, h: 2.2, d: 1.6 },
}

/**
 * A live service point (`lane-0`) wins over a placed fitting (`item:…`) when
 * one click hits both. Two fittings: the one whose centre the cursor is
 * nearest, so a bag belt in front of the claim hall is not swallowed by the
 * carousel's volume.
 */
export function pickedFacilityId(hits: readonly { id: string; fromCenter: number }[]): string | null {
  let metric: { id: string; fromCenter: number } | null = null
  let item: { id: string; fromCenter: number } | null = null
  for (const hit of hits) {
    if (!hit.id) continue
    const fitting = hit.id.startsWith('item:')
    const best = fitting ? item : metric
    if (best && hit.fromCenter >= best.fromCenter) continue
    if (fitting) item = hit
    else metric = hit
  }
  return metric?.id ?? item?.id ?? null
}

/**
 * Passport booths draw only on an arrivals or claim tile.
 * The dressing used to drop one in check-in. The player builds them in arrivals.
 */
export function hallPropAllowed(def: string, zone: string | null | undefined): boolean {
  if (def !== 'passport_booth') return true
  return zone === 'arrivals' || zone === 'claim'
}

/** Placements for the detailed kit. Every prop is scale 1: a real metre, never fitScale-shrunk. */
export function hallDetailPlacements(laid: readonly KitPlacement[], _cols: number, _rows: number): PropPlacement[] {
  const placements: PropPlacement[] = []
  for (const k of laid) {
    const type = hallItemProp(k.item.def)
    if (!type) continue
    const yaw = ((k.item.rot ?? 0) * Math.PI) / 2
    placements.push({ type, x: k.x, z: k.z, y: 0.07, yaw, scale: 1 })
  }
  return placements
}

/**
 * Invisible pick box for a placed fitting. Clicking it selects `item:<id>`.
 * Hidden through `material.visible`, not opacity: the hall's near-wall fade
 * resets opacity to 1 on every tall room mesh. Raycasts still hit it.
 */
export function hallPickMesh(item: { id: string; def?: string; rot?: number }, x: number, z: number): THREE.Mesh {
  const type = item.def ? hallItemProp(item.def) : undefined
  const foot = (type ? HALL_SERVICE_PICK_M[type] : undefined) ?? (item.def ? HALL_KIT_PICK_M[item.def] : undefined)
  const w = foot?.w ?? 1.8
  const h = foot?.h ?? 1.6
  const d = foot?.d ?? 1.4
  const pick = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }))
  pick.name = 'hall-pick'
  pick.position.set(x, h / 2, z)
  pick.rotation.y = ((item.rot ?? 0) * Math.PI) / 2
  pick.userData.facilityId = `item:${item.id}`
  pick.userData.servicePick = foot != null
  pick.frustumCulled = false
  return pick
}

/** Split placements into detailed and low-poly sets and build the detailed group. */
export function buildHallDetail(
  laid: readonly KitPlacement[],
  cols: number,
  rows: number,
): { group: THREE.Group; rest: KitPlacement[] } {
  capTerminalPropMetal(0.4)
  const placements = hallDetailPlacements(laid, cols, rows)
  const rest = laid.filter((k) => !hallItemProp(k.item.def))
  const group = buildTerminalProps(placements, { shadows: false })
  group.name = 'hall-kit-detail'
  return { group, rest }
}
