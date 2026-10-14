import { describe, expect, it } from 'vitest'
import { CASCADE_TIERS, cascadeSplits, snapToTexel } from './cascades'

describe('cascadeSplits', () => {
  it('is increasing and ends at the max distance', () => {
    for (const cfg of Object.values(CASCADE_TIERS)) {
      const s = cascadeSplits(1, cfg)
      expect(s).toHaveLength(cfg.cascades)
      expect(s[s.length - 1]).toBe(cfg.maxDistance)
      for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1])
    }
  })
})

describe('snapToTexel', () => {
  it('lands on the texel grid and is stable under sub-texel motion', () => {
    const extent = 100
    const size = 1000
    const texel = extent / size
    const a = snapToTexel(12.321, extent, size)
    expect(a / texel).toBeCloseTo(Math.round(a / texel), 6)
    expect(snapToTexel(12.321 + texel * 0.2, extent, size)).toBeCloseTo(a, 9)
  })
})
