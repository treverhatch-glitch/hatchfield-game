import {
  BANK_CAP_MULTIPLE,
  CATEGORIES,
  OPS_RP_PER_SEC,
  RESEARCH_DAY_SEC,
  ROOM_DIMINISH,
  ROOM_RP_PER_SEC,
  SPEC_PENALTY,
  STAFF_ROOM_BOOST,
  levelReward,
} from './config.ts'
import { linkFor } from './links.ts'
import { RESEARCH_NODES, nodeById, nodesInCategory } from './nodes.ts'
import type { NodeState, ResearchNode, ResearchState, RoomCounts } from './types.ts'

export function emptyResearchState(): ResearchState {
  return { points: 0, carry: 0, unlocked: [], rewardedThrough: 1, primarySpec: null }
}

/** Geometric weight of `count` copies. The first copy is 1. Later copies shrink. */
export function diminishedUnits(count: number): number {
  const copies = Math.max(0, Math.floor(count))
  if (copies <= 0) return 0
  const ratio: number = ROOM_DIMINISH
  if (ratio === 1) return copies
  return (1 - Math.pow(ratio, copies)) / (1 - ratio)
}

export function roomRate(rooms: RoomCounts): number {
  return (
    diminishedUnits(rooms.desk) * ROOM_RP_PER_SEC.desk +
    diminishedUnits(rooms.board) * ROOM_RP_PER_SEC.board +
    diminishedUnits(rooms.machine) * ROOM_RP_PER_SEC.machine
  )
}

/** Operations trickle plus room output. Hired researchers raise only the room share. */
export function researchRate(rooms: RoomCounts, operating: boolean, staff = 0): number {
  if (!operating) return 0
  const crew = Math.max(0, staff)
  const boost = 1 + crew * STAFF_ROOM_BOOST
  return OPS_RP_PER_SEC + roomRate(rooms) * boost
}

/**
 * Cap on points still in the wallet. The basis is the cheapest node that can
 * be bought now, or the cheapest locked node when nothing is open, or the
 * dearest node once the tree is finished.
 */
export function unspentCap(state: ResearchState, fieldLevel: number): number {
  let cheapestOpen = Number.POSITIVE_INFINITY
  let cheapestLocked = Number.POSITIVE_INFINITY
  let dearest = 0
  for (const node of RESEARCH_NODES) {
    const cost = nodeCost(state, node)
    if (cost > dearest) dearest = cost
    if (cost <= 0 || state.unlocked.includes(node.id)) continue
    const status = nodeState(state, node, fieldLevel)
    if (status === 'available' && cost < cheapestOpen) cheapestOpen = cost
    if (status === 'locked' && cost < cheapestLocked) cheapestLocked = cost
  }
  const basis = Number.isFinite(cheapestOpen)
    ? cheapestOpen
    : Number.isFinite(cheapestLocked)
      ? cheapestLocked
      : Math.max(1, dearest)
  return BANK_CAP_MULTIPLE * basis
}

export function clampUnspent(state: ResearchState, fieldLevel: number): ResearchState {
  const cap = unspentCap(state, fieldLevel)
  if (state.points <= cap) return state
  return { ...state, points: cap, carry: 0 }
}

/** Add a lump (a flight, a grant) into the same wallet the rooms fill. */
export function creditPoints(state: ResearchState, amount: number, fieldLevel: number): ResearchState {
  if (!(amount > 0) || !Number.isFinite(amount)) return state
  const sum = state.carry + amount
  const whole = Math.floor(sum)
  return clampUnspent({ ...state, points: state.points + whole, carry: sum - whole }, fieldLevel)
}

export function accrue(
  state: ResearchState,
  seconds: number,
  rooms: RoomCounts,
  operating: boolean,
  staff = 0,
  fieldLevel = 1,
): ResearchState {
  if (!(seconds > 0) || !operating) return state
  const sum = state.carry + researchRate(rooms, true, staff) * seconds
  const whole = Math.floor(sum)
  return clampUnspent({ ...state, points: state.points + whole, carry: sum - whole }, fieldLevel)
}

export function categoryUnlocked(category: (typeof CATEGORIES)[number]['id'], fieldLevel: number): boolean {
  const row = CATEGORIES.find((item) => item.id === category)
  return fieldLevel >= (row?.unlockLevel ?? 99)
}

