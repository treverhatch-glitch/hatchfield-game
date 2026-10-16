/** Tunables for the build-from-scratch terminal. Logic reads these, never literals. */
import type { BuildZone, DoorKind, EquipKind, RoomKind, ZoneSide } from './types.ts'

export const BUILD_TUNING = {
  /** Real metres per build tile. */
  tileMetres: 4,
  /** Average walking speed, m/s. */
  walkMps: 1.3,
  /** Bag belt speed, m/s. */
  beltMps: 0.5,
  /** Fraction of the build price refunded when a piece is removed. */
  refundShare: 0.4,
  /** Wear added per passenger or bag served. */
  wearPerUse: 0.02,
  /** Service time multiplier at 100 wear. */
  wornSlowdown: 1.5,
  /** Departing passengers reach the curb spread over this window... */
  showUpEarlySec: 2 * 3600,
  /** ...ending this long before departure. */
  showUpLateSec: 50 * 60,
  /** Seconds between arriving passengers stepping off. */
  deboardGapSec: 3,
  /** Boarding must finish this long before departure. */
  gateCloseSec: 5 * 60,
  /** Bags must reach make-up this long before departure to be loaded. */
  bagCutoffSec: 10 * 60,
} as const

export const FLOOR_COST = { build: 900, upkeepPerDay: 2 }
export const WALL_COST = { build: 400, upkeepPerDay: 1 }

export const DOOR_COST: Record<DoorKind, { build: number; upkeepPerDay: number }> = {
  public: { build: 1_200, upkeepPerDay: 3 },
  curb: { build: 6_000, upkeepPerDay: 12 },
  apron: { build: 8_000, upkeepPerDay: 15 },
  staff: { build: 1_500, upkeepPerDay: 3 },
  exit: { build: 4_000, upkeepPerDay: 8 },
  gate_bridge: { build: 8_000, upkeepPerDay: 15 },
  gate_apron: { build: 8_000, upkeepPerDay: 15 },
  arrivals_in: { build: 8_000, upkeepPerDay: 15 },
}

/** Metres on a side. A layout with no `tileM` is the legacy 4 m tile. */
export function layoutTileM(l: { tileM?: number } | null | undefined): number {
  const m = l?.tileM
  return m == null || !Number.isFinite(m) || m <= 0 ? BUILD_TUNING.tileMetres : m
}

/** Legacy 4 m tile stays 900. A 1 m tile is 56.25. */
export function floorTileCost(tileM: number): number {
  return (FLOOR_COST.build * tileM * tileM) / 16
}

export function floorTileUpkeep(tileM: number): number {
  return (FLOOR_COST.upkeepPerDay * tileM * tileM) / 16
}

/** Legacy 4 m edge stays 400. A 1 m edge is 100. */
export function wallEdgeCost(tileM: number): number {
  return (WALL_COST.build * tileM) / 4
}

export function wallEdgeUpkeep(tileM: number): number {
  return (WALL_COST.upkeepPerDay * tileM) / 4
}

/** Legacy 4 m zone paint stays 150. A 1 m tile is 9.375. */
export function zoneTileCost(tileM: number): number {
  return (ZONE_COST.build * tileM * tileM) / 16
}

export function zoneTileUpkeep(tileM: number): number {
  return (ZONE_COST.upkeepPerDay * tileM * tileM) / 16
}

/** Zone paint is per tile. */
export const ZONE_COST = { build: 150, upkeepPerDay: 0.5 }

export const ZONE_SIDE: Record<BuildZone, ZoneSide> = {
  landside: 'landside',
  checkin: 'landside',
  security: 'security',
  airside: 'airside',
  gates: 'airside',
  baggage: 'staff',
  retail: 'either',
  office: 'staff',
  claim: 'sterile_arr',
  arrivals: 'sterile_arr',
  vertical: 'staff',
  bagroom: 'staff',
}

/** Player-facing names. Never "landside" / "airside". */
export const ZONE_LABEL: Record<BuildZone, string> = {
  landside: 'Hall (before security)',
  checkin: 'Check-in',
  security: 'Security',
  airside: 'Hall (after security)',
  gates: 'Gates',
  baggage: 'Baggage',
  retail: 'Shops',
  office: 'Office',
  claim: 'Baggage claim',
  arrivals: 'Arrivals corridor',
  vertical: 'Stairs and lifts',
  bagroom: 'Bag room',
}

export interface RoomSpec {
  label: string
  /** Zones the whole room footprint must sit on. */
  zones: BuildZone[]
  /** Equipment the room cannot work without. */
  needs: EquipKind[]
  /** Must exist for the terminal to run. */
  required: boolean
  build: number
  upkeepPerDay: number
}

