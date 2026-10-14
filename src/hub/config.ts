/**
 * Tunables for the connecting-hub layer. Game-minutes are the shared
 * sim-minute clock (one field second is eight game-minutes).
 */

/** Field level where connecting traffic is allowed to appear. */
export const HUB_MID_FIELD_LEVEL = 3

/** Share of an arrival that is connecting, before airline role and banks. */
export const SHARE_BY_FIELD_LEVEL: Readonly<Record<number, number>> = {
  1: 0,
  2: 0,
  3: 0.08,
  4: 0.16,
  5: 0.28,
}

export const ROLE_SHARE_MULT = {
  cargo: 0,
  charter: 0.2,
  lcc: 0.45,
  full_service: 1,
} as const

/** Extra share for a signed hub carrier. Early levels stay at zero because the base is zero. */
export const HUB_CARRIER_BONUS = 0.12
/** Smaller bump for carriers that like layovers but are not a hub. */
export const LAYOVER_SHARE_BONUS = 0.04
export const TIER_BONUS_FROM = 4
export const TIER_SHARE_BONUS = 0.05
export const SHARE_CAP = 0.7

/** Minimum connection time, game-minutes. RFID replaces the Transfer Centre figure. */
export const MCT_BASE = 60
export const MCT_TRANSFER_CENTRE = 45
export const MCT_RFID = 25

/** Fixed bag-sort minutes before the haul between gates. */
export const BAG_BASE_MINUTES = { plain: 50, centre: 36, rfid: 16 } as const

/** Walking pace along the pier, metres per game-minute (~1.3 m/s). */
export const WALK_METRES_PER_MIN = 80
/** Terminal bus / people-mover pace, metres per game-minute. */
export const RIDE_METRES_PER_MIN = 220
/** Belt haul without RFID. */
export const BAG_BELT_METRES_PER_MIN = 10
/** Belt haul once the RFID line is in. */
export const BAG_RFID_METRES_PER_MIN = 40
/** Bag cart or bus when a ride link exists. */
export const BAG_RIDE_METRES_PER_MIN = 55
/** Deplane and find the transfer sign, game-minutes. */
export const DEPLANE_MINUTES = 8
/** Same-gate and missing-geometry floor so a single stand still has a walk. */
export const MIN_WALK_METRES = 40

/** Onward departure used when the timetable has no later wave. */
export const DEFAULT_CONNECTION_WINDOW = 80

export const ARRIVAL_CLUSTER_MINUTES = 15
export const DEPARTURE_CLUSTER_MINUTES = 15
/** Gap at or above this is a loose bank (demand and crowd stay at 1). */
export const LOOSE_BANK_GAP = 90
/** Gap at or below this is a fully tight bank. */
export const TIGHT_BANK_GAP = 35
export const TIGHT_TRANSFER_DEMAND = 1.8
export const TIGHT_CROWD_PEAK = 1.55

export const HOTEL_NIGHT_COST = 1_860
export const REBOOK_FEE = 700
/** Standing points lost per missed connecting passenger. */
export const STANDING_HIT_PER_PAX = 3.2

/**
 * Economy tech-tree modifier keys. A value above 0 means that node is unlocked.
 * `getModifier` falls back to 0 when the node is absent.
 */
export const TECH_TRANSFER_CENTRE = 'hub.transferCentre'
export const TECH_RFID_BAG_LINE = 'hub.rfidBagLine'

export const TRANSFER_CENTRE_RP = 36
export const TRANSFER_CENTRE_COST = 42_000
export const TRANSFER_CENTRE_UPKEEP = 1_800
export const RFID_RP = 52
export const RFID_COST = 28_000
export const RFID_UPKEEP = 900
