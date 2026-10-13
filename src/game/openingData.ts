/**
 * Opening balance — the first 10 minutes of a default new game.
 *
 * Prefab I should feel comfortable while the player is still learning the
 * loop. Pressure comes back when the clock leaves this window, a second
 * carrier signs, or the bank grows past these ceilings. Tunable here.
 */

/** Sim seconds that count as the opening. Same window as the early payroll phase. */
export const OPENING_SEC = 600

/**
 * Prefab I ceilings. Each one stays under Prefab II so the upgrade is still
 * a step up: II is 48 pax, 3 lanes, queue 20, 140 bag units.
 */
export const STARTER_CAPACITY = {
  paxCap: 46,
  servers: 2,
  serviceSec: 3.2,
  queueCap: 16,
  bagAllowance: 88,
  upkeepDay: 105,
  /** Check-in belt + self-service kiosk in the prefab bundle. */
  desks: 2,
  /** Jetway stands on the starter apron. */
  gates: 2,
  /** Claim carousels in the prefab bundle. */
  bagClaim: 1,
  /** Drop-off stalls one curb beside the hall counts as. */
  curbStalls: 8,
} as const

/** How far a road tile can sit from the hall origin and still be its curb. */
export const CURB_REACH = 4

/**
 * Open slots the tower will keep during the opening.
 * Null means the normal strip-based bank.
 */
export function openingSlotCap(clock: number): number | null {
  if (clock >= OPENING_SEC) return null
  if (clock < 180) return 2
  if (clock < 420) return 3
  return 4
}

/** Extra seconds between slots while the opening bank is still thin. */
export function openingSpacingBonus(clock: number): number {
  if (clock >= OPENING_SEC) return 0
  if (clock < 180) return 22
  if (clock < 420) return 12
  return 6
}

/** Slots written when the first carrier signs inside the opening. */
export const OPENING_FIRST_SLOTS = 2

/**
 * Bags the claim belt will actually present.
 * A prefab uses its published bag ceiling. A custom hall uses stalls per room.
 */
export function claimHoldUnits(premade: boolean, bagAllowance: number, rooms: number): number {
  if (premade) return Math.max(1, Math.round(bagAllowance))
  return Math.max(1, rooms) * 80
}
