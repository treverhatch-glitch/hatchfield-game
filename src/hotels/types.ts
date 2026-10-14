export type HotelSide = 'landside' | 'airside'

/** Landside grades match the apron hotel stamps; transit is the airside day-room block. */
export type HotelGrade = 'inn' | 'business' | 'resort' | 'transit'

/** How a landside hotel reaches the terminal. Airside hotels are inside it. */
export type HotelLink = 'inside' | 'walkway' | 'shuttle' | 'none'

export interface HotelTier {
  grade: HotelGrade
  side: HotelSide
  stars: number
  rooms: number
  /** Rack rate per room-night, dollars. */
  rate: number
  label: string
}

export interface HotelSite {
  id: string
  name: string
  grade: HotelGrade
  side: HotelSide
  stars: number
  rooms: number
  /** Rack rate after the player's rate setting. */
  rate: number
  link: HotelLink
  /** Daily upkeep already billed with the building (shown, not charged twice). */
  upkeep: number
  /** Apron cell for pan-to. */
  cell?: { c: number; r: number }
}

/** Who wants a bed tonight. Counts are guests (one room each). */
export interface HotelDemand {
  /** Overnight transfers that chose a hotel, by side preference. */
  layoverAirside: number
  layoverLandside: number
  /** Stranded passengers holding a hotel voucher. */
  voucherAirline: number
  voucherAirport: number
  /** Crew rest nights. */
  crew: number
  /** Local origin and destination visitors. */
  local: number
}

export type HotelSegment = keyof HotelDemand

export interface HotelNightLine {
  id: string
  name: string
  grade: HotelGrade
  side: HotelSide
  stars: number
  rooms: number
  occupied: number
  occupancy: number
  revenue: number
  upkeep: number
  rate: number
  link: HotelLink
  bySegment: Record<HotelSegment, number>
}

export interface HotelNight {
  lines: HotelNightLine[]
  rooms: number
  occupied: number
  occupancy: number
  revenue: number
  upkeep: number
  /** Guests no room could take, by segment. */
  overflow: Record<HotelSegment, number>
  /** Airport-paid vouchers that had to go to an outside hotel. */
  outsideVoucherCost: number
}
