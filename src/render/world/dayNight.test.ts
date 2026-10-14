import { describe, expect, it } from 'vitest'
import { simClockToHour, skyState } from './daylight'
import { applyDayNight, clockForHour, daylightFactor, DAY_NIGHT, NIGHT_FLOOR, resolveHour } from './dayNight'

describe('day/night hooks', () => {
  it('round-trips screenshot hours through the sim clock', () => {
    for (const hour of [0, 6.6, 8, 12, DAY_NIGHT.shots.dusk, 23]) {
      const clock = clockForHour(300, hour)
      expect(Math.floor(clock / 180)).toBe(300)
      const got = simClockToHour(clock)
      const span = Math.abs(got - hour)
      expect(Math.min(span, 24 - span)).toBeLessThan(1e-4)
    }
    expect(daylightFactor(12)).toBe(1)
    expect(daylightFactor(2)).toBe(0)
    expect(daylightFactor(DAY_NIGHT.shots.dawn)).toBeLessThan(0.4)
  })

  it('blends toward the night floor without dropping a season tint when daylight stays at 1', () => {
    const painted = skyState(12, 'clear')
    painted.sunColor = 0xffe0a0
    const kept = applyDayNight({ ...painted }, { daylight: 1 })
    expect(kept.sunColor).toBe(0xffe0a0)
    expect(kept.sunIntensity).toBe(painted.sunIntensity)

    const night = applyDayNight({ ...painted }, { daylight: 0, lights: 1 })
    expect(night.sunIntensity).toBeCloseTo(NIGHT_FLOOR.sunIntensity)
    expect(night.sunColor).toBe(NIGHT_FLOOR.sunColor)
    expect(night.lights).toBe(1)
    expect(night.stars).toBe(1)

    const lightsOnly = applyDayNight({ ...painted, lights: 0 }, { lights: 0.4 })
    expect(lightsOnly.lights).toBeCloseTo(0.4)
    expect(lightsOnly.sunColor).toBe(0xffe0a0)
  })

  it('lets a photo hour win over the control hour, and the control hour win over the clock', () => {
    expect(resolveHour(0, 15, { hour: 23 })).toBe(15)
    expect(resolveHour(0, null, { hour: 23 })).toBe(23)
    expect(resolveHour(0, null, null)).toBe(8)
  })
})
