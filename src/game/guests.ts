/**
 * RCT-inspired guest AI for the terminal hall.
 *
 * Chris Sawyer’s insight (verified): perfect pathfinding is easy and useless if it
 * stalls the sim. Guests decide at junctions with a short lookahead; they can get
 * lost; unmet needs hurt the rating. We use a small room graph (not open tile flood)
 * so thousands of decisions stay cheap — same spirit, airport rooms instead of rides.
 */

import type { ArriveMode } from './types'

export type { ArriveMode }

export type NeedId =
  | 'hunger'
  | 'bladder'
  | 'energy'
  | 'boarding'
  | 'bags'
  | 'shop'
  | 'play'

export type HallNode =
  | 'entrance'
  | 'checkin'
  | 'security'
  | 'bathroom'
  | 'food'
  | 'shop'
  | 'lounge'
  | 'golf'
  | 'waterfall'
  | 'gaming'
  | 'dayhotel'
  | 'spa'
  | 'pool'
  | 'gate'
  | 'claim'
  | 'info'
  | 'exit'
  /** Landside R&D — researchers only; guests rarely path here. */
  | 'lab_desk'
  | 'lab_board'
  | 'lab_bench'

/**
 * Passenger class — RCT-style guest types with different cash bands + tastes.
 * Rolled per body; airline persona only biases the mix.
 */
export type PaxTag = 'budget' | 'family' | 'business' | 'premium'

export interface GuestNeeds {
  hunger: number
  bladder: number
  energy: number
  /** Minutes until boarding — 0 means missed. */
  boarding: number
  bags: number
  shop: number
  /** HatchTag fantasy amenities — golf / waterfall / gaming. */
  play: number
}

/** 0–1 spend appetite by category (RCT-style taste). */
export interface GuestPrefs {
  food: number
  shop: number
  play: number
  lounge: number
  nap: number
  /** Hotel overnight / car park willingness. */
  landside: number
}

export type SpendKind = keyof GuestPrefs

export interface HallGuest {
  id: string
  flightId: string
  name: string
  tag: PaxTag
  job: 'depart' | 'arrive'
  node: HallNode
  path: HallNode[]
  seg: number
  t: number
  needs: GuestNeeds
  /** Cash in pocket — random per guest; gates purchases. */
  wallet: number
  prefs: GuestPrefs
  happiness: number
  patience: number
  spent: number
  thought: string
  color: string
  dead: boolean
  /** Passed the secure line (or arrived airside off a jet). */
  clearedSec: boolean
  /** Layover-bank transfer — longer dwell, captive spend. */
  transfer?: boolean
  airlineId?: string
  /** Which terminal campus hall this guest belongs to (`c,r` origin key). */
  hallId?: string
  /** Landside arrival / leave mode — hotel, short/long park, bus, rail, drop-off. */
  arriveMode?: ArriveMode
  /** Preferred mode before fallback (for missing-infra anger). */
  preferMode?: ArriveMode
  /** Seconds left depositing checked bags at check-in (outbound). */
  bagDepositLeft?: number
  /** Finished check-in bag drop for this journey. */
  bagsDropped?: boolean
  /** No path, or the security queue turned them away. */
  lost?: boolean
  /** Seconds left at the scanner. 0 means waiting, not being served. */
  serviceLeft?: number
  /** Arrival order at the security lane. */
  queueSeq?: number
}

/**
 * Past the secure line — uncleared departures may not enter.
 * Claim is airside (arrivals corridor); landside is only doors / info / check-in / WC / labs / exit.
 */
export const AIRSIDE_NODES: ReadonlySet<HallNode> = new Set([
  'food',
  'shop',
  'lounge',
  'golf',
  'waterfall',
  'gaming',
  'dayhotel',
  'spa',
  'pool',
  'gate',
  'claim',
])

export function isAirside(node: HallNode): boolean {
  return AIRSIDE_NODES.has(node)
}

/** Strict landside set — only these sit before the security choke. */
export const LANDSIDE_NODES: ReadonlySet<HallNode> = new Set([
  'entrance',
  'info',
  'checkin',
  'bathroom',
  'exit',
  'lab_desk',
  'lab_board',
  'lab_bench',
  'security', // choke itself
])

