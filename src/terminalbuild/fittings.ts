/**
 * Fitting catalog. Prices, wear, upkeep, and service times are read from
 * ItemDef / KIT_ITEMS or EQUIP_SPEC. This file adds geometry, side, stage,
 * prop, and inspector fields. It does not keep a second price list for
 * kinds that already have one.
 */
import { EQUIP_SPEC } from './config.ts'
import { tileKey } from './grid.ts'
import type { StageId } from './stages.ts'
import { itemDef, type ItemId } from '../game/terminal.ts'
import type {
  BuildLayout,
  BuildZone,
  Equip,
  EquipKind,
  Fitting,
  FittingKind,
  RoomKind,
  ZoneSide,
} from './types.ts'

export interface FittingSpec {
  kind: FittingKind
  label: string
  blurb: string
  /** Footprint before rotation, metres. Rot 0 extends +x (w) and +y (d). Front is +y. */
  w: number
  d: number
  h: number
  /** Clear floor in front of the piece, metres. */
  clearance: number
  rooms: readonly RoomKind[]
  /** Zones the piece may stand on. Empty means the rooms decide. */
  zones: readonly BuildZone[]
  side: ZoneSide
  stage: StageId
  serviceSec: number
  servers: number
  staff: number
  cost: number
  upkeep: number
  wear: number
  prop: string
  /** False for rails, totems, and boards so a thin piece does not close a whole tile. */
  blocksWalk: boolean
  /** Where the price was read from. `proposed` is a new kind with no item yet. */
  priceFrom: string
}

interface PriceBits {
  cost: number
  upkeep: number
  staff: number
  serviceSec: number
  wear: number
  priceFrom: string
}

function fromItem(id: string): PriceBits {
  const d = itemDef(id)
  if (!d) throw new Error(`fitting price: missing item ${id}`)
  return {
    cost: d.cost,
    upkeep: d.upkeep,
    staff: d.staff,
    serviceSec: d.serviceSec,
    wear: d.wearPerUse,
    priceFrom: id,
  }
}

function fromEquip(kind: EquipKind): PriceBits {
  const s = EQUIP_SPEC[kind]
  return { cost: s.build, upkeep: s.upkeepPerDay, staff: 0, serviceSec: s.serviceSec, wear: 0, priceFrom: `equip:${kind}` }
}

/** Proposed numbers for kinds that have no item and no equip row yet. */
const PROPOSED: Record<string, PriceBits> = {
  bp_podium: { cost: 2_500, upkeep: 15, staff: 0, serviceSec: 2, wear: 0.2, priceFrom: 'proposed' },
  cafe_table: { cost: 400, upkeep: 2, staff: 0, serviceSec: 0, wear: 0.05, priceFrom: 'proposed' },
  belt_incline: { cost: 18_000, upkeep: 40, staff: 0, serviceSec: 0, wear: 0.2, priceFrom: 'proposed' },
  bag_port: { cost: 2_000, upkeep: 5, staff: 0, serviceSec: 0, wear: 0, priceFrom: 'proposed' },
  escalator: { cost: 220_000, upkeep: 60, staff: 0, serviceSec: 0, wear: 0.1, priceFrom: 'proposed' },
  stairs: { cost: 40_000, upkeep: 5, staff: 0, serviceSec: 0, wear: 0.05, priceFrom: 'proposed' },
  lift: { cost: 120_000, upkeep: 30, staff: 0, serviceSec: 0, wear: 0.1, priceFrom: 'proposed' },
  gate_head: { cost: 35_000, upkeep: 40, staff: 0, serviceSec: 0, wear: 0.1, priceFrom: 'proposed' },
}

interface Shape {
  kind: FittingKind
  label: string
  blurb: string
  w: number
  d: number
  h: number
  clearance: number
  rooms: readonly RoomKind[]
  zones: readonly BuildZone[]
  side: ZoneSide
  stage: StageId
  servers: number
  prop: string
  blocksWalk: boolean
  price: PriceBits
}

