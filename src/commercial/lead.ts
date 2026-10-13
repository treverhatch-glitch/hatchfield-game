import { finite, nonNegative } from './num.ts'

/**
 * Days between signing and the first flight.
 * Default 7. Commuter 3–5, flag 10–14, hub 14.
 * The first starter contract is 0 so it can fly on the day it is signed.
 */

export type CarrierRole = 'commuter' | 'flag' | 'hub' | 'default'

export interface LeadBand {
  min: number
  max: number
  typical: number
}

export const LEAD_BAND: Record<CarrierRole, LeadBand> = {
  default: { min: 7, max: 7, typical: 7 },
  commuter: { min: 3, max: 5, typical: 4 },
  flag: { min: 10, max: 14, typical: 12 },
  hub: { min: 14, max: 14, typical: 14 },
}

export interface LeadInput {
  role?: CarrierRole
  /** Requested days. Clamped into the role band. Ignored for the starter contract. */
  days?: number
  /** The first starter contract. Lead time is 0. */
  starter?: boolean
}

/** Lead days for one airline at signing. */
export function resolveLead(input: LeadInput = {}): number {
  if (input.starter) return 0
  const band = LEAD_BAND[input.role ?? 'default']
  if (input.days === undefined || !Number.isFinite(input.days)) return band.typical
  return Math.min(band.max, Math.max(band.min, Math.round(input.days)))
}

/** First legal operating day: signDay + leadDays. */
export function earliestFlightDay(signDay: number, leadDays: number): number {
  return finite(signDay) + nonNegative(leadDays)
}

/** True when the flight is on or after the lead-time gate. */
export function flightRespectsLead(flightDay: number, signDay: number, leadDays: number): boolean {
  if (!Number.isFinite(flightDay)) return false
  return flightDay >= earliestFlightDay(signDay, leadDays)
}
