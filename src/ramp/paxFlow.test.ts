import { describe, expect, it } from 'vitest'
import { PAX_SHARES, samplePax, type PaxClock, type PaxMode } from './paxFlow.ts'

const door = { x: 8, z: 2.4, sill: 3.1 }

function clock(mode: PaxMode, leg: 'deplane' | 'board', now: number, extra: Partial<PaxClock> = {}): PaxClock {
  return {
    id: 'f1',
    mode,
    leg,
    start: 0,
    end: 10,
    now,
    aircraft: { x: 11, y: 6, heading: 0 },
    door,
    gate: { x: 14, y: 8 },
    metersPerUnit: 22,
    ...extra,
  }
}

describe('boarding pictures', () => {
  it.each(['bridge', 'stairs', 'bus'] as const)('%s shares fill the phase for both directions', (mode) => {
    for (const leg of ['deplane', 'board'] as const) {
      const shares = PAX_SHARES[mode][leg]
      expect(shares.reduce((sum, step) => sum + step.share, 0)).toBeCloseTo(1, 8)
      const start = samplePax(clock(mode, leg, 0))
      const end = samplePax(clock(mode, leg, 10))
      expect(start.step).toBe(shares[0].id)
      expect(end.step).toBe(shares[shares.length - 1].id)
    }
  })

  it('extends the bridge before anyone walks, and leaves it docked after deplaning', () => {
    expect(samplePax(clock('bridge', 'deplane', 0.2)).extend).toBeGreaterThan(0)
    expect(samplePax(clock('bridge', 'deplane', 0.2)).extend).toBeLessThan(1)
    expect(samplePax(clock('bridge', 'deplane', 0.2)).people).toEqual([])
    const walking = samplePax(clock('bridge', 'deplane', 6))
    expect(walking.extend).toBe(1)
    expect(walking.step).toBe('walk')
    expect(walking.people.length).toBeGreaterThan(0)
    expect(walking.people.every((person) => person.alt > 2)).toBe(true)
    const done = samplePax(clock('bridge', 'deplane', 10))
    expect(done.extend).toBe(1)
    expect(done.people).toEqual([])
  })

  it('retracts the bridge only after boarding', () => {
    expect(samplePax(clock('bridge', 'board', 1)).extend).toBe(1)
    expect(samplePax(clock('bridge', 'board', 9.5)).extend).toBeLessThan(0.5)
  })

  it('walks stair passengers up to the sill and back down without a jump', () => {
    let worst = 0
    let prev: Map<string, { c: number; r: number; alt: number }> | null = null
    let climbed = false
    for (let t = 0; t <= 10; t += 0.05) {
      const sample = samplePax(clock('stairs', 'board', t))
      if (sample.people.some((person) => person.alt > 2)) climbed = true
      if (prev) {
        for (const person of sample.people) {
          const was = prev.get(person.id)
          if (!was) continue
          const step = Math.hypot((person.c - was.c) * 22, (person.r - was.r) * 22, person.alt - was.alt)
          worst = Math.max(worst, step)
        }
      }
      prev = new Map(sample.people.map((person) => [person.id, person]))
    }
    expect(climbed).toBe(true)
    expect(worst).toBeLessThan(1.2)
    expect(samplePax(clock('stairs', 'deplane', 2)).props.some((prop) => prop.kind === 'stairs')).toBe(true)
  })

  it('keeps bus passengers inside the coach while it is moving', () => {
    const riding = samplePax(clock('bus', 'deplane', 5, { riding: true }))
    expect(riding.people).toEqual([])
    const alight = samplePax(clock('bus', 'board', 7))
    expect(alight.step).toBe('walk')
    expect(alight.people.length).toBeGreaterThan(0)
  })
})