const SHAPES: readonly Shape[] = [
  {
    kind: 'checkin_desk',
    label: 'Check-in desk',
    blurb: 'Desk, agent space, weigh belt, and a takeaway belt.',
    w: 2.0,
    d: 2.6,
    h: 1.1,
    clearance: 1.2,
    rooms: ['checkin'],
    zones: ['checkin'],
    side: 'landside',
    stage: 'CHECKIN',
    servers: 1,
    prop: 'checkin_desk',
    blocksWalk: true,
    price: fromItem('checkin_belt'),
  },
  {
    kind: 'checkin_kiosk',
    label: 'Self check-in',
    blurb: 'A kiosk. It cannot take hold bags.',
    w: 0.6,
    d: 0.6,
    h: 1.6,
    clearance: 1.2,
    rooms: ['checkin'],
    zones: ['checkin', 'landside'],
    side: 'landside',
    stage: 'CHECKIN',
    servers: 1,
    prop: 'self_checkin_kiosk',
    blocksWalk: true,
    price: fromItem('kiosk'),
  },
  {
    kind: 'bag_drop',
    label: 'Bag drop',
    blurb: 'Kiosk, scale, and a short injection belt. Measured from the bag-drop builder.',
    w: 1.9,
    d: 1.9,
    h: 1.6,
    clearance: 1.0,
    rooms: ['checkin'],
    zones: ['checkin'],
    side: 'landside',
    stage: 'BAG_DROP',
    servers: 1,
    prop: 'bag_drop_kiosk',
    blocksWalk: true,
    price: fromItem('bag_drop'),
  },
  {
    kind: 'queue_rail',
    label: 'Queue rail',
    blurb: 'One metre of rail. It does not close the tile.',
    w: 1.0,
    d: 0.3,
    h: 1.0,
    clearance: 0,
    rooms: ['checkin', 'security', 'gate'],
    zones: ['checkin', 'security', 'gates'],
    side: 'landside',
    stage: 'CHECKIN',
    servers: 0,
    prop: 'stanchion_queue',
    blocksWalk: false,
    price: fromItem('queue_rail'),
  },
  {
    kind: 'bp_podium',
    label: 'Boarding-pass podium',
    blurb: 'The e-gate in front of a security lane.',
    w: 1.0,
    d: 2.0,
    h: 1.1,
    clearance: 0.6,
    rooms: ['security'],
    zones: ['security'],
    side: 'security',
    stage: 'SECURITY',
    servers: 1,
    prop: 'bp_podium',
    blocksWalk: false,
    price: PROPOSED.bp_podium,
  },
  {
    kind: 'security_lane',
    label: 'Security lane',
    blurb: 'Divest, x-ray, scanner, recompose. One lane.',
    w: 4.0,
    d: 10.0,
    h: 2.3,
    clearance: 1.0,
    rooms: ['security'],
    zones: ['security'],
    side: 'security',
    stage: 'SECURITY',
    servers: 1,
    prop: 'security_lane_ct',
    blocksWalk: false,
    price: fromItem('security_small'),
  },
  {
    kind: 'gate_desk',
    label: 'Boarding desk',
    blurb: 'Scans the pass at the gate.',
    w: 2.4,
    d: 1.2,
    h: 1.1,
    clearance: 1.0,
    rooms: ['gate'],
    zones: ['gates'],
    side: 'airside',
    stage: 'GATE_QUEUE',
    servers: 1,
    prop: 'gate_podium',
    blocksWalk: true,
    price: fromItem('boarding_desk'),
  },
  {
    kind: 'seat_row',
    label: 'Seat row',
    blurb: 'Three seats.',
    w: 1.95,
    d: 0.75,
    h: 0.45,
    clearance: 0.4,
    rooms: ['gate', 'lounge'],
    zones: ['gates', 'airside', 'landside'],
    side: 'airside',
    stage: 'GATE_HOLD',
    servers: 0,
    prop: 'seat_row',
    blocksWalk: true,
    price: fromItem('seat_row'),
  },
  {
    kind: 'bench',
    label: 'Bench',
    blurb: 'A public bench.',
    w: 1.8,
    d: 0.6,
    h: 0.45,
    clearance: 0.4,
    rooms: [],
    zones: ['landside', 'airside', 'gates', 'checkin', 'retail', 'claim', 'arrivals'],
    side: 'landside',
    stage: 'LANDSIDE_FREE',
    servers: 0,
    prop: 'seat_row',
    blocksWalk: false,
    price: fromItem('bench'),
  },
  {
    kind: 'shop_counter',
    label: 'Shop counter',
    blurb: 'A café, shop, or news counter.',
    w: 4.0,
    d: 1.0,
    h: 1.1,
    clearance: 1.0,
    rooms: ['retail'],
    zones: ['retail'],
    side: 'either',
    stage: 'LANDSIDE_FREE',
    servers: 1,
    prop: 'cafe_counter',
    blocksWalk: true,
    price: fromItem('cafe'),
  },
  {
    kind: 'cafe_table',
    label: 'Café table',
    blurb: 'Four seats.',
    w: 1.6,
    d: 1.6,
    h: 0.75,
    clearance: 0.4,
    rooms: ['retail'],
    zones: ['retail'],
    side: 'either',
    stage: 'LANDSIDE_FREE',
    servers: 0,
    prop: 'cafe_table',
    blocksWalk: true,
    price: PROPOSED.cafe_table,
  },
  {
    kind: 'wc_block',
    label: 'Toilet block',
    blurb: 'One cubicle and basins.',
    w: 1.0,
    d: 1.6,
    h: 2.1,
    clearance: 0.8,
    rooms: ['toilets'],
    zones: ['landside', 'airside'],
    side: 'landside',
    stage: 'LANDSIDE_FREE',
    servers: 1,
    prop: 'restroom_block',
    blocksWalk: true,
    price: fromItem('toilet'),
  },
  {
    kind: 'claim_carousel',
    label: 'Bag claim',
    blurb: 'Flat plate with a feed hood. The builder box is 15.21 × 4.56 m; the plan straight-run estimate of 14.4 × 4.2 left out the feed hood and trolley bay.',
    w: 15.21,
    d: 4.56,
    h: 0.46,
    clearance: 1.2,
    rooms: [],
    zones: ['claim'],
    side: 'sterile_arr',
    stage: 'CLAIM',
    servers: 1,
    prop: 'baggage_carousel',
    blocksWalk: true,
    price: fromItem('claim_carousel'),
  },
  {
    kind: 'passport_booth',
    label: 'Passport control',
    blurb: 'Three booths, one officer each. Claim and arrivals only. The builder box is 4.25 × 3.24 m; the plan desk row of 4.3 × 1.3 left out the queue rail and board.',
    w: 4.25,
    d: 3.24,
    h: 1.1,
    clearance: 1.3,
    rooms: [],
    zones: ['claim', 'arrivals'],
    side: 'sterile_arr',
    stage: 'PASSPORT',
    servers: 3,
    prop: 'passport_booth',
    blocksWalk: true,
    price: fromItem('passport_booth'),
  },
  {
    kind: 'belt',
    label: 'Bag belt',
    blurb: 'One metre of belt. Bags ride it. People do not.',
    w: 1.0,
    d: 0.8,
    h: 0.7,
    clearance: 0,
    rooms: [],
    zones: ['checkin', 'bagroom', 'claim'],
    side: 'staff',
    stage: 'BAG_DROP',
    servers: 0,
    prop: 'belt',
    blocksWalk: true,
    price: fromEquip('bag_belt'),
  },
  {
    kind: 'belt_incline',
    label: 'Belt incline',
    blurb: 'A 5 m rise for bags. The shaft is walled.',
    w: 0.8,
    d: 14.0,
    h: 5,
    clearance: 0,
    rooms: [],
    zones: ['bagroom', 'vertical'],
    side: 'staff',
    stage: 'BAG_DROP',
    servers: 0,
    prop: 'belt_incline',
    blocksWalk: true,
    price: PROPOSED.belt_incline,
  },
  {
    kind: 'bag_port',
    label: 'Bag port',
    blurb: 'A wall opening for the bag hall.',
    w: 1.2,
    d: 0.4,
    h: 1.0,
    clearance: 0,
    rooms: [],
    zones: [],
    side: 'staff',
    stage: 'BAG_DROP',
    servers: 0,
    prop: 'bag_port',
    blocksWalk: false,
    price: PROPOSED.bag_port,
  },
  {
    kind: 'fids',
    label: 'Flight screen',
    blurb: 'A departures board. It does not close the tile.',
    w: 3.0,
    d: 0.3,
    h: 1.8,
    clearance: 0.6,
    rooms: [],
    zones: ['landside', 'airside', 'checkin', 'gates', 'retail', 'claim'],
    side: 'landside',
    stage: 'LANDSIDE_FREE',
    servers: 0,
    prop: 'departures_board',
    blocksWalk: false,
    price: fromItem('info_screen'),
  },
  {
    kind: 'wayfinding',
    label: 'Wayfinding totem',
    blurb: 'A sign post. It does not close the tile.',
    w: 0.4,
    d: 0.4,
    h: 2.6,
    clearance: 0,
    rooms: [],
    zones: ['landside', 'airside', 'checkin', 'gates', 'retail', 'claim', 'arrivals'],
    side: 'landside',
    stage: 'LANDSIDE_FREE',
    servers: 0,
    prop: 'wayfinding_totem',
    blocksWalk: false,
    price: fromItem('wayfinding'),
  },
  {
    kind: 'escalator',
    label: 'Escalator',
    blurb: 'One direction, one storey. The upper floor is WP6.',
    w: 1.6,
    d: 14.0,
    h: 5,
    clearance: 1,
    rooms: [],
    zones: ['vertical', 'landside'],
    side: 'landside',
    stage: 'LANDSIDE_FREE',
    servers: 0,
    prop: 'escalator',
    blocksWalk: true,
    price: PROPOSED.escalator,
  },
  {
    kind: 'stairs',
    label: 'Stairs',
    blurb: 'Both ways, one storey. The upper floor is WP6.',
    w: 3.0,
    d: 10.0,
    h: 5,
    clearance: 1,
    rooms: [],
    zones: ['vertical', 'landside'],
    side: 'landside',
    stage: 'LANDSIDE_FREE',
    servers: 0,
    prop: 'stairs',
    blocksWalk: true,
    price: PROPOSED.stairs,
  },
  {
    kind: 'lift',
    label: 'Lift',
    blurb: 'A shaft both floors share. The upper floor is WP6.',
    w: 2.6,
    d: 2.6,
    h: 5,
    clearance: 1.2,
    rooms: [],
    zones: ['vertical', 'landside'],
    side: 'landside',
    stage: 'LANDSIDE_FREE',
    servers: 0,
    prop: 'lift',
    blocksWalk: true,
    price: PROPOSED.lift,
  },
  {
    kind: 'gate_head',
    label: 'Gate head',
    blurb: 'The vestibule a bought bridge docks to. The bridge stays on the apron.',
    w: 4.0,
    d: 6.0,
    h: 4.2,
    clearance: 1,
    rooms: ['gate'],
    zones: ['gates'],
    side: 'airside',
    stage: 'BOARD',
    servers: 0,
    prop: 'gate_head',
    blocksWalk: false,
    price: PROPOSED.gate_head,
  },
]

