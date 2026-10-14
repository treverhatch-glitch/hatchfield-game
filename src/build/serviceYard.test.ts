import { describe, expect, it } from 'vitest'
import { SERVICE_POINTS, worldPoints } from './servicePoints'
import { ServiceYard } from './serviceYard'

const run = (y: ServiceYard, ids: string[], sec: number, dt = 0.1) => {
  for (let t = 0; t < sec; t += dt) for (const id of ids) y.step(id, dt)
}

describe('service points', () => {
  it('every serviced building has points near its tile', () => {
    for (const tile of Object.keys(SERVICE_POINTS) as (keyof typeof SERVICE_POINTS)[]) {
      const w = worldPoints(tile, { c: 10, r: 10 })!
      expect(w.points.length).toBeGreaterThan(0)
      for (const p of w.points) {
        expect(Math.abs(p.c - 10)).toBeLessThan(1)
        expect(Math.abs(p.r - 10)).toBeLessThan(1)
      }
    }
  })
  it('lot rotation turns points with the building', () => {
    const a = worldPoints('cargo', { c: 10, r: 10 }, { w: 2, d: 2, dir: { c: 0, r: 1 } })!
    const b = worldPoints('cargo', { c: 10, r: 10 }, { w: 2, d: 2, dir: { c: 1, r: 0 } })!
    expect(a.points[0]!.c).not.toBeCloseTo(b.points[0]!.c, 1)
  })
})

describe('ServiceYard', () => {
  const mk = () => {
    const y = new ServiceYard()
    y.sync([
      { key: '5,5', tile: 'fuel', anchor: { c: 5, r: 5 } },
      { key: '8,5', tile: 'cargo', anchor: { c: 8, r: 5 } },
      { key: '2,2', tile: 'fire', anchor: { c: 2, r: 2 } },
    ])
    return y
  }
  it('assigns to the specific building and only for served kinds', () => {
    const y = mk()
    expect(y.arrive('t1', 'bags', '5,5', { c: 5, r: 6 }, 2)).toBe(false)
    expect(y.arrive('t1', 'fuel', '5,5', { c: 5, r: 6 }, 2)).toBe(true)
    expect(y.occupancy('5,5')).toBe(1)
    expect(y.occupancy('8,5')).toBe(0)
  })
  it('queues when every point is busy, FIFO', () => {
    const y = mk()
    for (const id of ['a', 'b', 'c', 'd']) y.arrive(id, 'fuel', '5,5', { c: 5, r: 7 }, 3)
    expect(y.occupancy('5,5')).toBe(2)
    expect(y.queueLength('5,5')).toBe(2)
    expect(y.job('c')!.phase).toBe('queue')
    run(y, ['a', 'b', 'c', 'd'], 1.3 + 3 + 1.2)
    expect(y.served('5,5')).toBe(2)
    expect(y.job('c')!.phase).not.toBe('queue')
    expect(y.job('d')!.phase).not.toBe('queue')
  })
  it('runs approach → work → exit with progress and releases', () => {
    const y = mk()
    y.arrive('x', 'citycargo', '8,5', { c: 8, r: 7 }, 2)
    run(y, ['x'], 1.4)
    const j = y.job('x')!
    expect(j.phase).toBe('work')
    expect(y.activePoints('8,5').filter(Boolean)).toHaveLength(1)
    run(y, ['x'], 1)
    expect(y.job('x')!.progress).toBeGreaterThan(0.4)
    let out: string | null = null
    for (let i = 0; i < 40 && out !== 'released'; i++) out = y.step('x', 0.1)
    expect(out).toBe('released')
    expect(y.occupancy('8,5')).toBe(0)
  })
  it('throughput scales with bays (bottleneck)', () => {
    const served = (bays: 'fuel' | 'cargo') => {
      const y = new ServiceYard()
      y.sync([{ key: 'k', tile: bays, anchor: { c: 0, r: 0 } }])
      const kind = bays === 'fuel' ? 'fuel' : 'citycargo'
      const ids = Array.from({ length: 12 }, (_, i) => `v${i}`)
      ids.forEach((id) => y.arrive(id, kind, 'k', { c: 0, r: 2 }, 4))
      run(y, ids, 20)
      return y.served('k')
    }
    // 2 hoses vs 4 docks over the same 20 s at the same 6.3 s cycle.
    expect(served('cargo')).toBeGreaterThan(served('fuel') * 1.6)
  })
  it('fire tender departs from a bay', () => {
    const y = mk()
    const j = y.depart('f', 'fire', '2,2')!
    expect(j.phase).toBe('exit')
    expect(y.occupancy('2,2')).toBe(1)
    run(y, ['f'], 1.2)
    expect(y.occupancy('2,2')).toBe(0)
  })
  it('forget frees the point and admits the queue', () => {
    const y = mk()
    for (const id of ['a', 'b', 'c']) y.arrive(id, 'fuel', '5,5', { c: 5, r: 7 }, 3)
    y.forget('a')
    expect(y.job('c')!.phase).toBe('approach')
  })
})
