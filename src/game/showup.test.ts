import { describe, expect, it } from 'vitest'
import { checkInCloseAt } from '../pax/showup.ts'
import type { ShowUpSeat } from '../pax/showup.ts'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'

function withSeed(seed: number, run: () => void) {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    run()
  } finally {
    Math.random = orig
  }
}

function starter(): Game {
  const game = new Game()
  game.sandbox = true
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

function seat(partial: Partial<ShowUpSeat> & Pick<ShowUpSeat, 'segment'>): ShowUpSeat {
  return {
    preferFastTrack: false,
    amenity: 'none',
    leadSimSec: 10,
    spendLounge: 0,
    spendAmenity: 0,
    willLounge: 0,
    willAmenity: 0,
    moodArrive: 0,
    moodFast: 8,
    moodStandard: -1,
    moodLounge: 8,
    moodMiss: -7,
    ...partial,
  }
}

describe('departure show-up', () => {
  it('has passengers in the hall before the inbound lands', () => {
    withSeed(4, () => {
      const game = starter()
      game.offer = { airline: 'northline', age: 0, deadline: 36 }
      game.acceptOffer()
      let sawFlight = false
      let sawEarly = false
      for (let t = 0; t < 180 * 2; t += 0.5) {
        game.tick(0.5)
        const inbound = game.flights.find((f) => f.phase === 'approach' || f.phase === 'landing')
        if (!inbound) continue
        sawFlight = true
        const present = game.hallGuests.filter(
          (g) =>
            g.job === 'depart' &&
            !g.dead &&
            (g.flightId === inbound.id || g.flightId === `slot:${inbound.scheduleId}`) &&
            (g.releaseAt == null || g.releaseAt <= game.clock),
        )
        if (present.length > 0) sawEarly = true
      }
      expect(sawFlight).toBe(true)
      expect(sawEarly).toBe(true)
      expect(game.lostPaxCount()).toBe(0)
      expect(game.bagsLost).toBe(0)
    })
  }, 30_000)

  it('banks departures from the show-up adapter, spread across the window', () => {
    withSeed(4, () => {
      const game = starter()
      game.offer = { airline: 'northline', age: 0, deadline: 36 }
      game.acceptOffer()
      const plans = game.showUps.filter((p) => p.seats && p.seats.length > 1)
      expect(plans.length).toBeGreaterThan(0)
      let sawRoad = false
      let sawLounge = false
      for (const plan of plans) {
        const releases = plan.releases
        const seats = plan.seats ?? []
        expect(seats.length).toBe(releases.length)
        expect(releases.length).toBe(plan.tags.length)
        for (let i = 1; i < releases.length; i++) {
          expect(releases[i]).toBeGreaterThanOrEqual(releases[i - 1] - 1e-6)
        }
        expect(releases[releases.length - 1] - releases[0]).toBeGreaterThan(3)
        const close = checkInCloseAt(plan.std, plan.intl)
        expect(Math.max(...releases)).toBeLessThanOrEqual(close + 1e-6)
        const road = releases.filter((_, i) => seats[i]?.segment === 'road_warrior')
        const lounge = releases.filter((_, i) => seats[i]?.segment === 'lounge_lover')
        if (road.length && lounge.length) {
          expect(Math.max(...lounge)).toBeLessThan(Math.min(...road))
        }
        for (const s of seats) {
          if (s.segment === 'road_warrior') {
            sawRoad = true
            expect(s.preferFastTrack).toBe(true)
          }
          if (s.segment === 'lounge_lover') {
            sawLounge = true
            expect(s.preferFastTrack).toBe(false)
            expect(s.amenity).toBe('lounge')
            expect(s.spendLounge).toBeGreaterThan(0)
            expect(s.spendAmenity).toBeGreaterThan(0)
          }
        }
      }
      expect(sawRoad).toBe(true)
      expect(sawLounge).toBe(true)
    })
  })

  it('puts a road warrior on the fast-track lane and a lounge lover on the standard lane', () => {
    const game = starter()
    const fit = game.fits[0]
    const hallId = game.hallKey(fit)
    const open = game.hallOpenFor(fit)
    const road = spawnHallGuest('flt-fast', 'depart', 'business', { hallId, airlineId: 'northline' })
    road.node = 'security'
    road.clearedSec = false
    road.showUp = seat({
      segment: 'road_warrior',
      preferFastTrack: true,
      amenity: 'cafe',
      spendAmenity: 16,
      willAmenity: 0.85,
    })
    const lover = spawnHallGuest('flt-fast', 'depart', 'premium', { hallId, airlineId: 'northline' })
    lover.node = 'security'
    lover.clearedSec = false
    lover.showUp = seat({
      segment: 'lounge_lover',
      preferFastTrack: false,
      amenity: 'lounge',
      spendLounge: 60,
      spendAmenity: 21,
      willLounge: 0.8,
      willAmenity: 0.7,
    })
    game.hallGuests.push(road, lover)
    game.tickSecurityLane(road, 0.05, open)
    game.tickSecurityLane(lover, 0.05, open)
    expect(road.thought).toBe('Fast-track lane')
    expect(lover.thought).toBe('Stepping into the lane')
    expect(road.lost).toBe(false)
    expect(lover.lost).toBe(false)
  })

  it('sends a road warrior to the premium fast-track when that lane is staffed', () => {
    const game = starter()
    game.fieldXp = 420
    expect(game.fieldLevel()).toBe(4)
    expect(game.hirePremiumOfficer()).toBe(true)
    expect(game.buyPremium('fast_track_1')).toBe(true)
    const fit = game.fits[0]
    const hallId = game.hallKey(fit)
    const open = game.hallOpenFor(fit)
    const road = spawnHallGuest('flt-prem', 'depart', 'business', { hallId, airlineId: 'northline' })
    road.node = 'security'
    road.clearedSec = false
    road.showUp = seat({ segment: 'road_warrior', preferFastTrack: true })
    const lover = spawnHallGuest('flt-prem', 'depart', 'premium', { hallId, airlineId: 'northline' })
    lover.node = 'security'
    lover.clearedSec = false
    lover.showUp = seat({ segment: 'lounge_lover', preferFastTrack: false, amenity: 'lounge' })
    game.hallGuests.push(road, lover)
    game.tickSecurityLane(road, 0.05, open)
    game.tickSecurityLane(lover, 0.05, open)
    expect(road.premiumScreen).toBe('fast_track')
    expect(road.thought).toBe('Fast-track lane')
    expect(lover.premiumScreen).toBeUndefined()
    expect(lover.thought).toBe('Stepping into the lane')
  })

  it('lets a lounge lover spend in the lounge and the shop', () => {
    const game = starter()
    const fit = game.fits[0]
    const hallId = game.hallKey(fit)
    const open = game.hallOpenFor(fit)
    const g = spawnHallGuest('flt-lounge', 'depart', 'premium', { hallId, airlineId: 'northline' })
    g.node = 'lounge'
    g.clearedSec = true
    g.path = []
    g.needs.hunger = 10
    g.needs.bladder = 10
    g.needs.boarding = 70
    g.showUp = seat({
      segment: 'lounge_lover',
      amenity: 'lounge',
      spendLounge: 48,
      spendAmenity: 22,
      willLounge: 0.9,
      willAmenity: 0.8,
      moodLounge: 12,
    })
    g.wallet = 200
    g.prefs.lounge = 0.95
    g.prefs.shop = 0.9
    game.hallGuests.push(g)
    const before = game.cash
    game.serveNode(g, open)
    expect(g.thought).toMatch(/^Lounge \(−\$/)
    expect(g.loungeDone).toBe(true)
    expect(game.cash).toBeGreaterThan(before)
    expect(g.wallet).toBeLessThan(200)
    g.node = 'shop'
    g.path = []
    const mid = game.cash
    game.serveNode(g, open)
    expect(g.thought).toMatch(/^Shop \(−\$/)
    expect(g.shopDone).toBe(true)
    expect(game.cash).toBeGreaterThan(mid)
    expect(g.lost).toBe(false)
  })

  it('counts a passenger who releases after pushback as a miss, not lost', () => {
    const game = starter()
    game.scheduleAuto = false
    game.spawnCool = 1e9
    game.offerCool = 1e9
    const hallId = game.hallKey(game.fits[0])
    const stand = { c: 12, r: 21 }
    game.clock = 50
    game.schedule.push({
      id: 'late-slot',
      airline: 'northline',
      flightNo: 'NL2',
      eta: 30,
      status: 'inbound',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: 'flt-left',
    })
    const flight: Flight = {
      id: 'flt-left',
      airline: 'northline',
      flightNo: 'NL2',
      airframeId: 'crj700',
      airframeName: 'CRJ-700',
      pax: 40,
      cargo: false,
      craft: 'jet',
      kind: 'regional',
      phase: 'pushback',
      stand,
      x: stand.c,
      y: stand.r,
      z: 0.12,
      heading: 0,
      path: [stand, { c: stand.c - 0.7, r: stand.r }],
      seg: 0,
      t: 0,
      holdAngle: 0,
      scheduleId: 'late-slot',
      posted: {
        landing: true,
        bags: true,
        bagsLoad: true,
        fuel: true,
        catering: true,
        bagDrop: false,
        mx: true,
        deiced: true,
      },
      waitingOn: {
        bags: false,
        bagsLoad: false,
        fuel: false,
        catering: false,
        mx: false,
        deice: false,
        paxOut: 0,
        paxIn: 0,
      },
      phaseTime: 0,
      ledger: [],
      bagUnits: 6,
      bagStage: 'inflight',
      bagsDeposited: 6,
      claimLane: 1,
    }
    game.flights.push(flight)
    game.showUps.push({
      slotId: 'late-slot',
      std: 50,
      hallId,
      airlineId: 'northline',
      intl: false,
      tags: ['business'],
      releases: [50],
      spawned: 0,
      flightId: 'flt-left',
      closed: false,
      seats: [
        seat({
          segment: 'road_warrior',
          preferFastTrack: true,
          leadSimSec: 0,
        }),
      ],
    })
    const missed = game.missedFlights
    game.tick(0.25)
    expect(game.missedFlights).toBeGreaterThan(missed)
    expect(game.hallGuests.some((g) => g.flightId === 'flt-left' && !g.dead)).toBe(false)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('refuses a new bag drop after check-in closes', () => {
    const game = starter()
    const fit = game.fits[0]
    const hallId = game.hallKey(fit)
    game.clock = 50
    game.schedule.push({
      id: 'late',
      airline: 'northline',
      flightNo: 'NL1',
      eta: 30,
      status: 'inbound',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: 'flt-late',
    })
    game.showUps.push({
      slotId: 'late',
      std: 50,
      hallId,
      airlineId: 'northline',
      intl: false,
      tags: ['budget'],
      releases: [],
      spawned: 0,
      flightId: null,
      closed: false,
    })
    const g = spawnHallGuest('slot:late', 'depart', 'budget', { hallId, airlineId: 'northline' })
    g.node = 'checkin'
    g.path = []
    g.needs.hunger = 5
    g.needs.bladder = 5
    g.needs.boarding = 80
    game.hallGuests.push(g)
    game.tick(0.25)
    const body = game.hallGuests.find((x) => x.id === g.id)
    expect(body?.bagsDropped).toBe(true)
    expect(body?.bagDepositLeft ?? 0).toBe(0)
    expect(body?.thought ?? '').not.toMatch(/Dropping bags|Depositing/)
    expect(game.bagsLost).toBe(0)
  })

  it('clears hall walkers already bound to a cancelled departure', () => {
    const game = starter()
    const hallId = game.hallKey(game.fits[0])
    game.clock = 40
    game.schedule.push({
      id: 'cx',
      airline: 'northline',
      flightNo: 'NL9',
      eta: 80,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: 'flt-cx',
    })
    game.showUps.push({
      slotId: 'cx',
      std: 100,
      hallId,
      airlineId: 'northline',
      intl: false,
      tags: ['budget', 'budget'],
      releases: [999, 999],
      spawned: 2,
      flightId: 'flt-cx',
      closed: false,
    })
    const bound = spawnHallGuest('flt-cx', 'depart', 'budget', { hallId, airlineId: 'northline' })
    const pending = spawnHallGuest('slot:cx', 'depart', 'budget', { hallId, airlineId: 'northline' })
    const other = spawnHallGuest('flt-other', 'depart', 'budget', { hallId, airlineId: 'northline' })
    const arrival = spawnHallGuest('flt-cx', 'arrive', 'budget', { hallId, airlineId: 'northline' })
    game.hallGuests.push(bound, pending, other, arrival)
    game.cancelSlot('cx')
    expect(game.showUps.find((p) => p.slotId === 'cx')?.closed).toBe(true)
    expect(bound.dead).toBe(true)
    expect(pending.dead).toBe(true)
    expect(bound.thought).toBe('Flight cancelled')
    expect(other.dead).toBe(false)
    expect(arrival.dead).toBe(false)
    game.tick(1)
    expect(game.hallGuests.some((g) => g.id === bound.id && !g.dead)).toBe(false)
    expect(game.hallGuests.some((g) => g.id === other.id && !g.dead)).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
  })

  it('keeps missed departures under one percent on a prefab for six days', () => {
    withSeed(11, () => {
      const game = starter()
      game.startFocus = 'pax'
      game.offer = { airline: 'northline', age: 0, deadline: 36 }
      game.acceptOffer()
      game.offer = { airline: 'harbor', age: 0, deadline: 36 }
      game.acceptOffer()
      const seen = new Set<string>()
      let early = false
      let fastLane = false
      let loungePaid = false
      let shopPaid = false
      for (let t = 0; t < 180 * 6; t += 0.5) {
        game.tick(0.5)
        for (const g of game.hallGuests) {
          if (g.job === 'depart') seen.add(g.id)
          expect(g.lost).toBe(false)
          if (g.showUp?.preferFastTrack && g.thought === 'Fast-track lane') fastLane = true
          if (g.showUp?.segment === 'lounge_lover' && g.thought.startsWith('Lounge (−$')) loungePaid = true
          if (g.showUp?.segment === 'lounge_lover' && g.thought.startsWith('Shop (−$')) shopPaid = true
        }
        const inbound = game.flights.find((f) => f.phase === 'approach' || f.phase === 'landing')
        if (inbound) {
          const present = game.hallGuests.some(
            (g) =>
              g.job === 'depart' &&
              (g.flightId === inbound.id || g.flightId === `slot:${inbound.scheduleId}`) &&
              (g.releaseAt == null || g.releaseAt <= game.clock),
          )
          if (present) early = true
        }
      }
      expect(seen.size).toBeGreaterThan(20)
      expect(game.flightsDone).toBeGreaterThan(0)
      expect(early).toBe(true)
      expect(fastLane).toBe(true)
      expect(loungePaid).toBe(true)
      expect(shopPaid).toBe(true)
      expect(game.missedFlights / seen.size).toBeLessThanOrEqual(0.01)
      expect(game.lostPaxCount()).toBe(0)
      expect(game.bagsLost).toBe(0)
    })
  }, 60_000)
})
