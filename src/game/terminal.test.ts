import { describe, expect, it } from 'vitest'
import { hallPath, openNodesFromRooms, type HallNode } from './guests.ts'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'
import {
  ITEMS,
  JUNCTION_CAP,
  itemDef,
  lookaheadDepth,
  DEPARTURE_SPREAD_SEC,
  OVER_CAP_MAX,
  paxPerMin,
  pathClearsSecurity,
  PREFAB_TIERS,
  PREFAB_WEAR_PER_PAX,
  slowedService,
  stepLane,
  overCapMultiplier,
  unclearedReachesGate,
  UNSTAFFED_LANE,
} from './terminal.ts'

function furnished(): Set<HallNode> {
  return openNodesFromRooms({
    checkin: 1,
    security: 1,
    gate: 1,
    bagclaim: 1,
    food: 1,
    souvenir: 1,
    bagdrop: 1,
    lounge: 1,
    bathroom: 1,
  })
}

describe('queue throughput', () => {
  it('one scanner at 3s is 20 passengers a minute', () => {
    expect(paxPerMin(1, 3)).toBeCloseTo(20)
    expect(paxPerMin(2, 2)).toBeCloseTo(60)
    expect(paxPerMin(3, 1.4)).toBeCloseTo(128.57, 1)
  })

  it('a lane finishes one server at a time and turns away the overflow', () => {
    const q = { waiting: [] as string[], serving: [] as { id: string; left: number }[] }
    const lane = { servers: 1, serviceSec: 3, queueCap: 2 }
    const first = stepLane(q, 0, lane, ['a', 'b', 'c', 'd'])
    expect(first.turnedAway).toEqual(['d'])
    expect(q.serving.map((s) => s.id)).toEqual(['a'])
    expect(q.waiting).toEqual(['b', 'c'])

    const done = stepLane(q, 3, lane, [])
    expect(done.finished).toEqual(['a'])
    expect(q.serving[0]?.id).toBe('b')
    expect(q.waiting).toEqual(['c'])
  })

  it('sixty seconds of one lane clears nineteen and is serving the next', () => {
    const q = { waiting: [] as string[], serving: [] as { id: string; left: number }[] }
    const lane = { servers: 1, serviceSec: 3, queueCap: 30 }
    let finished = 0
    let n = 0
    for (let t = 0; t < 60; t += 0.5) {
      const arrivals: string[] = []
      if (n < 40) arrivals.push(`p${n++}`)
      finished += stepLane(q, 0.5, lane, arrivals).finished.length
    }
    // First guest starts at the end of the opening tick, so 60s of steps
    // finishes 19 and leaves the 20th at the scanner. Rate is still 20/min.
    expect(finished).toBe(19)
    expect(q.serving).toHaveLength(1)
  })

  it('wear stretches the service time, and a worn-out lane tops out at one and a half', () => {
    expect(slowedService(3, 0)).toBe(3)
    expect(slowedService(3.5, 100)).toBeCloseTo(5.25)
    expect(slowedService(3, 100)).toBeCloseTo(4.5)
  })

  it('Prefab I clears an opening bank, and later tiers stay ahead of it', () => {
    expect(PREFAB_TIERS[1].servers).toBe(2)
    expect(PREFAB_TIERS[1].serviceSec).toBe(3.2)
    expect(PREFAB_TIERS[1].paxCap).toBe(46)
    expect(PREFAB_TIERS[1].queueCap).toBe(16)
    expect(paxPerMin(PREFAB_TIERS[1].servers, PREFAB_TIERS[1].serviceSec)).toBeCloseTo(37.5, 1)
    expect(PREFAB_TIERS[2].paxCap).toBeGreaterThan(PREFAB_TIERS[1].paxCap)
    expect(PREFAB_TIERS[2].queueCap).toBeGreaterThan(PREFAB_TIERS[1].queueCap)
    expect(PREFAB_TIERS[2].bagAllowance).toBeGreaterThan(PREFAB_TIERS[1].bagAllowance)
    expect(PREFAB_TIERS[2].servers).toBe(3)
    expect(PREFAB_TIERS[2].serviceSec).toBe(3)
    expect(paxPerMin(PREFAB_TIERS[2].servers, PREFAB_TIERS[2].serviceSec)).toBeCloseTo(60)
    expect(PREFAB_TIERS[3].servers).toBe(4)
    expect(PREFAB_TIERS[3].serviceSec).toBe(2.5)
    expect(paxPerMin(PREFAB_TIERS[3].servers, PREFAB_TIERS[3].serviceSec)).toBeCloseTo(96)
    expect(overCapMultiplier(40, 40)).toBe(1)
    expect(overCapMultiplier(50, 40)).toBeCloseTo(1.2)
    expect(overCapMultiplier(200, 40)).toBe(OVER_CAP_MAX)
    expect(PREFAB_WEAR_PER_PAX).toBe(0.7)
    expect(UNSTAFFED_LANE).toBe(1.35)
    expect(DEPARTURE_SPREAD_SEC).toBe(45)
  })

  it('a bigger lane is faster and costs more to run', () => {
    const small = itemDef('security_small')!
    const medium = itemDef('security_medium')!
    const large = itemDef('security_large')!
    expect(paxPerMin(medium.servers, medium.serviceSec)).toBeGreaterThan(
      paxPerMin(small.servers, small.serviceSec),
    )
    expect(medium.upkeep).toBeGreaterThan(small.upkeep)
    expect(medium.cost).toBeGreaterThan(small.cost)
    expect(large.upkeep).toBeGreaterThan(medium.upkeep)
    expect(medium.minFieldLevel).toBe(2)
    expect(large.minFieldLevel).toBe(3)
    const cafe = itemDef('cafe')!
    const restaurant = itemDef('restaurant')!
    expect(restaurant.upkeep).toBeGreaterThan(cafe.upkeep)
    expect(restaurant.serviceSec).toBeGreaterThan(cafe.serviceSec)
    expect(ITEMS.every((i) => i.cost > 0)).toBe(true)
  })
})

