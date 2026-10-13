import {
  BUS_RIDE_MINUTES,
  CONNECTIVITY_CATALOG,
  PEOPLE_MOVER_RIDE_MINUTES,
} from '../connectivity/catalog.ts'
import type { PassengerLink } from '../connectivity/types.ts'
import {
  BAG_BASE_MINUTES,
  BAG_BELT_METRES_PER_MIN,
  BAG_RFID_METRES_PER_MIN,
  BAG_RIDE_METRES_PER_MIN,
  DEFAULT_CONNECTION_WINDOW,
  DEPLANE_MINUTES,
  MCT_BASE,
  MCT_RFID,
  MCT_TRANSFER_CENTRE,
  MIN_WALK_METRES,
  RIDE_METRES_PER_MIN,
  WALK_METRES_PER_MIN,
} from './config.ts'
import type { ConnectionVerdict, GatePoint, HubFacilities, Movement } from './types.ts'

export interface OnwardBooking {
  /** Game-minute departure the connection was sold on. */
  at: number
  /** Gate of that departure. Null when no timetable departure fits. */
  gateId: string | null
}

/**
 * The onward flight a connecting passenger was sold. Itineraries are sold
 * from the planned arrival, so the first departure at or after planned + MCT.
 * A late inbound then eats into that slack instead of rebooking for free.
 */
export function bookOnward(moves: readonly Movement[], plannedArrival: number, mct: number): OnwardBooking {
  const planned = Number.isFinite(plannedArrival) ? plannedArrival : 0
  const gap = Number.isFinite(mct) ? Math.max(0, mct) : 0
  const earliest = planned + gap
  let best: Movement | null = null
  for (const move of moves) {
    if (move.direction !== 'dep' || !Number.isFinite(move.at)) continue
    if (move.at + 1e-9 < earliest) continue
    if (!best || move.at < best.at) best = move
  }
  if (best) return { at: best.at, gateId: best.gateId }
  return { at: planned + Math.max(DEFAULT_CONNECTION_WINDOW, gap), gateId: null }
}

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

/** A moving walkway speeds only the metres it covers. The rest stays at a walk. */
export function assistedWalkMinutes(metres: number, walkwayMetres: number): number {
  const span = Math.max(0, Number.isFinite(metres) ? metres : 0)
  const covered = Math.min(span, Math.max(0, Number.isFinite(walkwayMetres) ? walkwayMetres : 0))
  const pace = WALK_METRES_PER_MIN
  const fast = pace * CONNECTIVITY_CATALOG.moving_walkway.speedMult
  if (!(pace > 0) || !(fast > 0)) return 0
  const total = (span - covered) / pace + covered / fast
  return Number.isFinite(total) ? total : 0
}

export function rideMinutes(metres: number): number {
  return Math.max(0, metres) / RIDE_METRES_PER_MIN
}

export function skywalkMinutes(metres: number): number {
  const pace = CONNECTIVITY_CATALOG.skywalk.metresPerMin
  if (!(pace > 0)) return walkMinutes(metres)
  const total = Math.max(0, metres) / pace
  return Number.isFinite(total) ? total : walkMinutes(metres)
}

/** Minutes in motion for one link. Deplane time is added by the verdict. */
export function linkTravelMinutes(link: PassengerLink, metres: number, walkwayMetres: number): number {
  if (link === 'people_mover') return PEOPLE_MOVER_RIDE_MINUTES
  if (link === 'airside_transfer_bus') return BUS_RIDE_MINUTES
  if (link === 'terminal_bus') return rideMinutes(metres)
  if (link === 'skywalk') return skywalkMinutes(metres)
  return assistedWalkMinutes(metres, link === 'walkway' ? walkwayMetres : 0)
}

export function resolveLink(ride: boolean, link: PassengerLink | undefined, walkwayMetres: number): PassengerLink {
  if (link) return link
  if (ride) return 'terminal_bus'
  if (walkwayMetres > 0) return 'walkway'
  return 'walk'
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
  /** Preferred over `ride` when the sim has chosen a built link. */
  link?: PassengerLink
  /** Metres of moving walkway between the gates. */
  walkwayMetres?: number
}

/**
 * A connection is made only when the schedule meets MCT and both the
 * passenger and the bag can reach the departure gate inside that window.
 */
export function evaluateConnection(input: ConnectionInput): ConnectionVerdict {
  const metres = gateMetres(input.from, input.to)
  const walkwayMetres = Math.max(0, input.walkwayMetres ?? 0)
  const link = resolveLink(input.ride, input.link, walkwayMetres)
  const walk = link === 'walkway' ? assistedWalkMinutes(metres, walkwayMetres) : walkMinutes(metres)
  const travel = linkTravelMinutes(link, metres, walkwayMetres)
  const riding = link !== 'walk' && link !== 'walkway'
  const ride = riding ? travel : null
  const mode = riding ? 'ride' : 'walk'
  const bagsRide = link === 'people_mover' || link === 'airside_transfer_bus' || link === 'terminal_bus'
  const paxMinutes = DEPLANE_MINUTES + travel
  const bagMinutes = bagTransferMinutes(metres, input.facilities, bagsRide)
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
    link,
    reason,
  }
}
