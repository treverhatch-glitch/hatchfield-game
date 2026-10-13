import { describe, expect, it } from 'vitest'
import { starterGame } from './fixtures'
import { terminals } from './layout'
import { makeWalker, planTerminal, walkerAt, zoneFor } from './plan'
import { CELL, cellX, cellZ } from './view'

describe('terminal interior plan', () => {
  it('zones: landside check-in, middle security + shops, airside gates', () => {
    expect(zoneFor(0, 3, 1, 3)).toBe('checkin')
    expect(zoneFor(1, 3, 1, 3)).toBe('security')
    expect(zoneFor(1, 3, 0, 3)).toBe('shops')
    expect(zoneFor(2, 3, 0, 3)).toBe('gate')
    expect(zoneFor(0, 1, 0, 4)).toBe('checkin')
    expect(zoneFor(0, 1, 1, 4)).toBe('gate')
  })

  it('starter hall is staffed and busy', () => {
    const [t] = terminals(starterGame())
    const plan = planTerminal(t, { density: 1, walkersPerCell: 1 })
    const zones = new Set(plan.zones.map((z) => z.zone))
    expect(zones).toEqual(new Set(['checkin', 'security', 'shops', 'gate', 'backoffice']))
    // Every zone has at least one staffed desk / lane / till.
    for (const z of plan.zones) {
      const cx = cellX(z.c)
      const cz = cellZ(z.r)
      const inCell = plan.people.filter((p) => Math.abs(p.x - cx) <= CELL / 2 && Math.abs(p.z - cz) <= CELL / 2)
      expect(inCell.some((p) => p.role === 'staff')).toBe(true)
    }
    expect(plan.props.filter((p) => p.kind === 'counter').length).toBeGreaterThanOrEqual(12)
    expect(plan.props.some((p) => p.kind === 'xray')).toBe(true)
    expect(plan.props.some((p) => p.kind === 'kiosk')).toBe(true)
    expect(plan.props.some((p) => p.kind === 'podium')).toBe(true)
    expect(plan.people.filter((p) => p.role === 'seated').length).toBeGreaterThan(10)
    expect(plan.walkers.length).toBeGreaterThanOrEqual(9 * 2)
    expect(plan.walkers.some((w) => w.bag)).toBe(true)
  })

  it('everything stays inside the building footprint', () => {
    const [t] = terminals(starterGame())
    const plan = planTerminal(t)
    const x0 = cellX(t.cluster.minC) - CELL / 2
    const x1 = cellX(t.cluster.maxC) + CELL / 2
    const z0 = cellZ(t.cluster.minR) - CELL / 2
    const z1 = cellZ(t.cluster.maxR) + CELL / 2
    const inside = (x: number, z: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1
    for (const p of plan.props) expect(inside(p.x, p.z)).toBe(true)
    for (const p of plan.people) expect(inside(p.x, p.z)).toBe(true)
    for (const w of plan.walkers) for (const p of w.pts) expect(inside(p.x, p.z)).toBe(true)
  })

  it('is deterministic and lighter at low density', () => {
    const [t] = terminals(starterGame())
    expect(planTerminal(t)).toEqual(planTerminal(t))
    expect(planTerminal(t, { density: 0.5 }).props.length).toBeLessThan(planTerminal(t).props.length)
    expect(planTerminal(t, { walkersPerCell: 0 }).walkers).toHaveLength(0)
  })

  it('walkers ping-pong along their route', () => {
    const w = makeWalker([{ x: 0, z: 0 }, { x: 10, z: 0 }], 1, 0, 0, true)
    expect(walkerAt(w, 0).x).toBeCloseTo(0)
    expect(walkerAt(w, 5).x).toBeCloseTo(5)
    expect(walkerAt(w, 15).x).toBeCloseTo(5)
    expect(walkerAt(w, 20).x).toBeCloseTo(0)
    expect(Math.sign(Math.sin(walkerAt(w, 5).yaw))).toBe(1)
    expect(Math.sign(Math.sin(walkerAt(w, 15).yaw))).toBe(-1)
    const bend = makeWalker([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }], 1, 0, 0, false)
    expect(walkerAt(bend, 2)).toMatchObject({ x: 2, z: 0 })
    expect(walkerAt(bend, 5).x).toBeCloseTo(4)
    expect(walkerAt(bend, 5).z).toBeCloseTo(1)
    expect(walkerAt(bend, 7).z).toBeCloseTo(3)
  })
})
