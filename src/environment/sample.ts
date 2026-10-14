/**
 * Day/night and seasons for the field.
 *
 * Builds on the sim-clock sky (`s../lighting/daylight.ts`) and the map
 * demand calendar (`src/economy/seasons.ts`). Colour tints are uniform writes.
 * The low preset keeps the season tint and a lighter snow write, and drops
 * fog-distance reshape plus apron light pools. No extra meshes or particles.
 */
import { DEFAULT_DEMAND_CALENDAR, demandAtDay } from '../economy/seasons.ts'
import type { Weather } from '../game/types.ts'
import { daylightFactor } from '../lighting/dayNight.ts'
import {
  DAY_SECONDS,
  lerpHex,
  lightsFactor,
  simClockToHour,
  skyState,
  smoothstep,
  type SkyState,
} from '../lighting/daylight.ts'
import {
  CLIMATE_LABEL,
  DEMAND,
  GROUND_OPS,
  SEASON_PALETTES,
  SEASON_WEATHER,
  SNOW,
  TIME_OF_DAY_DEMAND,
  type ClimateId,
  type GfxQuality,
  type SeasonPalette,
} from './config.ts'

export { DAY_SECONDS, simClockToHour }

export interface SeasonView {
  id: string
  name: string
  climate: ClimateId
  palette: SeasonPalette
  dayOfYear: number
}

export interface HolidayPeakInput {
  dayOfYear: number
  seasonId: string | null
  activeHolidayIds: readonly string[]
  /** Season curve × built-in holiday multipliers, before this hook. */
  calendarMultiplier: number
}

/** Extra peak on top of the calendar. Return 1 to leave the calendar as-is. */
export type HolidayPeakHook = (input: HolidayPeakInput) => number

export const defaultHolidayPeak: HolidayPeakHook = () => 1

/** Named boosts, e.g. `{ winter_holidays: 1.35 }`, multiplied for each active id. */
export function holidayPeakHook(extra: Readonly<Record<string, number>>): HolidayPeakHook {
  return (input) => {
    let peak = 1
    for (const id of input.activeHolidayIds) {
      const boost = extra[id]
      if (boost != null && boost > 0) peak *= boost
    }
    return peak
  }
}

export interface ArrivalDemand {
  hour: number
  day: number
  dayOfYear: number
  seasonId: string | null
  timeOfDay: number
  /** Calendar season curve × built-in holidays. */
  calendar: number
  holidayPeak: number
  combined: number
  activeHolidayIds: readonly string[]
}

export interface NightLighting {
  /** Apron flood masts. */
  apron: number
  /** Runway edge (and the rest of the runway bar, which shares this factor). */
  runwayEdge: number
  /** Taxiway edge (centre lights share this factor). */
  taxiEdge: number
  /** Terminal glass emissive. Comes on a little before the field at dusk. */
  terminalWindows: number
  /** Ground pools under the masts. Off on the low preset. */
  apronPools: boolean
}

const FALLBACK_SEASON = 'spring'

export function dayIndex(clock: number): number {
  if (!Number.isFinite(clock)) return 0
  return Math.floor(Math.max(0, clock) / DAY_SECONDS)
}

export function seasonAtDay(absoluteDay: number): SeasonView {
  const snap = demandAtDay(DEFAULT_DEMAND_CALENDAR, absoluteDay)
  const id = snap.seasonId && SEASON_PALETTES[snap.seasonId] ? snap.seasonId : FALLBACK_SEASON
  const palette = SEASON_PALETTES[id]
  return {
    id: palette.id,
    name: palette.name,
    climate: palette.climate,
    palette,
    dayOfYear: snap.dayOfYear,
  }
}

export function seasonAtClock(clock: number): SeasonView {
  return seasonAtDay(dayIndex(clock))
}

export function isNightHour(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24
  return h >= 19 || h < 8
}

