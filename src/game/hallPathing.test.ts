/**
 * Terminal passenger pathing end to end in the game: the prefab hall's
 * facilities as a nav grid, the full departure walk, live queues and
 * bottlenecks, waits feeding mood, crew, determinism, save safety and scale.
 */
import { describe, expect, it } from 'vitest'
import type { ShowUpPlan } from '../pax/showup.ts'
import { AIR, LANE, PRE, PAXNAV_TUNING, cellAt, cellsOfTile, moveOpen, type FacilityMetrics, type GuestMood, type NavGrid, type PaxWait } from '../paxnav/index.ts'
import { facilityBlockers, facilitiesFromItems } from '../terminalplay/facilities.ts'
import { spawnHallGuest } from './guests.ts'
import { HallNav, isNavBottleneck, navHallQueues, prefabClaimHall, prefabNavLayout, waitMoodDelta } from './hallNav.ts'
import { HALL_MOOD_LINK, HALL_QUEUE_TUNING } from './hallNavData.ts'
import { PLAY_TUNING } from '../terminalplay/config.ts'
import { HALL_D, HALL_W, schemeItems, schemeZones, type PlacedItem } from './terminal.ts'
import { Game } from './sim.ts'
import { SAVE_KEY } from './types.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

/** The straight walk between two samples, in 5 cm steps, only crosses open cell edges. */
function segmentOpen(g: NavGrid, x0: number, z0: number, x1: number, z1: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05))
  let prev = cellAt(g, x0, z0)
  for (let i = 1; i <= n; i++) {
    const c = cellAt(g, x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n)
    if (c !== prev && !moveOpen(g, prev, c, PRE | AIR)) return false
    prev = c
  }
  return true
}

/** A hall guest with a fixed id (spawnHallGuest rolls a random one). */
function guest(id: string, job: 'depart' | 'arrive', flightId: string, hallId?: string, tag: 'budget' | 'business' = 'budget') {
  const g = spawnHallGuest(flightId, job, tag, { hallId })
  g.id = id
  return g
}

function metric(over: Partial<FacilityMetrics>): FacilityMetrics {
  return {
    id: 'f',
    kind: 'security_lane',
    roomId: null,
    queueLength: 0,
    serving: false,
    incoming: 0,
    avgWaitSec: 0,
    longestWaitSec: 0,
    estWaitSec: 0,
    staffed: true,
    inUse: false,
    serviceSec: 30,
    served: 0,
    leftQueue: 0,
    stock: null,
    line: Array.from({ length: 12 }, (_, i) => ({ x: i, z: 0 })),
    ...over,
  }
}

describe('nav grid from the terminal facilities', () => {
  it('placed walls and belts block their whole hall cell; walkers go round', () => {
    const zones = schemeZones(1)
    // A wall across a gates cell next to the boarding desk.
    const items: PlacedItem[] = [...schemeItems(1), { id: 'w1', def: 'wall', c: 2, r: 4, wear: 0 }]
    const blocked = facilityBlockers(items)
    expect(blocked.has('2,4')).toBe(true)
    expect(facilitiesFromItems(items, 8, 5).find((f) => f.id === 'w1')?.type).toBe('wall')
    const layout = prefabNavLayout(zones, items)
    // Hall cell (2,4) is 6 m x 6.4 m: tiles whose centres fall in it have no floor.
    const wallTiles: { x: number; y: number }[] = []
    for (let y = 0; y < layout.h; y++) {
      for (let x = 0; x < layout.w; x++) {
        const c = Math.floor(((x + 0.5) * 4) / (HALL_W / 8))
        const r = Math.floor(((y + 0.5) * 4) / (HALL_D / 5))
        if (c === 2 && r === 4) wallTiles.push({ x, y })
      }
    }
    expect(wallTiles.length).toBeGreaterThan(0)
    for (const t of wallTiles) {
      expect(layout.floor[t.y][t.x]).toBe(false)
      expect(layout.equipment.some((e) => e.x === t.x && e.y === t.y)).toBe(false)
    }
    const nav = new HallNav()
    nav.setHall('h', '1', () => layout)
    const pn = nav.nav!
    const g = pn.nav
    const solid = new Set(wallTiles.flatMap((t) => cellsOfTile(g, t)))
    for (const c of solid) expect(g.mask[c]).toBe(0)
    const guests = Array.from({ length: 80 }, (_, i) => guest(`w-${i}`, 'depart', 'w'))
    nav.admit(guests, 0, () => 6)
    for (let i = 0; i < 1500 && nav.passengers; i++) {
      nav.tick(0.1)
      for (const p of pn.poses()) expect(solid.has(cellAt(g, p.x, p.z))).toBe(false)
    }
    expect(nav.boarded).toBeGreaterThan(0)
  })
})

