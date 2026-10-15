import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'

/**
 * Sim-seconds from one arrival's ETA until that aircraft's departure has
 * cleared the strip on a single runway with a starter-kit turn (walk-on
 * boarding, one taxiway). A second strip halves the gap.
 *
 * Measured on the starter field: the arrival is on the runway again for its
 * departure about 130–140s after it spawned. Scheduling tighter than that puts
 * the next short final on top of the previous takeoff roll.
 */
export const RUNWAY_TURN_SEC = 150

/**
 * A due slot may sit this far past its ETA while the strip finishes the
 * aircraft already on it. Past this, an overbooked bank books lateness.
 */
export const RUNWAY_LATE_SLACK_SEC = 4

/**
 * Sim-seconds a curfew, a storm, or a long queue may slip one flight when the
 * bank still fits the runway. The slip does not cascade. An overbooked bank
 * uses the full delay instead, so lateness grows only then.
 */
export const RUNWAY_GENTLE_SLIP_SEC = 2

/** Arrival-to-arrival gap that leaves the previous departure time to clear. */
export function runwayArrivalGapSec(strips: number): number {
  const lanes = Math.max(1, Math.floor(Number.isFinite(strips) ? strips : 1))
  return RUNWAY_TURN_SEC / lanes
}

/**
 * Movements the strips can start in a window. One turn is an arrival and a
 * departure, and a gap-spaced bank fills the window without going over.
 */
export function runwayMovementCapacity(strips: number, windowSec = REAL_SECONDS_PER_GAME_DAY): number {
  const lanes = Math.max(1, Math.floor(Number.isFinite(strips) ? strips : 1))
  const window = Number.isFinite(windowSec) ? Math.max(0, windowSec) : 0
  const gap = RUNWAY_TURN_SEC / lanes
  if (!(gap > 0)) return 0
  const turns = Math.floor((window + gap - 1e-9) / gap)
  return Math.max(0, turns) * 2
}

/** True when the timetable asks the strips to start more movements than they can. */
export function runwayOverbooked(scheduled: number, capacity: number): boolean {
  if (!Number.isFinite(scheduled) || !Number.isFinite(capacity)) return false
  return scheduled > capacity + 1e-6
}