const CATALOG = new Map<FittingKind, FittingSpec>(
  SHAPES.map((s) => [
    s.kind,
    {
      kind: s.kind,
      label: s.label,
      blurb: s.blurb,
      w: s.w,
      d: s.d,
      h: s.h,
      clearance: s.clearance,
      rooms: s.rooms,
      zones: s.zones,
      side: s.side,
      stage: s.stage,
      serviceSec: s.price.serviceSec,
      servers: s.servers,
      staff: s.price.staff,
      cost: s.price.cost,
      upkeep: s.price.upkeep,
      wear: s.price.wear,
      prop: s.prop,
      blocksWalk: s.blocksWalk,
      priceFrom: s.price.priceFrom,
    },
  ]),
)

export const FITTING_KINDS = SHAPES.map((s) => s.kind)

export function fittingSpec(kind: FittingKind): FittingSpec {
  const s = CATALOG.get(kind)
  if (!s) throw new Error(`unknown fitting ${kind}`)
  return s
}

export function fittingSize(kind: FittingKind, rot: number): { w: number; d: number } {
  const s = fittingSpec(kind)
  const q = ((Math.round(rot) % 4) + 4) % 4
  return q % 2 === 0 ? { w: s.w, d: s.d } : { w: s.d, d: s.w }
}

