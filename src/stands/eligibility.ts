/**
 * One gate for "may this aircraft use this stand": fit, lease, closed, reserved.
 * Assign, swap, and the timetable pin all ask here. Fit for a sized pad is
 * `standAllowReason`. Contract size classes pass their own boolean.
 */
import type { IcaoCode } from '../render/aircraft/realworld.ts'
import { standAccepts } from '../render/aircraft/stands.ts'
import { standAllowReason } from './fit.ts'
import type { StandRung, StandSize } from './types.ts'

export interface StandClaim {
  /** Airline asking. A leased stand refuses anyone else, including an unnamed caller. */
  airlineId?: string | null
  leaseAirlineId?: string | null
  closed?: boolean
  reserved?: boolean
  /** When size, rung, airframe, and ICAO are all set, grass and asphalt lists apply. */
  size?: StandSize
  rung?: StandRung
  airframeId?: string
  aircraftIcao?: IcaoCode
  /** Painted letter for a stand that has no size yet. */
  standLetter?: IcaoCode
  /**
   * Contract stands are size classes, not ICAO letters.
   * False means the stand cannot take the aircraft. Undefined skips the check.
   */
  sizeClassFits?: boolean
  standId?: string
  aircraftSizeClass?: string
}

/** First reason the claim is refused. Null when the aircraft may use the stand. */
export function standRefusal(claim: StandClaim): string | null {
  if (claim.closed) return 'Stand is closed.'
  if (claim.reserved) return 'Stand is reserved.'
  if (claim.leaseAirlineId && claim.leaseAirlineId !== (claim.airlineId ?? null)) {
    return 'Stand is leased to another airline.'
  }
  if (claim.size && claim.rung != null && claim.airframeId && claim.aircraftIcao) {
    return standAllowReason(claim.size, claim.rung, claim.airframeId, claim.aircraftIcao)
  }
  if (claim.aircraftIcao === 'H') return 'Helicopters use a helipad.'
  if (claim.standLetter && claim.aircraftIcao && !standAccepts(claim.standLetter, claim.aircraftIcao)) {
    return `Code ${claim.aircraftIcao} does not fit a code ${claim.standLetter} stand.`
  }
  if (claim.sizeClassFits === false) {
    return `stand ${claim.standId ?? 'stand'} too small for ${claim.aircraftSizeClass ?? 'aircraft'}`
  }
  return null
}
