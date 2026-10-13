/**
 * Litter, trash cans, restroom dirt, and hall janitors.
 *
 * Pure data. Tunable numbers live here, not in the sim. Distances are hall
 * cells (one cell is HALL_W / cols meters, about 6 m) unless noted.
 */

export const LITTER_TUNING = {
  /** A trash can catches rubbish from this many cells away (Chebyshev). ~12 m. */
  binRadius: 2,
  /** Pieces one can holds before it shows full and refuses more. */
  binCap: 24,
  /** Janitors go for a can once it is this full (0–1), before it overflows. */
  binEmptyAt: 0.75,
  /** Happiness drained per second per floor piece in the guest's zone. */
  joyPerPiecePerSec: 0.012,
  /** The litter drain stops growing here, so a trashed hall hurts but does not zero everyone. */
  joyDrainCapPerSec: 0.35,
  /** Comfort points one floor piece takes away from its zone. */
  comfortPerPiece: 0.4,
  /** Restroom dirt (0–100) added per visit, by tag. */
  restroomDirtPerUse: { budget: 3, family: 2.4, business: 1.2, premium: 1, default: 1.6 },
  /** Above this, guests notice the WC is dirty. */
  restroomDirtyAt: 45,
  /** Happiness lost on a visit to a fully filthy WC. Scales linearly from `restroomDirtyAt`. */
  restroomJoyHit: 8,
  /** Janitor walk speed, meters per second. */
  janitorSpeedMps: 1.3,
  /** Seconds to sweep one floor piece. */
  sweepSec: 2.5,
  /** Seconds to swap a bin bag. */
  emptyBinSec: 5,
  /** Seconds to service the restroom. */
  restroomServiceSec: 12,
  /** Dirt removed by one restroom service. */
  restroomCleanPerVisit: 70,
  /** Janitors start servicing the WC above this dirt even without a bigger job. */
  restroomServiceAt: 20,
  /** Cleaning budget share below which janitors stand idle (matches the field crew). */
  minCleaningBudget: 0.2,
  /** Advisor warns once a hall has this many floor pieces. */
  adviseLitterAt: 6,
} as const

/** Kit item id for the trash can. */
export const TRASH_CAN = 'trash_can'
