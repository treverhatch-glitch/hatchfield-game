import { describe, expect, it } from 'vitest'
import { GROUNDED_RETAIL_TAPER } from './economyTuning.ts'
import { FUEL_OUTAGE_SLOT_SEC } from './logisticsBridge.ts'
import { Game } from './sim.ts'
import type { Flight, Vec } from './types.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 500_000
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.offerCool = 1e9
  game.heloCool = 1e9
  game.milCool = 1e9
  game.ambuCool = 1e9
  game.fuelLoads = 0
  game.tankLitres = 0
  return game
}

function parked(game: Game, stand: Vec): Flight {
  const flight: Flight = {
    id: 'flt-dry',
    airline: 'northline',
    flightNo: 'NL100',
    airframeId: 'crj700',
    airframeName: 'CRJ-700',
    pax: 20,
    cargo: false,
    craft: 'jet',
    kind: 'regional',
    phase: 'servicing',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0.12,
    heading: 0,
    path: [stand],
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
    fuelLevel: 0.4,
    caterLevel: 0.2,
  }
  game.flights.push(flight)
  return flight
}

function unflown(label: string): boolean {
  return /passenger fees/i.test(label) || /\blanding\b/i.test(label) || /pad fee/i.test(label)
}

describe('grounded flight fares', () => {
  it('refunds passenger fees and the slot fee when the departure is cancelled for fuel', () => {
    const game = field()
    const flight = parked(game, { c: 12, r: 7 })
    expect(game.fuelOutage(flight)).toBe(true)
    const cashBefore = game.cash
    game.beginServicing(flight)
    const owed = flight.ledger.filter((line) => line.amount > 0 && unflown(line.label)).reduce((sum, line) => sum + line.amount, 0)
    const other = flight.ledger.filter((line) => line.amount > 0 && !unflown(line.label)).reduce((sum, line) => sum + line.amount, 0)
    expect(owed).toBeGreaterThan(0)
    const held = -game.bank
      .ledger()
      .entries.filter((entry) => entry.meta.label === 'Cancel refund' && !entry.meta.unpaid)
      .reduce((sum, entry) => sum + entry.amount, 0)
    expect(held).toBe(Math.round(owed))
    expect(game.cash - cashBefore).toBe(Math.round(other))
    const paxNow = game.bank.ledger().byCategory.passenger_fees ?? 0
    const landingNow = game.bank.ledger().byCategory.landing_fees ?? 0
    const penaltiesNow = game.bank.ledger().byCategory.penalties ?? 0
    expect(paxNow + landingNow + penaltiesNow).toBe(0)
    expect(flight.ledger.some((line) => /passenger fees/i.test(line.label))).toBe(true)
    expect(flight.ledger.some((line) => /\blanding\b/i.test(line.label))).toBe(true)
    flight.phase = 'board'
    flight.phaseTime = 400
    flight.fuelHeldSince = game.clock - FUEL_OUTAGE_SLOT_SEC - 0.1
    game.tick(0.3)
    expect(flight.phase).toBe('gone')
    const refunded = -game.bank
      .ledger()
      .entries.filter((entry) => entry.meta.label === 'Cancel refund' && !entry.meta.unpaid)
      .reduce((sum, entry) => sum + entry.amount, 0)
    expect(refunded).toBe(Math.round(owed))
    const pax = game.bank.ledger().byCategory.passenger_fees ?? 0
    const landing = game.bank.ledger().byCategory.landing_fees ?? 0
    const penalties = game.bank.ledger().byCategory.penalties ?? 0
    expect(pax + landing + penalties).toBe(0)
    expect(game.news.some((item) => item.text.includes('Passenger fees and the slot fee refunded'))).toBe(true)
  })

  it('returns withheld fees when fuel is put on the wing', () => {
    const game = field()
    const flight = parked(game, { c: 12, r: 7 })
    const before = game.cash
    game.beginServicing(flight)
    const owed = flight.ledger.filter((line) => line.amount > 0 && unflown(line.label)).reduce((sum, line) => sum + line.amount, 0)
    const other = flight.ledger.filter((line) => line.amount > 0 && !unflown(line.label)).reduce((sum, line) => sum + line.amount, 0)
    expect(owed).toBeGreaterThan(0)
    expect(game.cash - before).toBe(Math.round(other))
    flight.posted.fuel = true
    ;(game as unknown as { releaseUnflownFees(f: Flight): void }).releaseUnflownFees(flight)
    const pax = game.bank.ledger().byCategory.passenger_fees ?? 0
    const landing = game.bank.ledger().byCategory.landing_fees ?? 0
    const penalties = game.bank.ledger().byCategory.penalties ?? 0
    expect(penalties).toBe(0)
    expect(pax + landing).toBe(Math.round(owed))
    expect(game.cash - before).toBe(Math.round(owed + other))
  })

  it('tapers apron retail while the flight is grounded and leaves a fueled turn alone', () => {
    const game = field()
    const dry = parked(game, { c: 12, r: 7 })
    const factor = (game as unknown as { groundedRetailFactor(f: Flight | null): number }).groundedRetailFactor(dry)
    expect(factor).toBe(GROUNDED_RETAIL_TAPER)
    expect(factor).toBeLessThan(1)
    dry.posted.fuel = true
    expect((game as unknown as { groundedRetailFactor(f: Flight | null): number }).groundedRetailFactor(dry)).toBe(1)
  })
})
