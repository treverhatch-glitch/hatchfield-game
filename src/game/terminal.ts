/**
 * Terminal interior — prefab ceilings, painted zones, MVP items.
 *
 * Service times in this file are sim-seconds. The spec's real-world seconds
 * (a 45s screening) are compressed onto the sim clock, where one hour is 7.5s,
 * so a lane is felt without freezing the first flight.
 */
import { hallPath, isAirside, openForGuest, type HallNode } from './guests.ts'
import { KIT_ITEMS, KIT_PATCHES, type KitCategory } from './terminalKitData.ts'

export type ZoneId = 'checkin' | 'security' | 'gates' | 'arrivals' | 'retail' | 'toilets'

export type ItemId =
  | 'entrance'
  | 'queue_rail'
  | 'checkin_belt'
  | 'kiosk'
  | 'checkin_express'
  | 'security_small'
  | 'security_medium'
  | 'security_large'
  | 'secure_exit'
  | 'seat_row'
  | 'boarding_desk'
  | 'claim_carousel'
  | 'bag_system'
  | 'toilet'
  | 'toilet_plus'
  | 'cafe'
  | 'restaurant'
  | 'wayfinding'
  | 'fast_food'
  | 'bench'
  | 'plant'
  | 'art'
  | 'info_screen'
  | 'info_kiosk'
  | 'fountain'

export const GRID_C = 8
export const GRID_R = 5
export const HALL_W = 48
export const HALL_D = 32

/** RCT junction cap. Each wayfinding sign adds two more junctions. */
export const JUNCTION_CAP = 5

export interface ZoneDef {
  id: ZoneId
  label: string
  /** Player-facing side. Never "landside" / "airside". */
  side: string
  color: string
}

export const ZONES: ZoneDef[] = [
  { id: 'checkin', label: 'Check-in', side: 'Before security', color: '#7eb6e0' },
  { id: 'security', label: 'Security', side: 'The choke', color: '#c45c5c' },
  { id: 'gates', label: 'Gates', side: 'After security', color: '#2f5f9a' },
  { id: 'arrivals', label: 'Arrivals', side: 'Claim', color: '#e08a3c' },
  { id: 'retail', label: 'Shops / Food', side: 'Either side', color: '#e0c04a' },
  { id: 'toilets', label: 'Toilets', side: 'Either side', color: '#3a9a8a' },
]

export function zoneDef(id: ZoneId): ZoneDef {
  return ZONES.find((z) => z.id === id) ?? ZONES[0]
}

export interface ItemDef {
  id: ItemId
  name: string
  blurb: string
  zones: ZoneId[]
  servers: number
  queueCap: number
  /** Sim-seconds per guest at one server. 0 = a flow point, not a desk. */
  serviceSec: number
  /** Passengers per minute when this is a door / exit rather than a desk. */
  flowPerMin?: number
  cost: number
  /** $/game-day. Prefab bundles discount this; placed items pay it. */
  upkeep: number
  staff: number
  minFieldLevel: number
  wearPerUse: number
  perk?: string
  /** Extra bodies the hall can hold. */
  paxCap?: number
  bagAllowance?: number
  /** Room graph this item opens. */
  room?: 'checkin' | 'security' | 'gate' | 'bagclaim' | 'bathroom' | 'food' | 'bagdrop'
  signs?: number
  /** Build-bar category for the terminal kit. */
  category?: KitCategory
  /** Cell slots this item takes (of 4). Missing means the whole cell. */
  size?: 1 | 2 | 4
  /** Seats a waiting guest can take. */
  seats?: number
  /** Comfort points at the item's own cell. Fades out to `comfortRadius` cells. */
  comfort?: number
  comfortRadius?: number
}

