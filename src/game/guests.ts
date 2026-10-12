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
  | 'gate'
  | 'claim'
  | 'info'
  | 'exit'
  /** Landside R&D — researchers only; guests rarely path here. */
  | 'lab_desk'
  | 'lab_board'
  | 'lab_bench'

export type PaxTag = 'budget' | 'premium'

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
}

/** Past the secure line — uncleared departures may not enter. */
export const AIRSIDE_NODES: ReadonlySet<HallNode> = new Set([
  'food',
  'shop',
  'lounge',
  'golf',
  'waterfall',
  'gaming',
  'dayhotel',
  'gate',
])

export function isAirside(node: HallNode): boolean {
  return AIRSIDE_NODES.has(node)
}

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

/** Undirected hall graph — edges are decision points. */
export const HALL_EDGES: [HallNode, HallNode][] = [
  ['entrance', 'checkin'],
  ['entrance', 'claim'],
  ['entrance', 'bathroom'],
  ['checkin', 'security'],
  ['checkin', 'bathroom'],
  ['security', 'food'],
  ['security', 'shop'],
  ['security', 'lounge'],
  ['security', 'gate'],
  ['security', 'gaming'],
  ['food', 'shop'],
  ['food', 'bathroom'],
  ['food', 'waterfall'],
  ['shop', 'lounge'],
  ['shop', 'gaming'],
  ['lounge', 'gate'],
  ['lounge', 'golf'],
  ['lounge', 'waterfall'],
  ['lounge', 'dayhotel'],
  ['golf', 'waterfall'],
  ['gaming', 'gate'],
  ['dayhotel', 'gate'],
  ['dayhotel', 'food'],
  ['claim', 'exit'],
  ['claim', 'food'],
  ['claim', 'shop'],
  ['claim', 'bathroom'],
  ['entrance', 'info'],
  ['checkin', 'info'],
  ['security', 'info'],
  ['exit', 'entrance'],
  // Landside R&D corner — short spur off doors/info (not guest need targets).
  ['entrance', 'lab_desk'],
  ['info', 'lab_desk'],
  ['lab_desk', 'lab_board'],
  ['lab_board', 'lab_bench'],
  ['lab_desk', 'lab_bench'],
]

export const NODE_POS: Record<HallNode, { x: number; y: number; label: string }> = {
  entrance: { x: 0.12, y: 0.55, label: 'Doors' },
  checkin: { x: 0.28, y: 0.28, label: 'Check-in' },
  security: { x: 0.48, y: 0.28, label: 'Security' },
  bathroom: { x: 0.32, y: 0.72, label: 'WC' },
  food: { x: 0.58, y: 0.55, label: 'Food' },
  shop: { x: 0.72, y: 0.38, label: 'Shop' },
  lounge: { x: 0.72, y: 0.68, label: 'Lounge' },
  golf: { x: 0.82, y: 0.82, label: 'Golf' },
  waterfall: { x: 0.62, y: 0.88, label: 'Falls' },
  gaming: { x: 0.84, y: 0.48, label: 'Games' },
  dayhotel: { x: 0.78, y: 0.58, label: 'Day rooms' },
  gate: { x: 0.9, y: 0.28, label: 'Gate' },
  claim: { x: 0.48, y: 0.78, label: 'Bag claim' },
  info: { x: 0.22, y: 0.48, label: 'Info' },
  exit: { x: 0.12, y: 0.82, label: 'Landside' },
  lab_desk: { x: 0.08, y: 0.22, label: 'R&D desk' },
  lab_board: { x: 0.18, y: 0.14, label: 'Chalkboard' },
  lab_bench: { x: 0.28, y: 0.16, label: 'Lab bench' },
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
    if (job === 'depart') return Math.random() < 0.35 ? 'dayhotel' : 'lounge'
    return 'food'
  }
  if (need === 'play') {
    if (job === 'depart') return Math.random() < 0.4 ? 'golf' : Math.random() < 0.5 ? 'gaming' : 'waterfall'
    return Math.random() < 0.5 ? 'gaming' : 'waterfall'
  }
  return 'shop'
}

function rollPrefs(tag: PaxTag, transfer: boolean): GuestPrefs {
  const premium = tag === 'premium'
  return {
    food: premium ? 0.35 + Math.random() * 0.5 : 0.45 + Math.random() * 0.5,
    shop: premium ? 0.4 + Math.random() * 0.55 : 0.15 + Math.random() * 0.45,
    play: premium ? 0.35 + Math.random() * 0.55 : 0.25 + Math.random() * 0.5,
    lounge: premium ? 0.55 + Math.random() * 0.4 : 0.05 + Math.random() * 0.25,
    nap: transfer ? 0.55 + Math.random() * 0.4 : premium ? 0.2 + Math.random() * 0.4 : 0.05 + Math.random() * 0.2,
  }
}

function rollWallet(tag: PaxTag, transfer: boolean): number {
  if (tag === 'premium') return Math.round(90 + Math.random() * 160 + (transfer ? 40 : 0))
  return Math.round(22 + Math.random() * 55 + (transfer ? 25 : 0))
}

export function spawnHallGuest(
  flightId: string,
  job: 'depart' | 'arrive',
  tag: PaxTag,
  opts?: { transfer?: boolean; airlineId?: string; hallId?: string },
): HallGuest {
  const premium = tag === 'premium'
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
      hunger: (transfer ? 35 : 20) + Math.random() * (premium ? 40 : 55),
      bladder: 15 + Math.random() * 50,
      energy: premium ? 40 + Math.random() * 40 : 10 + Math.random() * 30,
      boarding: job === 'depart' ? 18 + Math.random() * 22 : transfer ? 40 + Math.random() * 30 : 99,
      bags: job === 'arrive' && !transfer ? 70 + Math.random() * 25 : 0,
      shop: (transfer ? 40 : premium ? 25 : 10) + Math.random() * (premium ? 40 : 25),
      play: (transfer ? 30 : premium ? 35 : 15) + Math.random() * (premium ? 45 : 35),
    },
    wallet: rollWallet(tag, transfer),
    prefs: rollPrefs(tag, transfer),
    happiness: transfer ? 65 : 70,
    patience: premium ? 55 : transfer ? 80 : 70,
    spent: 0,
    thought: transfer
      ? 'Long layover — need food and a seat'
      : job === 'depart'
        ? 'Where is check-in?'
        : 'Where are my bags?',
    color: premium
      ? pick(['#5c3d8a', '#2f6f9a', '#1f6b57'])
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
  if (rooms.gate > 0) open.add('gate')
  if (rooms.bagclaim > 0) open.add('claim')
  if ((rooms.rdesk ?? 0) > 0) open.add('lab_desk')
  if ((rooms.rboard ?? 0) > 0) open.add('lab_board')
  if ((rooms.rmachine ?? 0) > 0) open.add('lab_bench')
  // No soft security corridor — missing lanes means airside stays locked for uncleared pax.
  return open
}
