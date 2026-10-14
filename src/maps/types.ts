import type { Weather } from '../game/types'

/** Playable climates. `temperate` is the field the game already ships. */
export type MapId = 'temperate' | 'tropical' | 'desert'

/**
 * Same three buckets `src/environment` uses for sky and ramp pace
 * (dry and hot, rainy, cool).
 */
export type MapClimate = 'dry_hot' | 'rainy' | 'cool'

export type MapHazard = 'none' | 'heat' | 'monsoon' | 'typhoon' | 'sandstorm' | 'snow'

export interface DemandPoint {
  day: number
  multiplier: number
}

export interface MapSeason {
  id: string
  name: string
  startDay: number
  endDay: number
  demandCurve: readonly DemandPoint[]
  modifiers?: Readonly<Record<string, number>>
  climate: MapClimate
  /** Weights for clear / rain / fog / storm. Omitted on the temperate map. */
  weather?: Readonly<Record<Weather, number>>
  /** Ramp stretch while this season is up. 1 leaves turnaround times alone. */
  engineDerate: number
  /** Extra chew on wet-pavement wear. 1 leaves the decay term alone. */
  wear: number
  hazard: MapHazard
  /** 0–1 mix from the clock sky toward this season. 0 leaves the sky alone. */
  skyAmount: number
  skyTop: number
  skyHorizon: number
  sun: number
  hemi: number
  ground: number
  grass: number
  sunScale: number
  fogScale: number
}

export interface MapHoliday {
  id: string
  name: string
  startDay: number
  endDay: number
  demandMultiplier: number
  modifiers?: Readonly<Record<string, number>>
  /**
   * Extra peak for a host that still reads the default calendar
   * (`holidayPeakHook` in src/environment). 1 when the map calendar
   * already carries the boost.
   */
  peakHook: number
}

export type ChallengeKind = 'holiday_pax' | 'season_flights' | 'heat_flights'

export interface MapChallenge {
  id: string
  title: string
  detail: string
  kind: ChallengeKind
  target: number
  /** Holiday id, or season ids, depending on `kind`. */
  match: readonly string[]
}

export interface MapTerrain {
  /** CSS stripe on the new-game card. */
  swatch: string
  ground: number
  fields: readonly number[]
  trees: readonly number[]
}

export interface MapDefinition {
  id: MapId
  name: string
  region: string
  blurb: string
  yearLengthDays: number
  seasons: readonly MapSeason[]
  holidays: readonly MapHoliday[]
  challenges: readonly [MapChallenge, MapChallenge, MapChallenge]
  /** Null keeps the farmland mesh the renderer already builds. */
  terrain: MapTerrain | null
}

/** Numbers the world renderer can apply without importing the rest of the module. */
export interface MapDraw {
  skyAmount: number
  skyTop: number
  skyHorizon: number
  sun: number
  hemi: number
  ground: number
  sunScale: number
  fogScale: number
  terrain: { ground: number; fields: number[]; trees: number[] } | null
}

/** Shape `src/winterops` `WeatherState` already uses. */
export interface WinterOpsWeather {
  tempC: number
  precip: 'none' | 'snow' | 'freezing_rain'
  visibilityM: number
}

export interface WinterOpsReading {
  tempC: number
  precip: WinterOpsWeather['precip']
  visibilityM: number
  needsDeicing: boolean
  runwayRate: number
}

export interface ChallengeEvent {
  pax: number
  seasonId: string | null
  holidayIds: readonly string[]
  heat: boolean
}

export interface ChallengeCard {
  id: string
  title: string
  detail: string
  value: number
  target: number
  done: boolean
}