const BASE_ITEMS: ItemDef[] = [
  {
    id: 'entrance',
    name: 'Entrance doors',
    blurb: 'Curb doors. Counts the flow in and out.',
    zones: ['checkin'],
    servers: 1,
    queueCap: 0,
    serviceSec: 0,
    flowPerMin: 20,
    cost: 2000,
    upkeep: 10,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
  },
  {
    id: 'queue_rail',
    name: 'Queue rail',
    blurb: 'Two waiting spots. Longer lines need more rails.',
    zones: ['checkin', 'security', 'gates', 'arrivals', 'retail', 'toilets'],
    servers: 0,
    queueCap: 2,
    serviceSec: 0,
    cost: 100,
    upkeep: 1,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
  },
  {
    id: 'checkin_belt',
    name: 'Check-in desk',
    blurb: 'Tickets and hold bags onto the belt. Slow when the belt is full.',
    zones: ['checkin'],
    servers: 1,
    queueCap: 12,
    serviceSec: 4,
    cost: 6000,
    upkeep: 70,
    staff: 1,
    minFieldLevel: 1,
    wearPerUse: 0.4,
    room: 'checkin',
  },
  {
    id: 'kiosk',
    name: 'Self check-in',
    blurb: 'Faster ticket, no hold bags. Bags still need a desk.',
    zones: ['checkin'],
    servers: 1,
    queueCap: 4,
    serviceSec: 1.7,
    cost: 4000,
    upkeep: 15,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0.2,
    perk: 'Faster, but it cannot take hold bags',
    room: 'checkin',
  },
  {
    id: 'checkin_express',
    name: 'Twin check-in',
    blurb: 'Two agents. Clears a bank faster and costs more to staff.',
    zones: ['checkin'],
    servers: 2,
    queueCap: 16,
    serviceSec: 3.2,
    cost: 11000,
    upkeep: 120,
    staff: 2,
    minFieldLevel: 2,
    wearPerUse: 0.5,
    perk: 'Two agents — higher wage bill',
    room: 'checkin',
  },
  {
    id: 'security_small',
    name: 'Small security lane',
    blurb: 'The only way from the curb side to the gates. One scanner.',
    zones: ['security'],
    servers: 1,
    queueCap: 10,
    serviceSec: 3,
    cost: 8000,
    upkeep: 80,
    staff: 1,
    minFieldLevel: 1,
    wearPerUse: 0.8,
    room: 'security',
  },
  {
    id: 'security_medium',
    name: 'Medium security lane',
    blurb: 'Two scanners. Quicker banks, a much larger wage bill.',
    zones: ['security'],
    servers: 2,
    queueCap: 20,
    serviceSec: 2,
    cost: 18000,
    upkeep: 200,
    staff: 4,
    minFieldLevel: 2,
    wearPerUse: 0.6,
    perk: 'Two lanes — do not buy this for a quiet field',
    room: 'security',
  },
  {
    id: 'security_large',
    name: 'Large security lane',
    blurb: 'Three scanners. The wage bill hurts if the bank is thin.',
    zones: ['security'],
    servers: 3,
    queueCap: 30,
    serviceSec: 1.4,
    cost: 30000,
    upkeep: 260,
    staff: 5,
    minFieldLevel: 3,
    wearPerUse: 0.5,
    perk: 'Three lanes — highest upkeep in the hall',
    room: 'security',
  },
  {
    id: 'secure_exit',
    name: 'Secure exit',
    blurb: 'Arrivals leave the gate side without being screened again.',
    zones: ['security', 'arrivals'],
    servers: 1,
    queueCap: 0,
    serviceSec: 0,
    flowPerMin: 30,
    cost: 1500,
    upkeep: 10,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
  },
  {
    id: 'seat_row',
    name: 'Seat row',
    blurb: 'Four seats. Raises how many people the hall can hold.',
    zones: ['gates', 'arrivals'],
    servers: 0,
    queueCap: 4,
    serviceSec: 0,
    cost: 600,
    upkeep: 2,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0.1,
    paxCap: 4,
    room: 'gate',
  },
  {
    id: 'boarding_desk',
    name: 'Boarding desk',
    blurb: 'Scans the pass and releases people to the jetway.',
    zones: ['gates'],
    servers: 1,
    queueCap: 8,
    serviceSec: 0.6,
    cost: 3000,
    upkeep: 40,
    staff: 1,
    minFieldLevel: 1,
    wearPerUse: 0.3,
    room: 'gate',
  },
  {
    id: 'claim_carousel',
    name: 'Bag claim',
    blurb: 'Arrivals wait here. A small belt cannot swallow a widebody.',
    zones: ['arrivals'],
    servers: 1,
    queueCap: 30,
    serviceSec: 0,
    cost: 12000,
    upkeep: 60,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0.3,
    bagAllowance: 40,
    room: 'bagclaim',
  },
  {
    id: 'bag_system',
    name: 'Bag hall',
    blurb: 'Belt plus the hall behind the desks. More bags, more handlers.',
    zones: ['checkin', 'arrivals'],
    servers: 1,
    queueCap: 0,
    serviceSec: 1.4,
    cost: 16800,
    upkeep: 90,
    staff: 2,
    minFieldLevel: 1,
    wearPerUse: 0.4,
    bagAllowance: 50,
    room: 'bagdrop',
  },
  {
    id: 'toilet',
    name: 'Toilet block',
    blurb: 'Six stalls. Dirt rises; a scrub is part of the cost.',
    zones: ['toilets'],
    servers: 6,
    queueCap: 8,
    serviceSec: 4,
    cost: 5000,
    upkeep: 30,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 1.1,
    room: 'bathroom',
  },
  {
    id: 'toilet_plus',
    name: 'Family toilets',
    blurb: 'More stalls. The cleaner bill is higher every day.',
    zones: ['toilets'],
    servers: 8,
    queueCap: 12,
    serviceSec: 3.2,
    cost: 9000,
    upkeep: 55,
    staff: 0,
    minFieldLevel: 2,
    wearPerUse: 0.8,
    perk: 'More stalls — higher cleaner bill',
    room: 'bathroom',
  },
  {
    id: 'cafe',
    name: 'Café kiosk',
    blurb: 'A small hunger fix. Quiet hours still pay the upkeep.',
    zones: ['retail'],
    servers: 1,
    queueCap: 6,
    serviceSec: 2,
    cost: 4000,
    upkeep: 30,
    staff: 1,
    minFieldLevel: 1,
    wearPerUse: 0.3,
    room: 'food',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    blurb: 'Feeds a crowd and keeps them. Slow, and expensive to run.',
    zones: ['retail'],
    servers: 2,
    queueCap: 12,
    serviceSec: 8,
    cost: 15000,
    upkeep: 90,
    staff: 3,
    minFieldLevel: 3,
    wearPerUse: 0.4,
    perk: 'Big spend — long dwell, high upkeep',
    room: 'food',
  },
  {
    id: 'wayfinding',
    name: 'Wayfinding sign',
    blurb: 'Extends how far people can plan a path. Each sign adds two junctions.',
    zones: ['checkin', 'gates', 'arrivals', 'retail'],
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 800,
    upkeep: 5,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    perk: 'Lost people find the next turn',
    signs: 1,
  },
]

