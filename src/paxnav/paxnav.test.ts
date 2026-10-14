import { describe, expect, it } from 'vitest'
import {
  applyEdits,
  blankLayout,
  encloseFloor,
  isFloor,
  paintZone,
  placeDoor,
  placeEquipment,
  placeFloor,
  placeRoom,
  placeWall,
  removeEquipment,
  type BuildLayout,
  type EquipKind,
} from '../terminalbuild/index.ts'
import { sampleTerminal, type Edit } from '../terminalbuild/sample.ts'
import {
  AIR,
  CURB,
  LANE,
  PAXNAV_TUNING,
  PRE,
  PaxNav,
  cellAt,
  cellsOfTile,
  moveOpen,
  tileOfCell,
  type PaxEvent,
} from './index.ts'

function build(l: BuildLayout, edits: Edit[]): BuildLayout {
  const res = applyEdits(l, edits)
  if (res.error) throw new Error(res.error)
  return res.layout
}

function sample(): BuildLayout {
  const res = sampleTerminal()
  if (res.error) throw new Error(res.error)
  return res.layout
}

/**
 * 96 m x 52 m terminal: four gates with seats and jet bridges, a shop and
 * toilets after security, eight security lanes, ten check-in desks, four curb doors.
 */
function bigTerminal(): BuildLayout {
  const W = 24
  const edits: Edit[] = [
    (l) => placeFloor(l, { x: 0, y: 0, w: W, h: 13 }),
    (l) => paintZone(l, { x: 0, y: 0, w: W, h: 2 }, 'gates'),
    (l) => paintZone(l, { x: 0, y: 2, w: W, h: 3 }, 'airside'),
    (l) => paintZone(l, { x: 0, y: 2, w: 4, h: 2 }, 'retail'),
    (l) => paintZone(l, { x: 0, y: 5, w: W, h: 1 }, 'security'),
    (l) => paintZone(l, { x: 0, y: 6, w: W, h: 3 }, 'landside'),
    (l) => paintZone(l, { x: 0, y: 9, w: W, h: 4 }, 'checkin'),
  ]
  const lanes = [1, 4, 7, 10, 13, 16, 19, 22]
  for (let x = 0; x < W; x++) if (!lanes.includes(x)) edits.push((l) => placeWall(l, { x, y: 4, dir: 'S' }))
  for (const x of [3, 8, 15, 20]) edits.push((l) => placeDoor(l, { x, y: 12, dir: 'S', kind: 'curb' }))
  for (let g = 0; g < 4; g++) {
    const x = g * 6
    edits.push((l) => placeDoor(l, { x: x + 2, y: -1, dir: 'S', kind: 'apron' }))
  }
  edits.push(encloseFloor)
  for (let g = 0; g < 4; g++) {
    const x = g * 6
    edits.push(
      (l) => placeRoom(l, { id: `g${g + 1}`, kind: 'gate', x, y: 0, w: 6, h: 2 }),
      (l) => placeEquipment(l, { id: `gd${g + 1}`, kind: 'gate_desk', x: x + 3, y: 1 }),
      (l) => placeEquipment(l, { id: `seatA${g + 1}`, kind: 'seat', x: x + 1, y: 0 }),
      (l) => placeEquipment(l, { id: `seatB${g + 1}`, kind: 'seat', x: x + 4, y: 0 }),
    )
  }
  edits.push(
    (l) => placeRoom(l, { id: 'shop', kind: 'retail', x: 0, y: 2, w: 4, h: 2 }),
    (l) => placeEquipment(l, { id: 'shop1', kind: 'shop_counter', x: 1, y: 2 }),
    (l) => placeRoom(l, { id: 'wc', kind: 'toilets', x: 20, y: 2, w: 4, h: 2 }),
    (l) => placeEquipment(l, { id: 'wc1', kind: 'toilet', x: 22, y: 2 }),
    (l) => placeRoom(l, { id: 'sec', kind: 'security', x: 0, y: 5, w: W, h: 1 }),
    (l) => placeRoom(l, { id: 'ci', kind: 'checkin', x: 0, y: 9, w: W, h: 4 }),
  )
  lanes.forEach((x, i) => edits.push((l) => placeEquipment(l, { id: `lane${i + 1}`, kind: 'security_lane', x, y: 5 })))
  for (let i = 0; i < 10; i++) {
    edits.push((l) => placeEquipment(l, { id: `desk${i + 1}`, kind: 'checkin_desk', x: 2 + i * 2, y: 9 }))
  }
  return build(blankLayout(W, 13), edits)
}