describe('security choke', () => {
  it('a furnished hall reaches the gate only by passing security', () => {
    const open = furnished()
    expect(unclearedReachesGate(open, lookaheadDepth(1))).toBe(true)
    const locked = new Set(open)
    locked.delete('security')
    expect(unclearedReachesGate(locked, 12)).toBe(false)
    expect(pathClearsSecurity(null, 'gate')).toBe(false)
  })

  it('the junction cap loses a long walk until a sign extends it', () => {
    const open = furnished()
    open.add('lab_desk')
    open.add('lab_board')
    open.add('lab_bench')
    open.add('pool')
    open.delete('info')
    expect(hallPath('lab_bench', 'pool', open, JUNCTION_CAP)).toBeNull()
    const withSign = hallPath('lab_bench', 'pool', open, lookaheadDepth(1))
    expect(withSign).not.toBeNull()
    expect(lookaheadDepth(0)).toBe(5)
    expect(lookaheadDepth(1)).toBe(7)
  })

  it('starter prefab has ceilings, and the upgrade raises them and the upkeep', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    expect(game.buyLand('city')).toBe(true)
    game.buildStarterKit()
    const fit = game.fits[0]
    expect(fit.premade).toBe(true)
    expect(fit.tier).toBe(1)
    expect(fit.capGuests).toBe(46)
    expect(fit.secPerMin).toBeCloseTo(37.5, 1)
    expect(fit.bagAllowance).toBe(88)
    expect(fit.signs).toBe(2)
    expect(fit.zones?.[0]?.length).toBe(8)
    expect(fit.zones?.length).toBe(5)
    const before = game.landsideUpkeep()
    game.cash = 80_000
    game.upgradeHall()
    expect(game.fits[0].tier).toBe(2)
    expect(game.fits[0].capGuests).toBe(48)
    expect(game.fits[0].secPerMin).toBeCloseTo(60)
    expect(game.fits[0].bagAllowance).toBe(140)
    expect(game.fits[0].signs).toBe(3)
    expect(game.fits[0].zones?.[0]?.length).toBe(12)
    expect(game.landsideUpkeep()).toBeGreaterThan(before)
    expect(game.cash).toBe(80_000 - 22_000)
  })

  it('field level 1 cannot buy the medium lane', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    const cash = game.cash
    game.placeHallItem('security_medium')
    expect(game.fits[0].items?.some((i) => i.def === 'security_medium' && !i.bundle)).toBe(false)
    expect(game.cash).toBe(cash)
    expect(game.news[0]?.text ?? '').toMatch(/Field level/i)
  })

  it('a departure wave queues at the prefab lanes and stays off the gate', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.speed = 5
    game.demoHallCrowd(8)
    let sawQueue = false
    for (let i = 0; i < 500 && !sawQueue; i++) {
      game.tick(0.05)
      const serving = game.hallGuests.some(
        (g) => g.node === 'security' && (g.serviceLeft ?? 0) > 0 && !g.clearedSec,
      )
      if (serving && game.securityQueueCount() >= 1) sawQueue = true
    }
    expect(sawQueue).toBe(true)
    expect(game.hallGuests.some((g) => !g.clearedSec && g.node === 'gate')).toBe(false)
  })

  it('drips a prefab departure instead of dropping the bank at once', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.clock = 20
    game.speed = 1
    game.seedHallForFlight(
      { id: 'spread-1', cargo: false, pax: 66, airline: 'northline', stand: null } as Flight,
      'depart',
    )
    const wave = game.hallGuests.filter((g) => g.flightId === 'spread-1')
    expect(wave.length).toBeGreaterThanOrEqual(6)
    const times = wave.map((g) => g.releaseAt ?? game.clock)
    for (const t of times) expect(t).toBeGreaterThanOrEqual(20)
    const span = Math.max(...times) - Math.min(...times)
    expect(span).toBeGreaterThan(1)
    const buckets = new Map<number, number>()
    for (const t of times) {
      const s = Math.floor(t + 1e-6)
      buckets.set(s, (buckets.get(s) ?? 0) + 1)
    }
    for (const n of buckets.values()) expect(n).toBeLessThanOrEqual(3)
    const held = wave.filter((g) => (g.releaseAt ?? 0) > game.clock)
    expect(held.length).toBeGreaterThan(0)
    expect(held.every((g) => g.path.length === 0)).toBe(true)

    game.tick(0.2)
    const still = wave.filter((g) => (g.releaseAt ?? 0) > game.clock)
    expect(still.length).toBeGreaterThan(0)
    expect(still.every((g) => g.path.length === 0)).toBe(true)

    game.clock = Math.max(...times)
    game.tick(0.05)
    expect(wave.every((g) => g.releaseAt == null)).toBe(true)
    expect(wave.some((g) => g.path.length > 1)).toBe(true)
    expect(wave.some((g) => !g.clearedSec && g.node === 'gate')).toBe(false)
  })
})