export const ITEMS: ItemDef[] = [
  ...BASE_ITEMS.map((d) => ({ ...d, ...KIT_PATCHES[d.id] })),
  ...KIT_ITEMS,
]

const ITEM_MAP = new Map(ITEMS.map((i) => [i.id, i]))

export function itemDef(id: string): ItemDef | undefined {
  return ITEM_MAP.get(id as ItemId)
}

export function itemsForZone(zone: ZoneId): ItemDef[] {
  return ITEMS.filter((i) => i.zones.includes(zone))
}

/** Parallel servers / service time, as passengers per minute. */
export function paxPerMin(servers: number, serviceSec: number): number {
  if (servers <= 0) return 0
  if (serviceSec <= 0) return 0
  return (servers / serviceSec) * 60
}

export function itemThroughput(def: ItemDef): number {
  if (def.flowPerMin) return def.flowPerMin
  return paxPerMin(def.servers, def.serviceSec)
}

/**
 * Prefab security tuning. Crowd avoidance stays unwired until after playtest.
 * A worn-out lane runs at most ×1.5 (wear 100), not ×2. A janitor still matters.
 */
export const WORN_LANE_DIVISOR = 200
/** Each body past the comfort cap adds 2%, and the slowdown stops at ×1.4. */
export const OVER_CAP_PER_BODY = 0.02
export const OVER_CAP_MAX = 1.4
/** Departing passengers reach the doors across this window instead of in one burst. */
export const DEPARTURE_SPREAD_SEC = 45
/** An unstaffed lane. The player still hires the post. */
export const UNSTAFFED_LANE = 1.35
/** Wear added per body on a prefab bundle lane. */
export const PREFAB_WEAR_PER_PAX = 0.7

export function slowedService(serviceSec: number, wear: number): number {
  return serviceSec * (1 + Math.max(0, wear) / WORN_LANE_DIVISOR)
}

/** Service-time multiplier once the security node is past its comfort cap. */
export function overCapMultiplier(bodies: number, cap: number): number {
  if (bodies <= cap) return 1
  return Math.min(OVER_CAP_MAX, 1 + (bodies - cap) * OVER_CAP_PER_BODY)
}

