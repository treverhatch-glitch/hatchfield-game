import { describe, expect, it } from 'vitest'
import { applyEdits, placeEquipment, removeEquipment, type BuildLayout } from '../terminalbuild/index.ts'
import { sampleTerminal } from '../terminalbuild/sample.ts'
import { prefabNavLayout } from '../game/hallNav.ts'
import { schemeItems, schemeZones } from '../game/terminal.ts'
import { AIR, CrewNav, LANE, PRE, PaxNav, cellAt, cellX, cellZ, cellsOfTile, moveOpen, type CrewPose, type CrewPost } from './index.ts'

const WALK = PRE | AIR

function sample(): BuildLayout {
  const res = sampleTerminal()
  if (res.error) throw new Error(res.error)
  return res.layout
}

function edit(l: BuildLayout, fn: (l: BuildLayout) => ReturnType<typeof applyEdits>): BuildLayout {
  const res = fn(l)
  if (res.error) throw new Error(res.error)
  return res.layout
}

function crewOn(layout: BuildLayout, shiftSec = 600) {
  const nav = new PaxNav(layout, { seed: 3 })
  const crew = new CrewNav({ shiftSec })
  crew.setGrid(nav.nav, nav.facilities)
  return { nav, crew }
}

/** Distance from a point to the segment a-b. */
function toSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const L = dx * dx + dz * dz
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

/**
 * Every tick: each crew member stands on walkable floor, or on the one step
 * between a post's floor cell and its spot behind the desk; floor-to-floor
 * moves never cross a wall.
 */
function runChecked(nav: PaxNav, crew: CrewNav, from: number, to: number, dt: number, onTick?: (now: number, poses: CrewPose[]) => void) {
  const g = nav.nav
  const last = new Map<string, number>()
  for (let now = from; now <= to; now += dt) {
    crew.tick(dt, now)
    const posts = crew.postList
    const poses = crew.poses()
    for (const p of poses) {
      const c = cellAt(g, p.x, p.z)
      expect(c, `${p.id} off grid`).toBeGreaterThanOrEqual(0)
      if (!(g.mask[c] & WALK)) {
        const ok = posts.some((q) => toSegment(p.x, p.z, cellX(g, q.approach), cellZ(g, q.approach), q.x, q.z) < 1e-3)
        expect(ok, `${p.id} stands inside kit at ${p.x.toFixed(2)},${p.z.toFixed(2)}`).toBe(true)
        last.delete(p.id)
        continue
      }
      const prev = last.get(p.id)
      if (prev != null && prev !== c) expect(moveOpen(g, prev, c, WALK), `${p.id} ${prev}->${c}`).toBe(true)
      last.set(p.id, c)
    }
    onTick?.(now, poses)
  }
}

function standingAt(poses: CrewPose[], post: CrewPost): number {
  return poses.filter((p) => p.phase === 'post' && Math.hypot(p.x - post.x, p.z - post.z) < 1e-3).length
}

describe('crew posts', () => {
  it('puts agents behind desks and screeners in lanes, off every queue line', () => {
    const { nav, crew } = crewOn(sample())
    const g = nav.nav
    const posts = crew.postList
    const busy = new Set<number>()
    for (const f of nav.facilities.list) for (const c of f.line) busy.add(c)
    // Two desks, two lanes (two screeners each), one boarding desk.
    expect(posts.filter((p) => p.role === 'agent')).toHaveLength(2)
    expect(posts.filter((p) => p.role === 'screener')).toHaveLength(4)
    expect(posts.filter((p) => p.role === 'gate')).toHaveLength(1)
    for (const p of posts) {
      const eq = g.layout.equipment.find((e) => e.id === p.facility)!
      const stand = cellAt(g, p.x, p.z)
      // They stand on their own kit's tile.
      expect(cellsOfTile(g, eq)).toContain(stand)
      expect(busy.has(p.approach)).toBe(false)
      expect(g.mask[p.approach] & WALK).toBeTruthy()
      if (p.role === 'screener') {
        expect(g.mask[stand] & LANE).toBeTruthy()
        expect(busy.has(stand)).toBe(false)
      } else {
        // One step from the floor onto the desk tile's edge.
        expect([1, -1, g.gw, -g.gw]).toContain(stand - p.approach)
      }
    }
    // The hall opens staffed: everyone starts at their post.
    expect(crew.count).toBe(posts.length)
    const poses = crew.poses()
    for (const p of posts) expect(standingAt(poses, p)).toBe(1)
  })
})