/** Desk posts that can be staffed with bodies. */
export type StaffPost = 'checkin' | 'security' | 'gate'

export interface HallStaff {
  id: string
  node: StaffPost
  label: string
  color: string
  /** 0 working · 1 break */
  stage: number
}

/** Open nodes visible to a guest given clearance. */
export function openForGuest(open: Set<HallNode>, cleared: boolean): Set<HallNode> {
  if (cleared) return open
  const s = new Set<HallNode>()
  for (const n of open) {
    if (!isAirside(n)) s.add(n)
  }
  return s
}

/**
 * Undirected hall graph — security is the only landside→airside choke.
 * Premade fills security; player shells without it leave airside unreachable
 * (or invite breach / smuggling events when they force gaps).
 */
export const HALL_EDGES: [HallNode, HallNode][] = [
  // LANDSIDE — doors, info, check-in, WC only
  ['entrance', 'info'],
  ['entrance', 'checkin'],
  ['entrance', 'bathroom'],
  ['info', 'checkin'],
  ['info', 'bathroom'],
  ['checkin', 'bathroom'],
  // CHOKE — only bridges into the sterile side
  ['checkin', 'security'],
  ['info', 'security'],
  // AIRSIDE — after security (info reappears as airside hub via security)
  ['security', 'food'],
  ['security', 'shop'],
  ['security', 'lounge'],
  ['security', 'gate'],
  ['security', 'gaming'],
  ['security', 'spa'],
  ['security', 'dayhotel'],
  ['food', 'shop'],
  ['food', 'waterfall'],
  ['food', 'lounge'],
  ['shop', 'lounge'],
  ['shop', 'gaming'],
  ['lounge', 'gate'],
  ['lounge', 'golf'],
  ['lounge', 'waterfall'],
  ['lounge', 'dayhotel'],
  ['lounge', 'spa'],
  ['golf', 'waterfall'],
  ['golf', 'pool'],
  ['gaming', 'gate'],
  ['gaming', 'pool'],
  ['dayhotel', 'gate'],
  ['dayhotel', 'food'],
  ['dayhotel', 'spa'],
  ['spa', 'gate'],
  ['spa', 'pool'],
  ['pool', 'gate'],
  ['pool', 'waterfall'],
  // Arrivals corridor (clearedSec already true)
  ['gate', 'claim'],
  ['claim', 'exit'],
  ['claim', 'food'],
  ['claim', 'shop'],
  ['exit', 'entrance'],
  // Landside R&D spur
  ['entrance', 'lab_desk'],
  ['info', 'lab_desk'],
  ['lab_desk', 'lab_board'],
  ['lab_board', 'lab_bench'],
  ['lab_desk', 'lab_bench'],
]

/** Normalized floor plan (x/z in hall 3D + legacy 2D). */
export const NODE_POS: Record<HallNode, { x: number; y: number; label: string }> = {
  entrance: { x: 0.1, y: 0.5, label: 'Doors' },
  info: { x: 0.22, y: 0.42, label: 'Info' },
  checkin: { x: 0.28, y: 0.28, label: 'Check-in' },
  bathroom: { x: 0.26, y: 0.68, label: 'WC' },
  security: { x: 0.42, y: 0.4, label: 'Security' },
  food: { x: 0.58, y: 0.52, label: 'Food' },
  shop: { x: 0.68, y: 0.36, label: 'Shop' },
  lounge: { x: 0.7, y: 0.64, label: 'Lounge' },
  golf: { x: 0.82, y: 0.78, label: 'Golf' },
  waterfall: { x: 0.62, y: 0.82, label: 'Falls' },
  gaming: { x: 0.8, y: 0.46, label: 'Games' },
  dayhotel: { x: 0.76, y: 0.56, label: 'Day rooms' },
  spa: { x: 0.66, y: 0.48, label: 'Spa' },
  pool: { x: 0.86, y: 0.64, label: 'Pool' },
  gate: { x: 0.9, y: 0.28, label: 'Gate' },
  claim: { x: 0.72, y: 0.78, label: 'Bag claim' },
  exit: { x: 0.12, y: 0.78, label: 'Exit' },
  lab_desk: { x: 0.08, y: 0.22, label: 'R&D desk' },
  lab_board: { x: 0.16, y: 0.14, label: 'Chalkboard' },
  lab_bench: { x: 0.24, y: 0.16, label: 'Lab bench' },
}

