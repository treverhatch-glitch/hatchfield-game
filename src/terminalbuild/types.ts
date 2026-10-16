/**
 * Build-from-scratch terminal: floor tiles, walls, doors, painted zones,
 * rooms and equipment on a tile grid. Pure data; no DOM, Three, or React.
 *
 * Internal ids say landside / airside. Player copy never does: it says
 * "before security" / "after security" (see config.ts labels).
 */

export type BuildZone =
  | 'landside'
  | 'checkin'
  | 'security'
  | 'airside'
  | 'gates'
  | 'baggage'
  | 'retail'
  | 'office'
  | 'claim'
  | 'arrivals'
  | 'vertical'
  | 'bagroom'

/**
 * Which side of the security line a zone sits on.
 * Retail takes the side it is walked from.
 * `sterile_arr` is arrivals only: it is not a way around security.
 */
export type ZoneSide = 'landside' | 'security' | 'airside' | 'staff' | 'either' | 'sterile_arr'

export type RoomKind = 'checkin' | 'security' | 'gate' | 'bagmakeup' | 'retail' | 'toilets' | 'lounge' | 'office'

export type EquipKind =
  | 'checkin_desk'
  | 'security_lane'
  | 'gate_desk'
  | 'bag_belt'
  | 'makeup_carousel'
  | 'seat'
  | 'shop_counter'
  | 'toilet'
  | 'office_desk'

/**
 * A tile edge. `E` is the east side of (x, y), `S` the south side.
 * West and north map borders are written with x = -1 / y = -1.
 * `floor` is the story. Omitted means floor 0 so older layouts stay valid.
 */
export interface Edge {
  x: number
  y: number
  dir: 'E' | 'S'
  floor?: number
  /** Wall paint id from the interior catalog. Omitted means the plain wall. */
  finish?: string
}

/**
 * - public: inside door, anyone walks through.
 * - curb: outside door on the before-security side (way in and way out).
 * - apron: outside door on the after-security side or bag hall (aircraft, bag carts).
 * - staff: passengers cannot use it.
 * - exit: one-way, after security -> before security only (arrivals).
 */
export type DoorKind =
  | 'public'
  | 'curb'
  | 'apron'
  | 'staff'
  | 'exit'
  | 'gate_bridge'
  | 'gate_apron'
  | 'arrivals_in'

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
  /** Story this room sits on. Omitted means floor 0. */
  floor?: number
}

export interface Equip {
  id: string
  kind: EquipKind
  x: number
  y: number
  /** 0–100. Rises with use; worn kit serves slower. */
  wear: number
  /** Story this piece sits on. Omitted means floor 0. */
  floor?: number
}

/** Catalog pieces on the 1 m layout. `Equip` stays until the walk reads fittings directly. */
export type FittingKind =
  | 'checkin_desk'
  | 'checkin_kiosk'
  | 'bag_drop'
  | 'queue_rail'
  | 'bp_podium'
  | 'security_lane'
  | 'gate_desk'
  | 'seat_row'
  | 'bench'
  | 'shop_counter'
  | 'cafe_table'
  | 'wc_block'
  | 'claim_carousel'
  | 'passport_booth'
  | 'belt'
  | 'belt_incline'
  | 'bag_port'
  | 'fids'
  | 'wayfinding'
  | 'escalator'
  | 'stairs'
  | 'lift'
  | 'gate_head'

export interface Fitting {
  id: string
  kind: FittingKind
  /** Min corner, metres. Rot 0 extends +x and +y. Front is +y. */
  x: number
  y: number
  floor: number
  rot: 0 | 1 | 2 | 3
  /** 0–100. */
  wear: number
  staffed?: boolean
  gateId?: string
}

/** Empty growth slot. The same shape as a fitting, with no piece in it yet. */
export interface FittingSocket {
  id: string
  kind: FittingKind
  x: number
  y: number
  floor: number
  rot: 0 | 1 | 2 | 3
  gateId?: string
}

export interface BeltRun {
  id: string
  floor: number
  tiles: { x: number; y: number }[]
  dir: 'out' | 'in'
  incline?: { toFloor: number }
}

