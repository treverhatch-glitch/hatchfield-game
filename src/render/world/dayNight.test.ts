import { describe, expect, it } from 'vitest'
import { faceHour } from '../../core/faceClock'
import { simClockToHour, skyState } from './daylight'
import {
  applyDayNight,
  clockForHour,
  daylightFactor,
  DAY_NIGHT,
  NIGHT_FLOOR,
  FIXED_DAY_HOUR,
  resolveHour,
  resolvePlayHour,
  SKY_PHOTO_FADES,
  SKY_PHOTO_WEATHER,
  SKY_PHOTOS,
  skyPhotoBlend,
} from './dayNight'
import { SkyDome } from './environment'
import { QUALITY } from './quality'

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
    expect(resolveHour(0, null, null)).toBe(0)
    expect(resolveHour(22.5, null, null)).toBeCloseTo(faceHour(22.5))
    expect(resolveHour(22.5, null, null)).toBeCloseTo(3)
    expect(resolveHour(0, null, null, false)).toBe(FIXED_DAY_HOUR)
    expect(resolveHour(0, 23, null, false)).toBe(23)
    const night = skyState(3)
    const morning = skyState(FIXED_DAY_HOUR)
    expect(night.lights).toBe(1)
    expect(morning.lights).toBe(0)
    // Night is a dim moon, not a black field. Noon still leads.
    expect(night.sunIntensity).toBeGreaterThan(0.2)
    expect(night.sunIntensity).toBeLessThan(0.6)
    expect(night.exposure).toBeGreaterThan(0.8)
    expect(morning.sunIntensity).toBeGreaterThan(night.sunIntensity * 8)
  })

  it('holds noon when the cycle is off, and still lets a photo hour win', () => {
    expect(resolvePlayHour(0, null, null, false)).toBe(DAY_NIGHT.hold)
    expect(resolvePlayHour(clockForHour(4, 23), null, null, false)).toBe(DAY_NIGHT.hold)
    expect(resolvePlayHour(0, 18.5, null, false)).toBe(18.5)
    expect(resolvePlayHour(0, null, { hour: 23 }, false)).toBe(23)
    expect(resolvePlayHour(0, null, null, true)).toBe(0)
    const dawn = skyState(DAY_NIGHT.shots.dawn)
    const dusk = skyState(DAY_NIGHT.shots.dusk)
    const noon = skyState(DAY_NIGHT.shots.noon)
    const night = skyState(DAY_NIGHT.shots.night)
    expect(dawn.sunDir.y).toBeLessThan(noon.sunDir.y * 0.5)
    expect(dawn.sunDir.x).toBeGreaterThan(0)
    expect(dusk.sunDir.x).toBeLessThan(0)
    expect((dawn.sunColor >> 16) & 255).toBeGreaterThan(dawn.sunColor & 255)
    expect((dusk.sunColor >> 16) & 255).toBeGreaterThan(dusk.sunColor & 255)
    expect(dawn.stars).toBeLessThan(0.25)
    expect(dusk.stars).toBeLessThan(0.35)
    expect(noon.stars).toBe(0)
    expect(night.stars).toBeGreaterThan(0.9)
    expect(dawn.lights).toBeGreaterThan(0.9)
    expect(noon.lights).toBe(0)
  })
})

describe('pack 6 sky photos', () => {
  it('shows one photo per screenshot hour', () => {
    expect(skyPhotoBlend(DAY_NIGHT.shots.noon)).toEqual({ a: 'noon', b: 'noon', t: 0 })
    expect(skyPhotoBlend(DAY_NIGHT.shots.night)).toEqual({ a: 'night', b: 'night', t: 0 })
    expect(skyPhotoBlend(3)).toEqual({ a: 'night', b: 'night', t: 0 })
    const dawn = skyPhotoBlend(DAY_NIGHT.shots.dawn)
    expect(dawn.t < 0.5 ? dawn.a : dawn.b).toBe('dawn')
    const dusk = skyPhotoBlend(DAY_NIGHT.shots.dusk)
    expect(dusk.t < 0.5 ? dusk.a : dusk.b).toBe('dusk')
  })

  it('crossfades inside each window without a jump at either end', () => {
    for (const f of SKY_PHOTO_FADES) {
      const mid = skyPhotoBlend((f.start + f.end) / 2)
      expect(mid.a).toBe(f.from)
      expect(mid.b).toBe(f.to)
      expect(mid.t).toBeGreaterThan(0.3)
      expect(mid.t).toBeLessThan(0.7)
      const before = skyPhotoBlend(f.start - 0.01)
      expect(before.t === 0 ? before.a : before.b).toBe(f.from)
      const after = skyPhotoBlend(f.end + 0.01)
      expect(after).toEqual({ a: f.to, b: f.to, t: 0 })
    }
    expect(skyPhotoBlend(24 + 12)).toEqual(skyPhotoBlend(12))
  })

  it('a daylight override pulls the sky toward the night photo', () => {
    expect(skyPhotoBlend(12, 0)).toEqual({ a: 'noon', b: 'night', t: 1 })
    expect(skyPhotoBlend(12, 1)).toEqual({ a: 'noon', b: 'noon', t: 0 })
  })

  it('rain and fog take the overcast plate, and a storm takes the storm plate', () => {
    expect(skyPhotoBlend(12, null, 'rain')).toEqual({ a: 'overcast', b: 'overcast', t: 0 })
    expect(skyPhotoBlend(12, null, 'fog')).toEqual({ a: 'overcast', b: 'overcast', t: 0 })
    expect(skyPhotoBlend(12, null, 'storm')).toEqual({ a: 'storm', b: 'storm', t: 0 })
    expect(skyPhotoBlend(12, null, 'clear')).toEqual({ a: 'noon', b: 'noon', t: 0 })
    expect(skyPhotoBlend(23, null, 'rain')).toEqual({ a: 'night', b: 'night', t: 0 })
    expect(skyPhotoBlend(23, null, 'storm')).toEqual({ a: 'storm', b: 'storm', t: 0 })
    expect(SKY_PHOTO_WEATHER.rain).toBe(1)
    expect(SKY_PHOTO_WEATHER.storm).toBe(1)
  })

  it('every photo has a horizon row inside the image', () => {
    for (const photo of Object.values(SKY_PHOTOS)) {
      expect(photo.horizon).toBeGreaterThanOrEqual(0)
      expect(photo.horizon).toBeLessThan(1)
      expect(photo.url).toMatch(/^\/art\/textures\/landing\/sky\/(dawn|noon|dusk|night|overcast|storm)\.jpeg$/)
      expect(photo.url).not.toContain('hdri')
    }
  })

  it('keeps the procedural dome until photos are turned on', () => {
    expect(QUALITY.low.skyPhotos).toBe(true)
    expect(QUALITY.med.skyPhotos).toBe(true)
    const sky = new SkyDome()
    sky.setPhotos(false)
    sky.setPhoto(skyPhotoBlend(12), 1)
    expect(sky.photoAmount()).toBe(0)
    sky.dispose()
  })
})
