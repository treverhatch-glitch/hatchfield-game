/**
 * The timetable reads windows, buffers, and the offer preview from src/contracts.
 * It does not keep a second copy of those numbers.
 */
import { DEFAULT_AIRFRAMES, DEFAULT_MTT } from '../../contracts/airframes'
import type { SizeClass } from '../../contracts/types'
import { makeOffer, timeWindow } from '../../contracts/contracts'
import { previewOffer, type HourLight } from '../../contracts/preview'
import { DEFAULT_SCHEDULER_OPTIONS } from '../../contracts/scheduler'
import { seasonOfDay, weekdayOf } from '../../contracts/seasons'
import type { AircraftKind } from '../../game/types'
import { GAME_MINUTES_PER_SIM_SECOND } from '../../pax/showup'
import type { IcaoCode, TtFlight, TtRunway, TtStand, TtWindow } from './types'

const STAND_IN: Record<SizeClass, string> = {
  regional: 'atr72',
  narrow: 'a320',
  wide: 'a330',
  super: 'a380',
}

export function sizeClassFor(icao: IcaoCode, kind?: AircraftKind): SizeClass {
  if (icao === 'F') return 'super'
  if (icao === 'E' || icao === 'D' || kind === 'widebody' || kind === 'freighter') return 'wide'
  if (
    kind === 'regional' ||
    kind === 'helo_med' ||
    kind === 'helo_exec' ||
    kind === 'air_ambulance' ||
    icao === 'A' ||
    icao === 'B'
  ) {
    return 'regional'
  }
  return 'narrow'
}

/** Turnaround the scheduler will accept, in sim seconds. */
export function turnTargetSec(icao: IcaoCode, kind?: AircraftKind): number {
  return DEFAULT_MTT[sizeClassFor(icao, kind)] / GAME_MINUTES_PER_SIM_SECOND
}

/** Stand gap the scheduler leaves between turns, in sim seconds. */
export function standBufferSec(dayLength = 180): number {
  return (DEFAULT_SCHEDULER_OPTIONS.standBufferMin / 1440) * dayLength
}

/**
 * Hard band from `timeWindow`, around a banked sim time.
 * The band stays on that anchor. It does not slide forward just because the clock moved.
 */
export function contractSlotWindow(anchor: number, dayLength: number): TtWindow {
  const minuteOfDay = ((anchor % dayLength) + dayLength) % dayLength
  const preferredMin = Math.round((minuteOfDay / dayLength) * 1440) % 1440
  const window = timeWindow(preferredMin)
  const hard = (window.hardMin / 1440) * dayLength
  return { start: anchor - hard, end: anchor + hard, source: 'contract' }
}

export interface CapacityLight {
  hour: number
  light: HourLight
}

/**
 * One-week picture of the turns already on the board, via `previewOffer`.
 * A red hour is a warning. It does not remove the turn.
 */
export function capacityPreview(
  flights: TtFlight[],
  stands: TtStand[],
  runways: TtRunway[],
  dayLength: number,
): { hours: CapacityLight[]; warnings: string[] } {
  const arrivals = flights.filter((f) => f.direction === 'arr' && f.status !== 'cancelled').slice(0, 12)
  if (!arrivals.length) return { hours: [], warnings: [] }
  const season = seasonOfDay(0)
  const day = weekdayOf(season.startDay)
  const lines = arrivals.map((f, i) => {
    const cls = sizeClassFor(f.icao)
    const airframeId = STAND_IN[cls]
    const minute = Math.round((((f.time % dayLength) + dayLength) % dayLength / dayLength) * 1440) % 1440
    return {
      id: `board-${i}`,
      airframeId,
      kind: f.traffic === 'cargo' ? ('freighter' as const) : ('pax' as const),
      days: [day],
      arrival: timeWindow(minute),
      turnaroundTargetMin: DEFAULT_MTT[cls],
      origin: 'HTF',
      destination: 'HUB',
      flightNumber: f.flightNo,
    }
  })
  const offer = makeOffer({
    id: 'board-preview',
    airlineId: arrivals[0].airlineId || 'board',
    lines,
    services: ['fuel'],
  })
  const infra = {
    stands: stands.map((s) => ({
      id: s.id,
      sizeClass: sizeClassFor(s.icao),
      contact: true,
      pier: s.label.match(/^T\d+/)?.[0],
    })),
    runways: runways.map((r) => ({ id: r.id, movesPerHour: Math.max(1, r.hourlyCap) })),
  }
  if (!infra.runways.length) infra.runways.push({ id: 'rw0', movesPerHour: 30 })
  const preview = previewOffer(offer, [], season, infra, { airframes: DEFAULT_AIRFRAMES })
  return {
    hours: preview.hours.map((h) => ({ hour: h.hour, light: h.light })),
    warnings: preview.warnings,
  }
}
