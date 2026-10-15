/**
 * Pipeline and rail differentials.
 * The pipe uses the same connection rule as the fuel rail.
 * The quality hold is twice the pipeline lead, which is 6 game hours.
 */

export const PIPELINE = {
  /** Dollars per painted pipe cell, per day. */
  tileUpkeepPerDay: 40,
  /** Dollars for the receipt manifold, per day. */
  manifoldUpkeepPerDay: 520,
  /** Off the term, only while the manifold is open. */
  differential: -0.008,
  /** Off the term, only while the rail spur is flowing. */
  railDifferential: -0.004,
  /** Game minutes. The hold is twice this. */
  leadMinutes: 180,
  holdMultiple: 2,
  /** Open-flow days between quality holds. */
  intervalDays: 4,
  card: 'Pipeline batch held. Quality check. Flow resumes in 6 hours, or buy one spot truck now.',
} as const

const GAME_DAY_MINUTES = 24 * 60

export function qualityHoldMinutes(): number {
  return PIPELINE.leadMinutes * PIPELINE.holdMultiple
}

export function pipelineIntervalMinutes(): number {
  return PIPELINE.intervalDays * GAME_DAY_MINUTES
}

/** A closed line or a held batch pays the road term. */
export function supplyCut(supply: 'road' | 'rail' | 'pipeline' | 'barge', open: boolean): number {
  if (!open) return 0
  if (supply === 'rail' || supply === 'barge') return PIPELINE.railDifferential
  if (supply === 'pipeline') return PIPELINE.differential
  return 0
}