describe('queue read-out', () => {
  it('a wait under tolerance is free, a quick one pleases, a long one stings up to a cap', () => {
    const tol = HALL_QUEUE_TUNING.toleranceSec.security_lane!
    expect(waitMoodDelta('security_lane', 0)).toBe(HALL_QUEUE_TUNING.quickMood)
    expect(waitMoodDelta('security_lane', tol)).toBe(0)
    expect(waitMoodDelta('security_lane', tol + 600)).toBeCloseTo(-10 * HALL_QUEUE_TUNING.moodPerMinOver)
    expect(waitMoodDelta('security_lane', tol + 1e6)).toBe(-HALL_QUEUE_TUNING.maxMoodHit)
    // Kit without a tolerance (seats, belts) never moves mood.
    expect(waitMoodDelta('seat', 1e6)).toBe(0)
  })

  it('flags a bottleneck on a long wait or a line spilling past its floor marks', () => {
    const limit = HALL_QUEUE_TUNING.bottleneckSec.security_lane!
    expect(isNavBottleneck(metric({ queueLength: 3, estWaitSec: limit - 1 }))).toBe(false)
    expect(isNavBottleneck(metric({ queueLength: 3, estWaitSec: limit }))).toBe(true)
    // 11 m of line holds 16 people at 0.7 m; the 18th is off the marks.
    const spill = Math.ceil((11 + PAXNAV_TUNING.queueSpacingM) / PAXNAV_TUNING.queueSpacingM) + 1
    expect(isNavBottleneck(metric({ queueLength: spill, estWaitSec: 0 }))).toBe(true)
    expect(isNavBottleneck(metric({ queueLength: 10, estWaitSec: 0 }))).toBe(false)
  })

  it('groups facilities by hall node with counts, worst wait and a badge at the back of the longest line', () => {
    const rows = navHallQueues(
      [
        metric({ id: 'a', kind: 'checkin_desk', queueLength: 2, estWaitSec: 200 }),
        metric({ id: 'b', kind: 'checkin_desk', queueLength: 5, estWaitSec: 450, line: [{ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 2 }, { x: 0, z: 3 }, { x: 0, z: 4 }] }),
        metric({ id: 'c', kind: 'security_lane', queueLength: 0 }),
        metric({ id: 'd', kind: 'toilet', queueLength: 1, estWaitSec: HALL_QUEUE_TUNING.bottleneckSec.toilet! }),
      ],
      10,
      20,
    )
    const ci = rows.find((r) => r.node === 'checkin')!
    expect(ci.count).toBe(7)
    expect(ci.waitSec).toBe(450)
    expect(ci.bottleneck).toBe(false)
    expect(ci.at).toEqual({ x: 10, z: 24 })
    // Empty lines are not shown.
    expect(rows.some((r) => r.node === 'security')).toBe(false)
    expect(rows.find((r) => r.node === 'bathroom')!.bottleneck).toBe(true)
  })
})

