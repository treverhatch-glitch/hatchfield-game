import { describe, expect, it } from 'vitest'
import { blankView, rect, starterGame } from './fixtures'
import { terminals } from './layout'
import { planTerminal } from './plan'
import { canStep, navPath, PUBLIC_ROOMS, roomEdges, squareAt, STERILE_ROOMS, type RoomPlan } from './rooms'

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

  it('does not bake decorative crowd routes into the apron plan', () => {
    const [t] = terminals(starterGame())
    const plan = planTerminal(t, { walkersPerCell: 2, density: 1 })
    expect(plan.walkers).toEqual([])
    expect(plan.people).toEqual([])
    expect(plan.props).toEqual([])
    expect(plan.rooms.rooms.length).toBeGreaterThan(0)
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
