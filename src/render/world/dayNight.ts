/**
 * Day/night cycle the lighting rig reads after the sim clock paints the sky.
 *
 * `paintSky` owns the sun arc, sky colour, and season tint. `applyDayNight`
 * then blends that painted sky toward night, or pins the field lights, without
 * replacing a season colour when `daylight` stays at 1.
 *
 * `World.setDayNight(null)` hands the sun back to the clock. `setTimeOfDay`
 * only overrides the hour. Low quality uses the same sample and skips apron
 * light pools, headlight pools, and per-lamp glow rewrites.
 */
import type { Weather } from '../../game/types'
import { DAY_SECONDS, lerpHex, simClockToHour, smoothstep, type SkyState } from './daylight'

export const DAY_NIGHT_CYCLE = {
  /** Sun clears the horizon. Matches the dawn ramp in `lightsFactor`. */
  sunriseHour: 7.4,
  /** Field lights finish coming on. Matches the dusk ramp in `lightsFactor`. */
  sunsetHour: 19.4,
  /** Sim seconds in one in-game day. A cycle advances `hour` from this. */
  daySeconds: DAY_SECONDS,
} as const

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
 * Partial override. Omit a field, or pass null, to keep the sim clock.
 * `daylight` 1 leaves the painted sky; 0 blends the rig to `NIGHT_FLOOR`.
 * `lights` is field-light brightness (runway, taxi, apron, aircraft, headlights).
 */
export interface DayNightControl {
  hour?: number | null
  daylight?: number | null
  lights?: number | null
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

/** Null fields. Passing this (or null) leaves the clock sky alone. */
export function emptyDayNight(): DayNightControl {
  return { hour: null, daylight: null, lights: null }
}

/**
 * Blend a painted sky toward `NIGHT_FLOOR` when `daylight` is set, then apply
 * an optional field-light override. Does not mutate `sky`. Season colours
 * already in `sky` stay when `daylight` is omitted or 1.
 */
export function applyDayNight(sky: SkyState, control: DayNightControl | null): SkyState {
  if (!control) return sky
  const hasDay = control.daylight != null && Number.isFinite(control.daylight)
  const hasLights = control.lights != null && Number.isFinite(control.lights)
  if (!hasDay && !hasLights) return sky
  const next: SkyState = { ...sky, sunDir: { ...sky.sunDir } }
  if (hasDay) {
    const t = 1 - clamp01(control.daylight as number)
    next.sunIntensity += (NIGHT_FLOOR.sunIntensity - next.sunIntensity) * t
    next.hemiIntensity += (NIGHT_FLOOR.hemiIntensity - next.hemiIntensity) * t
    next.exposure += (NIGHT_FLOOR.exposure - next.exposure) * t
    next.ambient += (NIGHT_FLOOR.ambient - next.ambient) * t
    next.sunColor = lerpHex(next.sunColor, NIGHT_FLOOR.sunColor, t)
    next.hemiSky = lerpHex(next.hemiSky, NIGHT_FLOOR.hemiSky, t)
    next.hemiGround = lerpHex(next.hemiGround, NIGHT_FLOOR.hemiGround, t)
    next.stars = Math.max(next.stars, t)
  }
  if (hasLights) next.lights = clamp01(control.lights as number)
  return next
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

export type SkyPhotoId = 'dawn' | 'noon' | 'dusk' | 'night'

/**
 * Pack 6 sky panoramas on the dome. `horizon` is the image row (0 bottom, 1 top)
 * that sits on the horizon; everything above it stretches up to the zenith.
 */
export const SKY_PHOTOS: Record<SkyPhotoId, { url: string; horizon: number }> = {
  dawn: { url: '/textures/sky/sky_dawn.jpg', horizon: 0.2 },
  noon: { url: '/textures/sky/sky_noon.jpg', horizon: 0.3 },
  dusk: { url: '/textures/sky/sky_dusk.jpg', horizon: 0.08 },
  night: { url: '/textures/sky/sky_night.jpg', horizon: 0.05 },
}

/** Crossfade windows in sim hours, in clock order. Outside a window the last photo holds. */
export const SKY_PHOTO_FADES: readonly { from: SkyPhotoId; to: SkyPhotoId; start: number; end: number }[] = [
  { from: 'night', to: 'dawn', start: 5.0, end: 6.4 },
  { from: 'dawn', to: 'noon', start: 7.2, end: 9.2 },
  { from: 'noon', to: 'dusk', start: 17.0, end: 18.8 },
  { from: 'dusk', to: 'night', start: 19.6, end: 21.0 },
]

/** How much of the photo shows over the procedural sky. Grey weather keeps mostly the painted gradient. */
export const SKY_PHOTO_WEATHER: Record<Weather, number> = {
  clear: 1,
  rain: 0.35,
  fog: 0.25,
  storm: 0.15,
}

/** Two photos and the mix between them: `t` 0 shows `a`, 1 shows `b`. */
export interface SkyPhotoBlend {
  a: SkyPhotoId
  b: SkyPhotoId
  t: number
}

/**
 * Which panoramas the dome shows at `hour`. A `daylight` override below 1 pulls
 * the dominant photo toward night, the same way `applyDayNight` dims the rig.
 */
export function skyPhotoBlend(hour: number, daylight?: number | null): SkyPhotoBlend {
  const h = wrapHour(hour)
  let blend: SkyPhotoBlend | null = null
  let hold = SKY_PHOTO_FADES[SKY_PHOTO_FADES.length - 1].to
  for (const f of SKY_PHOTO_FADES) {
    if (h >= f.start && h < f.end) {
      blend = { a: f.from, b: f.to, t: smoothstep(f.start, f.end, h) }
      break
    }
    if (h >= f.end) hold = f.to
  }
  blend ??= { a: hold, b: hold, t: 0 }
  if (daylight != null && Number.isFinite(daylight) && daylight < 1) {
    const lead = blend.t < 0.5 ? blend.a : blend.b
    return { a: lead, b: 'night', t: 1 - clamp01(daylight) }
  }
  return blend
}

export function airfieldLevels(sample: Pick<DayNightSample, 'runwayEdge' | 'taxiEdge' | 'apron'>): AirfieldLevels {
  return { runway: sample.runwayEdge, taxi: sample.taxiEdge, apron: sample.apron }
}
