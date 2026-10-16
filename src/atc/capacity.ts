import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'

/**
 * Seconds the starter strip is locked for one arrival: short-final lock
 * through the landing roll leaving the pavement.
 *
 * Measured on the starter field (speed 1, 0.05s steps), one Harbor arrival,
 * five empty-field samples: 10.60s, 10.60s, 11.05s, 10.60s, 13.45s.
 * An earlier pair was 10.60s and 9.95s. The constant is the longer of the
 * repeated samples, rounded up, so the bank is not tighter than the roll.
 */
export const ARRIVAL_OCCUPANCY_SEC = 14

/**
 * Seconds the starter strip is locked for one departure: lineup lock through
 * the takeoff roll going airborne.
 *
 * Same harness, five samples: 13.30s, 14.00s, 13.90s, 13.90s, 12.70s.
 * The lock starts at the hold line (taxi, just short of the pavement) and
 * ends when the aircraft is airborne. The constant is the longer sample,
 * rounded up. Spacing stays on this figure. One later seed, with passengers
 * riding to the layby, holds for 17.60s; that sample is pinned in the
 * occupancy test and does not widen the gap.
 */
export const DEPARTURE_OCCUPANCY_SEC = 14

/**
 * Seconds from spawn until the arrival locks the strip. Measured 7.05s
 * (approach began at 406.50s, lock at 413.55s). The arrival is airborne
 * for this lead; it is not strip occupancy. A departure slot is checked
 * against the lock, not against the whole turnaround.
 */
export const ARRIVAL_LOCK_LEAD_SEC = 7.1

/**
 * Extra seconds on the arrival gap so a departure waiting at the hold line
 * can still enter the hole. Playtest and soak steps are 1.25 sim seconds
 * (0.25s tick at 5×). A gap of exactly arrival + departure has zero width:
 * the step that sees the strip go free is already too late to finish the
 * roll before the next lock, so the slot is never used. Four seconds is
 * the smallest allowance that stays inside one step of the measured sum.
 */
export const RUNWAY_SLOT_SLACK_SEC = 4

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

/**
 * Arrival-to-arrival gap on one strip: the arrival's occupancy plus one
 * departure slot. A second strip does not shrink this. It runs its own bank.
 *
 * The night demand curve stretches commercial spacing by at most 1.4. The
 * physical gap stays inside the interval two stands already turn (about one
 * completed flight every 76s on the idle soak) so the timetable does not
 * idle a gate. The opening ten minutes still uses a wider gap in the seeder
 * so the prefab does not fill in the first minutes.
 */
export function runwayArrivalGapSec(_strips = 1): number {
  return ARRIVAL_OCCUPANCY_SEC + DEPARTURE_OCCUPANCY_SEC + RUNWAY_SLOT_SLACK_SEC
}

/**
 * Movements the strips can start in a window. Each strip runs its own gap.
 * One turn is an arrival and a departure.
 */
export function runwayMovementCapacity(strips: number, windowSec = REAL_SECONDS_PER_GAME_DAY): number {
  const lanes = Math.max(1, Math.floor(Number.isFinite(strips) ? strips : 1))
  const window = Number.isFinite(windowSec) ? Math.max(0, windowSec) : 0
  const gap = runwayArrivalGapSec(1)
  if (!(gap > 0)) return 0
  const turns = Math.floor((window + gap - 1e-9) / gap)
  return Math.max(0, turns) * 2 * lanes
}

/** True when the timetable asks the strips to start more movements than they can. */
export function runwayOverbooked(scheduled: number, capacity: number): boolean {
  if (!Number.isFinite(scheduled) || !Number.isFinite(capacity)) return false
  return scheduled > capacity + 1e-6
}
