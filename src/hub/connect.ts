import {
  BAG_BASE_MINUTES,
  BAG_BELT_METRES_PER_MIN,
  BAG_RFID_METRES_PER_MIN,
  BAG_RIDE_METRES_PER_MIN,
  DEPLANE_MINUTES,
  MCT_BASE,
  MCT_RFID,
  MCT_TRANSFER_CENTRE,
  MIN_WALK_METRES,
  RIDE_METRES_PER_MIN,
  WALK_METRES_PER_MIN,
} from './config.ts'
import type { ConnectionVerdict, GatePoint, HubFacilities } from './types.ts'

export function minimumConnectionTime(facilities: HubFacilities): number {
  if (facilities.rfid) return MCT_RFID
  if (facilities.transferCentre) return MCT_TRANSFER_CENTRE
  return MCT_BASE
}

export function gateMetres(from: GatePoint, to: GatePoint): number {
  const dx = Math.abs(from.x - to.x)
  const dy = Math.abs(from.y - to.y)
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return MIN_WALK_METRES
  return Math.max(MIN_WALK_METRES, dx + dy)
}

export function walkMinutes(metres: number): number {
  return Math.max(0, metres) / WALK_METRES_PER_MIN
}

export function rideMinutes(metres: number): number {
  return Math.max(0, metres) / RIDE_METRES_PER_MIN
}

function bagBase(facilities: HubFacilities): number {
  if (facilities.rfid) return BAG_BASE_MINUTES.rfid
  if (facilities.transferCentre) return BAG_BASE_MINUTES.centre
  return BAG_BASE_MINUTES.plain
}

function bagSpeed(facilities: HubFacilities, ride: boolean): number {
  if (ride) return BAG_RIDE_METRES_PER_MIN
  if (facilities.rfid) return BAG_RFID_METRES_PER_MIN
  return BAG_BELT_METRES_PER_MIN
}

/** Minutes for the through-checked bag to reach the outbound make-up. */
export function bagTransferMinutes(metres: number, facilities: HubFacilities, ride: boolean): number {
  const haul = Math.max(0, metres) / bagSpeed(facilities, ride)
  const total = bagBase(facilities) + haul
  return Number.isFinite(total) ? total : bagBase(facilities)
}

export interface ConnectionInput {
  arrivalAt: number
  departureAt: number
  from: GatePoint
  to: GatePoint
  ride: boolean
  facilities: HubFacilities
}

/**
 * A connection is made only when the schedule meets MCT and both the
 * passenger and the bag can reach the departure gate inside that window.
 */
export function evaluateConnection(input: ConnectionInput): ConnectionVerdict {
  const metres = gateMetres(input.from, input.to)
  const walk = walkMinutes(metres)
  const ride = input.ride ? rideMinutes(metres) : null
  const mode = input.ride ? 'ride' : 'walk'
  const paxMinutes = DEPLANE_MINUTES + (input.ride ? rideMinutes(metres) : walk)
  const bagMinutes = bagTransferMinutes(metres, input.facilities, input.ride)
  const mct = minimumConnectionTime(input.facilities)
  const available = input.departureAt - input.arrivalAt
  const finiteAvailable = Number.isFinite(available) ? available : 0
  const paxMade = finiteAvailable + 1e-9 >= paxMinutes
  const bagMade = finiteAvailable + 1e-9 >= bagMinutes
  const meetsMct = finiteAvailable + 1e-9 >= mct
  let reason: ConnectionVerdict['reason'] = 'ok'
  if (!meetsMct) reason = 'below_mct'
  else if (!paxMade) reason = 'pax_late'
  else if (!bagMade) reason = 'bag_late'
  const made = reason === 'ok'
  return {
    made,
    paxMade: meetsMct && paxMade,
    bagMade: meetsMct && bagMade,
    mct,
    available: finiteAvailable,
    paxMinutes,
    bagMinutes,
    walkMinutes: walk,
    rideMinutes: ride,
    mode,
    reason,
  }
}
