import type { DisruptionId, StaffPoolId } from './types.ts'

/** Same day length as the apron clock (180 sim-seconds). */
export const DISRUPTION_DAY_SEC = 180

/** Field Level 3 is the first mid-game tier (T4 / hub loan). Nothing here fires earlier. */
export const MID_GAME_LEVEL = 3

/** Field Level 5 is mastery. Endless mode starts once the goals are done. */
export const MASTERY_LEVEL = 5

/** Volcanic ash always sends this many diversions. Severity never leaves the band. */
export const ASH_COUNT_MIN = 8
export const ASH_COUNT_MAX = 12

/**
 * Rooms each weather divert wants. Matches the inbound weather_divert profile
 * (stand + ARFF + 8 hotel rooms) so we do not invent a second divert shape.
 */
export const ASH_HOTEL_ROOMS = 8

/** A strike thins one pool. It never takes the pool to zero. */
export const STAFF_SCALE_FLOOR = 0.4

/** Rival undercutting cannot push fees through this floor. */
export const FEE_FLOOR = 0.55

/** One posting, either way. Stops a bad roll from minting NaN or a wipe. */
export const CASH_ABS_MAX = 80_000

export const COOLDOWN_DAYS = 6

/** Per-day chance the scheduler even tries. One event at a time on top of this. */
export const CHANCE_AT_MID = 0.07
export const CHANCE_AT_MASTERY = 0.2
export const CHANCE_ENDLESS = 0.2

export const RECOVERY_COST: Record<DisruptionId, number> = {
  'volcanic-ash': 4_000,
  'state-visit': 3_500,
  'software-outage': 2_500,
  'strike-day': 5_000,
  'hub-meltdown': 1_200,
  'health-screening': 2_800,
  'rival-price-war': 3_200,
}

export const POOL_LABEL: Record<StaffPoolId, string> = {
  maintenance: 'Maintenance',
  security: 'Security',
  cleaning: 'Cleaning',
  fire: 'Fire crews',
  ambulance: 'Ambulance crews',
  desk: 'Desk staff',
}

export const DEFAULT_POOLS: readonly StaffPoolId[] = [
  'maintenance',
  'security',
  'cleaning',
  'fire',
  'ambulance',
  'desk',
]

export const DISRUPTION_IDS: readonly DisruptionId[] = [
  'volcanic-ash',
  'state-visit',
  'software-outage',
  'strike-day',
  'hub-meltdown',
  'health-screening',
  'rival-price-war',
]

/** Bigger events are rarer. The mild ops hits come up more often. */
export const EVENT_WEIGHT: Record<DisruptionId, number> = {
  'volcanic-ash': 1,
  'state-visit': 2,
  'software-outage': 2,
  'strike-day': 2,
  'hub-meltdown': 1,
  'health-screening': 2,
  'rival-price-war': 1,
}
