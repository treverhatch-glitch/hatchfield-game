import { DEFAULT_SCHEDULER_OPTIONS } from '../../contracts/scheduler'
import { gameMinToSim } from './scheduleConfig'
import { clockLabel, durationLabel, hourSecs, standFits } from './time'
import type { IcaoCode, TtFlight, TtRunway, TtStand, TtTraffic } from './types'

export interface GanttBar {
  flight: TtFlight
  left: number
  width: number
  /** Overlap or a stand that cannot take the aircraft. */
  conflict: boolean
  /** Next turn starts inside the stand buffer, and does not overlap. */
  buffer: boolean
  /** Seconds until the next turn on this stand. Negative when they overlap. */
  gapSec: number | null
}
export interface GanttRow {
  stand: TtStand | null
  bars: GanttBar[]
}
export interface GanttGroup {
  /** `stands` is every gate, pier order. `none` is the Tower lane for unassigned turns. */
  icao: IcaoCode | 'none' | 'stands'
  rows: GanttRow[]
}

export interface ViewSpan {
  from: number
  to: number
}

/** Map sim time into 0..1 of the view span. */
export function frac(t: number, span: ViewSpan): number {
  return (t - span.from) / Math.max(1e-6, span.to - span.from)
}

/** Convert a horizontal pixel drag into sim seconds. */
export function pxToSec(dx: number, widthPx: number, span: ViewSpan): number {
  return (dx / Math.max(1, widthPx)) * (span.to - span.from)
}

/** Hour tick marks inside the span. */
export function hourTicks(span: ViewSpan, dayLength: number): { t: number; label: string }[] {
  const h = hourSecs(dayLength)
  const out: { t: number; label: string }[] = []
  for (let t = Math.ceil(span.from / h) * h; t <= span.to + 1e-6; t += h) {
    out.push({ t, label: clockLabel(t, dayLength) })
  }
  return out
}

/** Hour lines, plus a faint half-hour between them. */
export function axisTicks(span: ViewSpan, dayLength: number): { t: number; label: string; minor: boolean }[] {
  const step = hourSecs(dayLength) / 2
  const out: { t: number; label: string; minor: boolean }[] = []
  const start = Math.ceil((span.from - 1e-6) / step) * step
  for (let t = start; t <= span.to + 1e-6; t += step) {
    const onHour = Math.abs(t / (step * 2) - Math.round(t / (step * 2))) < 1e-3
    out.push({ t, label: onHour ? clockLabel(t, dayLength) : '', minor: !onHour })
  }
  return out
}

/**
 * The open sheet looks at one sim day. 24h is that whole day.
 * A shorter zoom is a window inside the day, kept on the clock when it fits.
 */
export function viewSpan(now: number, dayLength: number, zoomHours: number, dayShift = 0): ViewSpan {
  const dayStart = Math.floor(now / dayLength) * dayLength + dayShift * dayLength
  if (zoomHours >= 24) return { from: dayStart, to: dayStart + dayLength }
  const windowSec = hourSecs(dayLength) * zoomHours
  const anchor = dayShift === 0 ? now : dayStart + dayLength / 2
  const from = Math.max(dayStart, Math.min(anchor - windowSec / 2, dayStart + dayLength - windowSec))
  return { from, to: from + windowSec }
}

export interface FlightFilter {
  airline?: string | null
  conflictsOnly?: boolean
  code?: string
  query?: string
  conflictIds?: Set<string>
  status?: string
  terminal?: string
  traffic?: string
}

/** Hide bars that miss the airline, code, flight number, or conflict filter. */
export function filterFlights(flights: TtFlight[], filter: FlightFilter): TtFlight[] {
  const q = filter.query?.trim().toLowerCase() ?? ''
  return flights.filter((f) => {
    if (filter.airline && f.airlineName !== filter.airline) return false
    if (filter.code && f.icao !== filter.code) return false
    if (filter.status && f.status !== filter.status) return false
    if (filter.terminal && (f.terminal ?? 'Apron') !== filter.terminal) return false
    if (filter.traffic && (f.traffic ?? 'pax') !== filter.traffic) return false
    if (q && !f.flightNo.toLowerCase().includes(q)) return false
    if (filter.conflictsOnly && filter.conflictIds && !filter.conflictIds.has(f.id)) return false
    return true
  })
}

/**
 * Stand gantt: one row per stand, grouped by ICAO size class (largest first),
 * plus an "unassigned" group for flights the tower hasn't placed yet.
 * Bars overlapping on one stand, or on a stand too small, are flagged.
 */
