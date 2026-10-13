import { MAX_WAVE, PAX_SEGMENT_CONFIG, type SegmentConfig } from './config.ts'
import { clamp, clamp01, finite } from './num.ts'
import type { CleanFacts, PaxSegment, ShowUpFacts } from './types.ts'

export function asSegment(value: unknown): PaxSegment {
  if (value === 'road_warrior' || value === 'lounge_lover' || value === 'normal') return value
  return 'normal'
}

function unit(value: unknown): number {
  return clamp01(typeof value === 'number' ? value : 0)
}

export function cleanFacts(facts: ShowUpFacts | null | undefined): CleanFacts {
  const src = facts ?? {}
  return {
    loungeQuality: unit(src.loungeQuality),
    fastTrackAvailable: src.fastTrackAvailable === true,
    intl: src.intl === true,
    businessMix: unit(src.businessMix),
  }
}

export function cleanSegmentConfig(config: SegmentConfig | null | undefined): SegmentConfig {
  const src = config ?? PAX_SEGMENT_CONFIG
  return {
    baseRoadWarrior: clamp01(finite(src.baseRoadWarrior, PAX_SEGMENT_CONFIG.baseRoadWarrior)),
    baseLoungeLover: clamp01(finite(src.baseLoungeLover, PAX_SEGMENT_CONFIG.baseLoungeLover)),
    loungeQualityGain: clamp(finite(src.loungeQualityGain, PAX_SEGMENT_CONFIG.loungeQualityGain), 0, 1),
    businessMixGain: clamp(finite(src.businessMixGain, PAX_SEGMENT_CONFIG.businessMixGain), 0, 1),
    minNormal: clamp01(finite(src.minNormal, PAX_SEGMENT_CONFIG.minNormal)),
  }
}

/** How many passengers a pure call will actually draw. */
export function sanitizeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0
  return Math.min(MAX_WAVE, Math.floor(count))
}
