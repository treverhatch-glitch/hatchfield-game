/**
 * Tunables for transfers, layovers and stranded passengers.
 * Game-minutes are the shared sim-minute clock (one field second is eight game-minutes).
 */

import type { AirlineType } from './types.ts'

/**
 * Share of connecting passengers on a carrier that must be screened again
 * before the onward gate (inbound from a non-one-stop-security origin).
 * Charters fly the most leisure points without matching screening.
 */
export const TRANSFER_SCREEN_SHARE: Readonly<Record<AirlineType, number>> = {
  full_service: 0.3,
  lcc: 0.15,
  charter: 0.45,
  cargo: 0,
}

/** Screening at a dedicated airside transfer lane, game-minutes. */
export const TRANSFER_SECURITY_MINUTES = 12
/**
 * No transfer lane: re-screened passengers walk out through arrivals and
 * queue at main security again. Landside detour plus the queue, game-minutes.
 */
export const LANDSIDE_RECHECK_MINUTES = 42
/** Published MCT is rounded up to this step, game-minutes. */
export const MCT_ROUND_TO = 5
/** Percentile of gate pairs used for the published walk (most connections are not the worst pair). */
export const MCT_WALK_PERCENTILE = 0.85

/** Through-checked bags per connecting passenger. */
export const TRANSFER_BAGS_PER_PAX = 0.85
/** Bags per hour one baggage belt / make-up line sorts without automation. */
export const SORT_BAGS_PER_HOUR_PER_BELT = 420
/** Transfer Centre adds a dedicated transfer input to the sorter. */
export const TRANSFER_CENTRE_SORT_MULT = 1.35
/** RFID tracking cuts mis-sorts and lifts the line rate. */
export const RFID_SORT_MULT = 1.6
/** Misconnect floor with spare sort capacity (industry is about 1–2 %). */
export const MISCONNECT_BASE = 0.012
export const MISCONNECT_BASE_RFID = 0.004
/** Load share where the sorter starts to choke. */
export const SORT_KNEE = 0.7
/** Extra misconnect per unit of utilisation past the knee. */
export const MISCONNECT_PER_OVERLOAD = 0.45
export const MISCONNECT_CAP = 0.6
/** Courier the late bag to the passenger's final destination. */
export const MISCONNECT_DELIVERY_FEE = 85

/**
 * Reputation points lost per missed connecting passenger. Airline Standing
 * is already cut by the hub layer (STANDING_HIT_PER_PAX).
 */
export const REPUTATION_PER_MISS = 0.08

/** Layover classes by onward wait, game-minutes. Any wait across the night is overnight. */
export const SHORT_LAYOVER_MAX = 240
/** Night window on the displayed 24 h clock, hours. */
export const NIGHT_START = 23
export const NIGHT_END = 5
/** Waits up to this many game-minutes feel normal; needs drain faster after. */
export const LAYOVER_COMFORT_MINUTES = 60
/** Extra drain per hour past the comfort window. */
export const LAYOVER_DRAIN_PER_HOUR = 0.22
export const LAYOVER_DRAIN_CAP = 2.4

/**
 * Starting needs for a short layover, per hour of wait. Seeds airside visits to
 * food, shops, lounges and seating instead of a straight walk to the gate.
 */
export const LAYOVER_NEEDS_PER_HOUR = { hunger: 22, shop: 18, play: 12, energy: 16 } as const
export const LAYOVER_NEED_CAP = 85

/**
 * Who pays the voucher when an airline has no contract term.
 * Airline-caused disruption is the airline's bill; a missed connection
 * caused by the layout (MCT, bags) is the airport's.
 */
export const DEFAULT_VOUCHER_TERMS = {
  cancel: 'airline',
  delay: 'airline',
  misconnect: 'airport',
} as const

/** Meal voucher per stranded passenger rebooked same day. */
export const MEAL_VOUCHER = 18
/** Rebooking desk handling per stranded passenger. */
export const REBOOK_HANDLING = 12
/** Onward capacity left on a rebooking departure when the load factor is unknown. */
export const REBOOK_SEAT_SHARE = 0.12
/** Delays at or past this many game-minutes strand connecting passengers. */
export const STRAND_DELAY_MINUTES = 180

/**
 * Itineraries are not all sold on the first onward bank. Some passengers
 * book a later flight (long layover) or the first wave next morning (overnight).
 */
export const LONG_ITINERARY_SHARE = 0.12
export const OVERNIGHT_ITINERARY_SHARE = 0.05
/** Extra wait sold on a long itinerary, game-minutes. */
export const LONG_ITINERARY_MINUTES = 300
/** Arrivals from this displayed hour on are the late bank; onward may be next morning. */
export const LATE_BANK_FROM = 21
/** First onward wave next morning, displayed hour. */
export const MORNING_WAVE = 7

/** A cancel this close to departure strands the people already here. */
export const STRAND_WINDOW_MINUTES = 240
/** Share of a cancelled departure's expected load already at the airport. */
export const STRAND_CANCEL_SHARE = 0.6

/** Daily history kept for the Connections view. */
export const HISTORY_DAYS = 14
/** Alerts kept for pan-to-problem. */
export const ALERT_LIMIT = 12
