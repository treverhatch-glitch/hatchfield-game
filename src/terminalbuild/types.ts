/**
 * Build-from-scratch terminal: floor tiles, walls, doors, painted zones,
 * rooms and equipment on a tile grid. Pure data; no DOM, Three, or React.
 *
 * Internal ids say landside / airside. Player copy never does: it says
 * "before security" / "after security" (see config.ts labels).
 */

export type BuildZone = 'landside' | 'checkin' | 'security' | 'airside' | 'gates' | 'baggage' | 'retail'

/** Which side of the security line a zone sits on. Retail takes the side it is walked from. */
export type ZoneSide = 'landside' | 'security' | 'airside' | 'staff' | 'either'

export type RoomKind = 'checkin' | 'security' | 'gate' | 'bagmakeup' | 'retail' | 'toilets'

export type EquipKind =
  | 'checkin_desk'
  | 'security_lane'
  | 'gate_desk'
  | 'bag_belt'
  | 'makeup_carousel'
  | 'seat'
  | 'shop_counter'
  | 'toilet'

/**
 * A tile edge. `E` is the east side of (x, y), `S` the south side.
 * West and north map borders are written with x = -1 / y = -1.
 */
export interface Edge {
  x: number
  y: number
  dir: 'E' | 'S'
}

/**
 * - public: inside door, anyone walks through.
 * - curb: outside door on the before-security side (way in and way out).
 * - apron: outside door on the after-security side or bag hall (aircraft, bag carts).
 * - staff: passengers cannot use it.
 * - exit: one-way, after security -> before security only (arrivals).
 */
export type DoorKind = 'public' | 'curb' | 'apron' | 'staff' | 'exit'

export interface Door extends Edge {
  kind: DoorKind
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Room extends Rect {
  id: string
  kind: RoomKind
}

export interface Equip {
  id: string
  kind: EquipKind
  x: number
  y: number
  /** 0–100. Rises with use; worn kit serves slower. */
  wear: number
}

export interface BuildLayout {
  w: number
  h: number
  floor: boolean[][]
  zones: (BuildZone | null)[][]
  walls: Edge[]
  doors: Door[]
  rooms: Room[]
  equipment: Equip[]
}

export interface Tile {
  x: number
  y: number
}

export type FindingSeverity = 'blocker' | 'warning' | 'tip'

export interface Finding {
  /** Stable per problem, e.g. `wall_gap` or `gate_unreachable:g1`. */
  id: string
  severity: FindingSeverity
  /** True when the problem stops passengers or bags moving. These also raise a live alert. */
  blocksFlow: boolean
  title: string
  detail: string
  fix: string
  cells: Tile[]
}

export interface EditResult {
  layout: BuildLayout
  /** Cash the edit costs. Zero when rejected. */
  cost: number
  /** Set when the edit was rejected; `layout` is then the input unchanged. */
  error?: string
  /** Cells the zone brush could not take. The painter tints these invalid. */
  rejected?: Tile[]
}
