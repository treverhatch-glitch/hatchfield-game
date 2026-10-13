import type { DemandPoint, DemandSnapshot, MapDemandCalendar } from './types'

export const DEFAULT_DEMAND_CALENDAR: MapDemandCalendar = {
  mapId: 'temperate',
  yearLengthDays: 360,
  seasons: [
    {
      id: 'spring',
      name: 'Spring',
      startDay: 0,
      endDay: 89,
      demandCurve: [
        { day: 0, multiplier: 0.9 },
        { day: 89, multiplier: 1.05 },
      ],
    },
    {
      id: 'summer',
      name: 'Summer',
      startDay: 90,
      endDay: 179,
      demandCurve: [
        { day: 90, multiplier: 1.1 },
        { day: 135, multiplier: 1.28 },
        { day: 179, multiplier: 1.12 },
      ],
    },
    {
      id: 'autumn',
      name: 'Autumn',
      startDay: 180,
      endDay: 269,
      demandCurve: [
        { day: 180, multiplier: 1.05 },
        { day: 269, multiplier: 0.88 },
      ],
    },
    {
      id: 'winter',
      name: 'Winter',
      startDay: 270,
      endDay: 359,
      demandCurve: [
        { day: 270, multiplier: 0.86 },
        { day: 315, multiplier: 0.78 },
        { day: 359, multiplier: 0.9 },
      ],
      modifiers: { 'deicing.demand': 1.5, 'power.demand': 1.12 },
    },
  ],
  holidays: [
    {
      id: 'summer_getaway',
      name: 'Summer Getaway',
      startDay: 125,
      endDay: 139,
      demandMultiplier: 1.18,
    },
    {
      id: 'winter_holidays',
      name: 'Winter Holidays',
      startDay: 340,
      endDay: 355,
      demandMultiplier: 1.25,
      modifiers: { 'baggage.demand': 1.2 },
    },
  ],
}

function interpolate(points: readonly DemandPoint[], day: number): number {
  if (points.length === 0) return 1
  if (day <= points[0].day) return points[0].multiplier
  for (let index = 1; index < points.length; index++) {
    const right = points[index]
    if (day > right.day) continue
    const left = points[index - 1]
    const span = right.day - left.day
    if (span <= 0) return right.multiplier
    const progress = (day - left.day) / span
    return left.multiplier + (right.multiplier - left.multiplier) * progress
  }
  return points[points.length - 1].multiplier
}

function mergeModifiers(target: Record<string, number>, source: Readonly<Record<string, number>> | undefined): void {
  if (!source) return
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 1) * value
  }
}

/** Resolve demand from a map-owned calendar. Holiday curves multiply seasons. */
export function demandAtDay(calendar: MapDemandCalendar, absoluteDay: number): DemandSnapshot {
  const yearLength = Math.max(1, calendar.yearLengthDays)
  const dayOfYear = ((absoluteDay % yearLength) + yearLength) % yearLength
  const season = calendar.seasons.find((candidate) => dayOfYear >= candidate.startDay && dayOfYear <= candidate.endDay)
  const activeHolidays = calendar.holidays.filter(
    (holiday) => dayOfYear >= holiday.startDay && dayOfYear <= holiday.endDay,
  )
  let multiplier = season ? interpolate(season.demandCurve, dayOfYear) : 1
  const modifiers: Record<string, number> = {}
  mergeModifiers(modifiers, season?.modifiers)
  for (const holiday of activeHolidays) {
    multiplier *= holiday.demandMultiplier
    mergeModifiers(modifiers, holiday.modifiers)
  }
  return {
    mapId: calendar.mapId,
    dayOfYear,
    seasonId: season?.id ?? null,
    activeHolidayIds: activeHolidays.map((holiday) => holiday.id),
    multiplier,
    modifiers,
  }
}