describe('500 departing passengers through the starter terminal', () => {
  it('walk curb -> check-in / bag drop -> security -> needs -> gate -> boarding, on the floor, through real queues', () => {
    const game = field()
    game.hallGuests = []
    const hallId = game.hallKey(game.activeHall()!)
    game.tickHallNav(0.01)
    const hn = game.hallNav
    expect(hn.live).toBe(true)
    const nav = hn.nav!
    const g = nav.nav
    const b = nav.bounds()

    // Ten flights of 50. Each flight's passengers show up together, 90 nav
    // minutes before STD (a clock second to STD is 360 nav seconds of lead),
    // and a new flight shows up every 2000 nav seconds: what the starter kit
    // is sized for. Crushes are the next test.
    const N = 500
    const perFlight = 50
    const waveSteps = 4000
    const waits = new Map<string, PaxWait[]>()
    // The sim drains finished waits into mood each tick; watch them on the way.
    const drain = hn.drainWaits.bind(hn)
    hn.drainWaits = () => {
      const out = drain()
      for (const w of out) {
        if (!waits.has(w.id)) waits.set(w.id, [])
        waits.get(w.id)!.push(w)
      }
      return out
    }
    const last = new Map<string, { c: number; airside: boolean; x: number; z: number }>()
    const bad: string[] = []
    let peakQueue = 0
    let peakWalkers = 0
    let released = 0
    for (let step = 0; step < 80000 && (released < N || hn.passengers); step++) {
      if (released < N && step % waveSteps === 0) {
        const f = `f${released / perFlight}`
        game.showUps.push({ slotId: f, flightId: f, std: game.clock + 15 } as ShowUpPlan)
        for (let k = 0; k < perFlight; k++, released++) {
          game.hallGuests.push(guest(`p-${released}`, 'depart', f, hallId, released % 3 ? 'budget' : 'business'))
        }
      }
      game.tickHallNav(0.05)
      peakWalkers = Math.max(peakWalkers, hn.passengers)
      for (const q of hn.queues()) peakQueue = Math.max(peakQueue, q.count)
      // Plain checks per walker per tick (expect() here would be millions of calls); failures collected.
      for (const p of nav.poses()) {
        // On the ground, inside the grid, on floor that layer may stand on.
        if (p.y !== 0) bad.push(`${p.id} airborne`)
        if (p.x < b.minX || p.z < b.minZ || p.x > b.maxX || p.z > b.maxZ) bad.push(`${p.id} out of bounds`)
        // The cell under the body (the walk's own cell snaps ahead when someone joins a line).
        const c = cellAt(g, p.x, p.z)
        if (!(g.mask[c] & (p.airside ? AIR : PRE))) bad.push(`${p.id} on blocked floor`)
        const prev = last.get(p.id)
        if (prev && prev.c !== c) {
          if (!segmentOpen(g, prev.x, prev.z, p.x, p.z)) bad.push(`${p.id} through a wall ${prev.c}->${c} (${p.phase})`)
          // Airside only through a lane, and never back.
          if (!prev.airside && p.airside && !(g.mask[c] & LANE || g.mask[prev.c] & LANE)) bad.push(`${p.id} airside off a lane`)
          if (prev.airside && !p.airside) bad.push(`${p.id} back through security`)
        }
        last.set(p.id, { c, airside: p.airside, x: p.x, z: p.z })
      }
      if (bad.length) break
      // Drop the sim's copies once the walk is done with them, as the sim does after boarding.
      if (step % 50 === 0) {
        const walking = new Set(nav.poses().map((p) => p.id))
        game.hallGuests = game.hallGuests.filter((x) => walking.has(x.id) || !last.has(x.id))
      }
    }
    expect(bad).toEqual([])
    expect(released).toBe(N)
    expect(hn.passengers).toBe(0)
    expect(hn.boarded + hn.missed).toBe(N)
    // The starter hall copes with five flights' worth, with real lines on the way.
    expect(hn.boarded).toBeGreaterThanOrEqual(N * 0.95)
    expect(peakWalkers).toBeGreaterThanOrEqual(perFlight)
    expect(peakQueue).toBeGreaterThan(5)

    // Every boarded passenger queued at security and the boarding desk, in route order.
    const order = ['checkin_desk', 'security_lane', 'toilet', 'shop_counter', 'gate_desk']
    let checkedIn = 0
    for (const [id, list] of waits) {
      const kinds = list.map((w) => w.kind)
      if (kinds.includes('gate_desk')) expect(kinds, id).toContain('security_lane')
      for (let i = 1; i < kinds.length; i++) {
        // Toilet / food / shop come in any order between security and the gate.
        const a = order.indexOf(kinds[i - 1])
        const c = order.indexOf(kinds[i])
        if (a >= 2 && a <= 3 && c >= 2 && c <= 3) continue
        expect(c, `${id}: ${kinds.join(' > ')}`).toBeGreaterThan(a)
      }
      if (kinds[0] === 'checkin_desk') checkedIn++
    }
    expect(waits.size).toBeGreaterThanOrEqual(N * 0.95)
    // Bags go to check-in; roughly the configured share of passengers have them.
    expect(checkedIn / waits.size).toBeGreaterThan(PAXNAV_TUNING.checkinShare - 0.1)
    expect(checkedIn / waits.size).toBeLessThan(PAXNAV_TUNING.checkinShare + 0.1)
  }, 120_000)
})

