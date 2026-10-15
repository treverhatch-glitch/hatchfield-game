import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'

/**
 * Sim-seconds between arrivals on one strip. A second strip halves the gap.
 *
 * This is how long the strip stays busy for one landing to roll clear, not
 * the full gate turn. The same aircraft is back for its own departure about
 * 130–140s after it spawned, and the starter kit has two stands, so the next
 * arrival is already on short final while the first is at the gate. Spacing
 * the bank by that whole turn leaves a stand empty.
 *
 * The night demand curve stretches this gap by at most 1.4. The headway stays
 * inside the interval two stands already turn (about one completed flight
 * every 76s on the idle soak) so the timetable does not idle a gate.
 */
export const RUNWAY_TURN_SEC = 48

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

/** Arrival-to-arrival gap that lets the previous landing roll clear the strip. */
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
