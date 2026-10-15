import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'

/**
 * Cities-style development tree. These numbers are the tree's own research
 * points and level-up lumps. They do not replace catalog fees, RP_RATE_*,
 * or FIELD_LEVEL_XP.
 */

export const OPS_RP_PER_SEC = 0.01
export const ROOM_RP_PER_SEC = { desk: 0.09, board: 0.07, machine: 0.12 } as const

/**
 * Each extra copy of the same room adds this fraction of the previous copy.
 * One desk pays the full rate. A second desk adds 40% of that. A pile of
 * desks approaches 1 / (1 − this) times one desk, not one line per desk.
 */
export const ROOM_DIMINISH = 0.4

/**
 * Unspent points stop at this multiple of the next node's cost. A finished
 * tree stops at the same multiple of the dearest node.
 */
export const BANK_CAP_MULTIPLE = 2

/**
 * Operations trickle paid when a flight lifts off. Rooms are the larger share.
 * Fractions sit in the tree carry until they make a whole point.
 */
export const FLIGHT_RP = 0.35
export const FLIGHT_RP_PER_50_PAX = 0.1
export const NIGHT_FREIGHT_RP = 0.25

/**
 * Each hired researcher multiplies the room rate by (1 + n × this).
 * Rooms earn with an empty payroll. Bare staff do not add a second trickle.
 */
export const STAFF_ROOM_BOOST = 0.5

/** One game day, used to turn a shortfall into "~N days". */
export const RESEARCH_DAY_SEC = REAL_SECONDS_PER_GAME_DAY

/** Other specialisation branches cost this much more after the first pick. */
export const SPEC_PENALTY = 1.5

/**
 * Point costs by tier. The first node of a line is free so the category can open.
 * Each later tier costs more than the one before it. One careful lab (one desk,
 * one chalkboard, one bench, no researchers) finishes the tree around day 70–90
 * when it buys the cheapest open node as points allow. See docs/RESEARCH.md.
 */
export const TIER_COSTS = [0, 26, 38, 54, 76, 108] as const

export const CATEGORIES = [
  { id: 'airfield', label: 'Airfield', unlockLevel: 1 },
  { id: 'terminal', label: 'Terminal', unlockLevel: 1 },
  { id: 'airside', label: 'Airside Ops', unlockLevel: 2 },
  { id: 'landside', label: 'Landside', unlockLevel: 2 },
  { id: 'safety', label: 'Safety & Security', unlockLevel: 3 },
  { id: 'retail', label: 'Retail & Comfort', unlockLevel: 3 },
  { id: 'specs', label: 'Specialisations', unlockLevel: 4 },
] as const

export type ResearchCategoryId = (typeof CATEGORIES)[number]['id']

export const SPEC_BRANCHES = [
  { id: 'hub', label: 'Hub' },
  { id: 'cargo', label: 'Cargo' },
  { id: 'lowcost', label: 'Low-cost' },
  { id: 'premium', label: 'Premium' },
  { id: 'green', label: 'Green' },
] as const

export type SpecBranchId = (typeof SPEC_BRANCHES)[number]['id']

/** Cash and research points paid once, when the field reaches that level. */
export const LEVEL_REWARDS: Record<number, { cash: number; rp: number }> = {
  2: { cash: 2_500, rp: 2 },
  3: { cash: 4_000, rp: 3 },
  4: { cash: 6_000, rp: 4 },
  5: { cash: 8_000, rp: 5 },
  6: { cash: 10_000, rp: 6 },
  7: { cash: 12_000, rp: 8 },
  8: { cash: 15_000, rp: 8 },
  9: { cash: 18_000, rp: 10 },
  10: { cash: 22_000, rp: 12 },
}

export function levelReward(level: number): { cash: number; rp: number } {
  return LEVEL_REWARDS[level] ?? { cash: 0, rp: 0 }
}
