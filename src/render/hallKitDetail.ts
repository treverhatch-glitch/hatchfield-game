/**
 * High / Ultra graphics in the hall view: placed catalog items that have a
 * detailed render/terminalProps model draw that model (fitted into the item's
 * cell slots) instead of the low-poly KIT_MESH. Low / Medium are unchanged.
 */
import * as THREE from 'three'
import { HALL_D, HALL_W, itemDef } from '../game/terminal'
import { itemSize } from '../game/terminalKit'
import { buildTerminalProps, capTerminalPropMetal, fitScale, type PropPlacement, type TerminalPropType } from './terminalProps'
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
 * Props that stay near their authored metres beside the check-in bank.
 * The floor is the same 0.9 used for the 1.6 m desks: a little aisle overhang
 * reads better than an x-ray, carousel, booth, or counter shrunk to toy size.
 * Starter expansion cells stay empty — this only changes the mesh scale.
 */
export const HALL_REAL_SCALE = 0.9

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

/** Uniform scale for one detailed hall prop. Real-size kit never drops below {@link HALL_REAL_SCALE}. */
export function hallDetailScale(type: TerminalPropType, fit: number): number {
  return HALL_REAL_SIZE.has(type) ? Math.max(fit, HALL_REAL_SCALE) : fit
}

export function hallItemProp(def: string): TerminalPropType | undefined {
  return HALL_ITEM_PROP[def]
}

/** Split placements into detailed and low-poly sets and build the detailed group. */
export function buildHallDetail(
  laid: readonly KitPlacement[],
  cols: number,
  rows: number,
): { group: THREE.Group; rest: KitPlacement[] } {
  capTerminalPropMetal(0.4)
  const cw = HALL_W / Math.max(1, cols)
  const ch = HALL_D / Math.max(1, rows)
  const placements: PropPlacement[] = []
  const rest: KitPlacement[] = []
  for (const k of laid) {
    const type = hallItemProp(k.item.def)
    if (!type) {
      rest.push(k)
      continue
    }
    const slots = itemSize(itemDef(k.item.def))
    // A full cell for 4 slots, half for 2, a quarter for 1.
    const w = slots >= 2 ? cw : cw / 2
    const d = slots >= 4 ? ch : ch / 2
    const yaw = ((k.item.rot ?? 0) * Math.PI) / 2
    const odd = (k.item.rot ?? 0) % 2 !== 0
    const fit = fitScale(type, (odd ? d : w) * 0.92, (odd ? w : d) * 0.92)
    const scale = hallDetailScale(type, fit)
    placements.push({ type, x: k.x, z: k.z, y: 0.07, yaw, scale })
  }
  const group = buildTerminalProps(placements, { shadows: false })
  group.name = 'hall-kit-detail'
  return { group, rest }
}
