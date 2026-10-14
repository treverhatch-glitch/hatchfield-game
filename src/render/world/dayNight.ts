/**
 * Hooks for a later day/night cycle.
 *
 * The apron still follows the sim clock. A cycle should call `setDayNight`
 * once per frame (after photo mode applies its hour) with any field it wants
 * to own. Null fields keep the clock's value. `setDayNight(null)` hands the
 * sun back. `setTimeOfDay` only overrides the hour and leaves these hooks.
 */
import { DAYLIGHT_KEYS } from '../look'
import { DAY_SECONDS, lerpHex, type SkyState } from './daylight'

export const DAY_NIGHT_CYCLE = {
  /** Sun clears the horizon. Matches the dawn ramp in `lightsFactor`. */
  sunriseHour: 7.4,
  /** Field lights finish coming on. Matches the dusk ramp in `lightsFactor`. */
  sunsetHour: 19.4,
  /** Sim seconds in one in-game day. A cycle advances `hour` from this. */
  daySeconds: DAY_SECONDS,
} as const

export interface DayNightSample {
  /** 0–24. Null follows the simulation clock (or a photo-mode hour). */
  hour: number | null
  /** 0 = night floor, 1 = the clock's full sun. Null leaves the sun alone. */
  daylight: number | null
  /** 0 = field lights off, 1 = fully on. Null follows the clock and weather. */
  lights: number | null
}

export function emptyDayNight(): DayNightSample {
  return { hour: null, daylight: null, lights: null }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/**
 * Scale a clock-driven sky toward night, or pin the field lights.
 * Pure: the input sky is not mutated.
 */
export function applyDayNight(sky: SkyState, sample: DayNightSample | null): SkyState {
  if (!sample || (sample.daylight == null && sample.lights == null)) return sky
  const night = DAYLIGHT_KEYS[0]
  const next: SkyState = { ...sky, sunDir: { ...sky.sunDir } }
  if (sample.daylight != null) {
    const d = clamp01(sample.daylight)
    next.sunIntensity = night.sunI + (sky.sunIntensity - night.sunI) * d
    next.hemiIntensity = night.hemiI + (sky.hemiIntensity - night.hemiI) * d
    next.exposure = night.exposure + (sky.exposure - night.exposure) * d
    next.sunColor = lerpHex(night.sun, sky.sunColor, d)
    next.stars = Math.max(sky.stars, 1 - d)
  }
  if (sample.lights != null) next.lights = clamp01(sample.lights)
  return next
}
