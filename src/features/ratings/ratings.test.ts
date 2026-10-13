import { describe, expect, it } from 'vitest'
import { NotificationQueue } from '../notifications/queue.ts'
import { AirlineRatings, RESPONSE_EFFECT, ratingNotification, scorePeriod } from './ratings.ts'

const good = { airline: 'Hatch Air', punctuality: 0.98, turnaroundRatio: 0.9, feeRatio: 0.9, passengerMood: 90 }
const bad = { airline: 'SkyLark', punctuality: 0.4, turnaroundRatio: 1.4, feeRatio: 1.5, passengerMood: 35 }

describe('ratings', () => {
  it('scores components within 0..100', () => {
    const p = scorePeriod(good)
    expect(p.total).toBeGreaterThan(90)
    expect(p.turnaround).toBe(100)
    const b = scorePeriod(bad)
    expect(b.total).toBeLessThan(40)
    expect(b.fees).toBe(25)
  })
  it('raises a threat only after a streak, naming the worst factor, then cools down', () => {
    const r = new AirlineRatings()
    expect(r.update([bad])).toEqual([])
    const [sig] = r.update([bad])
    expect(sig.type).toBe('threat')
    if (sig.type === 'threat') expect(sig.worst).toBe('turnaround')
    for (let i = 0; i < 3; i++) expect(r.update([bad])).toEqual([])
    expect(r.update([bad])).toHaveLength(1)
  })
  it('raises slot requests for happy airlines', () => {
    const r = new AirlineRatings()
    r.update([good])
    const [sig] = r.update([good])
    expect(sig).toMatchObject({ type: 'slotRequest', extraSlots: 2 })
  })
  it('smooths scores and applies response effects', () => {
    const r = new AirlineRatings({ smoothing: 0.5 })
    r.update([good]); r.update([bad])
    const s = r.get('Hatch Air')!.score
    r.update([{ ...bad, airline: 'Hatch Air' }])
    expect(r.get('Hatch Air')!.score).toBeLessThan(s)
    r.adjust('Hatch Air', RESPONSE_EFFECT.discount)
    expect(r.all()[0].airline).toBe('Hatch Air')
  })
  it('produces non-blocking notifications with a safe default', () => {
    const q = new NotificationQueue()
    const n = q.push(ratingNotification({ type: 'threat', airline: 'X', score: 30, worst: 'fees' }, 0, 100), 0)
    expect(n.priority).toBe('high')
    expect(n.summary).toContain('fees are too high')
    q.tick(100)
    expect(q.get(n.id)?.resolvedChoiceId).toBe('ignore')
  })
})
