/**
 * Which desk is whose, for this moment. Pure: the sim passes flights, desks
 * and locks; this file does not read the hall or paint a sign.
 *
 * A passenger flight wants desks only while its window is open. Those desks
 * are branded to the airline and shared by that airline's overlapping flights.
 * A lock keeps its airline all day and is never given away. Kiosks and leftover
 * common desks stay general. Unstaffed desks do not cover a flight.
 */
import { gameMinToSim } from '../pax/showup.ts'
import { CHECKIN_ALLOC } from './config.ts'

export interface CheckinFlight {
  id: string
  airlineId: string
  /** Scheduled departure, sim seconds. */
  std: number
  /** Booked passengers. Zero does not take a desk. */
  pax: number
  /** Wide-body uses the long-haul open. */
  longHaul: boolean
}

export interface CheckinDesk {
  id: string
  /** Open for service (bundle, kiosk, or a clerk on the post). */
  staffed: boolean
  /** Self-serve. Always general, and a lock on it is ignored. */
  kiosk: boolean
}

export interface DedicatedLock {
  deskId: string
  airlineId: string
  /**
   * Share of normal service time. 1 leaves the desk alone. Trusted locks
   * pass a share below 1. Applied from the desk's base time, not stacked.
   */
  serviceShare?: number
}

export type DeskMode = 'dedicated' | 'common' | 'general' | 'kiosk'

export interface DeskAssignment {
  deskId: string
  /** Null on a general desk, a kiosk, or a desk nobody is using. */
  airlineId: string | null
  mode: DeskMode
  /** Open flights whose airline is holding this desk. */
  flightIds: string[]
  /** 1, or the Trusted share on a dedicated desk. */
  serviceShare: number
}

export interface FlightDeskShare {
  flightId: string
  airlineId: string
  open: boolean
  /** Branded desks this airline is holding. Shared by its open flights. */
  desks: string[]
  /**
   * Desks the airline still wants. Repeated on each of its open flights;
   * add it up from the airlines, not from these rows.
   */
  short: number
  windowOpenAt: number
  windowCloseAt: number
}

export interface Allocation {
  desks: DeskAssignment[]
  flights: FlightDeskShare[]
  /** Unmet branded desks across every airline with an open window. */
  shortOfDesks: number
  /** `short of desks` when something is unmet. Otherwise null. */
  reason: string | null
}

export interface AllocateInput {
  now: number
  flights: readonly CheckinFlight[]
  /** Desk order. The same order the hall paints. */
  desks: readonly CheckinDesk[]
  locks: readonly DedicatedLock[]
  tuning?: typeof CHECKIN_ALLOC
}

interface OpenFlight extends CheckinFlight {
  open: boolean
  need: number
  openAt: number
  closeAt: number
}

export function windowBounds(
  flight: Pick<CheckinFlight, 'std' | 'longHaul'>,
  tuning: typeof CHECKIN_ALLOC = CHECKIN_ALLOC,
): { openAt: number; closeAt: number } {
  const openMin = flight.longHaul ? tuning.openLongHaulGameMin : tuning.openShortHaulGameMin
  return {
    openAt: flight.std - gameMinToSim(openMin),
    closeAt: flight.std - gameMinToSim(tuning.closeGameMin),
  }
}

/** Desks one open flight wants. A flight with no passengers wants none. */
export function desksNeeded(pax: number, tuning: typeof CHECKIN_ALLOC = CHECKIN_ALLOC): number {
  const seats = Number.isFinite(pax) ? Math.max(0, Math.floor(pax)) : 0
  if (seats <= 0) return 0
  const per = Math.max(1, tuning.paxPerDesk)
  const min = Math.max(1, tuning.minDesksPerFlight)
  return Math.max(min, Math.ceil(seats / per))
}

function shareOf(lock: DedicatedLock): number {
  const n = lock.serviceShare
  if (n == null || !(n > 0) || n >= 1) return 1
  return n
}

/**
 * Assign desks for `now`. Dedicated locks stay put. Common desks fill the
 * remaining need, earliest departure first, then airline id, walking the
 * desks in the order they were given. Anything left is general.
 */
