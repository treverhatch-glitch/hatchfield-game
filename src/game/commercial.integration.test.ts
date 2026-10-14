import { describe, expect, it } from 'vitest'
import { ABANDON_FINE } from './catalog.ts'
import { SMALL_FIELD_FEE_FACTOR } from './economyTuning.ts'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'

/** Mulberry32 so offer rolls do not depend on the process seed. */
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

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  expect(game.buyLand('city')).toBe(true)
  game.buildStarterKit()
  return game
}

function sign(game: Game, airline: 'northline' | 'bushline') {
  game.offer = { airline, age: 0, deadline: 36 }
  game.acceptOffer()
}

function turn(airline: Flight['airline'], pax: number): Flight {
  return {
    id: 'fee-turn',
    airline,
    flightNo: 'NL9',
    airframeId: 'a320neo',
    airframeName: 'Airbus A320neo',
    pax,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'parked',
    stand: { c: 2, r: 2 },
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: false,
      bags: false,
      bagsLoad: false,
      fuel: false,
      catering: false,
      bagDrop: false,
      mx: false,
      deiced: false,
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
  }
}

describe('commercial live sim', () => {
  it('posts the signing deposit and lets the starter airline fly on day 0', () => {
    withSeed(3, () => {
      const game = field()
      const before = game.cash
      sign(game, 'northline')
      const held = game.deposits.northline
      expect(held.tier).toBe('standard')
      expect(held.held).toBe(21_840)
      expect(game.cash).toBe(before + held.held)
      const posted = game.bank.ledger().entries.filter((entry) => entry.category === 'deposits')
      expect(posted.map((entry) => entry.amount)).toEqual([held.held])
      expect(game.commercialLead.northline.leadDays).toBe(0)
      const first = Math.min(...game.schedule.filter((slot) => slot.airline === 'northline').map((slot) => slot.eta))
      expect(first).toBeLessThan(game.clock + 40)
    })
  })

  it('holds the next airline until lead time, then releases the first flight', () => {
    withSeed(5, () => {
      const game = field()
      sign(game, 'northline')
      sign(game, 'bushline')
      const lead = game.commercialLead.bushline
      expect(lead.leadDays).toBe(4)
      expect(lead.opened).toBe(false)
      const gate = (lead.signDay + lead.leadDays) * 180
      const first = Math.min(...game.schedule.filter((slot) => slot.airline === 'bushline').map((slot) => slot.eta))
      expect(first).toBeGreaterThanOrEqual(gate - 0.01)

      game.schedule = game.schedule.filter((slot) => slot.airline === 'bushline')
      game.scheduleAuto = false
      game.spawnCool = 0
      game.clock = gate - 30
      game.trySpawn()
      expect(game.flights.some((flight) => flight.airline === 'bushline')).toBe(false)

      game.clock = gate + 2
      for (let i = 0; i < 6 && !game.flights.some((flight) => flight.airline === 'bushline'); i += 1) {
        game.spawnCool = 0
        game.trySpawn()
      }
      expect(game.flights.some((flight) => flight.airline === 'bushline')).toBe(true)
      expect(game.commercialLead.bushline.opened).toBe(true)
    })
  })

  it('posts scaled landing and passenger fees, and trims standing above 1.3×', () => {
    withSeed(9, () => {
      const game = field()
      sign(game, 'northline')
      const standing = game.standingOf('northline')
      game.setFee('landingPerTonne', 16)
      game.setFee('paxFee', 24)
      expect(game.walkInDemand()).toBeLessThan(1)
      expect(game.standingOf('northline')).toBeLessThan(standing)

      const before = game.cash
      const flight = turn('northline', 40)
      game.beginServicing(flight)
      const landing = game.bank.ledger().entries.filter((entry) => entry.category === 'landing_fees')
      const pax = game.bank.ledger().entries.filter((entry) => entry.category === 'passenger_fees')
      const landingFee = Math.round(10_400 * SMALL_FIELD_FEE_FACTOR)
      const paxFee = Math.round(960 * SMALL_FIELD_FEE_FACTOR)
      expect(landing.map((entry) => entry.amount)).toContain(landingFee)
      expect(pax.map((entry) => entry.amount)).toContain(paxFee)
      expect(game.cash).toBe(before + landingFee + paxFee)
      expect(flight.ledger.some((line) => line.amount === paxFee)).toBe(true)
    })
  })

  it('refunds the deposit through the day close and keeps it on an early cancel', () => {
    withSeed(11, () => {
      const refunded = field()
      sign(refunded, 'northline')
      const held = refunded.deposits.northline.held
      refunded.deposits.northline.termEndDay = 0
      const beforeClose = refunded.cash
      refunded.clock = 180
      refunded.tickPayroll(1)
      const back = refunded.bank.ledger().entries.filter((entry) => entry.category === 'deposit_refunds')
      expect(back.map((entry) => entry.amount)).toEqual([-held])
      expect(refunded.deposits.northline.status).toBe('refunded')
      expect(refunded.cash).toBeLessThanOrEqual(beforeClose - held)

      const walked = field()
      sign(walked, 'northline')
      const cash = walked.cash
      walked.abandonAirline('northline', 'walked')
      expect(walked.deposits.northline.status).toBe('forfeited')
      expect(walked.bank.ledger().entries.some((entry) => entry.category === 'deposit_refunds')).toBe(false)
      expect(walked.cash).toBe(cash - ABANDON_FINE)
    })
  })

  it('sends more walk-in parking asks when fees are cheap', () => {
    const cheapAsks = withSeedCount(21, (game) => {
      for (const key of ['landingPerTonne', 'paxFee', 'carParkShort', 'carParkLong', 'hotelNight'] as const) {
        game.setFee(key, 0)
      }
      expect(game.walkInDemand()).toBeCloseTo(1.8)
      return parkingAsks(game, 80)
    })
    const hotAsks = withSeedCount(21, (game) => {
      game.setFee('landingPerTonne', 24)
      game.setFee('paxFee', 36)
      game.setFee('carParkShort', 100)
      game.setFee('carParkLong', 180)
      game.setFee('hotelNight', 300)
      expect(game.walkInDemand()).toBeLessThan(0.5)
      return parkingAsks(game, 80)
    })
    expect(cheapAsks).toBeGreaterThan(hotAsks)
    expect(cheapAsks).toBeGreaterThan(40)
    expect(hotAsks).toBeLessThan(25)
  })
})

function parkingAsks(game: Game, trials: number): number {
  let asks = 0
  for (let i = 0; i < trials; i += 1) {
    game.parkingCool = 0
    game.parkingOffer = null
    game.pendingThreat = null
    game.pendingEmergency = null
    game.hubOffer = null
    game.layoverOffer = null
    game.tickParking(0)
    if (game.parkingOffer) asks += 1
  }
  return asks
}

function withSeedCount(seed: number, run: (game: Game) => number): number {
  let count = 0
  withSeed(seed, () => {
    count = run(field())
  })
  return count
}
