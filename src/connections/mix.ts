import { transferShare } from '../hub/share.ts'
import type { CarrierProfile } from '../hub/types.ts'
import { TRANSFER_SCREEN_SHARE } from './config.ts'
import type { LoadSplit, PaxMix } from './types.ts'

/**
 * O&D vs transfer mix for one carrier. The transfer share is the hub layer's
 * (airline type, hub contract, tier, field level); this adds the re-screen share.
 */
export function paxMix(fieldLevel: number, carrier: CarrierProfile): PaxMix {
  const transfer = transferShare(fieldLevel, carrier)
  const screen = transfer > 0 ? (TRANSFER_SCREEN_SHARE[carrier.bizModel] ?? 0) : 0
  return { transfer, od: 1 - transfer, screen }
}

/** Whole-passenger split of one load. Transfer rounds, O&D takes the rest. */
export function splitLoad(pax: number, mix: PaxMix): LoadSplit {
  const total = Number.isFinite(pax) ? Math.max(0, Math.floor(pax)) : 0
  const transfer = Math.min(total, Math.round(total * clamp01(mix.transfer)))
  const screened = Math.min(transfer, Math.round(transfer * clamp01(mix.screen)))
  return { od: total - transfer, transfer, screened }
}

/** Stable 0..1 roll from a string, so the same passenger always rolls the same. */
export function roll01(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}
