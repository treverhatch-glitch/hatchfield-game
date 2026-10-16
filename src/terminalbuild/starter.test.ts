import { describe, expect, it } from 'vitest'
import { STARTER_CAPACITY } from '../game/openingData.ts'
import { paxPerMin } from '../game/terminal.ts'
import { buildFacilities } from '../paxnav/facilities.ts'
import { computeField } from '../paxnav/field.ts'
import { PRE, buildNavGrid } from '../paxnav/grid.ts'
import { fittingSize, fittingTiles } from './fittings.ts'
import { flood, indexLayout, tileKey, walkStep } from './grid.ts'
import { split1f } from './starter/split1f.ts'
import { reachOf, validateLayout } from './validate.ts'

describe('split1f starter', () => {
  const layout = split1f()

  it('is one floor, 88 by 44 metres, with the section 5 doors', () => {
    expect(layout.version).toBe(2)
    expect(layout.tileM).toBe(1)
    expect(layout.w).toBe(88)
    expect(layout.h).toBe(44)
    expect(layout.stories).toBe(1)
    expect(layout.slabs).toEqual([])
    const curb = layout.doors.filter((d) => d.kind === 'curb')
    const exit = layout.doors.filter((d) => d.kind === 'exit')
    const arrivals = layout.doors.filter((d) => d.kind === 'arrivals_in')
    const apron = layout.doors.filter((d) => d.kind === 'gate_apron')
    expect(curb.length).toBeGreaterThan(0)
    expect(exit.length).toBeGreaterThan(0)
    expect(arrivals.length).toBeGreaterThan(0)
    expect(apron.length).toBeGreaterThan(0)
  })

  it('faces each check-in desk south, toward the nearest curb door, within 45 degrees', () => {
    const curb = layout.doors.filter((d) => d.kind === 'curb')
    const desks = (layout.fittings ?? []).filter((f) => f.kind === 'checkin_desk')
    expect(desks.length).toBe(2)
    for (const desk of desks) {
      expect(fittingSize(desk.kind, desk.rot).w).toBe(2)
      expect(desk.rot).toBe(0)
      const size = fittingSize(desk.kind, desk.rot)
      const front = { x: desk.x + size.w / 2, y: desk.y + size.d }
      let best = Infinity
      let at = curb[0]
      for (const door of curb) {
        const dx = door.x + 0.5 - front.x
        const dy = door.y + 1 - front.y
        const dist = dx * dx + dy * dy
        if (dist < best) {
          best = dist
          at = door
        }
      }
      const dx = at.x + 0.5 - front.x
      const dy = at.y + 1 - front.y
      const angle = Math.abs(Math.atan2(dx, dy))
      expect(angle).toBeLessThanOrEqual((45 * Math.PI) / 180)
    }
  })

  it('keeps both lanes in the one security room, and every departure crosses it once', () => {
    const security = layout.rooms.filter((r) => r.kind === 'security')
    expect(security).toHaveLength(1)
    const room = security[0]
    const lanes = (layout.fittings ?? []).filter((f) => f.kind === 'security_lane')
    expect(lanes).toHaveLength(2)
    for (const lane of lanes) {
      const tiles = fittingTiles(lane)
      expect(tiles.length).toBeGreaterThan(0)
      for (const t of tiles) {
        expect(t.x).toBeGreaterThanOrEqual(room.x)
        expect(t.y).toBeGreaterThanOrEqual(room.y)
        expect(t.x).toBeLessThan(room.x + room.w)
        expect(t.y).toBeLessThan(room.y + room.h)
      }
    }
    expect(layout.rooms.some((r) => r.id === 'rd' && r.kind === 'office')).toBe(true)
    const v = validateLayout(layout)
    expect(v.findings.filter((f) => f.blocksFlow).map((f) => f.id)).toEqual([])
    expect(v.ok).toBe(true)

    const ix = indexLayout(layout)
    const reach = reachOf(layout, ix)
    expect(reach.curb.length).toBeGreaterThan(0)
    expect(reach.arrives.size).toBeGreaterThan(0)
    expect([...reach.curb].some((t) => reach.arrives.has(tileKey(t.x, t.y)))).toBe(true)
    const gate = layout.equipment.find((e) => e.kind === 'gate_desk')!
    const walked = flood([gate], walkStep(layout, ix, 'depart'))
    const curbKey = tileKey(reach.curb[0].x, reach.curb[0].y)
    expect(walked.dist.has(curbKey) || [...reach.curb].some((t) => walked.dist.has(tileKey(t.x, t.y)))).toBe(true)
    const hit = [...reach.curb].find((t) => walked.dist.has(tileKey(t.x, t.y)))!
    const path: { x: number; y: number }[] = []
    let cursor = tileKey(hit.x, hit.y)
    const guard = new Set<string>()
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor)
      const [x, y] = cursor.split(',').map(Number)
      path.push({ x, y })
      if (x === gate.x && y === gate.y) break
      cursor = walked.parent.get(cursor) ?? ''
    }
    let entries = 0
    let inside = false
    for (const t of path) {
      const inRoom = t.x >= room.x && t.y >= room.y && t.x < room.x + room.w && t.y < room.y + room.h
      if (inRoom && !inside) entries += 1
      inside = inRoom
    }
    expect(entries).toBe(1)
  })

  it('stays within 10% of the starter ceilings', () => {
    const n = (kind: string) => (layout.fittings ?? []).filter((f) => f.kind === kind).length
    expect(n('checkin_desk')).toBe(STARTER_CAPACITY.desks)
    expect(n('security_lane')).toBe(STARTER_CAPACITY.servers)
    expect(layout.rooms.filter((r) => r.kind === 'gate')).toHaveLength(STARTER_CAPACITY.gates)
    expect(n('claim_carousel')).toBe(STARTER_CAPACITY.bagClaim)
    const rate = paxPerMin(n('security_lane'), 3)
    expect(Math.abs(rate - 37.5) / 37.5).toBeLessThanOrEqual(0.1)
  })

  it('reaches both security lanes from the curb', () => {
    const g = buildNavGrid(layout, 1)
    const fac = buildFacilities(g)
    const field = computeField(g, g.spawns, PRE, null)
    const lanes = fac.list.filter((f) => f.kind === 'security_lane')
    expect(lanes).toHaveLength(2)
    for (const lane of lanes) {
      expect(Number.isFinite(field.dist[lane.service])).toBe(true)
      expect(lane.line.length).toBeGreaterThan(1)
    }
  })
})
