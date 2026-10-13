import { clockLabel, hourSecs, ICAO_ORDER, standFits } from './time'
import type { IcaoCode, TtFlight, TtRunway, TtStand } from './types'

export interface GanttBar {
  flight: TtFlight
  left: number
  width: number
  conflict: boolean
}
export interface GanttRow {
  stand: TtStand | null
  bars: GanttBar[]
}
export interface GanttGroup {
  icao: IcaoCode | 'none'
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
    return sorted.map((f, i) => {
      const prev = sorted[i - 1]
      const next = sorted[i + 1]
      const overlap =
        !!stand && ((prev && prev.onStandTo > f.onStandFrom) || (next && next.onStandFrom < f.onStandTo))
      const tooSmall = !!stand && !standFits(stand.icao, f.icao)
      const l = Math.max(0, frac(f.onStandFrom, span))
      const r = Math.min(1, frac(f.onStandTo, span))
      return { flight: f, left: l, width: Math.max(0.004, r - l), conflict: overlap || tooSmall }
    })
  }
  const groups: GanttGroup[] = []
  for (const code of [...ICAO_ORDER].reverse()) {
    const rows = stands
      .filter((s) => s.icao === code)
      .map((s) => ({ stand: s, bars: toBars(byStand.get(s.id) ?? [], s) }))
    if (rows.length) groups.push({ icao: code, rows })
  }
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
  return groups
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

/** Runway lane: movements per in-game hour vs combined strip capacity. */
export function runwayBuckets(
  flights: TtFlight[],
  runways: TtRunway[],
  span: ViewSpan,
  dayLength: number,
): HourBucket[] {
  const h = hourSecs(dayLength)
  const cap = runways.reduce((s, r) => s + r.hourlyCap, 0)
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

export interface BoardRow {
  id: string
  time: string
  est: string | null
  flightNo: string
  airline: string
  color: string
  stand: string
  status: string
  late: boolean
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
): BoardRow[] {
  return flights
    .filter((f) => f.direction === dir && f.time >= now - hourSecs(dayLength))
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
        color: f.color,
        stand: f.standLabel,
        status,
        late,
      }
    })
}