interface Track {
  cell: number
  airside: boolean
  kinds: EquipKind[]
}

/**
 * Tick with every invariant checked: on the floor, inside the grid, on a
 * walkable cell of the right side of security, and only ever stepping to a
 * neighbour cell through an open edge.
 */
function runChecked(nav: PaxNav, from: number, to: number, dt: number, tracks = new Map<string, Track>()) {
  const events: PaxEvent[] = []
  const kindOf = new Map(nav.metrics().map((m) => [m.id, m.kind]))
  for (let t = from; t < to; t += dt) {
    nav.tick(dt, t)
    events.push(...nav.drainEvents())
    const g = nav.nav
    const b = nav.bounds()
    // Plain checks, not expect(): this runs millions of times.
    const fail = (why: string) => {
      throw new Error(`t=${t}: ${why}`)
    }
    for (const p of nav.poses()) {
      if (p.y !== 0) fail(`${p.id} is off the floor`)
      if (!(p.x >= b.minX && p.x < b.maxX && p.z >= b.minZ && p.z < b.maxZ)) fail(`${p.id} left the grid`)
      const c = cellAt(g, p.x, p.z)
      // Before security only on before-security floor; after only on after-security floor.
      if (!(g.mask[c] & (p.airside ? AIR : PRE))) fail(`${p.id} on unwalkable cell ${c} (${p.x}, ${p.z})`)
      const tr = tracks.get(p.id)
      if (tr && tr.cell !== c && !moveOpen(g, tr.cell, c, PRE | AIR)) fail(`${p.id} stepped ${tr.cell} -> ${c} through a wall`)
      if (tr && tr.airside && !p.airside) fail(`${p.id} went back through security`)
      // Only a security lane lets you through.
      if (tr && !tr.airside && p.airside && !(g.mask[c] & LANE)) fail(`${p.id} got airside off a lane`)
      const kind = p.facility ? kindOf.get(p.facility) : undefined
      const kinds = tr?.kinds ?? []
      if (kind && kinds[kinds.length - 1] !== kind) kinds.push(kind)
      tracks.set(p.id, { cell: c, airside: p.airside, kinds })
    }
  }
  return { events, tracks }
}

