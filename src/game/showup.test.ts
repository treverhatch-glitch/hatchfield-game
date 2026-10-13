import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'

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
      for (let t = 0; t < 180 * 6; t += 0.5) {
        game.tick(0.5)
        for (const g of game.hallGuests) {
          if (g.job === 'depart') seen.add(g.id)
          expect(g.lost).toBe(false)
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
      expect(game.missedFlights / seen.size).toBeLessThanOrEqual(0.01)
      expect(game.lostPaxCount()).toBe(0)
      expect(game.bagsLost).toBe(0)
    })
  }, 60_000)
})
