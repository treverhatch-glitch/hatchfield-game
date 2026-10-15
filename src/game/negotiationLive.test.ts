import { describe, expect, it } from 'vitest'
import { FUEL, GA_PARK_DAY_RATE } from './catalog.ts'
import { SMALL_FIELD_FEE_FACTOR } from './economyTuning.ts'
import { Game } from './sim.ts'
import { landingCharge, serviceCharge } from '../commercial/live.ts'
import { SERVICE_IDS } from '../negotiation/index.ts'
import { negotiatedLineFactor } from '../negotiation/liveFees.ts'
import type { DepositTier, ServiceId } from '../negotiation/types.ts'
import type { Flight, Truck } from './types.ts'

/** Mulberry32 so offer rolls do not depend on the process seed. */
function withSeed<T>(seed: number, run: () => T): T {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    return run()
  } finally {
    Math.random = orig
  }
}

function fresh(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  return game
}

function field(): Game {
  const game = fresh()
  game.startFocus = 'pax'
  expect(game.buyLand('city')).toBe(true)
  game.buildStarterKit()
  game.speed = 1
  return game
}

function turn(airline: string, pax: number): Flight {
  return {
    id: `turn-${airline}`,
    airline,
    flightNo: 'HF9',
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

function fuelTruck(flightId: string): Truck {
  return {
    id: 'fuel-1',
    kind: 'fuel',
    flightId,
    x: 0,
    y: 0,
    path: [],
    seg: 0,
    t: 0,
    returning: false,
    dwell: 0,
    preDwell: 0,
    patrol: false,
    mission: 'fuel',
    home: null,
  }
}

/** Counter until the open ask is signed. Re-applies the ask each round. */
function signAsk(
  game: Game,
  id: string,
  fees: Partial<Record<ServiceId, number>>,
  deposit: DepositTier,
  extras?: { term?: number; lead?: boolean; fuel?: boolean },
) {
  game.presentNegotiation(id)
  let guard = 0
  while (game.negotiationPanel()?.open && guard < 6) {
    for (const service of SERVICE_IDS) game.setNegotiationFee(service, fees[service] ?? 0)
    game.setNegotiationDeposit(deposit)
    if (extras?.term) game.setNegotiationTerm(extras.term)
    if (extras?.lead && guard === 0) game.toggleNegotiationFreebie('lead')
    if (extras?.fuel && guard === 0) {
      game.toggleNegotiationFreebie('fuel')
      game.toggleNegotiationFreebie('fuel')
      game.toggleNegotiationFreebie('fuel')
    }
    game.counterNegotiation()
    guard += 1
  }
  expect(game.signed, `${id} should sign`).toContain(id)
}

describe('negotiated terms on the live sim', () => {
  it('charges a negotiated fee on the next turnaround and in the daily ledger', () => {
    const game = fresh()
    const landingPct = 25
    const paxPct = -10
    signAsk(game, 'harbor', { landing: landingPct, pax: paxPct, bags: -40, fuel: -40, catering: -40, parking: -40 }, 'standard')
    const before = game.cash
    const flight = turn('harbor', 40)
    game.beginServicing(flight)
    const landingFactor = 1 + landingPct / 100
    const paxFactor = 1 + paxPct / 100
    const parkingFactor = 0.6
    const negotiatedLanding = Math.round(landingCharge(7400, 'standard', false) * landingFactor)
    const negotiatedPax = Math.round(landingCharge(40 * 12, 'standard', false) * paxFactor)
    const expectedParking = Math.round(serviceCharge(GA_PARK_DAY_RATE, 'standard', false) * parkingFactor)
    const expectedLanding = Math.round(negotiatedLanding * SMALL_FIELD_FEE_FACTOR)
    const expectedPax = Math.round(negotiatedPax * SMALL_FIELD_FEE_FACTOR)
    expect(flight.ledger.map((line) => line.amount)).toEqual(
      expect.arrayContaining([expectedLanding, expectedPax, expectedParking]),
    )
    expect(game.cash).toBe(before + expectedLanding + expectedPax + expectedParking)
    const day = game.bank.ledgerForGameDay(0)
    expect(day.entries.filter((entry) => entry.category === 'landing_fees').map((entry) => entry.amount)).toContain(
      expectedLanding,
    )
    expect(day.entries.filter((entry) => entry.category === 'passenger_fees').map((entry) => entry.amount)).toContain(
      expectedPax,
    )
    expect(day.entries.filter((entry) => entry.category === 'parking_fees').map((entry) => entry.amount)).toContain(
      expectedParking,
    )
    expect(negotiatedLanding).toBe(Math.round(7400 * 1.25))
    expect(negotiatedPax).not.toBe(Math.round(480 * 1.25))
  })

  it('applies a fuel-discount freebie on the fuel line', () => {
    const game = fresh()
    signAsk(
      game,
      'harbor',
      { landing: -15, pax: -15, bags: -15, fuel: 0, catering: -15, parking: -15 },
      'standard',
      { fuel: true },
    )
    game.fuelBrand = 'apex'
    game.fuelLoads = 2
    const flight = turn('harbor', 40)
    game.flights.push(flight)
    game.finishTruck(fuelTruck(flight.id))
    const factor = negotiatedLineFactor(
      {
        feePct: { landing: -15, pax: -15, bags: -15, fuel: 0, catering: -15, parking: -15 },
        freebies: {
          parkingHours: 0,
          fuelDiscountPct: 15,
          priorityGates: false,
          contactGates: false,
          loungeAccess: false,
          marketingFund: 0,
          waivedLeadTime: false,
        },
        termMonths: 12,
        deposit: 'standard',
      },
      'fuel',
    )
    const negotiated = Math.round(serviceCharge(FUEL.apex.pump, 'standard', false) * factor)
    const expected = Math.round(negotiated * SMALL_FIELD_FEE_FACTOR)
    expect(factor).toBeCloseTo(0.85)
    expect(flight.ledger.some((line) => line.amount === expected)).toBe(true)
    const day = game.bank.ledgerForGameDay(0)
    expect(day.entries.filter((entry) => entry.category === 'fuel_sales').map((entry) => entry.amount)).toContain(expected)
  })

  it('changes the deposit taken, the term, and a waived lead time', () => {
    const standard = fresh()
    signAsk(standard, 'harbor', { landing: -20, pax: -20, bags: -20, fuel: -20, catering: -20, parking: -20 }, 'standard', {
      term: 6,
    })
    const high = fresh()
    signAsk(high, 'harbor', { landing: -20, pax: -20, bags: -20, fuel: -20, catering: -20, parking: -20 }, 'high', {
      term: 24,
    })
    const none = fresh()
    signAsk(none, 'harbor', { landing: -20, pax: -20, bags: -20, fuel: -20, catering: -20, parking: -20 }, 'none')

    expect(standard.deposits.harbor.tier).toBe('standard')
    expect(high.deposits.harbor.tier).toBe('big')
    expect(none.deposits.harbor.tier).toBe('none')
    expect(high.deposits.harbor.held).toBe(standard.deposits.harbor.held * 3)
    expect(none.deposits.harbor.held).toBe(0)
    expect(standard.bank.ledger().entries.filter((entry) => entry.category === 'deposits').map((entry) => entry.amount)).toEqual([
      standard.deposits.harbor.held,
    ])
    expect(high.bank.ledger().entries.filter((entry) => entry.category === 'deposits').map((entry) => entry.amount)).toEqual([
      high.deposits.harbor.held,
    ])
    expect(none.bank.ledger().entries.some((entry) => entry.category === 'deposits')).toBe(false)
    expect(standard.deposits.harbor.termEndDay).toBe(6 * 30)
    expect(high.deposits.harbor.termEndDay).toBe(24 * 30)

    const gated = fresh()
    gated.paxDesks = 8
    gated.offer = { airline: 'northline', age: 0, deadline: 36 }
    gated.acceptOffer()
    signAsk(gated, 'bushline', { landing: -20, pax: -20, bags: -20, fuel: -20, catering: -20, parking: -20 }, 'standard')
    expect(gated.commercialLead.bushline.leadDays).toBe(4)

    const waived = fresh()
    waived.paxDesks = 8
    waived.offer = { airline: 'northline', age: 0, deadline: 36 }
    waived.acceptOffer()
    signAsk(
      waived,
      'bushline',
      { landing: -20, pax: -20, bags: -20, fuel: -20, catering: -20, parking: -20 },
      'standard',
      { lead: true },
    )
    expect(waived.commercialLead.bushline.leadDays).toBe(0)
  })

  it('projects offer-panel margin from the live fee card', () => {
    const game = fresh()
    game.presentNegotiation('harbor')
    const before = game.negotiationPanel()?.margin ?? 0
    game.setFee('landingPerTonne', 16)
    const after = game.negotiationPanel()?.margin ?? 0
    expect(after).toBeGreaterThan(before)
    expect(Number.isFinite(after)).toBe(true)
    game.closeNegotiationPanel()
    expect(game.negotiationPanel()).toBeNull()
  })

  it('repeats a negotiated turnaround for a fixed seed', () => {
    const play = () =>
      withSeed(42, () => {
        const game = fresh()
        game.diplomacySeed = 42
        signAsk(game, 'harbor', { landing: 25, pax: -10, bags: -40, fuel: -40, catering: -40, parking: -40 }, 'standard')
        const flight = turn('harbor', 40)
        game.beginServicing(flight)
        return {
          cash: game.cash,
          held: game.deposits.harbor.held,
          landing: flight.ledger.find((line) => line.label.includes('landing'))?.amount,
          ledger: game.bank
            .ledger()
            .entries.map((entry) => `${entry.category}:${entry.amount}`)
            .join('|'),
        }
      })
    expect(play()).toEqual(play())
  })

  it('keeps a 30-day headless run that negotiates every offer above the cash floor', () => {
    const play = (seed: number) =>
      withSeed(seed, () => {
        const game = field()
        game.diplomacySeed = seed
        let floor = game.cash
        let offers = 0
        for (let step = 0; step < 180; step += 1) {
          game.tick(30)
          if (game.negotiationPanel()?.open) {
            offers += 1
            let guard = 0
            while (game.negotiationPanel()?.open && guard < 6) {
              game.matchNegotiationTarget()
              game.counterNegotiation()
              guard += 1
            }
            if (game.negotiationPanel()?.open) game.acceptNegotiation()
          }
          expect(Number.isFinite(game.cash)).toBe(true)
          floor = Math.min(floor, game.cash)
        }
        return { cash: game.cash, floor, offers, signed: game.signed.length }
      })

    const first = play(7)
    const second = play(7)
    expect(first.offers).toBeGreaterThan(0)
    expect(first.signed).toBeGreaterThan(0)
    expect(first.floor).toBeGreaterThan(-50_000)
    expect(Number.isNaN(first.cash)).toBe(false)
    expect(second).toEqual(first)
  }, 180_000)
})