/** Tiles the footprint covers. x,y is the min corner. */
export function fittingTiles(f: { kind: FittingKind; x: number; y: number; rot: number }): { x: number; y: number }[] {
  const { w, d } = fittingSize(f.kind, f.rot)
  const x0 = Math.floor(f.x)
  const y0 = Math.floor(f.y)
  const x1 = Math.ceil(f.x + w - 1e-6)
  const y1 = Math.ceil(f.y + d - 1e-6)
  const out: { x: number; y: number }[] = []
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out.push({ x, y })
  return out
}

/** Security kit. A lane or a boarding-pass podium only works in a security room. */
export function isSecurityKit(kind: FittingKind): boolean {
  return kind === 'security_lane' || kind === 'bp_podium'
}

/**
 * Room rule for a piece whose min corner is (x, y).
 * Null means the tile is allowed. The text is the finding detail.
 */
export function fittingRoomViolation(l: BuildLayout, kind: FittingKind, x: number, y: number): string | null {
  const tx = Math.floor(x)
  const ty = Math.floor(y)
  const zone = l.zones[ty]?.[tx] ?? null
  const side = zone ? (zone === 'claim' || zone === 'arrivals' ? 'sterile_arr' : null) : null
  let roomKind: string | null = null
  for (const r of l.rooms) {
    if (tx < r.x || ty < r.y || tx >= r.x + r.w || ty >= r.y + r.h) continue
    roomKind = r.kind
  }
  if (isSecurityKit(kind) && roomKind !== 'security') {
    return 'Security kit only works inside a security room.'
  }
  if (kind === 'passport_booth') {
    const sterile = zone === 'claim' || zone === 'arrivals' || side === 'sterile_arr'
    if (!sterile) return 'A passport booth only stands in baggage claim or the arrivals corridor.'
  }
  return null
}

