/** Cause drawn over a passenger: the mood and why they feel it. */
export type ThoughtCause = 'queue' | 'prices' | 'delight'

export type ThoughtIcon = ThoughtCause

export type MeasureUnit = 'min' | 'count' | 'pct'

export interface PassengerSample {
  id: string
  x: number
  y: number
  z: number
  /** 0–100. */
  happiness: number
  queued: boolean
  /** Minutes this passenger has already waited. */
  waitMin: number
  /** The airport's published prices sit above the schedule. */
  pricey: boolean
}

export interface MetricReading {
  id: string
  label: string
  value: number
  unit: MeasureUnit
}

export interface LeverReading {
  id: string
  /** Outcome measured after this lever moves. */
  metricId: string
  value: number
}

export interface AirlineMark {
  id: string
  name: string
}

/** One read of the airport. Pure feedback code sees only this. */
export interface FeedbackWorld {
  /** Sim seconds. */
  now: number
  passengersServed: number
  flightsLanded: number
  airlines: readonly AirlineMark[]
  /** 0–100. */
  reputation: number
  levers: readonly LeverReading[]
  metrics: readonly MetricReading[]
  passengers: readonly PassengerSample[]
}
