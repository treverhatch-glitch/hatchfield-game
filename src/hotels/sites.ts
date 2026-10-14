import {
  CREW_BASE,
  CREW_NIGHTSTOP_FROM,
  CREW_NIGHTSTOP_UNTIL,
  CREW_PER_SEATS,
  HOTEL_TIERS,
  HUB_CREW_REST_SHARE,
  LOCAL_STAY_SHARE,
  WALKWAY_MAX_METRES,
} from './config.ts'
import { clampRate } from './night.ts'
import type { HotelGrade, HotelLink, HotelSite } from './types.ts'

/** Walkway when close, shuttle when there is a bus curb, otherwise cut off. */
export function hotelLink(metresToTerminal: number, hasShuttle: boolean): HotelLink {
  const metres = Number.isFinite(metresToTerminal) ? Math.max(0, metresToTerminal) : Infinity
  if (metres <= WALKWAY_MAX_METRES) return 'walkway'
  if (hasShuttle) return 'shuttle'
  return 'none'
}

/** A site at a grade, with the player's rate applied. `units` stacks day-room blocks. */
export function hotelSite(opts: {
  id: string
  grade: HotelGrade
  link: HotelLink
  upkeep: number
  rateMult?: number
  units?: number
  cell?: { c: number; r: number }
}): HotelSite {
  const tier = HOTEL_TIERS[opts.grade]
  const units = Math.max(1, Math.floor(opts.units ?? 1))
  return {
    id: opts.id,
    name: units > 1 ? `${tier.label} ×${units}` : tier.label,
    grade: tier.grade,
    side: tier.side,
    stars: tier.stars,
    rooms: tier.rooms * units,
    rate: Math.round(tier.rate * clampRate(opts.rateMult ?? 1)),
    link: tier.side === 'airside' ? 'inside' : opts.link,
    upkeep: opts.upkeep,
    cell: opts.cell,
  }
}

/** Rooms a night-stopping crew needs. Day arrivals turn around and fly out. */
export function crewRooms(seats: number, arrivalHour: number, hub: boolean): number {
  if (!(seats > 0)) return 0
  const crew = CREW_BASE + Math.ceil(seats / CREW_PER_SEATS)
  if (arrivalHour >= CREW_NIGHTSTOP_FROM || arrivalHour < CREW_NIGHTSTOP_UNTIL) return crew
  return hub ? crew * HUB_CREW_REST_SHARE : 0
}

/** Arriving O&D visitors who book an airport hotel night. */
export function localStays(odArrivals: number): number {
  if (!(odArrivals > 0)) return 0
  return odArrivals * LOCAL_STAY_SHARE
}
