import { describe, expect, it } from 'vitest'
import { QUALITY } from '../world/quality'
import { clampAnisotropy, parseTier, tierBase, tierPreset, TIER_ORDER } from './tiers'

describe('quality tiers', () => {
  it('maps low/medium/high straight onto the existing presets', () => {
    expect(tierPreset('low')).toEqual(QUALITY.low)
    expect(tierPreset('medium')).toEqual(QUALITY.med)
    expect(tierPreset('high')).toEqual(QUALITY.high)
  })

  it('ultra is never cheaper than high', () => {
    const u = tierPreset('ultra')
    const h = tierPreset('high')
    expect(tierBase('ultra')).toBe('high')
    expect(u.shadowMapSize).toBeGreaterThan(h.shadowMapSize)
    expect(u.anisotropy).toBeGreaterThanOrEqual(h.anisotropy)
    expect(u.textureSize).toBeGreaterThan(h.textureSize)
  })

  it('shadow resolution never drops going up the ladder', () => {
    const sizes = TIER_ORDER.map((t) => tierPreset(t).shadowMapSize)
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
  })

  it('parses saved values and defaults to high', () => {
    expect(parseTier('ultra')).toBe('ultra')
    expect(parseTier('med')).toBe('medium')
    expect(parseTier('nope')).toBe('high')
  })

  it('clamps anisotropy to the GPU limit', () => {
    expect(clampAnisotropy(16, 8)).toBe(8)
    expect(clampAnisotropy(16, 0)).toBe(1)
    expect(clampAnisotropy(4, 16)).toBe(4)
  })
})