function sampleCurve(points: readonly { hour: number; factor: number }[], hour: number): number {
  const h = ((hour % 24) + 24) % 24
  if (points.length === 0) return 1
  const first = points[0]
  if (h <= first.hour) return first.factor
  for (let i = 1; i < points.length; i++) {
    const right = points[i]
    if (h > right.hour) continue
    const left = points[i - 1]
    const span = right.hour - left.hour
    if (span <= 0) return right.factor
    const t = (h - left.hour) / span
    return left.factor + (right.factor - left.factor) * t
  }
  return points[points.length - 1].factor
}

/** 1 at the morning open, well under 1 overnight. */
export function timeOfDayFactor(hour: number): number {
  return sampleCurve(TIME_OF_DAY_DEMAND, hour)
}

export function arrivalDemand(clock: number, holidayPeak: HolidayPeakHook = defaultHolidayPeak): ArrivalDemand {
  const day = dayIndex(clock)
  const snap = demandAtDay(DEFAULT_DEMAND_CALENDAR, day)
  const hour = simClockToHour(clock)
  const timeOfDay = timeOfDayFactor(hour)
  const peak = holidayPeak({
    dayOfYear: snap.dayOfYear,
    seasonId: snap.seasonId,
    activeHolidayIds: snap.activeHolidayIds,
    calendarMultiplier: snap.multiplier,
  })
  const holiday = Number.isFinite(peak) && peak > 0 ? peak : 1
  return {
    hour,
    day,
    dayOfYear: snap.dayOfYear,
    seasonId: snap.seasonId,
    timeOfDay,
    calendar: snap.multiplier,
    holidayPeak: holiday,
    combined: snap.multiplier * timeOfDay * holiday,
    activeHolidayIds: snap.activeHolidayIds,
  }
}

/**
 * Multiply a base slot gap. Daytime headway stays 1 so banks do not retune the
 * day wave; overnight gaps widen, which is where arrivals thin out.
 * Night bank research caps that stretch.
 */
export function arrivalSpacingScale(
  clock: number,
  opts?: { nightBank?: boolean; holidayPeak?: HolidayPeakHook },
): number {
  const demand = arrivalDemand(clock, opts?.holidayPeak)
  if (!isNightHour(demand.hour)) return 1
  let scale = 1 / Math.max(0.2, demand.combined)
  if (opts?.nightBank) scale = Math.min(scale, DEMAND.nightBankSpacingCap)
  return Math.min(DEMAND.spacingMax, Math.max(1, scale))
}

/** How many open timetable slots the tower should keep, after demand. */
export function bankTarget(
  baseWant: number,
  cap: number,
  clock: number,
  nightBank: boolean,
  holidayPeak: HolidayPeakHook = defaultHolidayPeak,
): number {
  const demand = arrivalDemand(clock, holidayPeak)
  let factor = demand.combined
  if (nightBank && isNightHour(demand.hour)) {
    factor = Math.max(factor, DEMAND.nightBankDemandFloor)
  }
  const want = Math.round(Math.max(0, baseWant) * factor)
  return Math.min(Math.max(0, cap), Math.max(DEMAND.minOpenBank, want))
}

export function rollSeasonWeather(absoluteDay: number, roll: number): Weather {
  const season = seasonAtDay(absoluteDay)
  const weights = SEASON_WEATHER[season.id] ?? SEASON_WEATHER[FALLBACK_SEASON]
  const r = ((roll % 1) + 1) % 1
  if (r < weights.clear) return 'clear'
  if (r < weights.clear + weights.rain) return 'rain'
  if (r < weights.clear + weights.rain + weights.fog) return 'fog'
  return 'storm'
}

/** Pace multiplier for deboard / service / board. 1 is fair weather. */
export function groundOpsPace(weather: Weather, climate: ClimateId): number {
  if (weather === 'clear') return 1
  let pace = GROUND_OPS.byWeather[weather]
  if (climate === 'rainy' && (weather === 'rain' || weather === 'storm')) pace += GROUND_OPS.rainyExtra
  if (climate === 'cool') pace += GROUND_OPS.coolExtra
  return pace
}

function windowFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24
  if (h >= 12) return smoothstep(17.6, 19, h)
  return 1 - smoothstep(6.8, 7.8, h)
}