const NAMES = [
  'Ada', 'Ben', 'Cara', 'Dev', 'Eve', 'Finn', 'Gia', 'Hank', 'Ivy', 'Jon',
  'Kim', 'Leo', 'Mia', 'Ned', 'Oli', 'Pia', 'Quin', 'Rio', 'Sam', 'Tess',
]

function neighbors(node: HallNode): HallNode[] {
  const out: HallNode[] = []
  for (const [a, b] of HALL_EDGES) {
    if (a === node) out.push(b)
    if (b === node) out.push(a)
  }
  return out
}

/** Short BFS — RCT-style capped search, not a global oracle. */
export function hallPath(
  from: HallNode,
  to: HallNode,
  open: Set<HallNode>,
  maxDepth = 6,
): HallNode[] | null {
  if (from === to) return [from]
  if (!open.has(from) || !open.has(to)) return null
  const q: HallNode[] = [from]
  const came = new Map<HallNode, HallNode>()
  const depth = new Map<HallNode, number>([[from, 0]])
  while (q.length) {
    const cur = q.shift()!
    if ((depth.get(cur) ?? 0) >= maxDepth) continue
    for (const n of neighbors(cur)) {
      if (!open.has(n) || came.has(n) || n === from) continue
      came.set(n, cur)
      depth.set(n, (depth.get(cur) ?? 0) + 1)
      if (n === to) {
        const path = [n]
        let k: HallNode | undefined = n
        while (k && k !== from) {
          k = came.get(k)
          if (k) path.push(k)
        }
        path.reverse()
        return path
      }
      q.push(n)
    }
  }
  return null
}

export function strongestNeed(g: HallGuest): NeedId | null {
  const entries: [NeedId, number][] = [
    ['boarding', g.job === 'depart' ? 100 - g.needs.boarding : 0],
    ['bags', g.job === 'arrive' ? g.needs.bags : 0],
    ['bladder', g.needs.bladder],
    ['hunger', g.needs.hunger],
    ['energy', g.needs.energy],
    ['shop', g.needs.shop],
    ['play', g.needs.play],
  ]
  entries.sort((a, b) => b[1] - a[1])
  if (entries[0][1] < 35) return null
  return entries[0][0]
}

export function needToNode(need: NeedId, job: HallGuest['job']): HallNode {
  if (need === 'boarding') return 'gate'
  if (need === 'bags') return 'claim'
  if (need === 'bladder') return 'bathroom'
  if (need === 'hunger') return 'food'
  if (need === 'energy') {
    if (job === 'depart') {
      const r = Math.random()
      if (r < 0.28) return 'spa'
      if (r < 0.55) return 'dayhotel'
      return 'lounge'
    }
    return Math.random() < 0.35 ? 'spa' : 'food'
  }
  if (need === 'play') {
    if (job === 'depart') {
      const r = Math.random()
      if (r < 0.28) return 'pool'
      if (r < 0.52) return 'golf'
      if (r < 0.76) return 'gaming'
      return 'waterfall'
    }
    return Math.random() < 0.4 ? 'pool' : Math.random() < 0.5 ? 'gaming' : 'waterfall'
  }
  return 'shop'
}

/** Airline persona only biases the mix — each body still rolls its own cash/taste. */
export function rollPaxTag(
  persona:
    | 'budget'
    | 'business'
    | 'luxury'
    | 'cargo_night'
    | 'military_gov',
): PaxTag {
  const r = Math.random()
  if (persona === 'luxury') {
    if (r < 0.5) return 'premium'
    if (r < 0.78) return 'business'
    if (r < 0.92) return 'family'
    return 'budget'
  }
  if (persona === 'business') {
    if (r < 0.38) return 'business'
    if (r < 0.58) return 'premium'
    if (r < 0.82) return 'family'
    return 'budget'
  }
  if (persona === 'cargo_night' || persona === 'military_gov') {
    if (r < 0.55) return 'budget'
    if (r < 0.85) return 'family'
    return 'business'
  }
  // budget carriers
  if (r < 0.5) return 'budget'
  if (r < 0.78) return 'family'
  if (r < 0.93) return 'business'
  return 'premium'
}