describe('crew routes', () => {
  it('a relief walks in before the one on duty walks out, and nobody crosses a wall', () => {
    const { nav, crew } = crewOn(sample(), 300)
    const posts = crew.postList
    const firstIds = new Set(crew.poses().map((p) => p.id))
    let unstaffedTicks = 0
    let maxCrew = 0
    runChecked(nav, crew, 0, 1500, 0.5, (_now, poses) => {
      maxCrew = Math.max(maxCrew, poses.length)
      for (const p of posts) {
        // A post is never left empty: the one on duty stays until the relief arrives.
        if (standingAt(poses, p) === 0 && !poses.some((q) => q.post === p.id && (q.phase === 'unstep' || q.phase === 'step'))) unstaffedTicks++
      }
    })
    expect(unstaffedTicks).toBe(0)
    // Shifts changed: new faces walked in (more crew than posts for a while), and the first shift has gone home.
    expect(maxCrew).toBeGreaterThan(posts.length)
    const ids = new Set(crew.poses().map((p) => p.id))
    expect([...firstIds].some((id) => ids.has(id))).toBe(false)
    expect(crew.count).toBe(posts.length)
  })

  it('removing kit walks its crew out; new kit gets crew who walk in from the curb', () => {
    const { nav, crew } = crewOn(sample(), 1e9)
    runChecked(nav, crew, 0, 5, 0.5)
    let l = edit(nav.layout, (x) => removeEquipment(x, 'lane2'))
    l = edit(l, (x) => placeEquipment(x, { id: 'desk3', kind: 'checkin_desk', x: 4, y: 4 }))
    nav.setLayout(l)
    crew.setGrid(nav.nav, nav.facilities)
    const posts = crew.postList
    expect(posts.some((p) => p.facility === 'lane2')).toBe(false)
    const desk3 = posts.find((p) => p.facility === 'desk3')!
    expect(desk3).toBeTruthy()
    // The new agent starts on the curb pavement, not at the desk.
    expect(standingAt(crew.poses(), desk3)).toBe(0)
    runChecked(nav, crew, 5, 400, 0.5)
    const poses = crew.poses()
    expect(standingAt(poses, desk3)).toBe(1)
    // Lane 2's screeners have left; everyone left is on a post.
    expect(crew.count).toBe(posts.length)
    for (const p of posts) expect(standingAt(poses, p)).toBe(1)
  })

  it('cleaners loop the toilet blocks in a prefab hall', () => {
    const layout = prefabNavLayout(schemeZones(2), schemeItems(2))
    const { nav, crew } = crewOn(layout, 1e9)
    const toilets = nav.facilities.list.filter((f) => f.kind === 'toilet')
    expect(toilets.length).toBeGreaterThan(0)
    expect(crew.cleanerCount).toBeGreaterThan(0)
    const stops = new Set<string>()
    runChecked(nav, crew, 0, 3000, 0.5, (_n, poses) => {
      for (const p of poses) if (p.role === 'cleaner' && p.phase === 'dwell') stops.add(`${p.x.toFixed(1)},${p.z.toFixed(1)}`)
    })
    // Every block gets a visit, and only toilet blocks do.
    expect(stops.size).toBe(toilets.length)
  })

  it('is deterministic', () => {
    const run = () => {
      const { crew } = crewOn(sample(), 200)
      for (let t = 0; t < 900; t += 0.5) crew.tick(0.5, t)
      return JSON.stringify(crew.poses())
    }
    expect(run()).toBe(run())
  })
})
