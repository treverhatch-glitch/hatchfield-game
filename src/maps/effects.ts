import type { Weather } from '../game/types'
import { demandAtDay } from '../economy/seasons'
import { dayOfYear, demandCalendar, holidaysOn, mapById, seasonOn } from './calendar'
import type { MapDraw, MapId, WinterOpsWeather } from './types'

const WEATHER_WORD: Record<Weather, string> = {
  clear: 'Clear',
  rain: 'Rain',
  fog: 'Fog',
  storm: 'Storm',
}

/**
 * Temperate keeps the live roll: clear below 0.55, rain below 0.75,
 * fog below 0.9, otherwise storm.
 */
export function rollMapWeather(mapId: MapId, absoluteDay: number, roll: number): Weather {
  if (mapId === 'temperate') {
    return roll < 0.55 ? 'clear' : roll < 0.75 ? 'rain' : roll < 0.9 ? 'fog' : 'storm'
  }
  const season = seasonOn(mapById(mapId), absoluteDay)
  const weights = season?.weather
  if (!weights) return roll < 0.55 ? 'clear' : roll < 0.75 ? 'rain' : roll < 0.9 ? 'fog' : 'storm'
  const r = ((roll % 1) + 1) % 1
  if (r < weights.clear) return 'clear'
  if (r < weights.clear + weights.rain) return 'rain'
  if (r < weights.clear + weights.rain + weights.fog) return 'fog'
  return 'storm'
}

export function weatherTitle(mapId: MapId, absoluteDay: number, weather: Weather): string {
  if (mapId === 'temperate') return WEATHER_WORD[weather]
  const season = seasonOn(mapById(mapId), absoluteDay)
  if (!season) return WEATHER_WORD[weather]
  if (season.hazard === 'sandstorm' && weather === 'storm') return 'Sandstorm'
  if (season.hazard === 'sandstorm' && weather === 'fog') return 'Sand haze'
  if (mapId === 'desert' && season.hazard === 'heat' && weather === 'clear') return 'Extreme heat'
  if (mapId === 'tropical' && season.hazard === 'heat' && weather === 'clear') return 'Heat'
  if (season.hazard === 'monsoon' && weather === 'rain') return 'Monsoon'
  if (season.hazard === 'typhoon' && weather === 'storm') return 'Typhoon'
  return WEATHER_WORD[weather]
}

export function engineDerate(mapId: MapId, absoluteDay: number): number {
  if (mapId === 'temperate') return 1
  const season = seasonOn(mapById(mapId), absoluteDay)
  const derate = season?.engineDerate ?? 1
  return Number.isFinite(derate) && derate > 0 ? derate : 1
}

/** 1 on the temperate map so pavement decay stays on today's formula. */
export function climateWear(mapId: MapId, absoluteDay: number): number {
  if (mapId === 'temperate') return 1
  const season = seasonOn(mapById(mapId), absoluteDay)
  const wear = season?.wear ?? 1
  return Number.isFinite(wear) && wear > 0 ? wear : 1
}

/** Holiday and season demand. Temperate always returns 1 so loads stay put. */
export function passengerFactor(mapId: MapId, absoluteDay: number): number {
  if (mapId === 'temperate') return 1
  const multiplier = demandAtDay(demandCalendar(mapId), absoluteDay).multiplier
  if (!Number.isFinite(multiplier) || multiplier <= 0) return 1
  return Math.min(1.85, Math.max(0.72, multiplier))
}

/** Null on the temperate map: the renderer keeps the clock sky and farmland. */
export function fieldDraw(mapId: MapId, absoluteDay: number): MapDraw | null {
  if (mapId === 'temperate') return null
  const map = mapById(mapId)
  const season = seasonOn(map, absoluteDay)
  if (!season || season.skyAmount <= 0) return null
  return {
    skyAmount: season.skyAmount,
    skyTop: season.skyTop,
    skyHorizon: season.skyHorizon,
    sun: season.sun,
    hemi: season.hemi,
    ground: season.ground,
    sunScale: season.sunScale,
    fogScale: season.fogScale,
    terrain: map.terrain
      ? {
          ground: map.terrain.ground,
          fields: [...map.terrain.fields],
          trees: [...map.terrain.trees],
        }
      : null,
  }
}

/**
 * Snowy temperate winter, in the shape winter ops already consumes.
 * Other maps, and the rest of the temperate year, return null.
 */
export function winterForecast(mapId: MapId, absoluteDay: number, weather: Weather): WinterOpsWeather | null {
  if (mapId !== 'temperate') return null
  const season = seasonOn(mapById(mapId), absoluteDay)
  if (!season || season.hazard !== 'snow') return null
  if (weather === 'storm') return { tempC: -6, precip: 'snow', visibilityM: 500 }
  if (weather === 'rain') return { tempC: 0, precip: 'freezing_rain', visibilityM: 1400 }
  if (weather === 'fog') return { tempC: -1, precip: 'none', visibilityM: 350 }
  return { tempC: 2, precip: 'none', visibilityM: 9000 }
}

export function climateAlert(mapId: MapId, absoluteDay: number, weather: Weather): { text: string; tone: 'ok' | 'bad' } | null {
  if (mapId === 'temperate') return null
  const title = weatherTitle(mapId, absoluteDay, weather)
  const season = seasonOn(mapById(mapId), absoluteDay)
  if (title === 'Sandstorm') return { text: 'Sandstorm over the strip — visibility down, pavement eats grit.', tone: 'bad' }
  if (title === 'Typhoon') return { text: 'Typhoon cell on the coast — wet strip, expect slips.', tone: 'bad' }
  if (title === 'Monsoon') return { text: 'Monsoon rain on the field.', tone: 'ok' }
  if (title === 'Extreme heat') {
    const derate = engineDerate(mapId, absoluteDay)
    return { text: `Extreme heat — engines de-rated to ${derate.toFixed(2)}× on stand.`, tone: 'bad' }
  }
  if (season && title !== WEATHER_WORD[weather]) return { text: `${season.name}: ${title}.`, tone: 'ok' }
  return { text: `${season?.name ?? 'Season'}: ${title}.`, tone: weather === 'clear' ? 'ok' : 'bad' }
}

export function climateCaption(mapId: MapId, absoluteDay: number, weather: Weather): string {
  const map = mapById(mapId)
  const day = dayOfYear(absoluteDay, map.yearLengthDays)
  const season = seasonOn(map, absoluteDay)
  const holidays = holidaysOn(map, absoluteDay).map((holiday) => holiday.name)
  const parts = [map.name, season ? `${season.name} · day ${day}` : `Day ${day}`, weatherTitle(mapId, absoluteDay, weather)]
  if (holidays.length) parts.push(holidays.join(', '))
  const derate = engineDerate(mapId, absoluteDay)
  if (derate > 1) parts.push(`Engines ${derate.toFixed(2)}×`)
  return parts.join(' · ')
}
