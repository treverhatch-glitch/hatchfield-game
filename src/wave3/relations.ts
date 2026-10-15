import {
  BAND_HYSTERESIS,
  CAPACITY_HEADROOM,
  CAPACITY_STRAIN,
  CONTRACT_TIERS,
  EXPERIENCE_TURNS,
  GATE_SCORE_CAP,
  LOUNGE_SCORE_CAP,
  RELATION_MAX,
  RELATION_MIN,
  SCORE_CAPACITY,
  SCORE_CAPACITY_STRAIN,
  SCORE_KEPT_PER_DAY,
  SCORE_ON_ACCEPT,
  SCORE_ON_CANCEL,
  SCORE_ON_DECLINE,
  SCORE_ON_DELAY,
  SCORE_ON_FINE,
  SCORE_ON_MISSED_ASK,
  SCORE_ON_SUCCESS,
  SCORE_PER_GATE,
  SCORE_PER_LOUNGE,
  type ContractTier,
} from './config.ts'
import type { RelationBand, RelationCounts, RelationParts, RelationSnapshot, RelationsState } from './types.ts'

export const RELATION_PART_LABELS: Record<keyof RelationParts, string> = {
  letter: 'Contracts',
  onTime: 'On-time turns',
  delay: 'Delays',
  cancel: 'Cancellations',
  kept: 'Kept contracts',
  capacity: 'Stand capacity',
  lounge: 'Lounges',
  gate: 'Gates',
  dedicated: 'Dedicated leases',
  missed: 'Missed asks',
  fine: 'Fines',
}

export interface RelationDayFacts {
  day: number
  signed: readonly string[]
  stands: number
  gates: number
  lounges: number
  /** Capped dedicated-lease credit per airline. Same review as lounges and gates. */
  dedicated?: Readonly<Record<string, number>>
}

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

export function emptyParts(): RelationParts {
  return {
    letter: 0,
    onTime: 0,
    delay: 0,
    cancel: 0,
    kept: 0,
    capacity: 0,
    lounge: 0,
    gate: 0,
    dedicated: 0,
    missed: 0,
    fine: 0,
  }
}

export function emptyCounts(): RelationCounts {
  return { onTime: 0, delay: 0, cancel: 0, missed: 0, fine: 0, kept: 0 }
}

function blankRow(): RelationSnapshot {
  return {
    score: 0,
    band: 'neutral',
    parts: emptyParts(),
    counts: emptyCounts(),
    reviewedDay: -1,
    routesGranted: 0,
    hubAsked: false,
    exclusiveNoted: false,
  }
}

export function readRelation(state: RelationsState, airlineId: string): RelationSnapshot {
  const row = state.rows[airlineId]
  if (!row) return blankRow()
  return {
    score: row.score ?? 0,
    band: row.band ?? 'neutral',
    parts: { ...emptyParts(), ...row.parts },
    counts: { ...emptyCounts(), ...row.counts },
    reviewedDay: row.reviewedDay ?? -1,
    routesGranted: row.routesGranted ?? 0,
    hubAsked: row.hubAsked ?? false,
    exclusiveNoted: row.exclusiveNoted ?? false,
  }
}

export function shiftScore(state: RelationsState, airlineId: string, delta: number): RelationsState {
  const prev = readRelation(state, airlineId)
  const score = clampScore(prev.score + delta)
  return {
    rows: {
      ...state.rows,
      [airlineId]: { ...prev, score, band: bandWithHysteresis(prev.band, score) },
    },
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function applyParts(
  state: RelationsState,
  airlineId: string,
  entries: readonly (readonly [keyof RelationParts, number])[],
  counts?: Partial<RelationCounts>,
  reviewedDay?: number,
): RelationsState {
  const prev = readRelation(state, airlineId)
  const requested = entries.reduce((sum, [, delta]) => sum + delta, 0)
  const score = clampScore(prev.score + requested)
  const applied = score - prev.score
  const parts = { ...prev.parts }
  const scale = requested !== 0 && applied !== requested ? applied / requested : 1
  for (const [key, delta] of entries) parts[key] = round3(parts[key] + delta * scale)
  const nextCounts = { ...prev.counts }
  if (counts) {
    for (const key of Object.keys(counts) as (keyof RelationCounts)[]) {
      nextCounts[key] += counts[key] ?? 0
    }
  }
  return {
    rows: {
      ...state.rows,
      [airlineId]: {
        ...prev,
        score: round3(score),
        band: bandWithHysteresis(prev.band, score),
        parts,
        counts: nextCounts,
        reviewedDay: reviewedDay ?? prev.reviewedDay,
      },
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
  return applyParts(state, airlineId, [['letter', response === 'accept' ? SCORE_ON_ACCEPT : SCORE_ON_DECLINE]])
}

export function noteTurnaround(
  state: RelationsState,
  airlineId: string,
  kind: 'success' | 'delay' | 'cancel',
): RelationsState {
  if (kind === 'success') return applyParts(state, airlineId, [['onTime', SCORE_ON_SUCCESS]], { onTime: 1 })
  if (kind === 'delay') return applyParts(state, airlineId, [['delay', SCORE_ON_DELAY]], { delay: 1 })
  return applyParts(state, airlineId, [['cancel', SCORE_ON_CANCEL]], { cancel: 1 })
}

export function noteMissedAsk(state: RelationsState, airlineId: string): RelationsState {
  return applyParts(state, airlineId, [['missed', SCORE_ON_MISSED_ASK]], { missed: 1 })
}

export function noteFine(state: RelationsState, airlineId: string): RelationsState {
  return applyParts(state, airlineId, [['fine', SCORE_ON_FINE]], { fine: 1 })
}

/**
 * End-of-day review. Kept contracts, spare stands, lounges and gates add.
 * A strained ramp subtracts. The same day does not apply twice.
 */
export function reviewRelationDay(state: RelationsState, facts: RelationDayFacts): RelationsState {
  let next = state
  const carriers = Math.max(1, facts.signed.length)
  const headroom = Math.max(0, facts.stands) / carriers
  for (const airlineId of facts.signed) {
    const prev = readRelation(next, airlineId)
    if (prev.reviewedDay >= facts.day) continue
    const turns = prev.counts.onTime + prev.counts.delay
    const scale = Math.min(1, turns / EXPERIENCE_TURNS)
    let capacity = 0
    if (facts.stands > 0 && headroom >= CAPACITY_HEADROOM) capacity = SCORE_CAPACITY * scale
    else if (turns > 0 && (facts.stands <= 0 || headroom < CAPACITY_STRAIN)) capacity = SCORE_CAPACITY_STRAIN
    const lounges = Math.min(Math.max(0, facts.lounges), LOUNGE_SCORE_CAP) * SCORE_PER_LOUNGE * scale
    const gates = Math.min(Math.max(0, facts.gates), GATE_SCORE_CAP) * SCORE_PER_GATE * scale
    const dedicated = Math.max(0, facts.dedicated?.[airlineId] ?? 0)
    next = applyParts(
      next,
      airlineId,
      [
        ['kept', SCORE_KEPT_PER_DAY],
        ['capacity', capacity],
        ['lounge', lounges],
        ['gate', gates],
        ['dedicated', dedicated],
      ],
      { kept: 1 },
      facts.day,
    )
  }
  return next
}
