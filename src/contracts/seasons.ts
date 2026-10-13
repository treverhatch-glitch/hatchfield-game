import type { Season, SeasonKind } from './types.ts'

/**
 * Game calendar: 364-day year (52 weeks), day 0 = Monday of week 0.
 * Summer mirrors IATA (last Sunday of March → last Saturday of October):
 * weeks 12..42 inclusive. Winter is the rest of the year (wraps into next year).
 */
export const DAYS_PER_WEEK = 7
export const DAYS_PER_YEAR = 364
export const MIN_PER_DAY = 1440
export const SUMMER_START_WEEK = 12
export const SUMMER_END_WEEK = 42

export function seasonFor(kind: SeasonKind, year: number): Season {
  const y0 = year * DAYS_PER_YEAR
  if (kind === 'summer') {
    return { id: `S${year}`, kind, year, startDay: y0 + SUMMER_START_WEEK * 7, endDay: y0 + (SUMMER_END_WEEK + 1) * 7 - 1 }
  }
  // Winter `year` runs from the end of summer `year` to the start of summer `year+1`.
  return {
    id: `W${year}`,
    kind,
    year,
    startDay: y0 + (SUMMER_END_WEEK + 1) * 7,
    endDay: y0 + DAYS_PER_YEAR + SUMMER_START_WEEK * 7 - 1,
  }
}

/** Season containing absolute game day `day`. Days before week 12 of year 0 belong to winter of year -1. */
export function seasonOfDay(day: number): Season {
  const year = Math.floor(day / DAYS_PER_YEAR)
  const doy = day - year * DAYS_PER_YEAR
  if (doy < SUMMER_START_WEEK * 7) return seasonFor('winter', year - 1)
  if (doy < (SUMMER_END_WEEK + 1) * 7) return seasonFor('summer', year)
  return seasonFor('winter', year)
}

export function nextSeason(s: Season): Season {
  return s.kind === 'summer' ? seasonFor('winter', s.year) : seasonFor('summer', s.year + 1)
}

/** Season ids for a term of `n` seasons starting at `first`. */
export function seasonRun(first: Season, n: number): Season[] {
  const out: Season[] = [first]
  while (out.length < n) out.push(nextSeason(out[out.length - 1]))
  return out
}

export function weekdayOf(day: number): number {
  return ((day % 7) + 7) % 7
}

export function seasonDays(s: Season): number {
  return s.endDay - s.startDay + 1
}

export function isLastWeekOfSeason(s: Season, day: number): boolean {
  return day > s.endDay - 7 && day <= s.endDay
}
