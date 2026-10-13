import {
  RFID_MCT_MINUTES,
  STANDING_HIT_CAP,
  STANDING_PER_MISSED_PASSENGER,
  TRANSFER_CENTRE_MCT_MINUTES,
  WALK_MCT_MINUTES,
  finite,
  nonNegative,
} from './catalog.ts'
import type { ConnectionOptions } from './types.ts'

/**
 * Minimum connection time in minutes.
 * A transfer centre publishes 45. The RFID stub flag cuts that to 25.
 * Without the centre, passengers are on the walk-only time even if the flag is set.
 */
export function minimumConnectionMinutes(options: ConnectionOptions): number {
  if (options.hasTransferCentre === true && options.rfid === true) return RFID_MCT_MINUTES
  if (options.hasTransferCentre === true) return TRANSFER_CENTRE_MCT_MINUTES
  return WALK_MCT_MINUTES
}

/**
 * Standing change for passengers who already missed.
 * A plain number, zero or negative. The diplomacy adapter adds it.
 * This module does not import diplomacy.
 */
export function missedConnectionStandingDelta(missedPassengers: number): number {
  const missed = nonNegative(missedPassengers)
  const perHead = nonNegative(STANDING_PER_MISSED_PASSENGER)
  const cap = nonNegative(STANDING_HIT_CAP)
  const product = missed * perHead
  const hit = Number.isFinite(product) ? Math.min(cap, product) : cap
  if (!(hit > 0)) return 0
  return -round2(hit)
}

/**
 * Standing change for one connection attempt.
 * The gap is the minutes between arrival and the onward departure.
 * Meeting the minimum connection time scores 0. Missing it returns the plain
 * Standing delta. A non-finite gap is not a real attempt, so it does not move Standing.
 */
export function connectionStandingDelta(
  gapMinutes: number,
  missedPassengers: number,
  options: ConnectionOptions,
): number {
  if (!Number.isFinite(gapMinutes)) return 0
  if (gapMinutes >= minimumConnectionMinutes(options)) return 0
  return finite(missedConnectionStandingDelta(missedPassengers))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