export const ROOM_SPEC: Record<RoomKind, RoomSpec> = {
  checkin: { label: 'Check-in hall', zones: ['checkin'], needs: ['checkin_desk'], required: true, build: 20_000, upkeepPerDay: 40 },
  security: { label: 'Security checkpoint', zones: ['security'], needs: ['security_lane'], required: true, build: 35_000, upkeepPerDay: 80 },
  gate: { label: 'Gate', zones: ['gates'], needs: ['gate_desk'], required: true, build: 25_000, upkeepPerDay: 50 },
  bagmakeup: { label: 'Bag make-up', zones: ['baggage'], needs: ['makeup_carousel'], required: true, build: 30_000, upkeepPerDay: 60 },
  retail: { label: 'Shops', zones: ['retail'], needs: ['shop_counter'], required: false, build: 12_000, upkeepPerDay: 20 },
  toilets: { label: 'Restroom', zones: ['landside', 'airside', 'retail', 'checkin', 'gates'], needs: ['toilet'], required: false, build: 10_000, upkeepPerDay: 25 },
  lounge: { label: 'Lounge', zones: ['airside', 'retail', 'gates'], needs: ['seat'], required: false, build: 18_000, upkeepPerDay: 35 },
  office: { label: 'Office', zones: ['office'], needs: ['office_desk'], required: false, build: 14_000, upkeepPerDay: 22 },
}

export interface EquipSpec {
  label: string
  /** Room kinds it may sit in. Empty = any floor tile (belts). */
  rooms: RoomKind[]
  /** Passengers stand next to it to be served. */
  servesPax: boolean
  /** Passengers walk through its tile (security lanes). */
  walkThrough: boolean
  /** Seconds per passenger (or per bag for bag kit). 0 = no service. */
  serviceSec: number
  build: number
  upkeepPerDay: number
}

export const EQUIP_SPEC: Record<EquipKind, EquipSpec> = {
  checkin_desk: { label: 'Check-in desk', rooms: ['checkin'], servesPax: true, walkThrough: false, serviceSec: 75, build: 8_000, upkeepPerDay: 15 },
  security_lane: { label: 'Security lane', rooms: ['security'], servesPax: true, walkThrough: true, serviceSec: 30, build: 45_000, upkeepPerDay: 60 },
  gate_desk: { label: 'Boarding desk', rooms: ['gate'], servesPax: true, walkThrough: false, serviceSec: 8, build: 6_000, upkeepPerDay: 10 },
  bag_belt: { label: 'Bag belt', rooms: [], servesPax: false, walkThrough: false, serviceSec: 0, build: 2_500, upkeepPerDay: 4 },
  makeup_carousel: { label: 'Make-up carousel', rooms: ['bagmakeup'], servesPax: false, walkThrough: false, serviceSec: 20, build: 40_000, upkeepPerDay: 55 },
  seat: { label: 'Seat row', rooms: ['gate', 'retail', 'lounge'], servesPax: false, walkThrough: false, serviceSec: 0, build: 900, upkeepPerDay: 1 },
  shop_counter: { label: 'Shop counter', rooms: ['retail'], servesPax: true, walkThrough: false, serviceSec: 60, build: 7_000, upkeepPerDay: 12 },
  toilet: { label: 'Toilet block', rooms: ['toilets'], servesPax: true, walkThrough: false, serviceSec: 90, build: 9_000, upkeepPerDay: 18 },
  office_desk: { label: 'Office desk', rooms: ['office'], servesPax: false, walkThrough: false, serviceSec: 0, build: 4_000, upkeepPerDay: 8 },
  bag_drop: { label: 'Bag drop', rooms: ['checkin'], servesPax: true, walkThrough: false, serviceSec: 40, build: 12_000, upkeepPerDay: 18 },
  passport_booth: { label: 'Passport booth', rooms: [], servesPax: true, walkThrough: false, serviceSec: 20, build: 18_000, upkeepPerDay: 22 },
}

/** Gemini interior plates the player can paint. Ids match `INTERIOR_TILES`. */
export const FLOOR_PAINTS = [
  { id: 'floor_terrazzo', label: 'Terrazzo' },
  { id: 'floor_carpet', label: 'Carpet' },
  { id: 'gate_carpet', label: 'Gate carpet' },
  { id: 'floor_restroom', label: 'Restroom floor' },
  { id: 'security_rubber', label: 'Security rubber' },
  { id: 'shop_plank', label: 'Shop plank' },
  { id: 'lounge_wood', label: 'Lounge wood' },
  { id: 'jet_runner', label: 'Jet runner' },
] as const

export const WALL_PAINTS = [
  { id: 'wall_panel', label: 'Panel' },
  { id: 'wall_panel_cream', label: 'Cream panel' },
  { id: 'wall_tile', label: 'Wall tile' },
  { id: 'wall_stall', label: 'Stall' },
  { id: 'restroom_tile', label: 'Restroom wall' },
  { id: 'office_panel', label: 'Office panel' },
  { id: 'oak_veneer', label: 'Oak' },
  { id: 'brushed_steel', label: 'Steel' },
  { id: 'jetbridge_panel', label: 'Jet bridge' },
] as const

export type FloorPaintId = (typeof FLOOR_PAINTS)[number]['id']
export type WallPaintId = (typeof WALL_PAINTS)[number]['id']

export const PAINT_COST = { floor: 80, wall: 60 }