/**
 * Field lights follow the sky's night factor (including storm/fog).
 * Terminal windows lead the floods at dusk and are dark by the 08:00 open.
 * Pools are the expensive extra; the low preset leaves them off.
 */
export function nightLighting(hour: number, weatherLights: number, pools: boolean): NightLighting {
  const field = Math.max(0, Math.min(1, weatherLights))
  // Storms and fog raise `weatherLights` above the clock. That bump lights the glass.
  // The dawn ramp on the field does not, so windows are dark at the 08:00 open.
  const weatherBump = Math.max(0, field - lightsFactor(hour))
  const windows = Math.min(1, Math.max(windowFactor(hour), weatherBump))
  return {
    apron: field,
    runwayEdge: field,
    taxiEdge: field,
    terminalWindows: windows,
    apronPools: pools && field > 0.02,
  }
}

/** Low keeps the palette and skips the fog-distance extra. */
export function seasonalExtras(quality: GfxQuality): boolean {
  return quality !== 'low'
}

/**
 * Winter snow on grass, 0–1. Other seasons stay clear.
 * Callers skip this when a map brought its own ground (desert, coast).
 */
export function snowCover(day: number, quality: GfxQuality): number {
  if (seasonAtDay(day).id !== 'winter') return 0
  return quality === 'low' ? SNOW.lowCover : SNOW.cover
}

/**
 * Clock sky, then the season's palette. Does not add particles.
 * Fog distance changes only when `seasonalExtras` is on.
 */
export function paintSky(hour: number, weather: Weather, day: number, quality: GfxQuality): SkyState {
  const sky = skyState(hour, weather)
  const { palette } = seasonAtDay(day)
  // Season colour is a daytime mix. Night keeps the dark sky; snow carries winter on the ground.
  const k = palette.amount * (0.22 + 0.78 * daylightFactor(hour))
  sky.skyTop = lerpHex(sky.skyTop, palette.skyTop, k)
  sky.skyHorizon = lerpHex(sky.skyHorizon, palette.skyHorizon, k)
  sky.fogColor = sky.skyHorizon
  sky.sunColor = lerpHex(sky.sunColor, palette.sun, k)
  sky.hemiSky = lerpHex(sky.hemiSky, palette.hemi, k * 0.7)
  sky.hemiGround = lerpHex(sky.hemiGround, palette.ground, k)
  sky.sunIntensity *= palette.sunScale
  if (seasonalExtras(quality)) {
    sky.fogFar = Math.max(70, sky.fogFar * palette.fogScale)
    sky.fogNear = Math.max(12, Math.min(sky.fogNear, sky.fogFar * 0.45))
  }
  return sky
}

/**
 * Plot grass tint. One material write, so Low keeps it.
 * Fog distance is the extra `seasonalExtras` still drops.
 */
export function grassColor(day: number, _quality: GfxQuality): number {
  return seasonAtDay(day).palette.grass
}

function holidayNames(ids: readonly string[]): string[] {
  const names: string[] = []
  for (const holiday of DEFAULT_DEMAND_CALENDAR.holidays) {
    if (ids.includes(holiday.id)) names.push(holiday.name)
  }
  return names
}

/** Tooltip: season, climate, any holiday peak, arrival factor, ramp stretch. */
export function environmentCaption(clock: number, weather: Weather, holidayPeak?: HolidayPeakHook): string {
  const season = seasonAtClock(clock)
  const demand = arrivalDemand(clock, holidayPeak)
  const pace = groundOpsPace(weather, season.climate)
  const peak = holidayNames(demand.activeHolidayIds)
  const parts = [
    `${season.name} · ${CLIMATE_LABEL[season.climate]}`,
    peak.length ? `Peak: ${peak.join(', ')}` : '',
    `Arrivals ${demand.combined.toFixed(2)}×`,
    `Ramp ${pace.toFixed(2)}×`,
  ]
  return parts.filter((part) => part.length > 0).join(' · ')
}

/** Same night window as `Game.isNight`: last third of the 180s day. */
export function clockIsNight(clock: number): boolean {
  const wrapped = ((clock % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS
  return wrapped >= (DAY_SECONDS * 2) / 3
}
