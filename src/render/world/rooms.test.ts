import { describe, expect, it } from 'vitest'
import { blankView, rect, starterGame } from './fixtures'
import { terminals } from './layout'
import { planTerminal, walkerAt } from './plan'
import { canStep, NAV_CLEAR, navPath, PUBLIC_ROOMS, roomAt, roomEdges, squareAt, STERILE_ROOMS, type RoomPlan } from './rooms'

function starterRooms(): RoomPlan {
  const [t] = terminals(starterGame())
  return planTerminal(t).rooms
}

/** Room ids reachable from `start` through doorways only. */
function reach(rp: RoomPlan, start: number, allow: (id: number) => boolean = () => true): Set<number> {
  const seen = new Set([start])
  const q = [start]
  while (q.length) {
    const cur = q.shift()!
    for (const d of rp.doors) {
      const n = d.a === cur ? d.b : d.b === cur ? d.a : -1
      if (n >= 0 && !seen.has(n) && allow(n)) {
        seen.add(n)
        q.push(n)
      }
    }
  }
  return seen
}

describe('terminal rooms', () => {
  it('starter hall has every room type, labelled', () => {
    const rp = starterRooms()
    const kinds = new Set(rp.rooms.map((r) => r.kind))
    expect(kinds).toEqual(new Set(['checkin', 'security', 'airside', 'shops', 'gate', 'lab', 'office']))
    expect(rp.rooms.filter((r) => r.kind === 'gate').map((r) => r.label).sort()).toEqual(['GATE 1', 'GATE 2', 'GATE 3'])
    // Every square inside the footprint belongs to a room.
    expect(rp.grid.every((id) => id >= 0)).toBe(true)
  })

  it('has walls, glass holdroom partitions, lintels and doorways', () => {
    const rp = starterRooms()
    expect(rp.walls.filter((w) => w.kind === 'solid' && !w.header).length).toBeGreaterThan(4)
    expect(rp.walls.some((w) => w.kind === 'glass')).toBe(true)
    expect(rp.walls.some((w) => w.header)).toBe(true)
    expect(rp.doors.some((d) => d.kind === 'staff')).toBe(true)
    for (const w of rp.walls) expect(w.x0 === w.x1 || w.z0 === w.z1).toBe(true)
  })

  it('every room is reachable, and airside only through security', () => {
    const rp = starterRooms()
    const checkin = rp.rooms.find((r) => r.kind === 'checkin')!
    expect(reach(rp, checkin.id).size).toBe(rp.rooms.length)
    // Without passing security or staff rooms, landside cannot reach sterile rooms.
    const kind = (id: number) => rp.rooms[id].kind
    const landside = reach(rp, checkin.id, (id) => kind(id) !== 'security' && PUBLIC_ROOMS.has(kind(id)))
    for (const id of landside) expect(STERILE_ROOMS.has(kind(id))).toBe(false)
  })

  it('nav paths go through doorways, never through walls', () => {
    const rp = starterRooms()
    const checkin = rp.rooms.find((r) => r.kind === 'checkin')!
    const gate = rp.rooms.find((r) => r.kind === 'gate')!
    const path = navPath(rp, checkin, gate)!
    expect(path.length).toBeGreaterThan(2)
    // Walk the polyline finely: every room change must cross a doorway edge.
    const visited = new Set<string>()
    for (let k = 1; k < path.length; k++) {
      const p = path[k - 1]
      const q = path[k]
      const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (rp.size * 0.2))
      let prev = squareAt(rp, p.x, p.z)
      for (let m = 1; m <= n; m++) {
        const s = squareAt(rp, p.x + ((q.x - p.x) * m) / n, p.z + ((q.z - p.z) * m) / n)
        expect(s).toBeGreaterThanOrEqual(0)
        if (s !== prev && Math.abs((s % rp.w) - (prev % rp.w)) + Math.abs(Math.floor(s / rp.w) - Math.floor(prev / rp.w)) === 1) {
          expect(canStep(rp, prev, s)).toBe(true)
        }
        visited.add(rp.rooms[rp.grid[s]].kind)
        prev = s
      }
    }
    expect(visited.has('security')).toBe(true)
    expect(visited.has('lab')).toBe(false)
    expect(visited.has('office')).toBe(false)
  })

  it('crowd walkers stay in public rooms; staff walk the back office', () => {
    const [t] = terminals(starterGame())
    const plan = planTerminal(t, { walkersPerCell: 1 })
    const pax = plan.walkers.filter((w) => !w.staff)
    expect(pax.length).toBeGreaterThan(15)
    for (const w of pax) {
      for (const p of w.pts) expect(PUBLIC_ROOMS.has(roomAt(plan.rooms, p.x, p.z)!.kind)).toBe(true)
    }
    expect(plan.walkers.some((w) => w.staff)).toBe(true)
  })

  it('walkers keep a body radius off walls and never cross furniture', () => {
    const [t] = terminals(starterGame())
    const plan = planTerminal(t, { walkersPerCell: 2 })
    const rp = plan.rooms
    const segDist = (x: number, z: number, w: { x0: number; z0: number; x1: number; z1: number }) => {
      const dx = w.x1 - w.x0
      const dz = w.z1 - w.z0
      const k = Math.max(0, Math.min(1, ((x - w.x0) * dx + (z - w.z0) * dz) / (dx * dx + dz * dz || 1)))
      return Math.hypot(x - w.x0 - dx * k, z - w.z0 - dz * k)
    }
    for (const w of plan.walkers) {
      const len = w.cum[w.cum.length - 1]
      for (let d = 0; d <= len; d += 0.1) {
        const p = walkerAt({ ...w, phase: 0, speed: 1 }, d)
        for (const wall of rp.walls) if (!wall.header) expect(segDist(p.x, p.z, wall)).toBeGreaterThan(NAV_CLEAR - 0.02)
        expect(rp.blocked[squareAt(rp, p.x, p.z)]).toBe(0)
      }
    }
  })

  it('room outlines close and one-deep halls still connect', () => {
    const rp = starterRooms()
    for (const r of rp.rooms) expect(roomEdges(rp, r).length).toBeGreaterThanOrEqual(4)
    const view = blankView([...rect(4, 4, 4, 1, 'terminal'), ...rect(4, 5, 4, 1, 'stand'), ...rect(4, 6, 4, 1, 'taxi')])
    const [t] = terminals(view)
    const thin = planTerminal(t).rooms
    expect(reach(thin, 0).size).toBe(thin.rooms.length)
  })
})
