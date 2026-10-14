/**
 * Facilities the terminal pathing layer reads.
 * This file does not move passengers. The live walk (entrance → boarding) is
 * src/paxnav via src/game/hallNav.ts, which reads `facilityBlockers` for the
 * prefab nav grid. `placeholderRoute` stays as the plain stop order.
 */
import { cellCenter, itemDef, type PlacedItem } from '../game/terminal.ts'
import { blockedCellKeys } from './place.ts'

export type FacilityType =
  | 'entrance'
  | 'checkin'
  | 'bag_drop'
  | 'security'
  | 'scanner'
  | 'seat'
  | 'restroom'
  | 'food'
  | 'shop'
  | 'sign'
  | 'gate'
  | 'wall'
  | 'belt'

/** One placed piece, in hall cells and metres. Capacity is parallel servers, else seats. */
export interface TerminalFacility {
  id: string
  type: FacilityType
  def: string
  c: number
  r: number
  x: number
  z: number
  capacity: number
}

const DEF_TYPE: Record<string, FacilityType> = {
  entrance: 'entrance',
  checkin_belt: 'checkin',
  checkin_express: 'checkin',
  kiosk: 'checkin',
  bag_drop: 'bag_drop',
  security_small: 'security',
  security_medium: 'security',
  security_large: 'security',
  scanner: 'scanner',
  seat_row: 'seat',
  bench: 'seat',
  toilet: 'restroom',
  toilet_plus: 'restroom',
  cafe: 'food',
  fast_food: 'food',
  restaurant: 'food',
  newsagent: 'shop',
  wayfinding: 'sign',
  info_screen: 'sign',
  departures_wall: 'sign',
  gate_pylon: 'sign',
  boarding_desk: 'gate',
  wall: 'wall',
  bag_system: 'belt',
  walkway: 'belt',
}

/** Passenger stops, in visit order. Walls, belts, and signs are not stops. */
const ROUTE_ORDER: FacilityType[] = [
  'entrance',
  'checkin',
  'bag_drop',
  'security',
  'scanner',
  'restroom',
  'food',
  'shop',
  'seat',
  'gate',
]

export function facilityType(def: string): FacilityType | null {
  return DEF_TYPE[def] ?? null
}

export function facilityCapacity(def: string): number {
  const item = itemDef(def)
  if (!item) return 0
  if (item.servers > 0) return item.servers
  if (item.seats && item.seats > 0) return item.seats
  return item.queueCap
}

/** Every placed item the pathing layer can see, including walls and belts. */
export function facilitiesFromItems(
  items: readonly PlacedItem[],
  cols: number,
  rows: number,
): TerminalFacility[] {
  const out: TerminalFacility[] = []
  for (const it of items) {
    const type = facilityType(it.def)
    if (!type) continue
    const at = cellCenter(it.c, it.r, cols, rows)
    out.push({
      id: it.id,
      type,
      def: it.def,
      c: it.c,
      r: it.r,
      x: at.x,
      z: at.z,
      capacity: facilityCapacity(it.def),
    })
  }
  return out
}

/** Cells the nav grid never walks: walls and belts (see `prefabNavLayout`). */
export function facilityBlockers(items: readonly { def: string; c: number; r: number }[]): Set<string> {
  return blockedCellKeys(items)
}

/**
 * Straight list of stops: doors, check-in, bag drop, security, airside
 * restroom / food / shop, seats, gate. Ignores walls; the walk uses the nav grid.
 */
export function placeholderRoute(facilities: readonly TerminalFacility[]): TerminalFacility[] {
  const stops = facilities.filter((f) => ROUTE_ORDER.includes(f.type))
  return [...stops].sort((a, b) => ROUTE_ORDER.indexOf(a.type) - ROUTE_ORDER.indexOf(b.type))
}
