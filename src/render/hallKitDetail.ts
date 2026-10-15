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
export function hallPickMesh(item: { id: string }, x: number, z: number): THREE.Mesh {
  const pick = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.4), new THREE.MeshBasicMaterial({ visible: false }))
  pick.name = 'hall-pick'
  pick.position.set(x, 0.9, z)
  pick.userData.facilityId = `item:${item.id}`
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
