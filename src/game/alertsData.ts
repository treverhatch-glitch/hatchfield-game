/**
 * Alert tuning — live operational problems. Pure data, read by alerts.ts and the sim scan.
 * Times are sim-seconds on the game clock (one sim hour is 7.5s).
 */
export const ALERT_TUNING = {
  /** How often the sim checks live conditions. */
  scanSec: 2,
  /** A dismissed alert stays quiet this long, then may come back if the problem is still there. */
  dismissQuietSec: 60,
  /** One-off event alerts (a failed inbound) fade after this long if nobody touches them. */
  eventTtlSec: 45,
  /** An aircraft that has not changed phase in this long on the ground counts as stuck. */
  stuckSec: 40,
  /** Holding this long in the stack, before the watchdog diverts it, counts as stuck too. */
  holdStuckSec: 60,
  /** Cash under this is a warning; under zero is critical. */
  lowCash: 5000,
  /** The stack shows this many entries; the rest wait their turn behind the counter. */
  visible: 4,
  /** Dismissed over-capacity hint stays off the corner for this long. */
  capacityCoolSec: 90,
} as const

/** Phases where a jet should keep moving. */
export const STUCK_PHASES = ['taxi_in', 'taxi_out', 'pushback', 'mx_taxi', 'mx_return'] as const
