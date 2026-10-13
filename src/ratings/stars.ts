import {
  CANONICAL_SUB_SCORES,
  SUB_SCORE_WEIGHTS,
  type SubScoreCategory,
} from './data.ts'

export interface WeakestSubScore {
  key: SubScoreCategory | string
  score: number
}

export interface StarRatingResult {
  stars: number
  score: number
  weakest: WeakestSubScore[]
  weakestKeys: string[]
}

function safeNum(val: unknown, fallback = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    return fallback
  }
  return val
}

/**
 * Calculates a 1-5 star rating from sub-scores (0..1), rounded to 0.5,
 * and identifies the 2 weakest sub-scores.
 */
export function starRating(
  sub: Record<string, number> | null | undefined
): StarRatingResult {
  const safeSub = sub && typeof sub === 'object' ? sub : {}

  let totalWeightedScore = 0
  let totalWeight = 0

  const subScoreList: WeakestSubScore[] = []

  for (const key of CANONICAL_SUB_SCORES) {
    let rawVal: unknown = safeSub[key]
    if (rawVal === undefined && key === 'on-time') {
      rawVal = safeSub['onTime']
    }

    const val = Math.min(1, Math.max(0, safeNum(rawVal, 0)))
    const weight = SUB_SCORE_WEIGHTS[key] ?? 0

    totalWeightedScore += val * weight
    totalWeight += weight

    subScoreList.push({
      key,
      score: val,
    })
  }

  const finalScore =
    totalWeight > 0 ? safeNum(totalWeightedScore / totalWeight, 0) : 0
  const clampedScore = Math.min(1, Math.max(0, finalScore))

  // Map score 0..1 to 1..5 stars
  const rawStars = 1 + 4 * clampedScore
  const roundedStars = Math.round(rawStars * 2) / 2
  const stars = Math.min(5, Math.max(1, safeNum(roundedStars, 1)))

  // Find 2 weakest sub-scores
  const sorted = [...subScoreList].sort((a, b) => a.score - b.score)
  const weakest = sorted.slice(0, 2)
  const weakestKeys = weakest.map((w) => w.key)

  return {
    stars,
    score: safeNum(clampedScore),
    weakest,
    weakestKeys,
  }
}
