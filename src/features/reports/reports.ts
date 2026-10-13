/**
 * Weekly / monthly airport reports, delivered as non-blocking notifications.
 * The sim records raw facts via ReportCollector; buildReport() summarises a period.
 */
import type { NewNotification } from '../notifications/queue.ts'

export type ReportPeriod = 'weekly' | 'monthly'

export interface FlightRecord { day: number; airline: string; onTime: boolean; delayMin: number }
export interface MoodSample { day: number; mood: number /* 0..100 */ }
export interface ComplaintRecord { day: number; topic: string }
export interface CashRecord { day: number; amount: number /* + income, - cost */; category: string }
export interface BottleneckRecord { day: number; system: string; severity: number /* 0..1 */ }

/** What the sim must expose; implement by forwarding sim events into a collector. */
export interface ReportSource {
  flights(fromDay: number, toDay: number): FlightRecord[]
  moods(fromDay: number, toDay: number): MoodSample[]
  complaints(fromDay: number, toDay: number): ComplaintRecord[]
  cash(fromDay: number, toDay: number): CashRecord[]
  bottlenecks(fromDay: number, toDay: number): BottleneckRecord[]
}

export class ReportCollector implements ReportSource {
  private f: FlightRecord[] = []
  private m: MoodSample[] = []
  private c: ComplaintRecord[] = []
  private k: CashRecord[] = []
  private b: BottleneckRecord[] = []
  recordFlight(r: FlightRecord): void { this.f.push(r) }
  recordMood(r: MoodSample): void { this.m.push(r) }
  recordComplaint(r: ComplaintRecord): void { this.c.push(r) }
  recordCash(r: CashRecord): void { this.k.push(r) }
  recordBottleneck(r: BottleneckRecord): void { this.b.push(r) }
  flights(a: number, b: number): FlightRecord[] { return this.f.filter((r) => r.day >= a && r.day < b) }
  moods(a: number, b: number): MoodSample[] { return this.m.filter((r) => r.day >= a && r.day < b) }
  complaints(a: number, b: number): ComplaintRecord[] { return this.c.filter((r) => r.day >= a && r.day < b) }
  cash(a: number, b: number): CashRecord[] { return this.k.filter((r) => r.day >= a && r.day < b) }
  bottlenecks(a: number, b: number): BottleneckRecord[] { return this.b.filter((r) => r.day >= a && r.day < b) }
  /** Drop records older than a day to bound memory. */
  prune(beforeDay: number): void {
    const keep = <T extends { day: number }>(xs: T[]) => xs.filter((x) => x.day >= beforeDay)
    this.f = keep(this.f); this.m = keep(this.m); this.c = keep(this.c); this.k = keep(this.k); this.b = keep(this.b)
  }
}

export interface AirlineLine { airline: string; flights: number; onTimePct: number }
export type Trend = 'up' | 'down' | 'flat'

export interface AirportReport {
  period: ReportPeriod
  fromDay: number
  toDay: number
  flights: number
  onTimePct: number
  avgDelayMin: number
  avgMood: number
  topComplaints: { topic: string; count: number }[]
  cashIn: number
  cashOut: number
  net: number
  costByCategory: Record<string, number>
  bestAirline?: AirlineLine
  worstAirline?: AirlineLine
  bottleneck?: { system: string; severity: number }
  trends: { onTime: Trend; mood: Trend; net: Trend }
}

const PERIOD_DAYS: Record<ReportPeriod, number> = { weekly: 7, monthly: 30 }
export const periodDays = (p: ReportPeriod): number => PERIOD_DAYS[p]

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const round1 = (v: number): number => Math.round(v * 10) / 10
function trend(cur: number, prev: number | undefined, eps: number): Trend {
  if (prev === undefined) return 'flat'
  return cur - prev > eps ? 'up' : prev - cur > eps ? 'down' : 'flat'
}

