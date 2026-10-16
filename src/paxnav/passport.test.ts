import { describe, expect, it } from 'vitest'
import { HallArrivals } from '../game/hallArrivals.ts'
import { layoutClaimHall } from '../game/hallNav.ts'
import { split1f } from '../terminalbuild/starter/split1f.ts'
import type { BuildLayout } from '../terminalbuild/types.ts'
import { bigTerminal } from './fixtures.test-util.ts'
import { PaxNav } from './paxnav.ts'

function withBooth(): BuildLayout {
  const layout = split1f()
  layout.fittings = [
    ...(layout.fittings ?? []),
    { id: 'pass-1', kind: 'passport_booth', x: 4, y: 8, floor: 0, rot: 0, wear: 0, staffed: true },
  ]
  return layout
}

function walkArrival(intl: boolean) {
  const layout = withBooth()
  const arr = new HallArrivals(9, layout.tileM)
  arr.setLayout(layout, layoutClaimHall(layout))
  expect(arr.spawn({ id: 'a', gate: 'gate1', bags: true, needs: [], intl, boardMethod: 'stairs', bagSeq: 1, flightId: 'F1' })).toBe(true)
  arr.setClaimReleased('F1', 1)
  let left = false
  for (let t = 0; t < 12_000 && arr.has('a'); t += 20) {
    arr.tick(20, t, null)
    if (arr.drainEvents().some((e) => e.id === 'a' && e.kind === 'left')) left = true
  }
  return { left, trace: arr.journey('a') }
}

describe('passport control', () => {
  it('sends only an international arrival through a booth, before claim', () => {
    const intl = walkArrival(true)
    expect(intl.left).toBe(true)
    expect(intl.trace!.hit).toContain('PASSPORT')
    expect(intl.trace!.hit.indexOf('PASSPORT')).toBeLessThan(intl.trace!.hit.indexOf('CLAIM'))

    const domestic = walkArrival(false)
    expect(domestic.left).toBe(true)
    expect(domestic.trace!.hit).not.toContain('PASSPORT')
    expect(domestic.trace!.skips.some((s) => s.stage === 'PASSPORT')).toBe(true)
  })

  it('never sends a departure through passport', () => {
    const nav = new PaxNav(bigTerminal(), { seed: 2, guests: false })
    expect(nav.spawn({ id: 'd', gate: 'g1', departAt: 12_000, bags: false, online: true, needs: [] })).toBe(true)
    for (let t = 0; t < 12_000 && nav.has('d'); t += 20) nav.tick(20, t)
    const trace = nav.stageTrace('d')
    expect(trace!.hit).not.toContain('PASSPORT')
    expect(trace!.skips.some((s) => s.stage === 'PASSPORT')).toBe(false)
  })
})