/** Catalog item id for a fitting, when the kit renderer has a model for it. */
export const FITTING_ITEM: Partial<Record<FittingKind, ItemId>> = {
  checkin_desk: 'checkin_belt',
  checkin_kiosk: 'kiosk',
  bag_drop: 'bag_drop',
  queue_rail: 'queue_rail',
  security_lane: 'security_small',
  gate_desk: 'boarding_desk',
  seat_row: 'seat_row',
  bench: 'bench',
  shop_counter: 'cafe',
  wc_block: 'toilet',
  claim_carousel: 'claim_carousel',
  passport_booth: 'passport_booth',
  fids: 'info_screen',
  wayfinding: 'wayfinding',
}

/** Placed catalog item → fitting. Kinds with no row are not written onto the layout. */
export const ITEM_TO_FITTING: Partial<Record<string, FittingKind>> = {
  checkin_belt: 'checkin_desk',
  checkin_express: 'checkin_desk',
  kiosk: 'checkin_kiosk',
  bag_drop: 'bag_drop',
  security_small: 'security_lane',
  security_medium: 'security_lane',
  security_large: 'security_lane',
  scanner: 'security_lane',
  boarding_desk: 'gate_desk',
  seat_row: 'seat_row',
  bench: 'bench',
  cafe: 'shop_counter',
  fast_food: 'shop_counter',
  newsagent: 'shop_counter',
  restaurant: 'shop_counter',
  toilet: 'wc_block',
  toilet_plus: 'wc_block',
  claim_carousel: 'claim_carousel',
  passport_booth: 'passport_booth',
  queue_rail: 'queue_rail',
  wayfinding: 'wayfinding',
  info_screen: 'fids',
}