export function paxTagLabel(tag: PaxTag): string {
  return tag === 'budget'
    ? 'Budget'
    : tag === 'family'
      ? 'Family'
      : tag === 'business'
        ? 'Business'
        : 'Premium'
}

export function paxTagColor(tag: PaxTag): string {
  return tag === 'premium'
    ? '#c9a227'
    : tag === 'business'
      ? '#6a9ec8'
      : tag === 'family'
        ? '#7aaf78'
        : '#b7c4b8'
}

/** True for lounge / high-ticket paths. */
export function tagSpendsUp(tag: PaxTag): boolean {
  return tag === 'premium' || tag === 'business'
}

export { bagUnitsForTag, estimateFlightBagUnits } from './bags.ts'

/**
 * RCT wallet roll — wide random band per type, rare broke / whale outliers.
 * Transfer layovers get a small bump (captive spenders).
 */
export function rollWallet(tag: PaxTag, transfer = false): number {
  const band =
    tag === 'premium'
      ? { lo: 80, hi: 260, broke: 0.04, brokeMax: 35, whale: 0.1, whaleMax: 420 }
      : tag === 'business'
        ? { lo: 50, hi: 175, broke: 0.05, brokeMax: 28, whale: 0.08, whaleMax: 300 }
        : tag === 'family'
          ? { lo: 30, hi: 120, broke: 0.06, brokeMax: 18, whale: 0.07, whaleMax: 200 }
          : { lo: 6, hi: 52, broke: 0.1, brokeMax: 8, whale: 0.05, whaleMax: 95 }
  let n: number
  const r = Math.random()
  if (r < band.broke) n = 1 + Math.random() * band.brokeMax
  else if (r > 1 - band.whale) n = band.hi + Math.random() * (band.whaleMax - band.hi)
  else n = band.lo + Math.random() * (band.hi - band.lo)
  if (transfer) n += 20 + Math.random() * 35
  return Math.max(0, Math.round(n))
}

/** RCT taste roll — type biases the means; each guest still differs. */
export function rollPrefs(tag: PaxTag, transfer = false): GuestPrefs {
  const jitter = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
  if (tag === 'premium') {
    return {
      food: jitter(0.3, 0.85),
      shop: jitter(0.4, 0.95),
      play: jitter(0.35, 0.9),
      lounge: jitter(0.55, 0.98),
      nap: transfer ? jitter(0.55, 0.95) : jitter(0.2, 0.65),
      landside: jitter(0.45, 0.95),
    }
  }
  if (tag === 'business') {
    return {
      food: jitter(0.35, 0.8),
      shop: jitter(0.25, 0.7),
      play: jitter(0.15, 0.55),
      lounge: jitter(0.4, 0.9),
      nap: transfer ? jitter(0.5, 0.9) : jitter(0.15, 0.55),
      landside: jitter(0.4, 0.85),
    }
  }
  if (tag === 'family') {
    return {
      food: jitter(0.5, 0.95),
      shop: jitter(0.35, 0.85),
      play: jitter(0.45, 0.95),
      lounge: jitter(0.05, 0.35),
      nap: transfer ? jitter(0.4, 0.8) : jitter(0.1, 0.4),
      landside: jitter(0.25, 0.7),
    }
  }
  return {
    food: jitter(0.4, 0.9),
    shop: jitter(0.1, 0.5),
    play: jitter(0.2, 0.65),
    lounge: jitter(0.02, 0.25),
    nap: transfer ? jitter(0.35, 0.75) : jitter(0.02, 0.25),
    landside: jitter(0.15, 0.55),
  }
}

/** Menu price ladder by passenger type. */
export function tagPrice(tag: PaxTag, budget: number, family: number, biz: number, premium: number): number {
  if (tag === 'premium') return premium
  if (tag === 'business') return biz
  if (tag === 'family') return family
  return budget
}

