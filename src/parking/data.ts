export interface ParkingPrices {
  short: number
  long: number
}

export interface ParkingSpaces {
  short: number
  long: number
}

export interface ParkingDemand {
  short: number
  long: number
}

/** Share of departing passengers who drive to the airport. */
export const DRIVING_SHARE = 0.35

/** Share of driving passengers who use short-stay parking. */
export const SHORT_STAY_SHARE = 0.30

/** Average length of stay in days for long-stay parking. */
export const LONG_STAY_AVG_DAYS = 4

/** Price elasticity exponent: demand * (defaultPrice / actualPrice) ^ 0.6. */
export const ELASTICITY_EXPONENT = 0.6

/** Default posted prices per day for parking tiers in dollars. */
export const DEFAULT_PARKING_PRICES: ParkingPrices = {
  short: 28,
  long: 58,
}

export const PARKING_DEFAULTS = {
  drivingShare: DRIVING_SHARE,
  shortStayShare: SHORT_STAY_SHARE,
  longStayAvgDays: LONG_STAY_AVG_DAYS,
  elasticityExponent: ELASTICITY_EXPONENT,
  prices: DEFAULT_PARKING_PRICES,
} as const