export function buildGantt(flights: TtFlight[], stands: TtStand[], span: ViewSpan): GanttGroup[] {
  const live = flights.filter(
    (f) => f.status !== 'cancelled' && f.status !== 'done' && f.onStandTo >= span.from && f.onStandFrom <= span.to,
  )
  // One bar per rotation: arrivals carry the stand occupancy; departures only if no paired arrival.
  const seen = new Set<string>()
  const bars: TtFlight[] = []
  for (const f of live) {
    const key = rotationKey(f)
    if (seen.has(key)) continue
    seen.add(key)
    bars.push(f)
  }
  const byStand = new Map<string, TtFlight[]>()
  const loose: TtFlight[] = []
  for (const f of bars) {
    if (f.standId && stands.some((s) => s.id === f.standId)) {
      const l = byStand.get(f.standId) ?? []
      l.push(f)
      byStand.set(f.standId, l)
    } else loose.push(f)
  }
  const toBars = (list: TtFlight[], stand: TtStand | null): GanttBar[] => {
    const sorted = [...list].sort((a, b) => a.onStandFrom - b.onStandFrom)
    const bufferSec = gameMinToSim(DEFAULT_SCHEDULER_OPTIONS.standBufferMin)
    return sorted.map((f, i) => {
      const prev = sorted[i - 1]
      const next = sorted[i + 1]
      const gapAfter = next ? next.onStandFrom - f.onStandTo : null
      const gapBefore = prev ? f.onStandFrom - prev.onStandTo : null
      const overlap =
        !!stand && ((gapBefore != null && gapBefore < 0) || (gapAfter != null && gapAfter < 0))
      const tooSmall = !!stand && !standFits(stand.icao, f.icao)
      const tight =
        !!stand &&
        !overlap &&
        ((gapAfter != null && gapAfter >= 0 && gapAfter < bufferSec) ||
          (gapBefore != null && gapBefore >= 0 && gapBefore < bufferSec))
      const l = Math.max(0, frac(f.onStandFrom, span))
      const r = Math.min(1, frac(f.onStandTo, span))
      return {
        flight: f,
        left: l,
        width: Math.max(0.004, r - l),
        conflict: overlap || tooSmall,
        buffer: tight,
        gapSec: gapAfter,
      }
    })
  }
  const groups: GanttGroup[] = []
  if (loose.length) {
    // Pack unassigned rotations into as few non-overlapping lanes as possible.
    const lanes: TtFlight[][] = []
    for (const f of [...loose].sort((a, b) => a.onStandFrom - b.onStandFrom)) {
      const lane = lanes.find((l) => l[l.length - 1].onStandTo <= f.onStandFrom)
      if (lane) lane.push(f)
      else lanes.push([f])
    }
    groups.push({ icao: 'none', rows: lanes.map((l) => ({ stand: null, bars: toBars(l, null) })) })
  }
  const rows = [...stands]
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    .map((s) => ({ stand: s, bars: toBars(byStand.get(s.id) ?? [], s) }))
  if (rows.length) groups.push({ icao: 'stands', rows })
  return groups
}

/** Popover sentence for a red clash or an amber buffer. */
export function barNote(bar: GanttBar, dayLength = 180): string | null {
  if (bar.conflict) {
    if (bar.gapSec != null && bar.gapSec < 0) {
      return `Clash: overlaps the next turn by ${durationLabel(-bar.gapSec, dayLength)}.`
    }
    return 'This stand cannot take this aircraft.'
  }
  if (bar.buffer && bar.gapSec != null && bar.gapSec >= 0) {
    return `Tight: the next turn starts ${durationLabel(bar.gapSec, dayLength)} later, inside the ${DEFAULT_SCHEDULER_OPTIONS.standBufferMin}m buffer.`
  }
  if (bar.buffer) return `Tight: inside the ${DEFAULT_SCHEDULER_OPTIONS.standBufferMin}m stand buffer.`
  return null
}

function rotationKey(f: TtFlight): string {
  return f.id.replace(/:(arr|dep)$/, '')
}

export interface HourBucket {
  start: number
  label: string
  arr: number
  dep: number
  cap: number
  over: boolean
}

/**
 * Movements per in-game hour vs capacity. Pass `runwayId` to count one strip
 * against its own cap ('auto' = flights with no runway yet, cap 0); omit it
 * for the combined total against the summed cap.
 */