export function spawnHallGuest(
  flightId: string,
  job: 'depart' | 'arrive',
  tag: PaxTag,
  opts?: { transfer?: boolean; airlineId?: string; hallId?: string },
): HallGuest {
  const up = tagSpendsUp(tag)
  const transfer = Boolean(opts?.transfer)
  return {
    id: `g-${Math.random().toString(36).slice(2, 8)}`,
    flightId,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    tag,
    job,
    node: job === 'depart' ? 'entrance' : transfer ? 'gate' : 'gate',
    path: [],
    seg: 0,
    t: 0,
    needs: {
      hunger: (transfer ? 35 : 20) + Math.random() * (up ? 40 : 55),
      bladder: 15 + Math.random() * 50,
      energy: up ? 40 + Math.random() * 40 : 10 + Math.random() * 30,
      boarding: job === 'depart' ? 18 + Math.random() * 22 : transfer ? 40 + Math.random() * 30 : 99,
      bags: job === 'arrive' && !transfer ? 70 + Math.random() * 25 : 0,
      shop: (transfer ? 40 : up ? 25 : 10) + Math.random() * (up ? 40 : 25),
      play:
        (transfer ? 30 : tag === 'family' ? 40 : up ? 35 : 15) +
        Math.random() * (tag === 'family' ? 50 : up ? 45 : 35),
    },
    wallet: rollWallet(tag, transfer),
    prefs: rollPrefs(tag, transfer),
    happiness: transfer ? 65 : 70,
    patience: tag === 'premium' ? 55 : tag === 'business' ? 60 : transfer ? 80 : 70,
    spent: 0,
    thought: transfer
      ? 'Long layover — need food and a seat'
      : job === 'depart'
        ? 'Where is check-in?'
        : 'Where are my bags?',
    color:
      tag === 'premium'
        ? pick(['#5c3d8a', '#2f6f9a', '#1f6b57'])
        : tag === 'business'
          ? pick(['#3a6a8a', '#4a7a9a', '#2f5a70'])
          : tag === 'family'
            ? pick(['#6a8a4a', '#5a7a3a', '#4a6a50'])
            : pick(['#8b6b4a', '#6a4a32', '#3a5a7a', '#5c4033']),
    dead: false,
    // Arrivals / transfers start airside; departures must clear security.
    clearedSec: job === 'arrive' || transfer,
    transfer,
    airlineId: opts?.airlineId,
    hallId: opts?.hallId,
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function openNodesFromRooms(rooms: {
  checkin: number
  security: number
  gate: number
  bagclaim: number
  food: number
  souvenir: number
  bagdrop: number
  lounge: number
  bathroom: number
  golf?: number
  waterfall?: number
  gaming?: number
  dayhotel?: number
  spa?: number
  pool?: number
  rdesk?: number
  rboard?: number
  rmachine?: number
}): Set<HallNode> {
  const open = new Set<HallNode>(['entrance', 'exit', 'info'])
  if (rooms.checkin > 0 || rooms.bagdrop > 0) open.add('checkin')
  if (rooms.security > 0) open.add('security')
  if (rooms.bathroom > 0) open.add('bathroom')
  if (rooms.food > 0) open.add('food')
  if (rooms.souvenir > 0) open.add('shop')
  if (rooms.lounge > 0) open.add('lounge')
  if ((rooms.golf ?? 0) > 0) open.add('golf')
  if ((rooms.waterfall ?? 0) > 0) open.add('waterfall')
  if ((rooms.gaming ?? 0) > 0) open.add('gaming')
  if ((rooms.dayhotel ?? 0) > 0) open.add('dayhotel')
  if ((rooms.spa ?? 0) > 0) open.add('spa')
  if ((rooms.pool ?? 0) > 0) open.add('pool')
  if (rooms.gate > 0) open.add('gate')
  if (rooms.bagclaim > 0) open.add('claim')
  if ((rooms.rdesk ?? 0) > 0) open.add('lab_desk')
  if ((rooms.rboard ?? 0) > 0) open.add('lab_board')
  if ((rooms.rmachine ?? 0) > 0) open.add('lab_bench')
  // No soft security corridor — missing lanes means airside stays locked for uncleared pax.
  return open
}