describe('capacity too low', () => {
  it('a crush on the starter kit shows bottlenecks at check-in and security, and costs flights', () => {
    const game = field()
    game.hallGuests = []
    const hallId = game.hallKey(game.activeHall()!)
    game.showUps.push({ slotId: 'crush', flightId: 'crush', std: game.clock + 12 } as ShowUpPlan)
    for (let i = 0; i < 300; i++) game.hallGuests.push(guest(`c-${i}`, 'depart', 'crush', hallId))
    const hot = new Set<string>()
    let peak = 0
    for (let i = 0; i < 12000 && (i < 10 || game.hallNav.passengers); i++) {
      game.tickHallNav(0.05)
      for (const l of game.hallNav.loads()) if (l.bottleneck) hot.add(l.kind)
      for (const q of game.hallNav.queues()) if (q.bottleneck) peak = Math.max(peak, q.count)
    }
    expect(hot.has('security_lane')).toBe(true)
    expect(hot.has('checkin_desk')).toBe(true)
    expect(peak).toBeGreaterThan(PLAY_TUNING.bottleneckAt)
    // Nobody is capped or culled: the kit simply cannot serve them all in time.
    expect(game.hallNav.boarded + game.hallNav.missed).toBe(300)
    expect(game.hallNav.missed).toBeGreaterThan(0)
  }, 60_000)
})

describe('waits feed satisfaction', () => {
  it('long lines cost the waiting guest happiness; quick ones lift it', () => {
    const game = field()
    game.hallGuests = game.hallGuests.filter((g) => !g.preview)
    const hallId = game.hallKey(game.activeHall()!)
    game.showUps.push({ slotId: 'm', flightId: 'm', std: game.clock + 200 } as ShowUpPlan)
    for (let i = 0; i < 300; i++) {
      const g = guest(`m-${i}`, 'depart', 'm', hallId)
      g.happiness = 70
      game.hallGuests.push(g)
    }
    // Watch the waits the sim is fed (drained inside tickHallNav).
    const seen: PaxWait[] = []
    const drain = game.hallNav.drainWaits.bind(game.hallNav)
    game.hallNav.drainWaits = () => {
      const out = drain()
      seen.push(...out)
      return out
    }
    // Thoughts carry onto the fare too (HALL_MOOD_LINK); waits are weighted 0 there, so the two never double up.
    const moods: GuestMood[] = []
    const drainMood = game.hallNav.drainMood.bind(game.hallNav)
    game.hallNav.drainMood = () => {
      const out = drainMood()
      moods.push(...out)
      return out
    }
    for (let i = 0; i < 1500; i++) game.tickHallNav(0.05)
    const expected = new Map<string, number>()
    for (const w of seen) expected.set(w.id, (expected.get(w.id) ?? 70) + waitMoodDelta(w.kind, w.waitSec))
    for (const m of moods) {
      const weight = HALL_MOOD_LINK.weight[m.key] ?? 0
      if (weight) expected.set(m.id, (expected.get(m.id) ?? 70) + m.delta * weight)
    }
    expect(seen.some((w) => waitMoodDelta(w.kind, w.waitSec) < 0)).toBe(true)
    expect(seen.some((w) => waitMoodDelta(w.kind, w.waitSec) > 0)).toBe(true)
    let hurt = 0
    for (const guest of game.hallGuests) {
      const want = expected.get(guest.id)
      if (want == null) continue
      expect(guest.happiness).toBeCloseTo(Math.max(0, Math.min(100, want)))
      if (guest.happiness < 70) hurt++
    }
    expect(hurt).toBeGreaterThan(0)
  }, 60_000)
})

