/**
 * Playtest knobs. Sim time follows the field clock: one day is 180 seconds.
 * The driver ticks at max speed (5×), same control a player uses.
 */
export const PLAYTEST_TUNING = {
  /** Real seconds passed into Game.tick. The clock advances dt × speed. */
  tickDt: 0.25,
  /** How often a persona looks at the board, in sim seconds. */
  actEverySec: 12,
  carefulDays: 45,
  greedyDays: 60,
  chaoticDays: 30,
  maxSpeed: 5 as const,
  /** A stuck entity must stay clear this long before it counts as recovered. */
  stuckRecoverSec: 15,
  /** Still stuck this long → softlock. */
  softlockStuckSec: 180,
  /** Ticks in a row with a live field whose clock does not move. */
  stallTicks: 60,
  /** Acts with no land before the run gives up. */
  landlessActs: 120,
  slowestTickCount: 8,
  couldNotLimit: 40,
  /**
   * Hall rooms the personas furnish once the day-1 research trickle has banked
   * a whole point. Order is desk, then board, then bench. Costs stay in the catalog.
   */
  labRooms: ['rdesk', 'rboard', 'rmachine'] as const,
} as const
