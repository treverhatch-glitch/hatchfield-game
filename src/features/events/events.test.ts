import { describe, expect, it } from 'vitest'
import { NotificationQueue } from '../notifications/queue.ts'
import { EVENT_DEFS, EventScheduler, eventChance, eventNotification, getEventDef, resolveEvent, type EventWorld } from './events.ts'

const world: EventWorld = { weather: 'clear', traffic: 20, fuelTrucks: 2, staff: 20, level: 3 }
const run = (seed: number, w: EventWorld, days = 200) => {
  const s = new EventScheduler(seed)
  const out: string[] = []
  for (let d = 0; d < days; d++) for (const e of s.rollDay(d, w)) out.push(`${d}:${e.defId}`)
  return out
}

describe('events', () => {
  it('is deterministic per seed and differs across seeds', () => {
    expect(run(42, world)).toEqual(run(42, world))
    expect(run(42, world)).not.toEqual(run(7, world))
  })
  it('respects level gates, requirements and weather', () => {
    const vip = getEventDef('vip-turnaround')
    expect(eventChance(vip, { ...world, level: 1 })).toBe(0)
    expect(eventChance(getEventDef('fuel-truck-breakdown'), { ...world, fuelTrucks: 0 })).toBe(0)
    const storm = getEventDef('storm-runway')
    expect(eventChance(storm, { ...world, weather: 'thunderstorm' })).toBeGreaterThan(eventChance(storm, world) * 10)
    expect(eventChance(getEventDef('fog-low-vis'), world)).toBe(0)
  })
  it('caps events per day and honours cooldowns', () => {
    const evs = run(1, { ...world, weather: 'thunderstorm' }, 100)
    const days = evs.map((e) => e.split(':')[0])
    expect(new Set(days).size).toBe(days.length)
    const storms = evs.filter((e) => e.endsWith('storm-runway')).map((e) => Number(e.split(':')[0]))
    for (let i = 1; i < storms.length; i++) expect(storms[i] - storms[i - 1]).toBeGreaterThanOrEqual(2)
  })
  it('weather change hook can trigger weather-driven events', () => {
    const s = new EventScheduler(3)
    let hit = 0
    for (let d = 0; d < 50; d += 2) hit += s.onWeatherChange(d, { ...world, weather: 'fog' }).length
    expect(hit).toBeGreaterThan(0)
    expect(new EventScheduler(3).onWeatherChange(0, world)).toEqual([])
  })
  it('resolves choices to effects, falling back to the default', () => {
    expect(resolveEvent('fuel-truck-breakdown', 'repair').cash).toBe(-1500)
    expect(resolveEvent('fuel-truck-breakdown', undefined).durationMin).toBe(240)
    expect(resolveEvent('fuel-truck-breakdown', 'bogus').durationMin).toBe(240)
    expect(() => resolveEvent('nope', 'x')).toThrow()
  })
  it('delivers as non-blocking notifications that default on expiry', () => {
    const q = new NotificationQueue()
    const effects: number[] = []
    q.onResolve((r) => effects.push(resolveEvent((r.item.payload as { defId: string }).defId, r.choiceId).runwayClosedMin ?? 0))
    const n = q.push(eventNotification({ uid: 'e1', defId: 'storm-runway', day: 0 }, 0, 1000), 0)
    expect(n.priority).toBe('high')
    q.tick(15 * 1000)
    expect(effects).toEqual([45])
  })
  it('every def has a valid default choice', () => {
    for (const d of EVENT_DEFS) expect(d.choices.some((c) => c.id === d.defaultChoice)).toBe(true)
  })
})
