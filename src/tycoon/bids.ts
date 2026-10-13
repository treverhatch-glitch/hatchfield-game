import {
  BID_JITTER,
  LEAVE_BELOW,
  MAX_DAILY_RENT,
  MID_RENEW_CHANCE,
  QUALITY_STAY,
  QUIET_PENALTY,
  RENEW_AT,
  brandsFor,
  type QualityTier,
} from './config.ts'
import type { TenantBid, TenantUnit } from './types.ts'

interface Roll {
  next(): number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function pickCard<T>(rows: readonly T[], rng: Roll): T {
  return rows[Math.floor(rng.next() * rows.length)] ?? rows[0]
}

/**
 * One bid per quality tier. Economy pays more guaranteed rent and a thin
 * share. Premium pays less rent and a fatter share of what it sells.
 */
export function makeBids(unit: TenantUnit, rng: Roll, nextId: () => string): TenantBid[] {
  const cards = brandsFor(unit.kind)
  const bids: TenantBid[] = []
  for (const quality of [1, 2, 3] as const) {
    const pool = cards.filter((c) => c.quality === quality)
    const card = pickCard(pool, rng)
    const swing = 1 - BID_JITTER + rng.next() * BID_JITTER * 2
    bids.push({
      id: nextId(),
      unitId: unit.id,
      brand: card.name,
      kind: unit.kind,
      dailyRent: clamp(Math.round(card.dailyRent * swing), 50, MAX_DAILY_RENT),
      revenueShare: clamp(Math.round(card.revenueShare * swing * 1000) / 1000, 0.04, 0.4),
      quality: quality satisfies QualityTier,
    })
  }
  return bids
}

export function decideStay(
  satisfaction: number,
  passengers: number,
  quality: QualityTier,
  roll: number,
): 'renew' | 'leave' {
  let score = satisfaction
  if (passengers <= 0) score -= QUIET_PENALTY
  score += (quality - 2) * QUALITY_STAY
  if (score >= RENEW_AT) return 'renew'
  if (score < LEAVE_BELOW) return 'leave'
  return roll < MID_RENEW_CHANCE ? 'renew' : 'leave'
}
