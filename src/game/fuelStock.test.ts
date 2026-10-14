import { describe, expect, it } from 'vitest'
import type { Flight, Truck } from './types.ts'
import { readMapView } from '../info/read.ts'
import { Game } from './sim.ts'

const DAY = 180

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.tiles[5][6] = 'depot'
  game.tiles[5][5] = 'kitchen'
  game.researchUnlocked.push('hydrant_fuel')
  game.bumpMap()
  game.cash = 5_000_000
  game.speed = 1
  return game
}

function bowser(game: Game) {
  const flight: Flight = {
    id: 'fuel-1',
    airline: 'harbor',
    flightNo: 'HB1',
    airframeId: 'b738',
    airframeName: 'Boeing 737-800',
    pax: 140,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'servicing',
    stand: { c: 12, r: 21 },
    x: 12,
    y: 21,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
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
      fuel: true,
      catering: false,
      mx: false,
      deice: false,
      paxOut: 0,
      paxIn: 0,
    },
    phaseTime: 0,
    ledger: [],
  }
  game.flights.push(flight)
  const truck: Truck = {
    id: 'trk-fuel',
    kind: 'fuel',
    flightId: flight.id,
    x: 12,
    y: 21,
    path: [],
    seg: 0,
    t: 0,
    returning: false,
    dwell: 0,
    preDwell: 0,
    patrol: false,
    mission: 'fuel',
    home: { c: 8, r: 21 },
  }
  game.finishTruck(truck)
  game.flights = game.flights.filter((f) => f.id !== flight.id)
}

/** Tank, ramp snapshot, delivery chain, info view, and the on-hand check. */
function sameStock(game: Game) {
  const snap = game.groundSnapshot()
  const chain = game.fuelView().litres
  const tank = game.tankLitres
  const onHand = game.fuelOnHand()
  const level = readMapView(game, 'fuel').scores.find((row) => row.id === 'level')?.value ?? ''
  const label = Math.round(tank).toLocaleString('en-US')
  if (!snap || snap.fuelLitres !== tank || chain !== tank || onHand !== tank >= 1 || !level.startsWith(`${label} L`)) {
    throw new Error(
      `fuel diverged at ${game.clock.toFixed(1)}s tank=${tank} ramp=${snap?.fuelLitres} chain=${chain} onHand=${onHand} level=${level}`,
    )
  }
}

describe('one fuel stock', () => {
  it('keeps the tank, the ramp, the chain, and the info view on one number for 30 days', () => {
    const game = field()
    game.schedule = []
    game.flights = []
    game.spawnCool = 10_000
    game.tankLitres = 10_000
    game.roadMinutes = 0
    game.tick(12)
    expect(game.tankLitres).toBe(46_000)
    sameStock(game)

    const beforeDraw = game.tankLitres
    bowser(game)
    expect(game.tankLitres).toBe(beforeDraw - 20_000)
    sameStock(game)

    game.tankTier = 2
    game.buyLoads()
    expect(game.tankLitres).toBe(beforeDraw - 20_000 + 80_000)
    sameStock(game)

    game.bumpMap()
    sameStock(game)

    game.spawnCool = 0
    game.scheduleAuto = true
    for (const id of ['bushline', 'northline', 'harbor'] as const) {
      if (game.meetsReq(id) && !game.signed.includes(id)) {
        game.signed.push(id)
        game.airlineHeat[id] = 75
      }
    }

    const seen = new Set<number>()
    const target = game.clock + 30 * DAY
    while (game.clock < target - 1e-6) {
      if (game.offer) game.acceptOffer()
      const left = target - game.clock
      game.tick(Math.min(4, left))
      sameStock(game)
      seen.add(game.tankLitres)
    }
    expect(game.clock).toBeGreaterThanOrEqual(target - 1e-6)
    expect(seen.size).toBeGreaterThan(1)
  }, 180_000)
})