describe('nav grid', () => {
  it('blocks walls, desks and belts, and keeps the security line', () => {
    const l = sample()
    const nav = new PaxNav(l)
    const g = nav.nav
    // Check-in desk tile and bag belt tile: nobody stands there.
    for (const c of cellsOfTile(g, { x: 5, y: 4 })) expect(g.mask[c]).toBe(0)
    for (const c of cellsOfTile(g, { x: 6, y: 4 })) expect(g.mask[c]).toBe(0)
    // Bag hall is staff only.
    for (const c of cellsOfTile(g, { x: 7, y: 2 })) expect(g.mask[c]).toBe(0)
    // Hall before security is PRE only, hall after is AIR only, lanes join them.
    for (const c of cellsOfTile(g, { x: 0, y: 3 })) expect(g.mask[c]).toBe(PRE)
    for (const c of cellsOfTile(g, { x: 0, y: 1 })) expect(g.mask[c]).toBe(AIR)
    for (const c of cellsOfTile(g, { x: 1, y: 2 })) expect(g.mask[c] & LANE).not.toBe(0)
    // Wall on the south edge of (0,1): no cell crosses it.
    const top = cellsOfTile(g, { x: 0, y: 1 })
    for (let i = 0; i < g.k; i++) {
      const a = top[(g.k - 1) * g.k + i]
      expect(moveOpen(g, a, a + g.gw, PRE | AIR)).toBe(false)
    }
    // Bare plot outside the walls is not walkable, except the curb pavement.
    for (let c = 0; c < g.mask.length; c++) {
      const t = tileOfCell(g, c)
      if (!isFloor(l, t.x, t.y) && g.mask[c]) expect(g.mask[c] & CURB).not.toBe(0)
    }
  })

  it('opens a door only across its span', () => {
    const l = sample()
    const g = new PaxNav(l).nav
    // Curb door on the south edge of (1,5).
    const inside = cellsOfTile(g, { x: 1, y: 5 })
    const open: number[] = []
    for (let i = 0; i < g.k; i++) {
      const a = inside[(g.k - 1) * g.k + i]
      if (moveOpen(g, a, a + g.gw, PRE)) open.push(i)
    }
    expect(open.length).toBe(PAXNAV_TUNING.doorCells)
  })

  it('a belt laid across the hall is a wall to passengers', () => {
    const l = build(sample(), [(x) => placeEquipment(x, { id: 'beltX', kind: 'bag_belt', x: 2, y: 3 })])
    const g = new PaxNav(l).nav
    for (const c of cellsOfTile(g, { x: 2, y: 3 })) expect(g.mask[c]).toBe(0)
  })
})

describe('spawning', () => {
  it('appears on the curb pavement, on the ground, inside the grid', () => {
    const l = sample()
    const nav = new PaxNav(l, { seed: 9 })
    for (let i = 0; i < 300; i++) expect(nav.spawn({ id: `p${i}`, gate: 'g1', departAt: 7200 })).toBe(true)
    const g = nav.nav
    const b = nav.bounds()
    for (const p of nav.poses()) {
      expect(p.y).toBe(0)
      expect(p.x).toBeGreaterThanOrEqual(b.minX)
      expect(p.x).toBeLessThan(b.maxX)
      expect(p.z).toBeGreaterThanOrEqual(b.minZ)
      expect(p.z).toBeLessThan(b.maxZ)
      const c = cellAt(g, p.x, p.z)
      expect(g.mask[c] & CURB).not.toBe(0)
      const t = tileOfCell(g, c)
      // Outside the building, right in front of one of the two curb doors.
      expect(isFloor(l, t.x, t.y)).toBe(false)
      expect([1, 2]).toContain(t.x)
      expect(t.y).toBe(6)
      expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true)
    }
  })

  it('spawns nobody when the terminal has no curb door', () => {
    const l = build(blankLayout(4, 4), [
      (x) => placeFloor(x, { x: 0, y: 0, w: 4, h: 4 }),
      (x) => paintZone(x, { x: 0, y: 0, w: 4, h: 4 }, 'landside'),
      encloseFloor,
    ])
    const nav = new PaxNav(l)
    expect(nav.spawn({ id: 'a', gate: 'g', departAt: 3600 })).toBe(false)
    expect(nav.count).toBe(0)
  })

  it('refuses duplicate ids', () => {
    const nav = new PaxNav(sample())
    expect(nav.spawn({ id: 'a', gate: 'g1', departAt: 3600 })).toBe(true)
    expect(nav.spawn({ id: 'a', gate: 'g1', departAt: 3600 })).toBe(false)
  })
})