export function needsMaintenance(wear: number): boolean {
  return wear >= 55
}

export function lookaheadDepth(signs: number): number {
  return JUNCTION_CAP + Math.max(0, Math.floor(signs)) * 2
}

export interface ServiceQueue {
  waiting: string[]
  serving: { id: string; left: number }[]
}

export interface LaneStats {
  servers: number
  serviceSec: number
  queueCap: number
  wearPerUse: number
}

/**
 * One slice of a multi-server queue.
 * Arrivals that do not fit in queueCap + servers are turned away (lost).
 */
export function stepLane(
  state: ServiceQueue,
  dt: number,
  lane: Pick<LaneStats, 'servers' | 'serviceSec' | 'queueCap'>,
  arrivals: string[],
): { finished: string[]; turnedAway: string[] } {
  const finished: string[] = []
  const turnedAway: string[] = []
  for (const s of state.serving) s.left -= dt
  state.serving = state.serving.filter((s) => {
    if (s.left <= 0) {
      finished.push(s.id)
      return false
    }
    return true
  })
  const seen = new Set<string>([...state.waiting, ...state.serving.map((s) => s.id)])
  for (const id of arrivals) {
    if (seen.has(id)) continue
    if (state.waiting.length + state.serving.length >= lane.queueCap + Math.max(0, lane.servers)) {
      turnedAway.push(id)
      continue
    }
    state.waiting.push(id)
    seen.add(id)
  }
  while (state.serving.length < lane.servers && state.waiting.length) {
    const id = state.waiting.shift()!
    state.serving.push({ id, left: lane.serviceSec })
  }
  return { finished, turnedAway }
}

/** Gate is only legal if security appears earlier on the path. */
export function pathClearsSecurity(path: HallNode[] | null, goal: HallNode = 'gate'): boolean {
  if (!path) return false
  const goalI = path.indexOf(goal)
  if (goalI < 0) return false
  if (!isAirside(goal)) return true
  const secI = path.indexOf('security')
  return secI >= 0 && secI < goalI
}

/**
 * Can an uncleared departure reach the gate?
 * Security has to be open, and both legs have to fit in the junction cap.
 */
export function unclearedReachesGate(open: Set<HallNode>, depth = JUNCTION_CAP): boolean {
  const locked = openForGuest(open, false)
  if (!locked.has('security')) return false
  const toSec = hallPath('entrance', 'security', locked, depth)
  if (!toSec) return false
  const cleared = openForGuest(open, true)
  const toGate = hallPath('security', 'gate', cleared, depth)
  if (!toGate) return false
  return pathClearsSecurity([...toSec, ...toGate.slice(1)], 'gate')
}

export interface PrefabTier {
  tier: 1 | 2 | 3
  label: string
  paxCap: number
  servers: number
  serviceSec: number
  queueCap: number
  bagAllowance: number
  upkeepDay: number
  /** Cash to reach this tier from the one below. Tier 1 is the kit. */
  upgradeCost: number
}

export const PREFAB_TIERS: Record<1 | 2 | 3, PrefabTier> = {
  1: {
    tier: 1,
    label: 'Prefab I · Linear',
    paxCap: 40,
    servers: 2,
    serviceSec: 3.5,
    queueCap: 10,
    bagAllowance: 70,
    upkeepDay: 90,
    upgradeCost: 0,
  },
  2: {
    tier: 2,
    label: 'Prefab II · Pier',
    paxCap: 48,
    servers: 3,
    serviceSec: 3,
    queueCap: 20,
    bagAllowance: 140,
    upkeepDay: 220,
    upgradeCost: 22000,
  },
  3: {
    tier: 3,
    label: 'Prefab III · Satellites',
    paxCap: 80,
    servers: 4,
    serviceSec: 2.5,
    queueCap: 30,
    bagAllowance: 260,
    upkeepDay: 420,
    upgradeCost: 48000,
  },
}

export interface PlacedItem {
  id: string
  def: ItemId
  c: number
  r: number
  wear: number
  /** Included in the prefab price. Extra stamps pay full upkeep. */
  bundle?: boolean
  /** Quarter turns, set with R while placing. */
  rot?: number
  /** Food sales taken at this outlet. */
  revenue?: number
}

