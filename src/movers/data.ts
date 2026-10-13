/** Moving walkway configuration parameters */
export interface WalkwayData {
  /** Base walking speed in metres per second (1.3 m/s). */
  baseWalkSpeedMS: number
  /** Walkway speed bonus in metres per second (+0.65 m/s). */
  speedBonusMS: number
  /** Walkway capacity in passengers per metre (1.2 pax/m). */
  capacityPaxPerM: number
  /** Capital construction cost in USD per 10 metres ($900 / 10m). */
  costPer10m: number
  /** Daily upkeep cost in USD per 10 metres ($40 / day per 10m). */
  upkeepPer10mDay: number
}

/** Automated people mover configuration parameters */
export interface PeopleMoverData {
  /** Train headway in seconds (90 s). */
  headwayS: number
  /** Train passenger capacity (120 pax). */
  trainCapacity: number
  /** Dwell time per stop in seconds (30 s). */
  dwellTimeS: number
  /** Standard guideway speed in metres per second (15 m/s). */
  speedMS: number
  /** Capital construction cost in USD per kilometre ($2.5M / km). */
  costPerKm: number
  /** Daily upkeep cost in USD per kilometre ($4k / day per km). */
  upkeepPerKmDay: number
}

/** Default walkway constants */
export const WALK_SPEED_M_S = 1.3
export const WALKWAY_SPEED_BONUS_M_S = 0.65
export const WALKWAY_CAPACITY_PAX_PER_M = 1.2
export const WALKWAY_COST_PER_10M = 900
export const WALKWAY_UPKEEP_PER_10M_DAY = 40

/** Default people mover constants */
export const PEOPLE_MOVER_HEADWAY_S = 90
export const PEOPLE_MOVER_TRAIN_CAPACITY = 120
export const PEOPLE_MOVER_DWELL_S = 30
export const PEOPLE_MOVER_SPEED_M_S = 15
export const PEOPLE_MOVER_COST_PER_KM = 2_500_000
export const PEOPLE_MOVER_UPKEEP_PER_KM_DAY = 4_000

export const WALKWAY_CONFIG: WalkwayData = {
  baseWalkSpeedMS: WALK_SPEED_M_S,
  speedBonusMS: WALKWAY_SPEED_BONUS_M_S,
  capacityPaxPerM: WALKWAY_CAPACITY_PAX_PER_M,
  costPer10m: WALKWAY_COST_PER_10M,
  upkeepPer10mDay: WALKWAY_UPKEEP_PER_10M_DAY,
} as const

export const PEOPLE_MOVER_CONFIG: PeopleMoverData = {
  headwayS: PEOPLE_MOVER_HEADWAY_S,
  trainCapacity: PEOPLE_MOVER_TRAIN_CAPACITY,
  dwellTimeS: PEOPLE_MOVER_DWELL_S,
  speedMS: PEOPLE_MOVER_SPEED_M_S,
  costPerKm: PEOPLE_MOVER_COST_PER_KM,
  upkeepPerKmDay: PEOPLE_MOVER_UPKEEP_PER_KM_DAY,
} as const
