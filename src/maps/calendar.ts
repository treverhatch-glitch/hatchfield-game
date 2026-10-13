import { DEFAULT_DEMAND_CALENDAR } from '../economy/seasons'
import type { MapDemandCalendar } from '../economy/types'
import { MAP_YEAR_DAYS, MAPS, TEMPERATE_META } from './data'
import type { MapDefinition, MapHoliday, MapId, MapSeason } from './types'

/**
 * Sky colours mirror `SEASON_PALETTES` in src/environment. `skyAmount` is 0
 * here so this branch does not repaint the default field. Environment can
 * still read the hex values when it tints the temperate year itself.
 */
const TEMPERATE_LOOK: Record<string, Pick<MapSeason, 'climate' | 'hazard' | 'skyTop' | 'skyHorizon' | 'sun' | 'hemi' | 'ground' | 'grass' | 'sunScale' | 'fogScale'>> = {
  spring: {
    climate: 'rainy',
    hazard: 'none',
    skyTop: 0x6e8c86,
    skyHorizon: 0xa8b8ae,
    sun: 0xd5e2d4,
    hemi: 0xc5d4cc,
    ground: 0x3f6240,
    grass: 0xb7d49a,
    sunScale: 0.86,
    fogScale: 0.8,
  },
  summer: {
    climate: 'dry_hot',
    hazard: 'none',
    skyTop: 0x3d88d4,
    skyHorizon: 0xf0c080,
    sun: 0xffe0a0,
    hemi: 0xfff0cc,
    ground: 0x8a7430,
    grass: 0xd4c06a,
    sunScale: 1.12,
    fogScale: 1.15,
  },
  autumn: {
    climate: 'cool',
    hazard: 'none',
    skyTop: 0x6a7ea4,
    skyHorizon: 0xe2b48a,
    sun: 0xffd0a4,
    hemi: 0xe6d2b4,
    ground: 0x6a4c30,
    grass: 0xc49858,
    sunScale: 0.9,
    fogScale: 0.9,
  },
  winter: {
    climate: 'cool',
    hazard: 'snow',
    skyTop: 0x8eacc8,
    skyHorizon: 0xd4e2ee,
    sun: 0xdce8f8,
    hemi: 0xd0e0f0,
    ground: 0x7a868c,
    grass: 0xb4c2b4,
    sunScale: 0.82,
    fogScale: 0.74,
  },
}

function temperateSeason(source: MapDemandCalendar['seasons'][number]): MapSeason {
  const look = TEMPERATE_LOOK[source.id] ?? TEMPERATE_LOOK.spring
  return {
    id: source.id,
    name: source.name,
    startDay: source.startDay,
    endDay: source.endDay,
    demandCurve: source.demandCurve,
    modifiers: source.modifiers,
    climate: look.climate,
    hazard: look.hazard,
    engineDerate: 1,
    wear: 1,
    skyAmount: 0,
    skyTop: look.skyTop,
    skyHorizon: look.skyHorizon,
    sun: look.sun,
    hemi: look.hemi,
    ground: look.ground,
    grass: look.grass,
    sunScale: look.sunScale,
    fogScale: look.fogScale,
  }
}

function temperateHoliday(source: MapDemandCalendar['holidays'][number]): MapHoliday {
  return {
    id: source.id,
    name: source.name,
    startDay: source.startDay,
    endDay: source.endDay,
    demandMultiplier: source.demandMultiplier,
    modifiers: source.modifiers,
    peakHook: 1,
  }
}

export function temperateMap(): MapDefinition {
  return {
    id: 'temperate',
    name: TEMPERATE_META.name,
    region: TEMPERATE_META.region,
    blurb: TEMPERATE_META.blurb,
    yearLengthDays: DEFAULT_DEMAND_CALENDAR.yearLengthDays,
    seasons: DEFAULT_DEMAND_CALENDAR.seasons.map(temperateSeason),
    holidays: DEFAULT_DEMAND_CALENDAR.holidays.map(temperateHoliday),
    challenges: TEMPERATE_META.challenges,
    terrain: null,
  }
}

export function mapById(id: MapId): MapDefinition {
  if (id === 'temperate') return temperateMap()
  return MAPS[id]
}

export function mapSwatch(id: MapId): string {
  if (id === 'temperate') return TEMPERATE_META.swatch
  return MAPS[id].terrain?.swatch ?? TEMPERATE_META.swatch
}

/** Economy calendar. Temperate is the shared default object, not a copy. */
export function demandCalendar(id: MapId): MapDemandCalendar {
  if (id === 'temperate') return DEFAULT_DEMAND_CALENDAR
  const map = MAPS[id]
  return {
    mapId: map.id,
    yearLengthDays: map.yearLengthDays,
    seasons: map.seasons.map((season) => ({
      id: season.id,
      name: season.name,
      startDay: season.startDay,
      endDay: season.endDay,
      demandCurve: season.demandCurve,
      modifiers: season.modifiers,
    })),
    holidays: map.holidays.map((holiday) => ({
      id: holiday.id,
      name: holiday.name,
      startDay: holiday.startDay,
      endDay: holiday.endDay,
      demandMultiplier: holiday.demandMultiplier,
      modifiers: holiday.modifiers,
    })),
  }
}

export function dayOfYear(absoluteDay: number, yearLength = MAP_YEAR_DAYS): number {
  const span = Math.max(1, yearLength)
  return ((absoluteDay % span) + span) % span
}

export function seasonOn(map: MapDefinition, absoluteDay: number): MapSeason | null {
  const day = dayOfYear(absoluteDay, map.yearLengthDays)
  return map.seasons.find((season) => day >= season.startDay && day <= season.endDay) ?? null
}

export function holidaysOn(map: MapDefinition, absoluteDay: number): MapHoliday[] {
  const day = dayOfYear(absoluteDay, map.yearLengthDays)
  return map.holidays.filter((holiday) => day >= holiday.startDay && day <= holiday.endDay)
}

export function parseMapId(value: unknown): MapId {
  if (value === 'tropical' || value === 'desert' || value === 'temperate') return value
  return 'temperate'
}