export function buildReport(src: ReportSource, period: ReportPeriod, toDay: number, previous?: AirportReport): AirportReport {
  const fromDay = toDay - PERIOD_DAYS[period]
  const flights = src.flights(fromDay, toDay)
  const onTimePct = flights.length ? round1((flights.filter((f) => f.onTime).length / flights.length) * 100) : 100
  const avgMood = round1(avg(src.moods(fromDay, toDay).map((m) => m.mood)))

  const counts = new Map<string, number>()
  for (const c of src.complaints(fromDay, toDay)) counts.set(c.topic, (counts.get(c.topic) ?? 0) + 1)
  const topComplaints = [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, 3)

  let cashIn = 0, cashOut = 0
  const costByCategory: Record<string, number> = {}
  for (const r of src.cash(fromDay, toDay)) {
    if (r.amount >= 0) cashIn += r.amount
    else { cashOut += -r.amount; costByCategory[r.category] = (costByCategory[r.category] ?? 0) - r.amount }
  }

  const byAirline = new Map<string, FlightRecord[]>()
  for (const f of flights) byAirline.set(f.airline, [...(byAirline.get(f.airline) ?? []), f])
  const lines: AirlineLine[] = [...byAirline.entries()]
    .map(([airline, fs]) => ({ airline, flights: fs.length, onTimePct: round1((fs.filter((f) => f.onTime).length / fs.length) * 100) }))
    .sort((a, b) => b.onTimePct - a.onTimePct || b.flights - a.flights || a.airline.localeCompare(b.airline))

  const sev = new Map<string, number>()
  for (const b of src.bottlenecks(fromDay, toDay)) sev.set(b.system, (sev.get(b.system) ?? 0) + b.severity)
  const worst = [...sev.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]

  const net = cashIn - cashOut
  return {
    period, fromDay, toDay,
    flights: flights.length,
    onTimePct,
    avgDelayMin: round1(avg(flights.map((f) => f.delayMin))),
    avgMood,
    topComplaints,
    cashIn, cashOut, net, costByCategory,
    bestAirline: lines[0],
    worstAirline: lines.length > 1 ? lines[lines.length - 1] : undefined,
    bottleneck: worst ? { system: worst[0], severity: round1(worst[1]) } : undefined,
    trends: {
      onTime: trend(onTimePct, previous?.onTimePct, 2),
      mood: trend(avgMood, previous?.avgMood, 2),
      net: trend(net, previous?.net, Math.max(100, Math.abs(previous?.net ?? 0) * 0.05)),
    },
  }
}

/** Wraps a report as a pop-in card. Never pauses play; expires after `ttlDays`. */
export function reportNotification(r: AirportReport, dayMs: number, ttlDays = 7): NewNotification<AirportReport> {
  const label = r.period === 'weekly' ? 'Weekly' : 'Monthly'
  const sign = r.net >= 0 ? '+' : '-'
  return {
    kind: 'report',
    priority: r.net < 0 || r.onTimePct < 70 ? 'normal' : 'low',
    title: `${label} airport report`,
    summary: `${r.onTimePct}% on time · mood ${r.avgMood} · net ${sign}$${Math.abs(r.net).toLocaleString('en-US')}`,
    expiresAt: (r.toDay + ttlDays) * dayMs,
    choices: [{ id: 'open', label: 'Open report' }, { id: 'dismiss', label: 'Dismiss' }],
    defaultChoiceId: 'dismiss',
    payload: r,
  }
}

/**
 * Decides when reports are due. Call onDayEnd(day) from the sim; it returns the
 * reports produced that day (weekly every 7 days, monthly every 30, as enabled).
 */
export class ReportScheduler {
  private last: Partial<Record<ReportPeriod, AirportReport>> = {}
  private readonly src: ReportSource
  private readonly enabled: ReportPeriod[]
  constructor(src: ReportSource, enabled: ReportPeriod[] = ['weekly', 'monthly']) {
    this.src = src
    this.enabled = enabled
  }
  onDayEnd(day: number): AirportReport[] {
    const out: AirportReport[] = []
    for (const p of this.enabled) {
      if (day > 0 && day % PERIOD_DAYS[p] === 0) {
        const r = buildReport(this.src, p, day, this.last[p])
        this.last[p] = r
        out.push(r)
      }
    }
    return out
  }
}
