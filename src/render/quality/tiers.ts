/**
 * Four-step quality ladder (Low / Medium / High / Ultra) on top of the existing three
 * render presets in `render/world/quality.ts`. Ultra reuses High and raises the knobs
 * that only a desktop GPU can afford. All tunables live in `TIERS` below.
 */
import { QUALITY, type QualityLevel, type QualityPreset } from '../world/quality'

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra'

export const TIER_ORDER: readonly QualityTier[] = ['low', 'medium', 'high', 'ultra']

export const TIER_LABEL: Record<QualityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
}

interface TierDef {
  base: QualityLevel
  overrides: Partial<QualityPreset>
}

export const TIERS: Record<QualityTier, TierDef> = {
  low: { base: 'low', overrides: {} },
  medium: { base: 'med', overrides: {} },
  high: { base: 'high', overrides: {} },
  ultra: {
    base: 'high',
    overrides: {
      shadowMapSize: 4096,
      shadowRadius: 5,
      pixelRatioCap: 2,
      textureSize: 1024,
      anisotropy: 16,
      lodScale: 1.8,
      grassTufts: 6000,
      trees: 900,
      precipitation: 3000,
      shadowReach: 0.8,
    },
  },
}

export function tierPreset(tier: QualityTier): QualityPreset {
  const def = TIERS[tier]
  return { ...QUALITY[def.base], ...def.overrides }
}

export function tierBase(tier: QualityTier): QualityLevel {
  return TIERS[tier].base
}

export function parseTier(v: unknown, fallback: QualityTier = 'high'): QualityTier {
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'ultra') return v
  if (v === 'med') return 'medium'
  return fallback
}

/** Clamp anisotropy to what the GPU supports. */
export function clampAnisotropy(want: number, max: number): number {
  return Math.max(1, Math.min(want, max > 0 ? max : 1))
}
