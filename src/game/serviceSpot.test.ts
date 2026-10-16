import { describe, expect, it } from 'vitest'
import { METERS_PER_CELL } from '../render/aircraft/specs.ts'
import { SERVICE_SPOT } from '../ramp/serviceSpotData.ts'
import { reservedSpots } from '../ramp/serviceSpots.ts'
import { Game } from './sim.ts'
import type { Flight, Truck, Vec } from './types.ts'

function field() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 500_000
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.speed = 1
  game.fuelBrand = 'apex'
  game.fuelLoads = 4
  return game
}

function parked(game: Game, stand: Vec, airframeId: string): Flight {
  const flight: Flight = {
    id: `flt-${airframeId}`,
    airline: 'northline',
    flightNo: 'NL100',
    airframeId,
    airframeName: airframeId,
    pax: 70,
    cargo: false,
    craft: 'jet',
    kind: airframeId === 'b738' ? 'narrowbody' : 'regional',
    phase: 'servicing',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0.12,
    heading: 0.4,
    path: [stand],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
      bags: false,
      bagsLoad: true,
      fuel: false,
      catering: true,
      bagDrop: true,
      mx: false,
      deiced: true,
    },
    waitingOn: {
      bags: true,
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
    bagStage: 'unload_aircraft',
    bagUnits: 12,
  }
  game.flights.push(flight)
  return flight
}

function docked(flight: Flight, kind: 'fuel' | 'bags', stand: Vec): Truck {
  return {
    id: `trk-${kind}`,
    kind,
    flightId: flight.id,
    x: stand.c,
    y: stand.r,
    path: [{ c: stand.c - 1, r: stand.r }, stand],
    seg: 1,
    t: 0,
    returning: false,
    dwell: 3,
    preDwell: 0,
    patrol: false,
    mission: kind === 'fuel' ? 'fuel' : 'unload',
    home: { c: stand.c - 4, r: stand.r },
    serviceFor: 4,
  }
}

describe('legacy service spots', () => {
  it('draws the bowser and the bag truck on separate airframe sockets', () => {
    const game = field()
    const stand = { c: 11, r: 6 }
    for (const airframeId of ['crj700', 'b738'] as const) {
      const flight = parked(game, stand, airframeId)
      const fuel = docked(flight, 'fuel', stand)
      const bags = docked(flight, 'bags', stand)
      game.trucks.push(fuel, bags)
      const origin = { x: flight.x, y: flight.y, heading: flight.heading }
      const spots = reservedSpots(airframeId, origin)
      const fuelDraw = game.truckApronDraw(fuel)
      const bagDraw = game.truckApronDraw(bags)
      expect(fuelDraw, airframeId).not.toBeNull()
      expect(bagDraw, airframeId).not.toBeNull()
      expect(fuelDraw!.x).toBeCloseTo(spots.fuel.x, 4)
      expect(fuelDraw!.y).toBeCloseTo(spots.fuel.y, 4)
      expect(bagDraw!.x).toBeCloseTo(spots.bags.x, 4)
      expect(bagDraw!.y).toBeCloseTo(spots.bags.y, 4)
      expect(Math.hypot(fuelDraw!.x - stand.c, fuelDraw!.y - stand.r)).toBeGreaterThan(0.15)
      const apart = Math.hypot(fuelDraw!.x - bagDraw!.x, fuelDraw!.y - bagDraw!.y) * METERS_PER_CELL
      expect(apart).toBeGreaterThanOrEqual(SERVICE_SPOT.minSeparationM - 0.05)
      const belt = game.beltApronDraw(bags)
      expect(belt, airframeId).not.toBeNull()
      expect(belt!.x).toBeCloseTo(spots.belt.x, 4)
      expect(belt!.y).toBeCloseTo(spots.belt.y, 4)
      expect(belt!.deck).toBeGreaterThan(0.05)
      expect(belt!.slide).toBeGreaterThan(0)
      game.trucks.length = 0
      game.flights.length = 0
    }
  })

  it('uses the socket once a dispatched bowser reaches the stand', () => {
    const game = field()
    const flight = parked(game, { c: 11, r: 6 }, 'crj700')
    game.beginServicing(flight)
    let draw: { x: number; y: number } | null = null
    for (let i = 0; i < 240 && !draw; i++) {
      game.tick(0.25)
      const truck = game.trucks.find((t) => t.kind === 'fuel' && t.flightId === flight.id && !t.returning && t.dwell > 0)
      draw = truck ? game.truckApronDraw(truck) : null
    }
    expect(draw).not.toBeNull()
    expect(Math.hypot(draw!.x - flight.stand!.c, draw!.y - flight.stand!.r)).toBeGreaterThan(0.15)
    const spot = reservedSpots('crj700', { x: flight.x, y: flight.y, heading: flight.heading }).fuel
    expect(draw!.x).toBeCloseTo(spot.x, 3)
    expect(draw!.y).toBeCloseTo(spot.y, 3)
  })
})