/** Queued kit the existing walk still reads as Equip. */
export const FITTING_EQUIP: Partial<Record<FittingKind, EquipKind>> = {
  checkin_desk: 'checkin_desk',
  checkin_kiosk: 'checkin_desk',
  security_lane: 'security_lane',
  gate_desk: 'gate_desk',
  wc_block: 'toilet',
  shop_counter: 'shop_counter',
}

export function equipForFitting(f: Fitting, at: { x: number; y: number }): Equip | null {
  const kind = FITTING_EQUIP[f.kind]
  if (!kind) return null
  return { id: f.id, kind, x: at.x, y: at.y, wear: f.wear, floor: f.floor }
}

/** First empty socket of this kind that passes the room rule, else null. */
export function takeFittingSocket(l: BuildLayout, kind: FittingKind): { x: number; y: number; rot: 0 | 1 | 2 | 3; id: string } | null {
  const taken = new Set<string>()
  for (const f of l.fittings ?? []) taken.add(`${f.kind}@${f.x},${f.y}`)
  for (const s of l.sockets ?? []) {
    if (s.kind !== kind) continue
    if (taken.has(`${s.kind}@${s.x},${s.y}`)) continue
    if (fittingRoomViolation(l, kind, s.x, s.y)) continue
    return { x: s.x, y: s.y, rot: s.rot, id: s.id }
  }
  return null
}

/** Tiles a belt run occupies. */
export function beltTileSet(l: BuildLayout): Set<string> {
  const out = new Set<string>()
  for (const b of l.belts ?? []) for (const t of b.tiles) out.add(tileKey(t.x, t.y, b.floor))
  return out
}

/** Directed belt walk from a start tile (or a tile touching the belt) to a port. */
export function beltReachesPort(l: BuildLayout, start: { x: number; y: number }, portKind: 'bag_out' | 'bag_in'): boolean {
  const belts = (l.belts ?? []).filter((b) => (portKind === 'bag_out' ? b.dir === 'out' : b.dir === 'in'))
  const tiles = new Set<string>()
  for (const b of belts) for (const t of b.tiles) tiles.add(tileKey(t.x, t.y))
  if (!tiles.size) return false
  const goals = new Set<string>()
  for (const p of l.ports ?? []) {
    if (p.kind !== portKind) continue
    const [a, b] = edgeTilesOf(p.edge)
    for (const t of [a, b]) if (tiles.has(tileKey(t.x, t.y))) goals.add(tileKey(t.x, t.y))
  }
  if (!goals.size) return false
  const q: { x: number; y: number }[] = []
  const seen = new Set<string>()
  const push = (t: { x: number; y: number }) => {
    const k = tileKey(t.x, t.y)
    if (seen.has(k) || !tiles.has(k)) return
    seen.add(k)
    q.push(t)
  }
  push(start)
  if (!tiles.has(tileKey(start.x, start.y))) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) push({ x: start.x + dx, y: start.y + dy })
  }
  for (let i = 0; i < q.length; i++) {
    const n = q[i]
    if (goals.has(tileKey(n.x, n.y))) return true
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) push({ x: n.x + dx, y: n.y + dy })
  }
  return false
}

function edgeTilesOf(e: { x: number; y: number; dir: 'E' | 'S' }): [{ x: number; y: number }, { x: number; y: number }] {
  return e.dir === 'E'
    ? [
        { x: e.x, y: e.y },
        { x: e.x + 1, y: e.y },
      ]
    : [
        { x: e.x, y: e.y },
        { x: e.x, y: e.y + 1 },
      ]
}
