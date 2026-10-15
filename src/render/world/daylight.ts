/**
 * Day / night + weather lighting model. Pure numbers in, pure numbers out, so the
 * sim clock, a photo-mode override, or a future weather system can all drive it.
 * The light rig reads the painted sky, then `applyDayNight` in `dayNight.ts`.
 */
import type { Weather } from '../../game/types'
import { DAYLIGHT_KEYS, LIGHT_LOOK, SUN_DISC, type DaylightKey } from '../look'

/** Sim day is 180 s; `Game.isNight()` is the last third. Map so night = 19:00–08:00. */
export const DAY_SECONDS = 180

export function simClockToHour(clock: number): number {
  const p = (((clock % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / DAY_SECONDS
  if (p < 2 / 3) return 8 + (p / (2 / 3)) * 11
  return (19 + ((p - 2 / 3) / (1 / 3)) * 13) % 24
}

export interface SkyState {
  hour: number
  /** Unit vector pointing from the ground toward the sun (or moon at night). */
  sunDir: { x: number; y: number; z: number }
  sunColor: number
  sunIntensity: number
  hemiSky: number
  hemiGround: number
  hemiIntensity: number
  ambient: number
  skyTop: number
  skyHorizon: number
  fogColor: number
  fogNear: number
  fogFar: number
  exposure: number
  /** 0 = full day, 1 = airfield lights fully on. */
  lights: number
  stars: number
  /** Ground wetness for darker / glossier paving. */
  wet: number
  precip: number
  lightning: boolean
}

type Key = DaylightKey

// Curve lives in `DAYLIGHT_KEYS` (look.ts): a warm sun key over a cooler hemisphere.

export function lerpHex(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  const r = Math.round(ar + (br - ar) * k)
  const g = Math.round(ag + (bg - ag) * k)
  const bl = Math.round(ab + (bb - ab) * k)
  return (r << 16) | (g << 8) | bl
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function sample(hour: number): Key {
  const h = ((hour % 24) + 24) % 24
  for (let i = 0; i < DAYLIGHT_KEYS.length - 1; i++) {
    const a = DAYLIGHT_KEYS[i]
    const b = DAYLIGHT_KEYS[i + 1]
    if (h >= a.h && h <= b.h) {
      const t = (h - a.h) / (b.h - a.h || 1)
      return {
        h,
        top: lerpHex(a.top, b.top, t),
        horizon: lerpHex(a.horizon, b.horizon, t),
        sun: lerpHex(a.sun, b.sun, t),
        sunI: a.sunI + (b.sunI - a.sunI) * t,
        hemi: lerpHex(a.hemi, b.hemi, t),
        hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
        exposure: a.exposure + (b.exposure - a.exposure) * t,
      }
    }
  }
  return DAYLIGHT_KEYS[0]
}

/** Field lights: on 19:00 → 08:00 with short ramps, matching the sim night window. */
export function lightsFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24
  if (h >= 12) return smoothstep(18.6, 19.4, h)
  return 1 - smoothstep(7.4, 8.2, h)
}

/**
 * 1 when the sky should be a star field, 0 once the sun disc is up.
 * Narrower than `lightsFactor`, so sunrise and sunset keep a visible sun
 * while the runway lights are still ramping.
 */
export function starsFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24
  if (h >= 12) return smoothstep(SUN_DISC.duskStart, SUN_DISC.duskEnd, h)
  return 1 - smoothstep(SUN_DISC.dawnStart, SUN_DISC.dawnEnd, h)
}

export function sunDirection(hour: number): { x: number; y: number; z: number } {
  const h = ((hour % 24) + 24) % 24
  const day = h >= 6 && h <= 20
  if (!day) {
    // Moon: high in the south-west, steady so night shadows don't swing.
    const v = { x: -0.35, y: 0.82, z: 0.45 }
    const l = Math.hypot(v.x, v.y, v.z)
    return { x: v.x / l, y: v.y / l, z: v.z / l }
  }
  const a = ((h - 6) / 14) * Math.PI
  const elev = Math.max(0.12, Math.sin(a)) * 1.05
  // East (+x) in the morning, west (−x) in the evening, a little south (+z).
  const x = Math.cos(a) * Math.cos(elev)
  const z = 0.35 * Math.cos(elev)
  const y = Math.sin(elev)
  const l = Math.hypot(x, y, z)
  return { x: x / l, y: y / l, z: z / l }
}

export function skyState(hour: number, weather: Weather = 'clear'): SkyState {
  const k = sample(hour)
  const lights = lightsFactor(hour)
  const s: SkyState = {
    hour: k.h,
    sunDir: sunDirection(hour),
    sunColor: k.sun,
    sunIntensity: k.sunI,
    hemiSky: k.hemi,
    hemiGround: lerpHex(LIGHT_LOOK.hemiGroundDay, LIGHT_LOOK.hemiGroundNight, lights),
    hemiIntensity: k.hemiI,
    ambient: LIGHT_LOOK.ambientDay + (LIGHT_LOOK.ambientNight - LIGHT_LOOK.ambientDay) * lights,
    skyTop: k.top,
    skyHorizon: k.horizon,
    fogColor: k.horizon,
    // Light aerial haze: the far field and farmland soften into the horizon colour.
    fogNear: 150,
    fogFar: 600,
    exposure: k.exposure,
    lights,
    stars: starsFactor(hour),
    wet: 0,
    precip: 0,
    lightning: false,
  }
  if (weather === 'rain' || weather === 'storm') {
    const storm = weather === 'storm'
    const grey = storm ? 0x3c4650 : 0x7d8894
    s.skyTop = lerpHex(s.skyTop, grey, storm ? 0.85 : 0.7)
    s.skyHorizon = lerpHex(s.skyHorizon, grey, storm ? 0.85 : 0.65)
    s.fogColor = s.skyHorizon
    s.sunIntensity *= storm ? 0.22 : 0.45
    s.hemiIntensity *= storm ? 0.75 : 0.9
    s.fogNear = storm ? 40 : 70
    s.fogFar = storm ? 190 : 260
    s.wet = storm ? 1 : 0.75
    s.precip = storm ? 1 : 0.6
    s.lightning = storm
    s.lights = Math.max(s.lights, storm ? 0.7 : 0.35)
  } else if (weather === 'fog') {
    s.skyTop = lerpHex(s.skyTop, 0xb8c2ca, 0.7)
    s.skyHorizon = lerpHex(s.skyHorizon, 0xc6cfd6, 0.8)
    s.fogColor = s.skyHorizon
    s.sunIntensity *= 0.55
    s.fogNear = 18
    s.fogFar = 150
    s.wet = 0.3
    s.lights = Math.max(s.lights, 0.6)
  }
  return s
}
