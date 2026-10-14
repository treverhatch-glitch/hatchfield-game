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
  CONNECTION_RECOVERY_MIN,
  CONNECTION_RECOVERY_TRIES,
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

/**
 * Departures still ahead of an actual landing, soonest first, inside the
 * recovery window. The sold flight is often already gone when the inbound is late.
 */
export function laterDepartures(
  moves: readonly Movement[],
  actualArrival: number,
  windowMinutes = CONNECTION_RECOVERY_MIN,
): Movement[] {
  const arrival = Number.isFinite(actualArrival) ? actualArrival : 0
  const span = Number.isFinite(windowMinutes) ? Math.max(0, windowMinutes) : 0
  const latest = arrival + span
  return moves
    .filter((move) => move.direction === 'dep' && Number.isFinite(move.at) && move.at > arrival && move.at <= latest)
    .sort((a, b) => a.at - b.at)
}

export interface ResolvedConnection {
  verdict: ConnectionVerdict
  to: GatePoint
  departureAt: number
  /** A later departure saved a sold connection that would have missed. */
  recovered: boolean
}

export interface ResolveConnectionInput {
  moves: readonly Movement[]
  /** Game-minute the inbound actually landed. */
  arrivalAt: number
  /** Game-minute the itinerary was sold against. */
  plannedArrival: number
  from: GatePoint
  gates: readonly GatePoint[]
  facilities: HubFacilities
  ride?: boolean
  walkwayMetres?: number
  linkFor?: (fromId: string, toId: string) => PassengerLink | undefined
  recoveryTries?: number
}

function pickGate(gateId: string | null, gates: readonly GatePoint[], from: GatePoint, preferOther: boolean): GatePoint {
  if (gateId) {
    const hit = gates.find((gate) => gate.id === gateId)
    if (hit) return hit
  }
  // A sold flight with no stand yet still leaves from another gate. A recovery
  // candidate with no stand is this aircraft's own turn, still at the arrival stand.
  if (preferOther) return gates.find((gate) => gate.id !== from.id) ?? from
  return from
}

/**
 * Sell the connection from the planned arrival. When that flight cannot be
 * made, take the soonest later departure inside the recovery window that the
 * walk and the bags can both reach. A belt or a walk that fits none of them
 * keeps the original miss.
 */
export function resolveConnection(input: ResolveConnectionInput): ResolvedConnection | null {
  if (!input.from) return null
  const arrivalAt = Number.isFinite(input.arrivalAt) ? input.arrivalAt : 0
  const plannedArrival = Number.isFinite(input.plannedArrival) ? input.plannedArrival : arrivalAt
  const facilities = input.facilities
  const onward = bookOnward(input.moves, plannedArrival, minimumConnectionTime(facilities))
  const soldGate = pickGate(onward.gateId, input.gates, input.from, true)
  const walkwayMetres = input.walkwayMetres ?? 0
  const judge = (gate: GatePoint, departureAt: number) =>
    evaluateConnection({
      arrivalAt,
      departureAt,
      from: input.from,
      to: gate,
      ride: input.ride ?? false,
      link: input.linkFor?.(input.from.id, gate.id),
      walkwayMetres,
      facilities,
    })
  const sold = judge(soldGate, onward.at)
  if (sold.made) {
    return { verdict: sold, to: soldGate, departureAt: onward.at, recovered: false }
  }
  const tries = Number.isFinite(input.recoveryTries) ? Math.max(0, input.recoveryTries ?? 0) : CONNECTION_RECOVERY_TRIES
  const candidates = laterDepartures(input.moves, arrivalAt).slice(0, tries)
  for (const candidate of candidates) {
    if (candidate.at === onward.at && candidate.gateId === onward.gateId) continue
    const gate = pickGate(candidate.gateId, input.gates, input.from, false)
    const again = judge(gate, candidate.at)
    if (again.made) {
      return { verdict: again, to: gate, departureAt: candidate.at, recovered: true }
    }
  }
  return { verdict: sold, to: soldGate, departureAt: onward.at, recovered: false }
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
