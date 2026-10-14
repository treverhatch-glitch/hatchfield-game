/**
 * Wave 3 tunables. These are a separate research-points currency and a
 * relationship contract rider. They do not replace catalog fees, RP_RATE_*,
 * or the economy module's balance table.
 */

export const RELATION_MIN = -100
export const RELATION_MAX = 100

/** Lose a band only this far past its edge. */
export const BAND_HYSTERESIS = 5

export const SCORE_ON_ACCEPT = 2
export const SCORE_ON_DECLINE = -3
export const SCORE_ON_SUCCESS = 0.25
export const SCORE_ON_DELAY = -1.5
export const SCORE_ON_CANCEL = -6

/**
 * Contract quality from the relationship score.
 * Fee multipliers apply on top of the published terms. Tier 1 is exactly 1,
 * so a new relationship does not move existing fees.
 * Tiers never add aircraft.
 */
export const CONTRACT_TIERS = [
  { tier: 1, minScore: -100, feeMult: 1, extraSlots: 0, penaltyMult: 1, label: 'Published' },
  { tier: 2, minScore: 20, feeMult: 1.05, extraSlots: 1, penaltyMult: 1, label: 'Preferred' },
  { tier: 3, minScore: 45, feeMult: 1.1, extraSlots: 2, penaltyMult: 0.95, label: 'Trusted' },
  { tier: 4, minScore: 70, feeMult: 1.15, extraSlots: 3, penaltyMult: 0.9, label: 'Priority' },
  { tier: 5, minScore: 90, feeMult: 1.22, extraSlots: 4, penaltyMult: 0.85, label: 'Flagship' },
] as const

export type ContractTier = (typeof CONTRACT_TIERS)[number]['tier']

/**
 * Passive research trickle from operations. Runs on day 1 with no staff and
 * no rooms. Rooms are the bulk of the income.
 */
export const OPS_TRICKLE_PER_SEC = 0.02

/** Extra points when a turnaround is graded. Still small next to a staffed lab. */
export const OPS_RP_PER_TURNAROUND = 0.35

export const ROOM_RP_PER_SEC = {
  desk: 0.06,
  board: 0.04,
  machine: 0.09,
} as const

/**
 * Late lab: eight hours at 1x, sixteen placed rooms.
 * At the rates above this is about 92% of one branch, short of the capstone.
 */
export const LATE_LAB = {
  seconds: 8 * 3600,
  desk: 8,
  board: 4,
  machine: 4,
} as const

/** Research-point cost of each depth, shared by every branch. */
export const DEPTH_COST = [2000, 2800, 3600, 4400, 5000, 5400, 4600, 4200] as const

/** Field level required to buy that depth. Depth 8 needs a late field. */
export const DEPTH_FIELD_LEVEL = [1, 1, 2, 2, 3, 3, 4, 5] as const

export const BRANCHES = ['passenger', 'cargo', 'efficiency', 'prestige'] as const
export type ResearchBranch = (typeof BRANCHES)[number]
