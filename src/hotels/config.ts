/**
 * Hotel tunables. Upkeep for each grade is billed with the building
 * (HOTEL_CLASS_EXPENSE / HALL_AMENITY_EXPENSE); these are the room-night side.
 */
import type { HotelGrade, HotelTier } from './types.ts'

export const HOTEL_TIERS: Readonly<Record<HotelGrade, HotelTier>> = {
  inn: { grade: 'inn', side: 'landside', stars: 2, rooms: 30, rate: 79, label: 'Airport inn' },
  business: { grade: 'business', side: 'landside', stars: 3, rooms: 44, rate: 149, label: 'Business hotel' },
  resort: { grade: 'resort', side: 'landside', stars: 5, rooms: 64, rate: 289, label: 'Airport resort' },
  transit: { grade: 'transit', side: 'airside', stars: 3, rooms: 16, rate: 129, label: 'Transit hotel' },
}

/** Player rate setting, as a multiplier on the rack rate. */
export const RATE_MIN = 0.6
export const RATE_MAX = 1.6
export const RATE_STEP = 0.1
/**
 * Price elasticity for guests who pay themselves (layover and local).
 * 1.2 means a 10 % rate rise loses about 12 % of those guests.
 */
export const RATE_ELASTICITY = 1.2
/** Airlines pay a negotiated share of rack for crew and voucher rooms. */
export const CREW_RATE_SHARE = 0.6
export const VOUCHER_RATE_SHARE = 0.75
/** Outside hotel the airport pays when its own rooms are full or missing. */
export const OUTSIDE_VOUCHER_RATE = 165

/** A landside hotel this close walks in; farther needs a shuttle (bus curb). */
export const WALKWAY_MAX_METRES = 320

/** Crew per inbound that night-stops: flight deck + cabin, one room each. */
export const CREW_BASE = 2
export const CREW_PER_SEATS = 50
/** Inbounds landing at or after this displayed hour (or before dawn) night-stop their crew. */
export const CREW_NIGHTSTOP_FROM = 19
export const CREW_NIGHTSTOP_UNTIL = 5
/** Hub-based crews rest here on most rotations. */
export const HUB_CREW_REST_SHARE = 0.5
/** Share of arriving O&D passengers who stay a night at an airport hotel. */
export const LOCAL_STAY_SHARE = 0.015
/** Hotels below this occupancy for a night raise a warning. */
export const LOW_OCCUPANCY = 0.25