export function runwayBuckets(
  flights: TtFlight[],
  runways: TtRunway[],
  span: ViewSpan,
  dayLength: number,
  runwayId?: string,
): HourBucket[] {
  const h = hourSecs(dayLength)
  const own = runwayId && runwayId !== 'auto' ? runways.find((r) => r.id === runwayId) : undefined
  const cap = runwayId === undefined ? runways.reduce((s, r) => s + r.hourlyCap, 0) : own?.hourlyCap ?? 0
  if (runwayId !== undefined) flights = flights.filter((f) => (runwayOf(f) ?? 'auto') === runwayId)
  const out: HourBucket[] = []
  for (let t = Math.floor(span.from / h) * h; t < span.to; t += h) {
    let arr = 0
    let dep = 0
    for (const f of flights) {
      if (f.status === 'cancelled') continue
      if (f.time >= t && f.time < t + h) {
        if (f.direction === 'arr') arr++
        else dep++
      }
    }
    out.push({ start: t, label: clockLabel(t, dayLength), arr, dep, cap, over: arr + dep > cap })
  }
  return out
}

/** Runway a movement uses: departures prefer their own depRunwayId. */
export function runwayOf(f: TtFlight): string | null {
  return f.direction === 'dep' ? f.depRunwayId ?? f.runwayId : f.runwayId
}

export interface RunwayLaneModel {
  id: string
  label: string
  cap: number
  buckets: HourBucket[]
  flights: TtFlight[]
}

/** One lane per runway, an Auto lane if any movement is unassigned, and a combined Total. */
export function runwayLanes(
  flights: TtFlight[],
  runways: TtRunway[],
  span: ViewSpan,
  dayLength: number,
): { lanes: RunwayLaneModel[]; total: RunwayLaneModel } {
  const live = flights.filter((f) => f.status !== 'cancelled' && f.time >= span.from && f.time <= span.to)
  const known = new Set(runways.map((r) => r.id))
  const lanes: RunwayLaneModel[] = runways.map((r) => ({
    id: r.id,
    label: r.label,
    cap: r.hourlyCap,
    buckets: runwayBuckets(flights, runways, span, dayLength, r.id),
    flights: live.filter((f) => runwayOf(f) === r.id),
  }))
  const loose = live.filter((f) => !runwayOf(f) || !known.has(runwayOf(f)!))
  if (loose.length) {
    lanes.push({
      id: 'auto',
      label: 'Auto',
      cap: 0,
      buckets: runwayBuckets(
        flights.map((f) => (runwayOf(f) && !known.has(runwayOf(f)!) ? { ...f, runwayId: null, depRunwayId: null } : f)),
        runways,
        span,
        dayLength,
        'auto',
      ),
      flights: loose,
    })
  }
  const total: RunwayLaneModel = {
    id: 'total',
    label: 'Total',
    cap: runways.reduce((s, r) => s + r.hourlyCap, 0),
    buckets: runwayBuckets(flights, runways, span, dayLength),
    flights: live,
  }
  return { lanes, total }
}

export interface BoardRow {
  id: string
  time: string
  est: string | null
  flightNo: string
  airline: string
  airlineId: string
  color: string
  stand: string
  status: string
  statusKey: TtFlight['status']
  late: boolean
  terminal: string
  traffic: TtFlight['traffic']
}

const STATUS_TEXT: Record<TtFlight['status'], string> = {
  scheduled: 'On time',
  delayed: 'Delayed',
  inbound: 'Approach',
  on_stand: 'At gate',
  departing: 'Departed',
  done: 'Landed',
  cancelled: 'Cancelled',
}

/** Flight board rows with clock times; sorted by time, past movements trimmed. */
export function boardRows(
  flights: TtFlight[],
  dir: 'arr' | 'dep',
  now: number,
  dayLength: number,
  limit = 14,
  span?: ViewSpan,
): BoardRow[] {
  return flights
    .filter((f) => {
      if (f.direction !== dir || f.status === 'cancelled') return false
      if (span) return f.time >= span.from && f.time < span.to
      return f.time >= now - hourSecs(dayLength)
    })
    .sort((a, b) => a.time - b.time)
    .slice(0, limit)
    .map((f) => {
      const planned = f.time - f.delaySec
      const late = f.delaySec > 0.5
      let status = STATUS_TEXT[f.status]
      if (dir === 'dep' && f.status === 'on_stand') status = 'Boarding'
      if (dir === 'dep' && f.status === 'scheduled') status = 'Scheduled'
      if (dir === 'arr' && f.status === 'on_stand') status = 'Arrived'
      return {
        id: f.id,
        time: clockLabel(planned, dayLength),
        est: late ? clockLabel(f.time, dayLength) : null,
        flightNo: f.flightNo,
        airline: f.airlineName,
        airlineId: f.airlineId ?? '',
        color: f.color,
        stand: f.standLabel,
        status,
        statusKey: f.status,
        late,
        terminal: f.terminal ?? 'Apron',
        traffic: (f.traffic ?? 'pax') as TtTraffic,
      }
    })
}
