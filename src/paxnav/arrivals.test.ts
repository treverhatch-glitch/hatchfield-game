import { describe, expect, it } from 'vitest'
import { HallArrivals } from '../game/hallArrivals.ts'
import { layoutClaimHall } from '../game/hallNav.ts'
import { split1f } from '../terminalbuild/starter/split1f.ts'
import { ARRIVAL_STAGES } from '../terminalbuild/stages.ts'
import { AIR, ARR, LANE } from './grid.ts'
import { traceCovers } from './stages.ts'

describe('arrival stages', () => {
  it('reaches claim then the exit and never carries a security lane or airside cell', () => {
    const layout = split1f()
    const arr = new HallArrivals(4, layout.tileM)
    arr.setLayout(layout, layoutClaimHall(layout))
    const mask = arr.nav!.mask
    for (let c = 0; c < mask.length; c++) {
      if (mask[c] & ARR) expect(mask[c] & (AIR | LANE)).toBe(0)
    }
    expect(arr.spawn({ id: 'a1', gate: 'gate1', bags: true, needs: [], intl: false, boardMethod: 'stairs' })).toBe(true)
    const seen = new Set<number>()
    let left = false
    for (let t = 0; t < 8_000 && arr.has('a1'); t += 20) {
      const pose = arr.poses().find((p) => p.id === 'a1')
      if (pose && pose.layer !== 1) {
        seen.add(pose.cell)
        expect(mask[pose.cell] & LANE).toBe(0)
        expect(mask[pose.cell] & AIR).toBe(0)
      }
      arr.tick(20, t, null)
      if (arr.drainEvents().some((e) => e.kind === 'left' && e.id === 'a1')) left = true
    }
    expect(left).toBe(true)
    expect(seen.size).toBeGreaterThan(0)
    const trace = arr.journey('a1')
    expect(trace).toBeTruthy()
    expect(traceCovers(trace!, ARRIVAL_STAGES)).toBe(true)
    expect(trace!.hit).toContain('CLAIM')
    expect(trace!.hit).toContain('EXIT')
    expect(trace!.hit.indexOf('CLAIM')).toBeLessThan(trace!.hit.indexOf('EXIT'))
    expect(trace!.hit).not.toContain('PASSPORT')
    expect(trace!.hit).not.toContain('SECURITY')
    expect(trace!.skips.find((s) => s.stage === 'PASSPORT')?.reason).toBe('flight is not international')
  })
})