describe('crew in the hall', () => {
  it('staff the starter hall at open and walk with the passengers', () => {
    const game = field()
    game.tickHallNav(0.01)
    const crew = game.hallNav.crew
    expect(crew.count).toBeGreaterThan(0)
    expect(game.hallNav.count).toBe(game.hallNav.passengers + crew.count)
    const roles = new Set(crew.poses().map((p) => p.role))
    for (const r of ['agent', 'screener', 'gate'] as const) expect(roles.has(r)).toBe(true)
    // Crew draw after passengers, in uniform slots.
    const i = game.hallNav.passengers
    expect(game.hallNav.crewRole(i)).not.toBeNull()
    expect(game.hallNav.isArrival(i)).toBe(false)
    expect(game.hallNav.idAt(i)).toMatch(/^crew:/)
  })
})

describe('deterministic and save-safe', () => {
  function run(): string {
    const zones = schemeZones(1)
    const items = schemeItems(1)
    const nav = new HallNav()
    nav.setHall('h', '1', () => prefabNavLayout(zones, items))
    const guests = Array.from({ length: 200 }, (_, i) => guest(`d-${i}`, 'depart', `f${i % 3}`))
    nav.admit(guests, 0, (f) => 30 + Number(f.slice(1)) * 10)
    for (let i = 0; i < 600; i++) nav.tick(0.05)
    const out = new Float32Array(nav.count * 4)
    nav.writePoses(out)
    return JSON.stringify({ poses: [...out], m: nav.metrics().map((m) => [m.id, m.queueLength, m.served]), crew: nav.crew.poses(), b: nav.boarded })
  }

  it('same inputs, same walk: passengers, queues and crew', () => {
    expect(run()).toBe(run())
  })

  it('the walk is never saved: a reload restarts it from the next released guests', () => {
    const game = field()
    game.tickHallNav(0.01)
    const hallId = game.hallKey(game.activeHall()!)
    for (let i = 0; i < 50; i++) game.hallGuests.push(guest(`s-${i}`, 'depart', 's', hallId))
    for (let i = 0; i < 40; i++) game.tickHallNav(0.05)
    expect(game.hallNav.passengers).toBeGreaterThan(0)
    game.persist()
    const raw = localStorage.getItem(SAVE_KEY)!
    expect(raw).toBeTruthy()
    expect(raw.includes('crew:')).toBe(false)
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    loaded.tickHallNav(0.01)
    expect(loaded.hallNav.live).toBe(true)
    expect(loaded.hallNav.passengers).toBe(loaded.hallGuests.filter((x) => x.job === 'depart' && !x.dead).length)
    const id = loaded.hallKey(loaded.activeHall()!)
    for (let i = 0; i < 20; i++) loaded.hallGuests.push(guest(`r-${i}`, 'depart', 'r', id))
    loaded.tickHallNav(0.05)
    expect(loaded.hallNav.nav!.poses().filter((p) => p.id.startsWith('r-'))).toHaveLength(20)
  })
})

describe('scale', () => {
  it('1,300+ walkers (departures, arrivals and crew) stay inside the frame budget', () => {
    const zones = schemeZones(1)
    const items = schemeItems(1)
    const nav = new HallNav()
    nav.setHall('h', '1', () => prefabNavLayout(zones, items), () => prefabClaimHall(zones, items))
    const guests = [
      ...Array.from({ length: 1100 }, (_, i) => guest(`d-${i}`, 'depart', `f${i % 6}`)),
      ...Array.from({ length: 250 }, (_, i) => guest(`a-${i}`, 'arrive', `f${i % 6}`)),
    ]
    nav.admit(guests, 0, () => 40)
    nav.tick(0.01)
    expect(nav.count).toBeGreaterThanOrEqual(1300)
    const frames = 120
    const t0 = performance.now()
    for (let i = 0; i < frames; i++) nav.tick(1 / 60)
    const per = (performance.now() - t0) / frames
    // 60 fps is 16.7 ms a frame; the walk leaves most of it for drawing.
    expect(per).toBeLessThan(10)
    expect(nav.count).toBeGreaterThanOrEqual(1300)
  })
})
