import { afterEach, describe, expect, it } from 'vitest'
import { perf, perfEnd, perfFrame, perfStart } from './perf'

describe('perf spans', () => {
  afterEach(() => {
    perf.enabled = false
    perf.reset()
  })

  it('records nothing while disabled', () => {
    perf.reset()
    perfEnd('sim.tick', perfStart())
    perfFrame()
    expect(perf.report().rows).toEqual([])
    expect(perf.frames).toBe(0)
  })

  it('reports ms per frame, sorted by cost', () => {
    perf.enabled = true
    perf.reset()
    for (let f = 0; f < 4; f++) {
      perfFrame()
      perfEnd('cheap', performance.now())
      perfEnd('costly', performance.now() - 8)
    }
    const r = perf.report()
    expect(r.frames).toBe(4)
    expect(r.rows.map((x) => x.label)).toEqual(['costly', 'cheap'])
    expect(r.rows[0].calls).toBe(4)
    expect(r.rows[0].msPerFrame).toBeGreaterThanOrEqual(8)
  })
})
