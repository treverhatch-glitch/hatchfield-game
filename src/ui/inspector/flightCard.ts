import { BAG_CART_WAIT, CATERING_CART_WAIT } from '../../carts/cause.ts'
import type { HallGuest } from '../../game/guests.ts'
import type { Flight, ScheduleSlot, Tile, Vec } from '../../game/types.ts'

/** Right-edge width from the flight-card spec. */
export const FLIGHT_CARD_WIDTH = 320

/**
 * Sits above the alert dock. The dock is `bottom: 168px` and at most
 * `min(40vh, 320px)` tall, so the card's bottom edge clears that box.
 */
export const FLIGHT_CARD_BOTTOM = 'calc(168px + min(40vh, 320px) + 12px)'

export function labelPhase(phase: string, craft?: string): string {
  if (craft === 'helo') {
    const helo: Record<string, string> = {
      approach: 'Hover in',
      landing: 'Settling',
      servicing: 'On pad',
      takeoff: 'Lifting',
    }
    return helo[phase] ?? phase
  }
  const map: Record<string, string> = {
    hold: 'Holding',
    approach: 'On approach',
    landing: 'Landing',
    taxi_in: 'Taxi in',
    deboard: 'Deboarding',
    servicing: 'Servicing',
    mx_taxi: 'Taxi to hangar',
    mx_bay: 'Hangar MX',
    mx_return: 'Return from hangar',
    board: 'Boarding',
    pushback: 'Pushback',
    parked: 'Parked (GA)',
    taxi_out: 'Taxi out',
    takeoff: 'Takeoff',
    gone: 'Airborne',
  }
  return map[phase] ?? phase
}

export interface ServiceProgress {
  id: string
  label: string
  state: 'done' | 'waiting' | 'idle'
  detail: string
}

const PAST_DEBOARD = new Set([
  'servicing',
  'board',
  'pushback',
  'taxi_out',
  'takeoff',
  'mx_taxi',
  'mx_bay',
  'mx_return',
  'parked',
  'gone',
])

const PAST_BOARD = new Set(['pushback', 'taxi_out', 'takeoff', 'gone'])

function flagProgress(
  id: string,
  label: string,
  posted: boolean,
  waiting: boolean,
  waitingDetail = 'Waiting',
): ServiceProgress {
  if (posted) return { id, label, state: 'done', detail: 'Done' }
  if (waiting) return { id, label, state: 'waiting', detail: waitingDetail }
  return { id, label, state: 'idle', detail: 'Not started' }
}

function countProgress(
  id: string,
  label: string,
  waiting: number,
  finished: boolean,
): ServiceProgress {
  if (waiting > 0) return { id, label, state: 'waiting', detail: `${waiting} still moving` }
  if (finished) return { id, label, state: 'done', detail: 'Clear' }
  return { id, label, state: 'idle', detail: 'Not started' }
}

export interface CartServiceHold {
  bagsIn?: boolean
  bagsOut?: boolean
  catering?: boolean
}

/** One line per turnaround service, from the flight's posted and waiting flags. */
export function serviceProgress(flight: Flight, hold: CartServiceHold = {}): ServiceProgress[] {
  return [
    flagProgress('bags', 'Bags in', flight.posted.bags, flight.waitingOn.bags || Boolean(hold.bagsIn), hold.bagsIn ? BAG_CART_WAIT : 'Waiting'),
    flagProgress(
      'bagsLoad',
      'Bags out',
      flight.posted.bagsLoad,
      flight.waitingOn.bagsLoad || Boolean(hold.bagsOut),
      hold.bagsOut ? BAG_CART_WAIT : 'Waiting',
    ),
    flagProgress('fuel', 'Fuel', flight.posted.fuel, flight.waitingOn.fuel),
    flagProgress(
      'catering',
      'Catering',
      flight.posted.catering,
      flight.waitingOn.catering || Boolean(hold.catering),
      hold.catering ? CATERING_CART_WAIT : 'Waiting',
    ),
    flagProgress('mx', 'Line MX', flight.posted.mx, flight.waitingOn.mx),
    flagProgress('deice', 'De-ice', flight.posted.deiced, flight.waitingOn.deice),
    countProgress('paxOut', 'Deboard', flight.waitingOn.paxOut, PAST_DEBOARD.has(flight.phase)),
    countProgress('paxIn', 'Board', flight.waitingOn.paxIn, PAST_BOARD.has(flight.phase)),
  ]
}

export function delaySummary(slot: Pick<ScheduleSlot, 'delayReason' | 'delaySec'> | null | undefined): string {
  if (!slot?.delayReason) return 'On time'
  if (slot.delaySec > 0) return `${slot.delayReason} · ${Math.round(slot.delaySec)}s`
  return slot.delayReason
}

export function flightDelaySummary(flight: Flight, schedule: ScheduleSlot[]): string {
  const slot = flight.scheduleId ? schedule.find((row) => row.id === flight.scheduleId) : undefined
  return delaySummary(slot)
}

