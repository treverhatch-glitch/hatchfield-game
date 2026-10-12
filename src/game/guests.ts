/**
 * RCT-inspired guest AI for the terminal hall.
 *
 * Chris Sawyer’s insight (verified): perfect pathfinding is easy and useless if it
 * stalls the sim. Guests decide at junctions with a short lookahead; they can get
 * lost; unmet needs hurt the rating. We use a small room graph (not open tile flood)
 * so thousands of decisions stay cheap — same spirit, airport rooms instead of rides.
 */

export type NeedId = 'hunger' | 'bladder' | 'energy' | 'boarding' | 'bags' | 'shop'

export type HallNode =
  | 'entrance'
  | 'checkin'
  | 'security'
  | 'bathroom'
  | 'food'
  | 'shop'
  | 'lounge'
  | 'gate'
  | 'claim'
  | 'info'
  | 'exit'

export type PaxTag = 'budget' | 'premium'

export interface GuestNeeds {
  hunger: number
  bladder: number
  energy: number
  /** Minutes until boarding — 0 means missed. */
  boarding: number
  bags: number
  shop: number
}

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
  happiness: number
  patience: number
  spent: number
  thought: string
  color: string
  dead: boolean
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
  ['food', 'shop'],
  ['food', 'bathroom'],
  ['shop', 'lounge'],
  ['lounge', 'gate'],
  ['claim', 'exit'],
  ['claim', 'food'],
  ['claim', 'shop'],
  ['claim', 'bathroom'],
  ['entrance', 'info'],
  ['checkin', 'info'],
  ['security', 'info'],
  ['exit', 'entrance'],
]

export const NODE_POS: Record<HallNode, { x: number; y: number; label: string }> = {
  entrance: { x: 0.12, y: 0.55, label: 'Doors' },
  checkin: { x: 0.28, y: 0.28, label: 'Check-in' },
  security: { x: 0.48, y: 0.28, label: 'Security' },
  bathroom: { x: 0.32, y: 0.72, label: 'WC' },
  food: { x: 0.58, y: 0.55, label: 'Food' },
  shop: { x: 0.72, y: 0.38, label: 'Shop' },
  lounge: { x: 0.72, y: 0.68, label: 'Lounge' },
  gate: { x: 0.9, y: 0.28, label: 'Gate' },
  claim: { x: 0.48, y: 0.78, label: 'Bag claim' },
  info: { x: 0.22, y: 0.48, label: 'Info' },
  exit: { x: 0.12, y: 0.82, label: 'Landside' },
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
  if (need === 'energy') return job === 'depart' ? 'lounge' : 'food'
  return 'shop'
}

export function spawnHallGuest(
  flightId: string,
  job: 'depart' | 'arrive',
  tag: PaxTag,
): HallGuest {
  const premium = tag === 'premium'
  return {
    id: `g-${Math.random().toString(36).slice(2, 8)}`,
    flightId,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    tag,
    job,
    node: job === 'depart' ? 'entrance' : 'gate',
    path: [],
    seg: 0,
    t: 0,
    needs: {
      hunger: 20 + Math.random() * (premium ? 40 : 55),
      bladder: 15 + Math.random() * 50,
      energy: premium ? 40 + Math.random() * 40 : 10 + Math.random() * 30,
      boarding: job === 'depart' ? 18 + Math.random() * 22 : 99,
      bags: job === 'arrive' ? 70 + Math.random() * 25 : 0,
      shop: premium ? 25 + Math.random() * 40 : 10 + Math.random() * 25,
    },
    happiness: 70,
    patience: premium ? 55 : 70,
    spent: 0,
    thought: job === 'depart' ? 'Where is check-in?' : 'Where are my bags?',
    color: premium
      ? pick(['#5c3d8a', '#2f6f9a', '#1f6b57'])
      : pick(['#8b6b4a', '#6a4a32', '#3a5a7a', '#5c4033']),
    dead: false,
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
}): Set<HallNode> {
  const open = new Set<HallNode>(['entrance', 'exit', 'info'])
  if (rooms.checkin > 0 || rooms.bagdrop > 0) open.add('checkin')
  if (rooms.security > 0) open.add('security')
  if (rooms.bathroom > 0) open.add('bathroom')
  if (rooms.food > 0) open.add('food')
  if (rooms.souvenir > 0) open.add('shop')
  if (rooms.lounge > 0) open.add('lounge')
  if (rooms.gate > 0) open.add('gate')
  if (rooms.bagclaim > 0) open.add('claim')
  // Premade / partial halls still allow walking past missing rooms via security↔gate if both exist
  if (open.has('security') && open.has('gate')) {
    /* ok */
  } else if (open.has('checkin') && open.has('gate')) {
    open.add('security') // soft corridor so custom halls are not soft-locked
  }
  return open
}
