import {
  PEOPLE_MOVER_DWELL_S,
  PEOPLE_MOVER_HEADWAY_S,
  PEOPLE_MOVER_SPEED_M_S,
  PEOPLE_MOVER_TRAIN_CAPACITY,
  PEOPLE_MOVER_UPKEEP_PER_KM_DAY,
  PEOPLE_MOVER_COST_PER_KM,
  WALKWAY_COST_PER_10M,
  WALKWAY_SPEED_BONUS_M_S,
  WALKWAY_UPKEEP_PER_10M_DAY,
  WALK_SPEED_M_S,
} from './data'

/**
 * Calculates walking time in seconds for a given distance, accounting for moving walkway sections.
 *
 * @param distanceM Total walking distance in metres.
 * @param walkwayM Distance in metres with a moving walkway installed (clamped between 0 and distanceM).
 * @param walkSpeedM_S Base walking speed in m/s (default: 1.3 m/s).
 * @returns Walking time in seconds.
 */
export function walkTimeS(
  distanceM: number,
  walkwayM: number = 0,
  walkSpeedM_S: number = WALK_SPEED_M_S,
): number {
  if (distanceM <= 0 || walkSpeedM_S <= 0) return 0

  const clampedWalkwayM = Math.min(distanceM, Math.max(0, walkwayM))
  const footDistanceM = distanceM - clampedWalkwayM
  const walkwaySpeedM_S = walkSpeedM_S + WALKWAY_SPEED_BONUS_M_S

  const footTimeS = footDistanceM / walkSpeedM_S
  const walkwayTimeS = clampedWalkwayM / walkwaySpeedM_S

  return footTimeS + walkwayTimeS
}

/**
 * Calculates total transfer time in seconds for an automated people mover journey.
 * Includes average wait time (headway / 2), travel time, and dwell time for intermediate/end stops.
 *
 * @param distanceM Guideway distance in metres.
 * @param stops Number of stops made along the route.
 * @param speedM_S Travel speed in m/s (default: 15 m/s).
 * @param headwayS Train headway in seconds (default: 90 s).
 * @param dwellS Dwell time per stop in seconds (default: 30 s).
 * @returns Total transfer time in seconds.
 */
export function moverTransferTimeS(
  distanceM: number = 0,
  stops: number = 0,
  speedM_S: number = PEOPLE_MOVER_SPEED_M_S,
  headwayS: number = PEOPLE_MOVER_HEADWAY_S,
  dwellS: number = PEOPLE_MOVER_DWELL_S,
): number {
  const avgWaitS = headwayS > 0 ? headwayS / 2 : 0
  const travelTimeS = distanceM > 0 && speedM_S > 0 ? distanceM / speedM_S : 0
  const dwellTimeS = Math.max(0, stops) * dwellS

  return avgWaitS + travelTimeS + dwellTimeS
}

/**
 * Calculates hourly passenger capacity for an automated people mover line.
 *
 * @param headwayS Train headway in seconds (default: 90 s).
 * @param trainCapacity Passenger capacity per train (default: 120 pax).
 * @returns Passenger capacity per hour.
 */
export function moverHourlyCapacity(
  headwayS: number = PEOPLE_MOVER_HEADWAY_S,
  trainCapacity: number = PEOPLE_MOVER_TRAIN_CAPACITY,
): number {
  if (headwayS <= 0 || trainCapacity <= 0) return 0
  const trainsPerHour = 3600 / headwayS
  return trainsPerHour * trainCapacity
}

/**
 * Calculates daily upkeep cost in USD for moving walkways and people mover guideway.
 *
 * @param walkwayM Length of moving walkway in metres ($40/day per 10 m).
 * @param moverKm Length of people mover guideway in kilometres ($4,000/day per km).
 * @returns Total daily upkeep in USD.
 */
export function dailyUpkeep(walkwayM: number = 0, moverKm: number = 0): number {
  const validWalkwayM = Math.max(0, walkwayM)
  const validMoverKm = Math.max(0, moverKm)

  const walkwayUpkeep = (validWalkwayM / 10) * WALKWAY_UPKEEP_PER_10M_DAY
  const moverUpkeep = validMoverKm * PEOPLE_MOVER_UPKEEP_PER_KM_DAY

  return walkwayUpkeep + moverUpkeep
}

/**
 * Calculates capital construction cost in USD for moving walkways.
 *
 * @param walkwayM Length of walkway in metres ($900 per 10 m).
 * @returns Capital cost in USD.
 */
export function walkwayCost(walkwayM: number = 0): number {
  return (Math.max(0, walkwayM) / 10) * WALKWAY_COST_PER_10M
}

/**
 * Calculates capital construction cost in USD for automated people movers.
 *
 * @param moverKm Guideway length in kilometres ($2,500,000 per km).
 * @returns Capital cost in USD.
 */
export function moverCost(moverKm: number = 0): number {
  return Math.max(0, moverKm) * PEOPLE_MOVER_COST_PER_KM
}

/**
 * Calculates total capital construction cost in USD for walkway and people mover infrastructure.
 *
 * @param walkwayM Length of walkway in metres.
 * @param moverKm Guideway length in kilometres.
 * @returns Total construction cost in USD.
 */
export function constructionCost(walkwayM: number = 0, moverKm: number = 0): number {
  return walkwayCost(walkwayM) + moverCost(moverKm)
}