describe('pathing', () => {
  it('walks curb -> check-in -> security -> needs -> gate seats -> boarding, never through a wall', () => {
    const l = bigTerminal()
    const nav = new PaxNav(l, { seed: 4 })
    const gates = ['g1', 'g2', 'g3', 'g4']
    // Long enough before boarding that nobody has to skip the toilet or food stop.
    const departAt = 2400 + PAXNAV_TUNING.boardLeadSec
    for (let i = 0; i < 48; i++) {
      nav.spawn({
        id: `p${i}`,
        gate: gates[i % 4],
        departAt,
        bags: i % 3 !== 0,
        // One toilet block: 12 users x 90 s fits comfortably before boarding.
        needs: i % 4 === 1 ? ['toilet', 'food'] : [],
      })
    }
    const { events, tracks } = runChecked(nav, 0, departAt, 0.25)
    const boarded = events.filter((e) => e.kind === 'boarded').map((e) => e.id)
    expect(boarded.length).toBe(48)
    expect(events.filter((e) => e.kind !== 'boarded')).toEqual([])
    for (let i = 0; i < 48; i++) {
      const want: EquipKind[] = [
        ...(i % 3 !== 0 ? (['checkin_desk'] as const) : []),
        'security_lane',
        ...(i % 4 === 1 ? (['toilet', 'shop_counter'] as const) : []),
        'gate_desk',
      ]
      expect(tracks.get(`p${i}`)!.kinds, `p${i}`).toEqual(want)
    }
    // Everyone was served at their own gate's desk.
    const served = new Map(nav.metrics().map((m) => [m.id, m.served]))
    for (const gd of ['gd1', 'gd2', 'gd3', 'gd4']) expect(served.get(gd)).toBe(12)
  })

  it('waits at the gate seats until boarding opens', () => {
    const nav = new PaxNav(bigTerminal(), { seed: 2 })
    const departAt = 4000
    nav.spawn({ id: 'a', gate: 'g3', departAt, bags: false, needs: [] })
    runChecked(nav, 0, 600, 0.25)
    const p = nav.poses()[0]
    expect(p.phase).toBe('seated')
    expect(p.airside).toBe(true)
    // In gate room g3 (x 12..18 tiles), beside a seat row.
    const t = tileOfCell(nav.nav, cellAt(nav.nav, p.x, p.z))
    expect(t.x).toBeGreaterThanOrEqual(12)
    expect(t.x).toBeLessThan(18)
    expect(t.y).toBeLessThan(2)
    const { events } = runChecked(nav, 600, departAt, 0.5)
    const boarded = events.find((e) => e.kind === 'boarded')!
    expect(boarded.at).toBeGreaterThanOrEqual(departAt - PAXNAV_TUNING.boardLeadSec)
  })

  it('misses the flight when the gate closes first, and says so', () => {
    const nav = new PaxNav(sample(), { seed: 1 })
    nav.spawn({ id: 'late', gate: 'g1', departAt: PAXNAV_TUNING.gateCloseSec + 20, bags: true, needs: [] })
    const { events } = runChecked(nav, 0, 120, 0.25)
    expect(events.map((e) => e.kind)).toEqual(['missed'])
    expect(nav.count).toBe(0)
  })

  it('is deterministic for a seed', () => {
    const run = () => {
      const nav = new PaxNav(bigTerminal(), { seed: 7 })
      for (let i = 0; i < 30; i++) nav.spawn({ id: `p${i}`, gate: 'g2', departAt: 3000 })
      for (let t = 0; t < 600; t += 0.5) nav.tick(0.5, t)
      return nav.poses().map((p) => [p.id, p.x.toFixed(3), p.z.toFixed(3), p.phase])
    }
    expect(run()).toEqual(run())
  })
})

