import {
  BAND_HYSTERESIS,
  CONTRACT_TIERS,
  RELATION_MAX,
  RELATION_MIN,
  SCORE_ON_ACCEPT,
  SCORE_ON_CANCEL,
  SCORE_ON_DECLINE,
  SCORE_ON_DELAY,
  SCORE_ON_SUCCESS,
  type ContractTier,
} from './config.ts'
import type { RelationBand, RelationRow, RelationsState } from './types.ts'

export function emptyRelations(): RelationsState {
  return { rows: {} }
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(RELATION_MIN, Math.min(RELATION_MAX, score))
}

function rawBand(score: number): RelationBand {
  if (score < -60) return 'hostile'
  if (score < -20) return 'cold'
  if (score <= 20) return 'neutral'
  if (score <= 60) return 'warm'
  return 'partner'
}

const BAND_RANK: Record<RelationBand, number> = {
  hostile: 0,
  cold: 1,
  neutral: 2,
  warm: 3,
  partner: 4,
}

/** Drop a band only after the score is BAND_HYSTERESIS past the edge. */
export function bandWithHysteresis(prev: RelationBand, score: number): RelationBand {
  const next = rawBand(score)
  if (BAND_RANK[next] >= BAND_RANK[prev]) return next
  const edge = next === 'hostile' ? -60 : next === 'cold' ? -20 : next === 'neutral' ? 20 : 60
  if (score > edge - BAND_HYSTERESIS && BAND_RANK[rawBand(score + BAND_HYSTERESIS)] >= BAND_RANK[prev]) {
    return prev
  }
  return next
}

export function readRelation(state: RelationsState, airlineId: string): RelationRow {
  return state.rows[airlineId] ?? { score: 0, band: 'neutral' }
}

export function shiftScore(state: RelationsState, airlineId: string, delta: number): RelationsState {
  const prev = readRelation(state, airlineId)
  const score = clampScore(prev.score + delta)
  return {
    rows: {
      ...state.rows,
      [airlineId]: { score, band: bandWithHysteresis(prev.band, score) },
    },
  }
}

export function contractTierFor(score: number): (typeof CONTRACT_TIERS)[number] {
  let picked: (typeof CONTRACT_TIERS)[number] = CONTRACT_TIERS[0]
  for (const row of CONTRACT_TIERS) {
    if (score >= row.minScore) picked = row
  }
  return picked
}

export function tierOf(state: RelationsState, airlineId: string): ContractTier {
  return contractTierFor(readRelation(state, airlineId).score).tier
}

export function feeFactorFor(state: RelationsState, airlineId: string): number {
  return contractTierFor(readRelation(state, airlineId).score).feeMult
}

export function noteLetter(
  state: RelationsState,
  airlineId: string,
  response: 'accept' | 'decline',
): RelationsState {
  return shiftScore(state, airlineId, response === 'accept' ? SCORE_ON_ACCEPT : SCORE_ON_DECLINE)
}

export function noteTurnaround(
  state: RelationsState,
  airlineId: string,
  kind: 'success' | 'delay' | 'cancel',
): RelationsState {
  const delta = kind === 'success' ? SCORE_ON_SUCCESS : kind === 'delay' ? SCORE_ON_DELAY : SCORE_ON_CANCEL
  return shiftScore(state, airlineId, delta)
}
