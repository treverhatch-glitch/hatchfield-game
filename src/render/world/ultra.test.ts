import { describe, expect, it } from 'vitest'
import { baseLevel, parseQuality, QUALITY, QUALITY_LABEL, suggestQuality } from './quality'

describe('ultra quality level', () => {
  it('never drops below high on any knob', () => {
    const u = QUALITY.ultra
    const h = QUALITY.high
    expect(u.level).toBe('ultra')
    expect(u.shadowMapSize).toBeGreaterThan(h.shadowMapSize)
    expect(u.textureSize).toBeGreaterThan(h.textureSize)
    expect(u.anisotropy).toBeGreaterThanOrEqual(h.anisotropy)
    expect(u.lodScale).toBeGreaterThan(h.lodScale)
    expect(u.pixelRatioCap).toBeGreaterThanOrEqual(h.pixelRatioCap)
    expect(u.msaa).toBe(true)
    expect(u.shadowEvery).toBe(1)
  })

  it('climbs the ladder in shadow resolution', () => {
    const sizes = (['low', 'med', 'high', 'ultra'] as const).map((l) => QUALITY[l].shadowMapSize)
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
  })

  it('parses, labels and maps to a base level', () => {
    expect(parseQuality('ultra')).toBe('ultra')
    expect(QUALITY_LABEL.ultra).toBe('Ultra')
    expect(baseLevel('ultra')).toBe('high')
    expect(baseLevel('med')).toBe('med')
  })

  it('suggests ultra only for a strong machine with a discrete desktop GPU', () => {
    const strong = { deviceMemory: 8, hardwareConcurrency: 20 }
    expect(suggestQuality({ ...strong, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 SUPER Direct3D11)' })).toBe('ultra')
    expect(suggestQuality({ ...strong, renderer: 'ANGLE (AMD, Radeon RX 7800 XT)' })).toBe('ultra')
    expect(suggestQuality({ ...strong, renderer: 'Apple M2' })).toBe('high')
    expect(suggestQuality({ ...strong, renderer: 'Intel(R) UHD Graphics 770' })).toBe('high')
    expect(suggestQuality({ renderer: 'NVIDIA GeForce RTX 4070', deviceMemory: 4, hardwareConcurrency: 4 })).toBe('med')
    expect(suggestQuality({ ...strong, renderer: 'ANGLE (Google, SwiftShader Device)' })).toBe('low')
  })
})