describe('re-path on layout edits', () => {
  it('a new wall cuts a route: passengers re-plan and never cross it', () => {
    const l = sample()
    const nav = new PaxNav(l, { seed: 5 })
    for (let i = 0; i < 24; i++) nav.spawn({ id: `p${i}`, gate: 'g1', departAt: 4000, bags: false, needs: [] })
    const tracks = new Map<string, Track>()
    runChecked(nav, 0, 6, 0.25, tracks)
    expect(nav.poses().some((p) => p.facility === 'lane2')).toBe(true)
    const lane2Before = nav.metricsFor('lane2')!.served

    // Split the before-security side down the middle: the curb doors (x1, x2) keep only lane1.
    const cut = build(l, [2, 3, 4, 5].map((y) => (x: BuildLayout) => placeWall(x, { x: 2, y, dir: 'E' })))
    const rev = nav.revision
    nav.setLayout(cut)
    expect(nav.revision).toBe(rev + 1)
    const g = nav.nav
    // West of the new wall (where the curb is), nobody still heads for lane2.
    for (const p of nav.poses()) {
      if (p.airside || p.facility !== 'lane2') continue
      expect(tileOfCell(g, cellAt(g, p.x, p.z)).x).toBeGreaterThanOrEqual(3)
    }
    const fromCurb = nav.poses().filter((p) => !p.airside && tileOfCell(g, cellAt(g, p.x, p.z)).x <= 2)
    expect(fromCurb.length).toBeGreaterThan(0)
    for (const p of fromCurb) expect(p.facility).not.toBe('lane2')
    const { events } = runChecked(nav, 6, 4000, 0.25, tracks)
    expect(events.filter((e) => e.kind === 'boarded').length).toBe(24)
    expect(nav.metricsFor('lane2')!.served).toBeLessThanOrEqual(lane2Before + 1)
    // The new wall really is closed on the grid.
    const west = cellsOfTile(g, { x: 2, y: 3 })
    for (let i = 0; i < g.k; i++) {
      const a = west[i * g.k + g.k - 1]
      expect(moveOpen(g, a, a + 1, PRE | AIR)).toBe(false)
    }
  })

  it('removing a lane mid-queue sends its line to the other lane', () => {
    const l = sample()
    const nav = new PaxNav(l, { seed: 6 })
    for (let i = 0; i < 16; i++) nav.spawn({ id: `p${i}`, gate: 'g1', departAt: 4000, bags: false, needs: [] })
    const tracks = new Map<string, Track>()
    runChecked(nav, 0, 40, 0.25, tracks)
    expect(nav.metricsFor('lane1')!.queueLength).toBeGreaterThan(0)
    const res = removeEquipment(l, 'lane1')
    nav.setLayout(res.layout)
    expect(nav.metricsFor('lane1')).toBeUndefined()
    for (const p of nav.poses()) expect(p.facility).not.toBe('lane1')
    // Positions may snap off the removed lane tile once; reset tracking and carry on.
    const { events } = runChecked(nav, 40, 4000, 0.25)
    expect(events.filter((e) => e.kind === 'boarded').length).toBe(16)
  })

  it('a passenger with no way through security is stuck until the player opens one', () => {
    const l = sample()
    const blocked = build(l, [(x) => removeEquipment(x, 'lane1'), (x) => removeEquipment(x, 'lane2')])
    const nav = new PaxNav(blocked, { seed: 3 })
    nav.spawn({ id: 'a', gate: 'g1', departAt: 4000, bags: false, needs: [] })
    const first = runChecked(nav, 0, 30, 0.25)
    expect(first.events.map((e) => e.kind)).toEqual(['stuck'])
    expect(nav.poses()[0].phase).toBe('stuck')
    nav.setLayout(build(blocked, [(x) => placeEquipment(x, { id: 'lane9', kind: 'security_lane', x: 3, y: 2 })]))
    const { events } = runChecked(nav, 30, 4000, 0.25)
    expect(events.map((e) => e.kind)).toEqual(['boarded'])
  })
})