export interface Ceilings {
  paxCap: number
  secPerMin: number
  bagAllowance: number
  upkeepDay: number
  servers: number
  serviceSec: number
  queueCap: number
  wearPerUse: number
}

export interface CeilingInput {
  premade: boolean
  redesigned?: boolean
  tier?: 1 | 2 | 3
  items?: PlacedItem[]
  roomsSecurity?: number
}

function extraOf(items: PlacedItem[], pick: (def: ItemDef) => number): number {
  let n = 0
  for (const it of items) {
    const def = itemDef(it.def)
    if (def) n += pick(def)
  }
  return n
}

export function ceilingsFor(fit: CeilingInput): Ceilings {
  const items = fit.items ?? []
  const extras = items.filter((i) => !i.bundle)
  if (fit.premade && !fit.redesigned) {
    const t = PREFAB_TIERS[fit.tier ?? 1]
    const extraSec = extras
      .filter((i) => itemDef(i.def)?.room === 'security')
      .reduce((s, i) => s + itemThroughput(itemDef(i.def)!), 0)
    return {
      paxCap: t.paxCap + extraOf(extras, (d) => d.paxCap ?? Math.round(d.queueCap / 4)),
      secPerMin: paxPerMin(t.servers, t.serviceSec) + extraSec,
      bagAllowance: t.bagAllowance + extraOf(extras, (d) => d.bagAllowance ?? 0),
      upkeepDay: t.upkeepDay + extraOf(extras, (d) => d.upkeep),
      servers: t.servers,
      serviceSec: t.serviceSec,
      queueCap: t.queueCap,
      wearPerUse: PREFAB_WEAR_PER_PAX,
    }
  }
  if (!fit.premade && !fit.redesigned && items.length === 0) {
    const servers = Math.max(0, fit.roomsSecurity ?? 0)
    return {
      paxCap: 48,
      secPerMin: servers > 0 ? paxPerMin(servers, 3) : 0,
      bagAllowance: 80,
      upkeepDay: 0,
      servers,
      serviceSec: 3,
      queueCap: Math.max(10, servers * 10),
      wearPerUse: 0.8,
    }
  }
  const secItems = items.filter((i) => itemDef(i.def)?.room === 'security')
  const servers = secItems.reduce((s, i) => s + (itemDef(i.def)?.servers ?? 0), 0)
  const serviceSec = secItems.reduce((s, i) => {
    const d = itemDef(i.def)
    if (!d || d.serviceSec <= 0) return s
    return s === 0 ? d.serviceSec : Math.min(s, d.serviceSec)
  }, 0)
  const queueCap = secItems.reduce((s, i) => s + (itemDef(i.def)?.queueCap ?? 0), 0)
  const bags = extraOf(items, (d) => d.bagAllowance ?? 0)
  const pax =
    8 + extraOf(items, (d) => (d.paxCap ?? 0) + (d.queueCap > 0 ? Math.round(d.queueCap / 4) : 0))
  return {
    paxCap: Math.max(16, pax),
    secPerMin: paxPerMin(servers, serviceSec || 3),
    bagAllowance: bags,
    upkeepDay: extraOf(items, (d) => d.upkeep),
    servers,
    serviceSec: serviceSec || 3,
    queueCap: queueCap || 0,
    wearPerUse: 0.8,
  }
}

export function laneStats(fit: CeilingInput): LaneStats {
  const c = ceilingsFor(fit)
  return {
    servers: c.servers,
    serviceSec: c.serviceSec,
    queueCap: c.queueCap,
    wearPerUse: c.wearPerUse,
  }
}

export function blankZones(): (ZoneId | null)[][] {
  return Array.from({ length: GRID_R }, () => Array.from({ length: GRID_C }, () => null))
}

/**
 * Real terminal schemes, painted as C check-in, S security, G gates,
 * A arrivals, R retail, T toilets.
 * I — linear single pier (London City).
 * II — finger pier (mid-size concourse, FAA pier family).
 * III — central processor feeding two satellites (Tampa).
 */
