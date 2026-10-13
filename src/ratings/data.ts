export type SubScoreCategory =
  | 'queues'
  | 'cleanliness'
  | 'shops'
  | 'on-time'
  | 'bags'
  | 'transfers'
  | 'accessibility'
  | 'comfort'

export const CANONICAL_SUB_SCORES: SubScoreCategory[] = [
  'queues',
  'cleanliness',
  'shops',
  'on-time',
  'bags',
  'transfers',
  'accessibility',
  'comfort',
]

/**
 * Weights for airport sub-scores, summing to 1.0.
 * Supports both 'on-time' and 'onTime' key variants.
 */
export const SUB_SCORE_WEIGHTS: Record<string, number> = {
  queues: 0.2,
  cleanliness: 0.15,
  shops: 0.1,
  'on-time': 0.2,
  onTime: 0.2,
  bags: 0.15,
  transfers: 0.05,
  accessibility: 0.05,
  comfort: 0.1,
}