interface ConnectionGuest {
  flightId: string
  dead: boolean
  transfer?: boolean
  connectFlightId?: string | null
}

interface ConnectionFlight {
  id: string
  flightNo: string
}

function connectionTargetLabel(id: string, flights: ConnectionFlight[]): string {
  if (id.startsWith('rebook:')) return `rebook ${id.slice('rebook:'.length)}`
  if (id.startsWith('connect:')) {
    const rest = id.slice('connect:'.length)
    const match = flights.find((flight) => rest === flight.id || rest.startsWith(`${flight.id}:`))
    if (match) {
      const gate = rest.slice(match.id.length + 1)
      return gate ? `${match.flightNo} · gate ${gate}` : match.flightNo
    }
    return rest
  }
  return flights.find((flight) => flight.id === id)?.flightNo ?? id
}

/** Connecting passengers on this flight, or a clear empty line. */
export function connectionSummary(
  flight: Flight,
  guests: ConnectionGuest[],
  flights: ConnectionFlight[],
): string {
  const links = guests.filter(
    (guest) => !guest.dead && guest.flightId === flight.id && (guest.transfer || guest.connectFlightId),
  )
  if (links.length === 0) {
    return flight.destination ? `None on this turn · ${flight.destination}` : 'None on this turn'
  }
  const counts = new Map<string, number>()
  for (const guest of links) {
    const label = guest.connectFlightId
      ? connectionTargetLabel(guest.connectFlightId, flights)
      : 'an open bank'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const parts = [...counts.entries()].map(([label, count]) => (count === 1 ? label : `${count} via ${label}`))
  const noun = links.length === 1 ? 'connection' : 'connections'
  return `${links.length} ${noun} · ${parts.join(', ')}`
}

export function flightConnectionSummary(flight: Flight, guests: HallGuest[], flights: Flight[]): string {
  return connectionSummary(flight, guests, flights)
}

let open = false
let shownId: string | null = null
const listeners = new Set<() => void>()

function emitCard() {
  for (const listener of listeners) listener()
}

export function subscribeFlightCard(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Empty while the apron card is closed. */
export function flightCardSnapshot(): string {
  return open && shownId ? shownId : ''
}

export function isFlightCardOpen(): boolean {
  return open
}

export function flightCardFlightId(): string | null {
  return open ? shownId : null
}

/**
 * Identity of the open card's flight. Changes when that flight's phase,
 * elapsed second, passengers, or turnaround services change — not when
 * some other flight (including flights[0]) moves.
 */
export function flightLiveKey(game: {
  flights: Flight[]
  selectedFlight: string | null
  cartServiceHold: (id: string) => CartServiceHold
}): string {
  const id = flightCardFlightId()
  if (!id || game.selectedFlight !== id) return ''
  const flight = game.flights.find((row) => row.id === id)
  if (!flight || flight.phase === 'gone') return ''
  const services = serviceProgress(flight, game.cartServiceHold(flight.id))
  return [
    flight.id,
    flight.phase,
    Math.floor(Math.max(0, flight.phaseTime)),
    flight.pax,
    flight.waitingOn.paxIn,
    flight.waitingOn.paxOut,
    services.map((row) => `${row.id}:${row.state}:${row.detail}`).join(','),
    flight.ledger.length,
  ].join('|')
}

/** Re-render the open card on sim emits and on animation frames while the key moves. */
export function subscribeFlightLive(
  game: { subscribe: (fn: () => void) => () => void; flights: Flight[]; selectedFlight: string | null; cartServiceHold: (id: string) => CartServiceHold },
  listener: () => void,
): () => void {
  let alive = true
  let last = flightLiveKey(game)
  const pull = () => {
    const next = flightLiveKey(game)
    if (next === last) return
    last = next
    listener()
  }
  const off = game.subscribe(pull)
  const frame = () => {
    if (!alive) return
    pull()
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame)
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame)
  return () => {
    alive = false
    off()
  }
}

export function openFlightCard(id: string) {
  if (open && shownId === id) return
  open = true
  shownId = id
  emitCard()
}

/** Hides the card. The sim selection is left alone. */
export function closeFlightCard() {
  if (!open && shownId == null) return
  open = false
  shownId = null
  emitCard()
}

export function resetFlightCard() {
  open = false
  shownId = null
  emitCard()
}

interface FlightClickGame {
  tool: string
  view: string
  tile: (v: Vec) => Tile | null
  nearestFlight: (v: Vec) => { id: string } | undefined
  selectedFlight: string | null
}

/**
 * After an apron click has updated `selectedFlight`.
 * A second click on that same flight closes the card.
 */
export function syncFlightCardClick(game: FlightClickGame, v: Vec, beforeSelected: string | null) {
  if (game.view !== 'apron' || game.tool !== 'pan') return
  if (game.tile(v) === 'terminal') return
  const hit = game.nearestFlight(v)
  if (!hit || game.selectedFlight !== hit.id) return
  if (open && beforeSelected === hit.id) closeFlightCard()
  else openFlightCard(hit.id)
}
