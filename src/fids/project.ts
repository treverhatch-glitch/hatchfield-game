import { BOARD_ROW_COUNT } from './config'
import { boardClock } from './clock'
import { cityFor } from './cities'
import type { BoardRow, BoardSnapshot, BoardStatus, FeedFlight, FeedSlot, FidsSource } from './types'

const LEFT = new Set(['pushback', 'taxi_out', 'takeoff', 'gone'])
const DEPARTURE_PHASES = new Set([
  'parked',
  'servicing',
  'mx_taxi',
  'mx_bay',
  'mx_return',
  'board',
  'pushback',
  'taxi_out',
  'takeoff',
  'gone',
])

/**
 * On-time movements that have not left read as Boarding.
 * A late movement that is still here reads as Delayed.
 * Pushback through airborne reads as Departed.
 */
export function boardStatus(phase: string | null, delayed: boolean): BoardStatus {
  if (phase && LEFT.has(phase)) return 'Departed'
  if (delayed) return 'Delayed'
  return 'Boarding'
}

function place(destination: string | undefined, id: string): string {
  const city = destination?.trim()
  return city ? city : cityFor(id)
}

function gateOf(source: FidsSource, stand: { c: number; r: number } | null | undefined): string {
  const label = source.gateLabel(stand ?? null).trim()
  if (!label || label === '—' || label === '-') return '--'
  return label
}

function airlineOf(source: FidsSource, id: string): string {
  const name = source.airline(id)?.name?.trim()
  return name || 'Charter'
}

function nearest(rows: BoardRow[], now: number): BoardRow[] {
  return [...rows]
    .sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now) || a.at - b.at)
    .slice(0, BOARD_ROW_COUNT)
    .sort((a, b) => a.at - b.at)
}

/**
 * Project the live timetable into departures and arrivals.
 * Pure: the same source always yields the same rows.
 */
export function boardSnapshot(source: FidsSource): BoardSnapshot {
  const now = source.clock
  const flights = new Map<string, FeedFlight>()
  for (const flight of source.flights) flights.set(flight.id, flight)
  const slots = new Map<string, FeedSlot>()
  for (const slot of source.schedule) slots.set(slot.id, slot)

  const arrivals: BoardRow[] = []
  for (const slot of source.schedule) {
    if (slot.status === 'cancelled') continue
    const flight = slot.flightId ? flights.get(slot.flightId) : undefined
    const delayed = slot.status === 'delayed' || slot.delaySec > 0
    const at = slot.eta + Math.max(0, slot.delaySec)
    arrivals.push({
      id: `arr:${slot.id}`,
      flight: slot.flightNo,
      airline: airlineOf(source, slot.airline),
      destination: place(flight?.destination, slot.id),
      time: boardClock(at),
      gate: gateOf(source, flight?.stand ?? slot.stand ?? slot.standPref),
      status: boardStatus(flight?.phase ?? null, delayed),
      at,
    })
  }

  const departures: BoardRow[] = []
  for (const flight of source.flights) {
    if (!flight.flightNo || !DEPARTURE_PHASES.has(flight.phase)) continue
    const slot = flight.scheduleId ? slots.get(flight.scheduleId) : undefined
    const delayed = slot ? slot.status === 'delayed' || slot.delaySec > 0 : false
    const at = flight.std ?? now
    departures.push({
      id: `dep:${flight.id}`,
      flight: flight.flightNo,
      airline: airlineOf(source, flight.airline),
      destination: place(flight.destination, flight.id),
      time: boardClock(at),
      gate: gateOf(source, flight.stand),
      status: boardStatus(flight.phase, delayed),
      at,
    })
  }

  return {
    now,
    clock: boardClock(now),
    airportName: source.branding?.airportName?.trim() || 'HATCHFIELD',
    departures: nearest(departures, now),
    arrivals: nearest(arrivals, now),
  }
}

export function isFidsSource(view: object | null | undefined): view is FidsSource {
  if (!view) return false
  const v = view as Partial<FidsSource>
  return (
    typeof v.clock === 'number' &&
    Array.isArray(v.schedule) &&
    Array.isArray(v.flights) &&
    typeof v.airline === 'function' &&
    typeof v.gateLabel === 'function'
  )
}