describe('queues', () => {
  it('forms a visible, evenly spaced line and reports length and waits', () => {
    const l = build(sample(), [(x) => removeEquipment(x, 'desk2')])
    const nav = new PaxNav(l, { seed: 8 })
    const desk = nav.metricsFor('desk1')!
    expect(desk.line.length).toBeGreaterThan(5)
    for (let i = 0; i < 10; i++) nav.spawn({ id: `p${i}`, gate: 'g1', departAt: 7200, bags: true, needs: [] })
    runChecked(nav, 0, 60, 0.25)
    const m = nav.metricsFor('desk1')!
    expect(m.serving).toBe(true)
    expect(m.queueLength).toBe(9)
    expect(m.incoming).toBe(0)
    const svc = 75
    expect(m.estWaitSec).toBeGreaterThan(9 * svc)
    expect(m.estWaitSec).toBeLessThanOrEqual(10 * svc)
    expect(m.longestWaitSec).toBeGreaterThan(0)

    // Everyone stands on the marked line at their place x spacing from the desk.
    const head = m.line[0]
    const queued = nav.poses().filter((p) => p.facility === 'desk1')
    expect(queued.length).toBe(10)
    for (const p of queued) {
      const along = Math.abs(p.x - head.x) + Math.abs(p.z - head.z)
      expect(along).toBeCloseTo(p.place * PAXNAV_TUNING.queueSpacingM, 1)
    }
    const places = queued.map((p) => p.place).sort((a, b) => a - b)
    expect(places).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

    runChecked(nav, 60, 60 + 3 * svc, 0.25)
    const later = nav.metricsFor('desk1')!
    expect(later.served).toBeGreaterThanOrEqual(2)
    expect(later.queueLength).toBeLessThan(9)
    expect(later.avgWaitSec).toBeGreaterThan(0)
  })

  it('queue lines never cross walls or each other', () => {
    const nav = new PaxNav(bigTerminal())
    const g = nav.nav
    const seen = new Set<number>()
    for (const m of nav.metrics()) {
      const cells = m.line.map((p) => cellAt(g, p.x, p.z))
      for (let i = 1; i < cells.length; i++) expect(moveOpen(g, cells[i], cells[i - 1], PRE | AIR)).toBe(true)
      for (const c of cells) {
        expect(seen.has(c)).toBe(false)
        seen.add(c)
      }
    }
    // Every queued kit item in the big terminal got a service point.
    expect(nav.metrics().length).toBe(4 + 1 + 1 + 8 + 10)
  })

  it('spreads passengers over equal desks by expected wait', () => {
    const nav = new PaxNav(sample(), { seed: 10 })
    for (let i = 0; i < 20; i++) nav.spawn({ id: `p${i}`, gate: 'g1', departAt: 7200, bags: true, needs: [] })
    const a = nav.metricsFor('desk1')!.incoming
    const b = nav.metricsFor('desk2')!.incoming
    expect(a + b).toBe(20)
    expect(Math.abs(a - b)).toBeLessThanOrEqual(2)
  })
})

describe('scale', () => {
  it('moves 1200 passengers well inside a 20 fps frame', () => {
    const nav = new PaxNav(bigTerminal(), { seed: 11 })
    const gates = ['g1', 'g2', 'g3', 'g4']
    for (let i = 0; i < 1200; i++) nav.spawn({ id: `p${i}`, gate: gates[i % 4], departAt: 4 * 3600 })
    const dt = 1 / 20
    let t = 0
    for (let i = 0; i < 40; i++, t += dt) nav.tick(dt, t)
    const buf = new Float32Array(1200 * 4)
    const frames = 200
    const start = performance.now()
    for (let i = 0; i < frames; i++, t += dt) {
      nav.tick(dt, t)
      nav.writePoses(buf)
    }
    const ms = (performance.now() - start) / frames
    expect(nav.count).toBeGreaterThanOrEqual(1000)
    // 50 ms is the whole frame at 20 fps; the walk layer gets a small slice of it.
    expect(ms).toBeLessThan(5)
    // Fast-forward (big dt) stays sane too.
    for (let i = 0; i < 200; i++, t += 2) nav.tick(2, t)
    for (const p of nav.poses()) expect(p.y).toBe(0)
  })
})
