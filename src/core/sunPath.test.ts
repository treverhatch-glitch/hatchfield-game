import { describe, expect, it } from 'vitest'
import { moonDirection, shadowCast, sunDirection, MAX_SHADOW_RATIO } from './sunPath'

describe('sunPath', () => {
  it('rises east, peaks at midday, sets west', () => {
    expect(sunDirection(7).x).toBeGreaterThan(0.5)
    expect(sunDirection(19).x).toBeLessThan(-0.5)
    expect(sunDirection(13).elevation).toBeGreaterThan(sunDirection(8).elevation)
    expect(sunDirection(13).source).toBe('sun')
  })
  it('hands night to the moon', () => {
    expect(sunDirection(23).source).toBe('moon')
    expect(sunDirection(23)).toEqual(moonDirection(23))
    expect(sunDirection(2).y).toBeGreaterThan(0)
  })
  it('lifts the summer noon and lowers the winter noon', () => {
    const base = sunDirection(13).elevation
    expect(sunDirection(13, 'summer').elevation).toBeGreaterThan(base)
    expect(sunDirection(13, 'winter').elevation).toBeLessThan(base)
    expect(sunDirection(13, 'nonsense').elevation).toBeCloseTo(base)
  })
  it('throws long shadows at dawn and dusk, short at noon, away from the sun', () => {
    const dawn = shadowCast(sunDirection(6.5), 2)
    const noon = shadowCast(sunDirection(13), 2)
    const dusk = shadowCast(sunDirection(19.5), 2)
    expect(dawn.castLength).toBeGreaterThan(noon.castLength * 3)
    expect(dusk.castLength).toBeGreaterThan(noon.castLength * 3)
    expect(dawn.ux).toBeLessThan(0)
    expect(dusk.ux).toBeGreaterThan(0)
    expect(dawn.castLength).toBeLessThanOrEqual(2 * MAX_SHADOW_RATIO)
  })
  it('slides an airborne shadow further the higher it flies', () => {
    const d = sunDirection(10)
    expect(shadowCast(d, 1, 20).slide).toBeGreaterThan(shadowCast(d, 1, 5).slide)
    expect(shadowCast(d, 1, 0).slide).toBe(0)
  })
})
