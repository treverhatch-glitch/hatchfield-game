import { describe, expect, it } from 'vitest'
import { HallArrivals } from '../game/hallArrivals.ts'
import { layoutClaimHall } from '../game/hallNav.ts'
import { split1f } from '../terminalbuild/starter/split1f.ts'
import { PaxNav } from './paxnav.ts'

describe('starter walk', () => {
  it('pushes 46 departures and 46 arrivals with no stuck agent', () => {
    const layout = split1f()
    const gates = layout.rooms.filter((r) => r.kind === 'gate').map((r) => r.id)
    const nav = new PaxNav(layout, { seed: 5, guests: false })
    const arr = new HallArrivals(5, layout.tileM)
    arr.setLayout(layout, layoutClaimHall(layout))
    for (let i = 0; i < 46; i++) {
      expect(
        nav.spawn({
          id: `d${i}`,
          gate: gates[i % gates.length] ?? gates[0],
          departAt: 9_000,
          bags: false,
          online: true,
          needs: [],
          boardMethod: 'stairs',
        }),
      ).toBe(true)
      expect(
        arr.spawn({ id: `a${i}`, gate: gates[i % gates.length] ?? gates[0], bags: false, needs: [], intl: false, boardMethod: 'stairs' }),
      ).toBe(true)
    }
    const stuck = new Set<string>()
    let boarded = 0
    let left = 0
    for (let t = 0; t < 14_000; t += 30) {
      nav.tick(30, t)
      for (const e of nav.drainEvents()) {
        if (e.kind === 'stuck') stuck.add(e.id)
        if (e.kind === 'boarded') boarded++
      }
      arr.tick(30, t, nav)
      for (const e of arr.drainEvents()) {
        if (e.kind === 'stuck') stuck.add(e.id)
        if (e.kind === 'left') left++
      }
    }
    expect(stuck.size).toBe(0)
    expect(boarded).toBe(46)
    expect(left).toBe(46)
    expect(nav.count).toBe(0)
    expect(arr.count).toBe(0)
  })
})