export function allocate(input: AllocateInput): Allocation {
  const tuning = input.tuning ?? CHECKIN_ALLOC
  const now = input.now
  const flights: OpenFlight[] = input.flights.map((flight) => {
    const bounds = windowBounds(flight, tuning)
    const span = bounds.closeAt - bounds.openAt
    const open = span > 1e-9 && now >= bounds.openAt - 1e-9 && now < bounds.closeAt - 1e-9
    return {
      ...flight,
      ...bounds,
      open,
      need: open ? desksNeeded(flight.pax, tuning) : 0,
    }
  })

  const lockByDesk = new Map<string, DedicatedLock>()
  for (const lock of input.locks) {
    if (!lock.airlineId) continue
    const desk = input.desks.find((row) => row.id === lock.deskId)
    if (!desk || desk.kiosk) continue
    lockByDesk.set(lock.deskId, lock)
  }

  const need = new Map<string, number>()
  const earliest = new Map<string, number>()
  for (const flight of flights) {
    if (!flight.open || flight.need <= 0) continue
    need.set(flight.airlineId, (need.get(flight.airlineId) ?? 0) + flight.need)
    const prev = earliest.get(flight.airlineId)
    if (prev == null || flight.std < prev) earliest.set(flight.airlineId, flight.std)
  }

  const held = new Map<string, string[]>()
  const remember = (airlineId: string, deskId: string) => {
    const list = held.get(airlineId)
    if (list) list.push(deskId)
    else held.set(airlineId, [deskId])
  }
  /** One staffed desk covers one unit of this airline's need. */
  const cover = (airlineId: string) => {
    const left = need.get(airlineId) ?? 0
    if (left <= 0) return false
    need.set(airlineId, left - 1)
    return true
  }

  const desks: DeskAssignment[] = input.desks.map((desk) => {
    const lock = lockByDesk.get(desk.id)
    if (desk.kiosk) {
      return { deskId: desk.id, airlineId: null, mode: 'kiosk', flightIds: [], serviceShare: 1 }
    }
    if (lock) {
      return {
        deskId: desk.id,
        airlineId: lock.airlineId,
        mode: 'dedicated',
        flightIds: [],
        serviceShare: shareOf(lock),
      }
    }
    return { deskId: desk.id, airlineId: null, mode: 'general', flightIds: [], serviceShare: 1 }
  })

  for (let i = 0; i < desks.length; i++) {
    const row = desks[i]
    const desk = input.desks[i]
    if (row.mode !== 'dedicated' || !row.airlineId || !desk.staffed) continue
    remember(row.airlineId, row.deskId)
    cover(row.airlineId)
  }

  const queue = [...need.entries()]
    .filter(([, left]) => left > 0)
    .sort((a, b) => {
      const sa = earliest.get(a[0]) ?? 0
      const sb = earliest.get(b[0]) ?? 0
      if (sa !== sb) return sa - sb
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
    })

  let qi = 0
  for (let i = 0; i < desks.length; i++) {
    const row = desks[i]
    const desk = input.desks[i]
    if (row.mode !== 'general' || !desk.staffed || desk.kiosk) continue
    while (qi < queue.length && queue[qi][1] <= 0) qi++
    if (qi >= queue.length) break
    const airlineId = queue[qi][0]
    if (!cover(airlineId)) continue
    remember(airlineId, row.deskId)
    row.airlineId = airlineId
    row.mode = 'common'
    queue[qi][1] -= 1
  }

  let shortOfDesks = 0
  for (const [, left] of need) if (left > 0) shortOfDesks += left

  const airlineShort = (airlineId: string) => Math.max(0, need.get(airlineId) ?? 0)
  const shares: FlightDeskShare[] = flights.map((flight) => ({
    flightId: flight.id,
    airlineId: flight.airlineId,
    open: flight.open,
    desks: flight.open ? (held.get(flight.airlineId) ?? []) : [],
    short: flight.open ? airlineShort(flight.airlineId) : 0,
    windowOpenAt: flight.openAt,
    windowCloseAt: flight.closeAt,
  }))

  for (const row of desks) {
    if (!row.airlineId) continue
    row.flightIds = shares.filter((flight) => flight.open && flight.airlineId === row.airlineId).map((flight) => flight.flightId)
  }

  return {
    desks,
    flights: shares,
    shortOfDesks,
    reason: shortOfDesks > 0 ? tuning.shortReason : null,
  }
}
