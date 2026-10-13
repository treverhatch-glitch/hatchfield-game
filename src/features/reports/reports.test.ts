import { describe, expect, it } from 'vitest'
import { NotificationQueue } from '../notifications/queue.ts'
import { ReportCollector, ReportScheduler, buildReport, reportNotification } from './reports.ts'

function seed(c: ReportCollector, fromDay: number, onTimeEvery: number, income: number) {
  for (let d = fromDay; d < fromDay + 7; d++) {
    for (let i = 0; i < 4; i++) {
      const airline = i % 2 ? 'SkyLark' : 'Hatch Air'
      const onTime = airline === 'Hatch Air' || (d + i) % onTimeEvery !== 0
      c.recordFlight({ day: d, airline, onTime, delayMin: onTime ? 0 : 20 })
    }
    c.recordMood({ day: d, mood: 60 + d })
    c.recordComplaint({ day: d, topic: d % 2 ? 'queues' : 'toilets' })
    c.recordComplaint({ day: d, topic: 'queues' })
    c.recordCash({ day: d, amount: income, category: 'fees' })
    c.recordCash({ day: d, amount: -300, category: 'staff' })
    c.recordBottleneck({ day: d, system: 'security', severity: 0.5 })
    c.recordBottleneck({ day: d, system: 'bags', severity: 0.2 })
  }
}

describe('reports', () => {
  it('summarises a week deterministically', () => {
    const c = new ReportCollector()
    seed(c, 0, 2, 1000)
    const r = buildReport(c, 'weekly', 7)
    expect(r.flights).toBe(28)
    expect(r.cashIn).toBe(7000)
    expect(r.cashOut).toBe(2100)
    expect(r.net).toBe(4900)
    expect(r.costByCategory.staff).toBe(2100)
    expect(r.topComplaints[0]).toEqual({ topic: 'queues', count: 10 })
    expect(r.bestAirline?.airline).toBe('Hatch Air')
    expect(r.worstAirline?.airline).toBe('SkyLark')
    expect(r.bottleneck?.system).toBe('security')
    expect(buildReport(c, 'weekly', 7)).toEqual(r)
  })
  it('computes trends against the previous report', () => {
    const c = new ReportCollector()
    seed(c, 0, 1000, 1000)
    seed(c, 7, 2, 200)
    const s = new ReportScheduler(c, ['weekly'])
    expect(s.onDayEnd(3)).toEqual([])
    s.onDayEnd(7)
    const [w2] = s.onDayEnd(14)
    expect(w2.trends.onTime).toBe('down')
    expect(w2.trends.net).toBe('down')
    expect(w2.trends.mood).toBe('up')
  })
  it('fires monthly on day 30 alongside weekly when both due', () => {
    const s = new ReportScheduler(new ReportCollector())
    expect(s.onDayEnd(28).map((r) => r.period)).toEqual(['weekly'])
    expect(s.onDayEnd(30).map((r) => r.period)).toEqual(['monthly'])
  })
  it('becomes a dismissible, auto-expiring notification', () => {
    const c = new ReportCollector()
    seed(c, 0, 2, 1000)
    const q = new NotificationQueue()
    const n = q.push(reportNotification(buildReport(c, 'weekly', 7), 1000), 7000)
    expect(n.summary).toContain('net +$4,900')
    q.tick(14000)
    expect(q.get(n.id)?.status).toBe('expired')
  })
  it('handles an empty period', () => {
    const r = buildReport(new ReportCollector(), 'monthly', 30)
    expect(r.onTimePct).toBe(100)
    expect(r.bestAirline).toBeUndefined()
    expect(r.bottleneck).toBeUndefined()
  })
  it('prunes old records', () => {
    const c = new ReportCollector()
    seed(c, 0, 2, 1000)
    c.prune(5)
    expect(c.flights(0, 100)).toHaveLength(8)
  })
})
