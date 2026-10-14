/**
 * Wave 3 tunables. Research points live on the Growth tree. This file is the
 * relationship contract rider.
 *
 * Relationship money: Wave 3 owns the landing-fee factor (`feeMult`).
 * Diplomacy keeps slot capacity (`capacityFactor`) and does not multiply the
 * landing bill. Tier 1 `feeMult` is 1, and a neutral diplomacy discount is
 * also 1, so a tier-1 neutral landing total matches the old stacked formula.
 * Catalog fees, airframe multipliers, the published fee index, disruptions,
 * and negotiated line percents are not relationship factors.
 */
export const RELATION_FEE_OWNER = 'wave3' as const

export const RELATION_MIN = -100
export const RELATION_MAX = 100

/** Lose a band only this far past its edge. */
export const BAND_HYSTERESIS = 5

export const SCORE_ON_ACCEPT = 2
export const SCORE_ON_DECLINE = -3
/**
 * On-time departure. One clean turn a day, with the contract kept, crosses
 * Preferred inside PREFERRED_DAY_MIN..MAX even before the lounges count.
 * A day of real delays does not. The 60-day careful bot is the served-field check.
 */
export const SCORE_ON_SUCCESS = 0.9
/** A late pushback or a turnaround grade of C or worse. */
export const SCORE_ON_DELAY = -0.55
export const SCORE_ON_CANCEL = -4

/** Departure is late this many game minutes past STD. Arrival delaySec is not a turnaround. */
export const LATE_DEPARTURE_GAME_MIN = 15

/** Clean turns a well-served carrier finishes in one game day. */
export const CAREFUL_TURNS_PER_DAY = 3
export const PREFERRED_DAY_MIN = 20
export const PREFERRED_DAY_MAX = 30
export const SCORE_ON_MISSED_ASK = -1
/** Relation hit when a fine posts. The cash amount stays on the ledger. Once per posting, not per passenger. */
export const SCORE_ON_FINE = -0.2

/**
 * Once a day, for each signed carrier.
 * Kept days, spare stands, lounges and gates add whether or not the last turn was late.
 * Delays, missed asks and fines subtract on their own. A strained ramp (too few stands) subtracts too.
 */
export const SCORE_KEPT_PER_DAY = 0.08
export const SCORE_CAPACITY = 0.16
export const SCORE_CAPACITY_STRAIN = -0.12
export const SCORE_PER_LOUNGE = 0.12
export const LOUNGE_SCORE_CAP = 2
export const SCORE_PER_GATE = 0.1
export const GATE_SCORE_CAP = 2
/** Stands per signed carrier before capacity counts as headroom. */
export const CAPACITY_HEADROOM = 0.3
/** Below this, the ramp is strained and capacity pulls the score down. */
export const CAPACITY_STRAIN = 0.15
/** Turns before stand, lounge and gate credit counts in full. A signed carrier that never flies does not climb on the building. */
export const EXPERIENCE_TURNS = 8

/**
 * Contract quality from the relationship score.
 * Fee multipliers apply on top of the published terms. Tier 1 is exactly 1,
 * so a new relationship does not move existing fees.
 * Tiers never add aircraft. Each tier's `unlock` is the visible concession.
 */
export const CONTRACT_TIERS = [
  { tier: 1, minScore: -100, feeMult: 1, extraSlots: 0, penaltyMult: 1, label: 'Published', unlock: 'Published schedule' },
  { tier: 2, minScore: 20, feeMult: 1.05, extraSlots: 1, penaltyMult: 1, label: 'Preferred', unlock: 'More routes' },
  { tier: 3, minScore: 45, feeMult: 1.1, extraSlots: 2, penaltyMult: 0.95, label: 'Trusted', unlock: 'Hub request' },
  { tier: 4, minScore: 70, feeMult: 1.15, extraSlots: 3, penaltyMult: 0.9, label: 'Priority', unlock: 'Bigger aircraft' },
  { tier: 5, minScore: 90, feeMult: 1.22, extraSlots: 4, penaltyMult: 0.85, label: 'Flagship', unlock: 'Exclusivity' },
] as const

export type ContractTier = (typeof CONTRACT_TIERS)[number]['tier']

export function unlocksThrough(tier: number): string[] {
  return CONTRACT_TIERS.filter((row) => row.tier <= tier).map((row) => row.unlock)
}

export function nextTier(score: number): (typeof CONTRACT_TIERS)[number] | null {
  return CONTRACT_TIERS.find((row) => row.minScore > score) ?? null
}

/** Priority and Flagship fly the largest type already in the closed fleet. */
export function tierWantsLargerMetal(tier: number): boolean {
  return CONTRACT_TIERS.some((row) => row.tier <= tier && row.unlock === 'Bigger aircraft')
}

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