const SCHEME_I = [
  'CCCCCCAA',
  'CCCCTTAA',
  'SSSSSSAA',
  'GGRTGGGG',
  'GGGRGGGG',
]
const SCHEME_II = [
  'CCCCGGGGGGGG',
  'CCCCTGTGTGTG',
  'SSSSGGGGGGGG',
  'AAAAGRGRGRGR',
  'AAAAGGGTGGGG',
  'AAAAGGTGGGGT',
  'AAAAGGGGGGGG',
]
const SCHEME_III = [
  'CCCCCGGGGGGGGG',
  'CCCCCGRTGGTGRG',
  'SSSSSGGGGGGGGG',
  'CCCCCGGGGRGGGG',
  'AAAAAGGGGGGGGG',
  'AAAAAGGGGGGGGG',
  'AAAAAGRTGGTGRG',
  'AAAAAGGGGGGGGG',
  'AAAATGGGRGGGGG',
]

const SCHEME_LETTER: Record<string, ZoneId> = {
  C: 'checkin',
  S: 'security',
  G: 'gates',
  A: 'arrivals',
  R: 'retail',
  T: 'toilets',
}

export function schemeRows(tier: 1 | 2 | 3): string[] {
  if (tier === 2) return SCHEME_II
  if (tier === 3) return SCHEME_III
  return SCHEME_I
}

export function schemeZones(tier: 1 | 2 | 3): ZoneId[][] {
  return schemeRows(tier).map((row) => [...row].map((ch) => SCHEME_LETTER[ch]))
}

export function schemeSigns(tier: 1 | 2 | 3): number {
  if (tier === 2) return 3
  if (tier === 3) return 4
  return 2
}

export function schemeLabel(tier: 1 | 2 | 3): string {
  return PREFAB_TIERS[tier].label
}

/** Tier I linear plan. Kept for callers that do not pass a tier. */
export function prefabZones(): ZoneId[][] {
  return schemeZones(1)
}

function cellsOf(zones: ZoneId[][], zone: ZoneId): { c: number; r: number }[] {
  const out: { c: number; r: number }[] = []
  for (let r = 0; r < zones.length; r++) {
    for (let c = 0; c < zones[r].length; c++) {
      if (zones[r][c] === zone) out.push({ c, r })
    }
  }
  return out
}

export function schemeItems(tier: 1 | 2 | 3): PlacedItem[] {
  const zones = schemeZones(tier)
  const spot = (def: ItemId, cell: { c: number; r: number } | undefined): PlacedItem | null => {
    if (!cell) return null
    return {
      id: `bundle-${def}-${cell.c}-${cell.r}`,
      def,
      c: cell.c,
      r: cell.r,
      wear: 0,
      bundle: true,
    }
  }
  const at = (zone: ZoneId, i: number) => {
    const cells = cellsOf(zones, zone)
    return cells[Math.min(i, cells.length - 1)]
  }
  const list = [
    spot('entrance', at('checkin', 0)),
    spot('kiosk', at('checkin', 1)),
    spot('checkin_belt', at('checkin', 2)),
    spot('queue_rail', at('checkin', 3)),
    spot('wayfinding', at('checkin', 4)),
    spot(prefabSecurityItem(tier), at('security', 0)),
    spot('secure_exit', at('security', cellsOf(zones, 'security').length - 1)),
    spot('boarding_desk', at('gates', 0)),
    spot('seat_row', at('gates', 1)),
    spot('claim_carousel', at('arrivals', 0)),
    spot('bag_system', at('arrivals', 1)),
    spot('toilet', at('toilets', 0)),
    spot('cafe', at('retail', 0)),
    spot('wayfinding', at('gates', 3)),
  ].filter((x): x is PlacedItem => Boolean(x))
  const seen = new Set<string>()
  return list.filter((it) => {
    const key = `${it.c},${it.r}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function prefabBundle(): PlacedItem[] {
  return schemeItems(1)
}

export function prefabSecurityItem(tier: 1 | 2 | 3): ItemId {
  if (tier === 2) return 'security_medium'
  if (tier === 3) return 'security_large'
  return 'security_small'
}

export function cellCenter(
  c: number,
  r: number,
  cols = GRID_C,
  rows = GRID_R,
): { x: number; z: number } {
  const cw = HALL_W / Math.max(1, cols)
  const rh = HALL_D / Math.max(1, rows)
  return {
    x: -HALL_W / 2 + (c + 0.5) * cw,
    z: -HALL_D / 2 + (r + 0.5) * rh,
  }
}

export function moodWord(happiness: number): string {
  if (happiness >= 75) return 'Happy'
  if (happiness >= 55) return 'Content'
  if (happiness >= 35) return 'Impatient'
  return 'Miserable'
}
