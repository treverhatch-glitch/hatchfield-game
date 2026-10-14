/**
 * Day/night cycle hooks for the light rig.
 *
 * The sim clock paints the sky through `paintSky` (sun arc, sky colour, season
 * tint). This module is the seam the lighting pass — sun, hemisphere, airfield
 * glow, bloom, grade — reads after that paint, so a season tint is never
 * replaced by a night override.
 *
 * `World.setDayNight` / `WorldRenderer.setDayNight` store a partial override.
 * `setTimeOfDay(null)` clears only the photo-mode hour. `setDayNight(null)`
 * clears the hour and the override together.
 *
 * Low quality uses the same sample. It skips apron light pools, headlight
 * pools, and per-lamp glow rewrites; the sky, snow tint, and shared edge-light
 * opacity stay.
 */
import { DAY_SECONDS, lerpHex, simClockToHour, smoothstep, type SkyState } from './daylight'

export const DAY_NIGHT = {
  /** Sun clears the horizon. */
  sunrise: 6.4,
  /** Sun meets the horizon again. */
  sunset: 19.2,
  daySeconds: DAY_SECONDS,
  /** Hours used by the dawn / noon / dusk / night screenshots. */
  shots: { dawn: 6.6, noon: 12, dusk: 19, night: 23 },
} as const

/** Rig values a full-night override blends toward. Matches the midnight key. */
export const NIGHT_FLOOR = {
  sunIntensity: 0.16,
  hemiIntensity: 0.32,
  exposure: 1.15,
  sunColor: 0x8ea6d8,
  hemiSky: 0x30406a,
  hemiGround: 0x1a2418,
  ambient: 0.24,
  stars: 1,
} as const

/**
 * Partial override. Omit a field to keep the sim clock.
 * `daylight` 1 leaves the painted sky; 0 blends the rig to `NIGHT_FLOOR`.
 * `lights` is field-light brightness (runway, taxi, apron, aircraft, headlights).
 */
export interface DayNightControl {
  hour?: number | null
  daylight?: number
  lights?: number
}

/** What the renderer and the lighting rig both read, once per frame. */
export interface DayNightSample {
  hour: number
  /** 1 = full painted day, 0 = night floor. */
  daylight: number
  /** 0 = field lights off, 1 = fully on. */
  lights: number
  windows: number
  runwayEdge: number
  taxiEdge: number
  apron: number
  apronPools: boolean
  /** Aircraft nav and beacon brightness. */
  aircraft: number
  /** Vehicle headlight brightness. */
  headlights: number
  /** 0–1 winter snow on grass. 0 on other seasons and on maps with their own ground. */
  snow: number
  ground: number
  grass: number
  seasonId: string
}

export interface AirfieldLevels {
  runway: number
  taxi: number
  apron: number
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function wrapHour(hour: number): number {
  if (!Number.isFinite(hour)) return 0
  return ((hour % 24) + 24) % 24
}

/** 1 through the middle of the day, 0 overnight. Informational; the sky keys already paint this. */
export function daylightFactor(hour: number): number {
  const h = wrapHour(hour)
  if (h >= 12) return 1 - smoothstep(17.4, 20.4, h)
  return smoothstep(5.8, 8.6, h)
}

/**
 * Absolute sim clock (seconds) whose hour and season day match.
 * `day` is the economy day index (`floor(clock / 180)`).
 */
export function clockForHour(day: number, hour: number): number {
  const h = wrapHour(hour)
  const safeDay = Number.isFinite(day) ? Math.max(0, Math.floor(day)) : 0
  let p: number
  if (h >= 8 && h < 19) {
    p = ((h - 8) / 11) * (2 / 3)
  } else {
    const from19 = h >= 19 ? h - 19 : h + 5
    p = 2 / 3 + (from19 / 13) * (1 / 3)
  }
  return safeDay * DAY_SECONDS + p * DAY_SECONDS
}

/**
 * Blend a painted sky toward `NIGHT_FLOOR` when `daylight` is set, then apply
 * an optional field-light override. Season colours already in `sky` stay when
 * `daylight` is omitted or 1.
 */
export function applyDayNight(sky: SkyState, control: DayNightControl | null): SkyState {
  if (!control) return sky
  if (control.daylight != null && Number.isFinite(control.daylight)) {
    const t = 1 - clamp01(control.daylight)
    sky.sunIntensity += (NIGHT_FLOOR.sunIntensity - sky.sunIntensity) * t
    sky.hemiIntensity += (NIGHT_FLOOR.hemiIntensity - sky.hemiIntensity) * t
    sky.exposure += (NIGHT_FLOOR.exposure - sky.exposure) * t
    sky.ambient += (NIGHT_FLOOR.ambient - sky.ambient) * t
    sky.sunColor = lerpHex(sky.sunColor, NIGHT_FLOOR.sunColor, t)
    sky.hemiSky = lerpHex(sky.hemiSky, NIGHT_FLOOR.hemiSky, t)
    sky.hemiGround = lerpHex(sky.hemiGround, NIGHT_FLOOR.hemiGround, t)
    sky.stars = Math.max(sky.stars, t)
  }
  if (control.lights != null && Number.isFinite(control.lights)) {
    sky.lights = clamp01(control.lights)
  }
  return sky
}

export function idleDayNight(): DayNightSample {
  return {
    hour: 12,
    daylight: 1,
    lights: 0,
    windows: 0,
    runwayEdge: 0,
    taxiEdge: 0,
    apron: 0,
    apronPools: false,
    aircraft: 0,
    headlights: 0,
    snow: 0,
    ground: 0x5a7a44,
    grass: 0xb7d49a,
    seasonId: 'spring',
  }
}

/** Photo-mode hour wins; otherwise the control hour; otherwise the sim clock. */
export function resolveHour(clock: number, hourOverride: number | null, control: DayNightControl | null): number {
  if (hourOverride != null && Number.isFinite(hourOverride)) return hourOverride
  if (control?.hour != null && Number.isFinite(control.hour)) return control.hour
  return simClockToHour(clock)
}

export function airfieldLevels(sample: Pick<DayNightSample, 'runwayEdge' | 'taxiEdge' | 'apron'>): AirfieldLevels {
  return { runway: sample.runwayEdge, taxi: sample.taxiEdge, apron: sample.apron }
}