export interface Port {
  id: string
  kind: 'bag_out' | 'bag_in'
  edge: Edge
  /** `terminal:<hallId>:bag_out:<id>` */
  socket: string
}

/** A fitting the migration could not place. The player puts it back for free. */
export interface UnplacedFitting {
  id: string
  kind: FittingKind
  wear: number
  staffed?: boolean
  gateId?: string
  reason?: string
}

/**
 * One storey of tiles. The ground storey is `BuildLayout.floor` / `zones` /
 * `floorPaint` (index 0). Upper storeys live in `BuildLayout.slabs`.
 * Storing a slab does not walk it: `ENABLED_STORIES` stays 1 until WP6.
 */
export interface FloorSlab {
  index: number
  /** Metres above the ground slab. Ground is 0. The next storey is 5 m up. */
  elevationM: number
  tiles: boolean[][]
  zones: (BuildZone | null)[][]
  paint?: (string | null)[][]
}

/** A tile that joins two stories. Not offered in the editor while only floor 0 is enabled. */
export type VerticalKind = 'stairs' | 'escalator' | 'lift'

export interface Vertical {
  kind: VerticalKind
  x: number
  y: number
  /** Story the tile is walked from. Omitted means floor 0. */
  floor?: number
  /** The other story. Ignored until that story is enabled. */
  toFloor: number
}

export interface BuildLayout {
  /**
   * 2 is the 1 m terminal document. Missing means a legacy 4 m build.
   * The ground slab stays `floor` / `zones` / `floorPaint`. Upper slabs stay `slabs`.
   */
  version?: 2
  /** Metres per tile. Missing means 4. */
  tileM?: number
  w: number
  h: number
  /**
   * How many stories this layout is allowed to hold.
   * The starter is 1: arrivals and departures stay apart on the ground slab.
   * WP6 raises this to 2 (departures up, arrivals down). Omitted means 1.
   */
  stories?: number
  /** Ground-floor slab. This is storey 0. It is not shared with an upper slab. */
  floor: boolean[][]
  zones: (BuildZone | null)[][]
  walls: Edge[]
  doors: Door[]
  rooms: Room[]
  equipment: Equip[]
  /** Stairs, escalators, and lifts. Empty on a 1-story hall. */
  verticals?: Vertical[]
  /**
   * Storeys above the ground slab, keyed by `index` (1 and up).
   * A 1-story hall leaves this empty. The field is on the model from the start
   * so WP6 can fill floor 1 without a save migration of walls and furniture.
   */
  slabs?: FloorSlab[]
  /**
   * Floor paint per tile, same shape as `floor`. Omitted means the hall terrazzo.
   * Ids are the Gemini interior plates (see FLOOR_PAINTS).
   */
  floorPaint?: (string | null)[][]
  fittings?: Fitting[]
  belts?: BeltRun[]
  ports?: Port[]
  /** Empty growth slots. */
  sockets?: FittingSocket[]
  /** Fittings a migration could not place. */
  unplaced?: UnplacedFitting[]
}

/**
 * Player edits inside a shell. Merged onto the hall layout for the walk.
 * Pieces omit `floor` to mean floor 0. The game only enables floor 0.
 */
export interface InteriorEdit {
  walls: Edge[]
  doors: Door[]
  /** Edge keys removed from the base layout (an erased interior or security wall). */
  removed: string[]
  floorPaint: { x: number; y: number; paint: string; floor?: number }[]
  wallPaint: { x: number; y: number; dir: 'E' | 'S'; paint: string; floor?: number }[]
  /** Zone painted under a room. Null clears. */
  zones: { x: number; y: number; zone: BuildZone | null; floor?: number }[]
  rooms: Room[]
  equipment: Equip[]
  /**
   * Indoor floor the player dragged (Prison Architect foundations).
   * Omitted on saves from before the foundation tool. Floor 0 only.
   */
  foundation?: { x: number; y: number; floor?: number }[]
}

export interface Tile {
  x: number
  y: number
  /** Story. Omitted means floor 0. */
  floor?: number
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
