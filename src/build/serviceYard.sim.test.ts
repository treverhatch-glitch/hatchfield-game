import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim'

/** Trucks parked on their home building, returning, so the next tick hands them to the yard. */
function homeTrucks(g: Game, kind: 'fuel' | 'bags', at: { c: number; r: number }, n: number) {
  for (let i = 0; i < n; i++) {
    g.spawnTruck(kind, null, [{ c: at.c, r: at.r + 1 }, at], kind === 'fuel' ? 'fuel' : 'sort_inbound', at)
    const t = g.trucks[g.trucks.length - 1]!
    t.preDwell = 0
    t.returning = true
    t.seg = 1
    t.x = at.c
    t.y = at.r
  }
  return g.trucks.slice(-n)
}

describe('service yard in the sim loop', () => {
  it('trucks returning home queue at that building and dock at its points', () => {
    const g = new Game()
    g.buyLand('city')
    g.tiles[10][10] = 'fuel'
    g.tiles[10][20] = 'fuel'
    g.syncYard()
    const ts = homeTrucks(g, 'fuel', { c: 10, r: 10 }, 4)
    g.speed = 1
    for (let i = 0; i < 2; i++) g.tick(0.1)
    expect(g.yard.occupancy('10,10')).toBe(2)
    expect(g.yard.queueLength('10,10')).toBe(2)
    expect(g.yard.occupancy('20,10')).toBe(0)
    expect(ts[0]!.yard?.key).toBe('10,10')
    // Docked trucks perform the action; positions sit on the hose points, not the tile centre.
    for (let i = 0; i < 20; i++) g.tick(0.1)
    const working = ts.filter((t) => t.yard?.phase === 'work')
    expect(working.length).toBeGreaterThan(0)
    expect(working.some((t) => t.yard!.action === 'refuel')).toBe(true)
    expect(Math.hypot(working[0]!.x - 10, working[0]!.y - 10)).toBeGreaterThan(0.1)
  })
  it('throughput depends on bays: queue drains as docks free', () => {
    const g = new Game()
    g.buyLand('city')
    g.tiles[10][10] = 'fuel'
    g.syncYard()
    homeTrucks(g, 'fuel', { c: 10, r: 10 }, 6)
    g.speed = 1
    let peak = 0
    for (let i = 0; i < 400; i++) {
      g.tick(0.1)
      peak = Math.max(peak, g.yard.occupancy('10,10'))
    }
    expect(peak).toBe(2)
    expect(g.yard.served('10,10')).toBeGreaterThanOrEqual(4)
    expect(g.yard.queueLength('10,10')).toBe(0)
  })
})
