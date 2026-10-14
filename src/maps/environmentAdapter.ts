import { demandAtDay } from '../economy/seasons'
import type { MapDemandCalendar } from '../economy/types'
import { demandCalendar, holidaysOn, mapById, seasonOn } from './calendar'
import type { MapClimate, MapId } from './types'

/**
 * What `src/environment` (day/night and seasons) paints from.
 * `climate` matches its `ClimateId`. `palette` matches `SeasonPalette`.
 * Temperate ids stay spring / summer / autumn / winter so a host that still
 * looks up `SEASON_PALETTES` hits the same year.
 */
export interface EnvironmentSeason {
  id: string
  name: string
  climate: MapClimate
  dayOfYear: number
  palette: {
    id: string
    name: string
    climate: MapClimate
    amount: number
    skyTop: number
    skyHorizon: number
    sun: number
    hemi: number
    ground: number
    grass: number
    sunScale: number
    fogScale: number
  }
}

export interface EnvironmentBinding {
  calendar: MapDemandCalendar
  season: EnvironmentSeason
  activeHolidays: { id: string; name: string }[]
  /**
   * Pass to environment's `holidayPeakHook` only when that host is still on
   * the default temperate calendar. Map calendars already include the boost,
   * so this stays 1 for temperate and is the holiday product otherwise.
   */
  legacyHolidayPeak: number
}

export function environmentSeason(mapId: MapId, absoluteDay: number): EnvironmentSeason {
  const map = mapById(mapId)
  const snap = demandAtDay(demandCalendar(mapId), absoluteDay)
  const season = seasonOn(map, absoluteDay)
  const id = season?.id ?? 'spring'
  const name = season?.name ?? 'Spring'
  const climate = season?.climate ?? 'rainy'
  return {
    id,
    name,
    climate,
    dayOfYear: snap.dayOfYear,
    palette: {
      id,
      name,
      climate,
      amount: season?.skyAmount ?? 0,
      skyTop: season?.skyTop ?? 0x4f93d6,
      skyHorizon: season?.skyHorizon ?? 0xc4ddf0,
      sun: season?.sun ?? 0xfff3d4,
      hemi: season?.hemi ?? 0xe8f3ff,
      ground: season?.ground ?? 0x5a7a44,
      grass: season?.grass ?? 0xb7d49a,
      sunScale: season?.sunScale ?? 1,
      fogScale: season?.fogScale ?? 1,
    },
  }
}

export function environmentBinding(mapId: MapId, absoluteDay: number): EnvironmentBinding {
  const map = mapById(mapId)
  const holidays = holidaysOn(map, absoluteDay)
  let legacyHolidayPeak = 1
  if (mapId !== 'temperate') {
    for (const holiday of holidays) legacyHolidayPeak *= holiday.peakHook
  }
  return {
    calendar: demandCalendar(mapId),
    season: environmentSeason(mapId, absoluteDay),
    activeHolidays: holidays.map((holiday) => ({ id: holiday.id, name: holiday.name })),
    legacyHolidayPeak,
  }
}