export function nodeCost(state: ResearchState, node: ResearchNode): number {
  if (node.baseCost <= 0) return 0
  if (!node.branch || !state.primarySpec || state.primarySpec === node.branch) return node.baseCost
  return Math.ceil(node.baseCost * SPEC_PENALTY)
}

/**
 * Why a locked card cannot be bought. Category gate first, then the missing
 * previous node. Owned and available nodes (including a shortfall of points) return null.
 */
export function lockCopy(state: ResearchState, node: ResearchNode, fieldLevel: number): string | null {
  if (nodeState(state, node, fieldLevel) !== 'locked') return null
  if (!categoryUnlocked(node.category, fieldLevel)) {
    const row = CATEGORIES.find((item) => item.id === node.category)
    return `Needs Field Level ${row?.unlockLevel ?? 1}.`
  }
  for (const req of node.requires) {
    if (state.unlocked.includes(req)) continue
    return `Research ${nodeById(req)?.name ?? req} first.`
  }
  return null
}

export function nodeState(state: ResearchState, node: ResearchNode, fieldLevel: number): NodeState {
  if (state.unlocked.includes(node.id)) return 'owned'
  if (!categoryUnlocked(node.category, fieldLevel)) return 'locked'
  for (const req of node.requires) {
    if (!state.unlocked.includes(req)) return 'locked'
  }
  return 'available'
}

export function shortfallDays(shortfall: number, perSec: number): number | null {
  if (!(shortfall > 0)) return 0
  if (!(perSec > 0)) return null
  return Math.max(1, Math.ceil(shortfall / perSec / RESEARCH_DAY_SEC))
}

/** Footer sentence. `Need 3 more RP (~2 days)` at the operations rate. */
export function shortfallCopy(points: number, cost: number, perSec: number): string | null {
  const need = Math.max(0, cost - points)
  if (need <= 0) return null
  const days = shortfallDays(need, perSec)
  if (days == null) return `Need ${need} more RP`
  const unit = days === 1 ? 'day' : 'days'
  return `Need ${need} more RP (~${days} ${unit})`
}

export interface BuyResult {
  ok: boolean
  why: string
  state: ResearchState
}

export function buyNode(state: ResearchState, id: string, fieldLevel: number): BuyResult {
  const node = nodeById(id)
  if (!node) return { ok: false, why: 'Unknown research.', state }
  const status = nodeState(state, node, fieldLevel)
  if (status === 'owned') return { ok: false, why: 'Already researched.', state }
  if (status === 'locked') {
    if (!categoryUnlocked(node.category, fieldLevel)) {
      const row = CATEGORIES.find((item) => item.id === node.category)
      return { ok: false, why: `Needs Field Level ${row?.unlockLevel ?? 1}.`, state }
    }
    return { ok: false, why: 'Research the previous step first.', state }
  }
  const cost = nodeCost(state, node)
  if (state.points < cost) {
    return { ok: false, why: shortfallCopy(state.points, cost, OPS_RP_PER_SEC) ?? 'Not enough research points.', state }
  }
  const primarySpec = state.primarySpec ?? node.branch ?? null
  return {
    ok: true,
    why: node.name,
    state: {
      ...state,
      points: state.points - cost,
      unlocked: [...state.unlocked, node.id],
      primarySpec,
    },
  }
}

export interface LevelPayout {
  level: number
  cash: number
  rp: number
}

/** Pay each newly reached field level once. RP lands in the tree; cash is returned. */
export function claimLevels(state: ResearchState, reached: number): { state: ResearchState; payouts: LevelPayout[] } {
  const payouts: LevelPayout[] = []
  let next = state
  const top = Math.max(state.rewardedThrough, Math.floor(reached))
  for (let level = state.rewardedThrough + 1; level <= top; level++) {
    const reward = levelReward(level)
    payouts.push({ level, cash: reward.cash, rp: reward.rp })
    next = { ...next, points: next.points + reward.rp, rewardedThrough: level }
  }
  return { state: next, payouts }
}

export function blockReason(state: ResearchState, buildId: string): string | null {
  const link = linkFor(buildId)
  if (!link) return null
  if (state.unlocked.includes(link.nodeId)) return null
  return `Requires research: ${link.label}.`
}

export function treeNodes(): readonly ResearchNode[] {
  return RESEARCH_NODES
}

export function categoryNodes(category: (typeof CATEGORIES)[number]['id']): ResearchNode[] {
  return nodesInCategory(category)
}
