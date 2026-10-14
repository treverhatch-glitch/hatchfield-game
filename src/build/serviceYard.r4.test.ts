import { describe, expect, it } from 'vitest'
import { ServiceYard } from './serviceYard'

const run = (y: ServiceYard, ids: string[], sec: number, dt = 0.1) => {
  for (let t = 0; t < sec; t += dt) for (const id of ids) y.step(id, dt)
}

describe('ServiceYard round 4', () => {
  it('tow tugs queue at a hangar door and roll out when the tow ends', () => {
    const y = new ServiceYard()
    y.sync([{ key: '4,4', tile: 'hangar', anchor: { c: 4, r: 4 } }])
    expect(y.arrive('tug:a:in', 'tow', '4,4', { c: 6, r: 6 }, 900)).toBe(true)
    expect(y.arrive('tug:b:in', 'tow', '4,4', { c: 6, r: 6 }, 900)).toBe(true)
    run(y, ['tug:a:in', 'tug:b:in'], 2)
    expect(y.job('tug:a:in')!.phase).toBe('work')
    expect(y.job('tug:b:in')!.phase).toBe('queue')
    expect(y.queueLength('4,4')).toBe(1)
    // Queued tug waits in the hangar's own lane, not on the door.
    const q = y.job('tug:b:in')!
    const door = y.spec('4,4')!.points[0]!
    expect(Math.hypot(q.c - door.c, q.r - door.r)).toBeGreaterThan(0.3)
    y.finishWork('tug:a:in')
    run(y, ['tug:a:in', 'tug:b:in'], 3)
    expect(y.job('tug:a:in')).toBeUndefined()
    expect(y.job('tug:b:in')!.phase).toBe('work')
    expect(y.served('4,4')).toBe(1)
  })

  it('MRO has two tow doors and its own queue lane', () => {
    const y = new ServiceYard()
    y.sync([{ key: '9,9', tile: 'mro', anchor: { c: 9, r: 9 } }])
    for (const id of ['a', 'b', 'c']) y.arrive(id, 'tow', '9,9', { c: 11, r: 11 }, 900)
    run(y, ['a', 'b', 'c'], 2)
    expect(y.occupancy('9,9')).toBe(2)
    expect(y.queueLength('9,9')).toBe(1)
  })

  it('coaches dock at bus-station kerb bays', () => {
    const y = new ServiceYard()
    y.sync([{ key: '3,3', tile: 'bus', anchor: { c: 3, r: 3 } }])
    expect(y.arrive('coach1', 'coach', '3,3', { c: 1, r: 3 }, 2)).toBe(true)
    run(y, ['coach1'], 1.5)
    expect(y.job('coach1')!.action).toBe('board')
    run(y, ['coach1'], 4)
    expect(y.served('3,3')).toBe(1)
  })

  it('throughput survives save / restore, even before the site re-syncs', () => {
    const y = new ServiceYard()
    y.sync([{ key: '5,5', tile: 'fuel', anchor: { c: 5, r: 5 } }])
    y.arrive('t', 'fuel', '5,5', { c: 5, r: 6 }, 0.5)
    run(y, ['t'], 5)
    const snap = JSON.parse(JSON.stringify(y.save()))
    expect(snap.served['5,5']).toBe(1)
    const z = new ServiceYard()
    z.restore(snap)
    expect(z.save().served['5,5']).toBe(1)
    z.sync([{ key: '5,5', tile: 'fuel', anchor: { c: 5, r: 5 } }])
    expect(z.served('5,5')).toBe(1)
    z.restore({ served: { '5,5': Number.NaN } as Record<string, number> })
    z.restore(null)
  })
})
