import {
  HUB_CARRIER_BONUS,
  HUB_MID_FIELD_LEVEL,
  LAYOVER_SHARE_BONUS,
  ROLE_SHARE_MULT,
  SHARE_BY_FIELD_LEVEL,
  SHARE_CAP,
  TIER_BONUS_FROM,
  TIER_SHARE_BONUS,
} from './config.ts'
import type { CarrierProfile } from './types.ts'

function hash32(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function levelShare(fieldLevel: number): number {
  const level = Math.floor(fieldLevel)
  if (level < HUB_MID_FIELD_LEVEL) return 0
  if (SHARE_BY_FIELD_LEVEL[level] != null) return SHARE_BY_FIELD_LEVEL[level]
  return SHARE_BY_FIELD_LEVEL[5] ?? 0
}

/**
 * Fraction of an arriving load that is connecting.
 * Exactly 0 before mid-game, so the early hall is unchanged.
 */
export function transferShare(fieldLevel: number, carrier: CarrierProfile): number {
  const base = levelShare(fieldLevel)
  if (!(base > 0)) return 0
  if (carrier.kind === 'cargo' || carrier.bizModel === 'cargo') return 0
  const role = ROLE_SHARE_MULT[carrier.bizModel] ?? 0
  let share = base * role
  if (carrier.hub) share += HUB_CARRIER_BONUS
  else if (carrier.likesLayovers) share += LAYOVER_SHARE_BONUS
  if (carrier.tier >= TIER_BONUS_FROM) share += TIER_SHARE_BONUS
  if (!Number.isFinite(share) || share <= 0) return 0
  return Math.min(SHARE_CAP, share)
}

/** Bank tightness multiplies share. A zero base stays zero. */
export function scaledShare(base: number, demand: number): number {
  if (!(base > 0) || !(demand > 0) || !Number.isFinite(base) || !Number.isFinite(demand)) return 0
  return Math.min(SHARE_CAP, base * demand)
}

/**
 * Stable subset of `count` arrivals. Same seed and share always pick the same indexes.
 * Share 0 returns an empty list.
 */
export function connectingIndexes(count: number, share: number, seed: string): number[] {
  if (!(count > 0) || !(share > 0) || !Number.isFinite(share)) return []
  const n = Math.min(count, Math.round(count * share))
  if (n <= 0) return []
  const order = Array.from({ length: count }, (_, i) => i)
  order.sort((a, b) => {
    const ha = hash32(`${seed}:${a}`)
    const hb = hash32(`${seed}:${b}`)
    return ha - hb || a - b
  })
  return order.slice(0, n).sort((a, b) => a - b)
}
