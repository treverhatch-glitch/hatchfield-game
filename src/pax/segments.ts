import { PAX_SEGMENT_CONFIG, type SegmentConfig } from './config.ts'
import { cleanFacts, cleanSegmentConfig } from './facts.ts'
import type { PaxRng } from './rng.ts'
import type { PaxSegment, SegmentShares, ShowUpFacts } from './types.ts'

/**
 * Road warrior / lounge lover / normal shares. They sum to 1.
 * Lounge quality raises only the lounge-lover share. A business-heavy bank
 * raises only the road-warrior share. Both are taken from normal passengers,
 * and normal is held at `minNormal` if the two levers would crowd it out.
 */
export function segmentShares(
  facts: ShowUpFacts = {},
  config: SegmentConfig = PAX_SEGMENT_CONFIG,
): SegmentShares {
  const clean = cleanFacts(facts)
  const cfg = cleanSegmentConfig(config)
  let lounge = cfg.baseLoungeLover + clean.loungeQuality * cfg.loungeQualityGain
  let road = cfg.baseRoadWarrior + clean.businessMix * cfg.businessMixGain
  if (!Number.isFinite(lounge) || lounge < 0) lounge = 0
  if (!Number.isFinite(road) || road < 0) road = 0

  const room = Math.max(0, 1 - cfg.minNormal)
  const sum = lounge + road
  if (sum > room) {
    if (sum > 0 && room > 0) {
      const scale = room / sum
      lounge *= scale
      road *= scale
    } else {
      lounge = 0
      road = 0
    }
  }

  const normal = 1 - (lounge + road)
  return {
    roadWarrior: road,
    loungeLover: lounge,
    normal: Number.isFinite(normal) ? normal : 1,
  }
}

/** Lounge-lover share alone, for callers that only have a quality number. */
export function loungeLoverShare(loungeQuality: number, businessMix = 0): number {
  return segmentShares({ loungeQuality, businessMix }).loungeLover
}

export function sampleSegment(rng: PaxRng, shares: SegmentShares): PaxSegment {
  const road = Number.isFinite(shares.roadWarrior) ? Math.max(0, shares.roadWarrior) : 0
  const lounge = Number.isFinite(shares.loungeLover) ? Math.max(0, shares.loungeLover) : 0
  const u = rng.next()
  if (u < road) return 'road_warrior'
  if (u < road + lounge) return 'lounge_lover'
  return 'normal'
}
