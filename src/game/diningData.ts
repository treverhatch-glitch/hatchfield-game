/**
 * Sit-down dining — seats near the food court, meal dwell, standing diners.
 *
 * Pure data. Tunable numbers live here, not in the sim. Distances are hall
 * cells (one cell is about 6 m) unless noted.
 */

export const DINING_TUNING = {
  /** A diner looks for a seat this many cells from the counter (Chebyshev). ~12 m. */
  seatRadius: 2,
  /** Seconds to eat at each outlet. `default` covers any outlet not listed. */
  consumeSec: { fast_food: 18, restaurant: 32, cafe: 10, default: 20 } as Record<string, number>,
  /** Outlets whose buyers eat or drink on the move and never look for a seat. */
  walkAway: ['cafe'] as readonly string[],
  /** Seconds of boarding clock a diner keeps spare after the meal, or they skip the seat. */
  boardingMarginSec: 20,
  /** Boarding need lost per second once the boarding clock runs. The hall tick uses it too. */
  boardingDrainPerSec: 0.42,
  /** Walk pace from the counter to the seat, meters per second. */
  walkMps: 1.3,
  /** Happiness lost by a diner who wanted a seat and had to eat standing. */
  standJoyHit: 2,
  /** Happiness per second while seated with a meal. */
  seatedJoyPerSec: 0.1,
  /** Shop need per second while seated, so a relaxed diner browses (and spends) after. */
  seatedShopPerSec: 0.5,
  /** Standing diners are counted over this window for the advisor. */
  standWindowSec: 120,
  /** Advisor hints once this many diners stood within the window. */
  adviseStandingAt: 3,
} as const

/** Restaurant tables: seats each outlet brings with it. */
export const TABLE_SEATS: Partial<Record<string, number>> = { restaurant: 4 }
