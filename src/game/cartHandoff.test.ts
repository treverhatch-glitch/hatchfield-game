import { describe, expect, it } from 'vitest'
import { resolveSocket } from '../carts/index.ts'
import { METERS_PER_CELL, getAircraftSpec } from '../render/aircraft/specs.ts'
import { aircraftSocketTable } from '../render/socketLayout.ts'
import { Game } from './sim.ts'
import type { Flight, Vec } from './types.ts'

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
  return game
}

function parked(game: Game, stand: Vec): Flight {
  const flight: Flight = {
    id: 'flt-bags',
    airline: 'northline',
    flightNo: 'NL100',
    airframeId: 'crj700',
    airframeName: 'CRJ-700',
    pax: 40,
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
      landing: true,
      bags: true,
      bagsLoad: true,
      fuel: true,
      catering: false,
      bagDrop: true,
      mx: false,
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
    bagStage: 'outbound_sort',
    bagUnits: 18,
  }
  game.flights.push(flight)
  return flight
}

describe('socket carts on the field', () => {
  it('puts a bag cart on the check-in to sort leg and a hi-lift on the kitchen to door leg', () => {
    const game = field()
    game.tiles[5][6] = 'depot'
    game.tiles[5][5] = 'kitchen'
    game.bumpMap()
    const flight = parked(game, { c: 11, r: 6 })
    game.tick(0.5)
    const bags = game.cartPoses().filter((pose) => pose.kind === 'bag_cart')
    expect(bags.some((pose) => pose.fromSocket === 'desk_drop' && pose.toSocket === 'makeup_stop' && pose.vehicleSocket === 'cart_bed')).toBe(true)

    flight.bagStage = 'unload_aircraft'
    game.tick(0.5)
    game.beginServicing(flight)
    game.tick(0.5)
    const catering = game.cartPoses().filter((pose) => pose.kind === 'catering_truck')
    expect(catering.some((pose) => pose.fromSocket === 'cart_slot' && pose.toSocket === 'catering_door' && pose.vehicleSocket === 'catering_lip')).toBe(true)
  })

  it('docks the catering truck on the aircraft catering_door, not a tile offset', () => {
    const game = field()
    game.tiles[5][6] = 'depot'
    game.tiles[5][5] = 'kitchen'
    game.bumpMap()
    const flight = parked(game, { c: 11, r: 6 })
    game.tick(0.5)
    game.beginServicing(flight)
    const expected = resolveSocket(aircraftSocketTable(getAircraftSpec(flight.airframeId)), 'catering_door', {
      x: flight.x * METERS_PER_CELL,
      y: flight.y * METERS_PER_CELL,
      heading: flight.heading,
    })
    expect(expected).not.toBeNull()
    const tileOffset = { x: flight.x * METERS_PER_CELL + 8, y: flight.y * METERS_PER_CELL - 6 }
    let saw = false
    for (let i = 0; i < 160 && !saw; i++) {
      game.tick(0.5)
      const pose = game.cartPoses().find((row) => row.kind === 'catering_truck' && row.phase === 'dock' && row.lockedTo === 'catering_door')
      if (!pose || !expected) continue
      expect(pose.x).toBeCloseTo(expected.x, 1)
      expect(pose.y).toBeCloseTo(expected.y, 1)
      expect(Math.hypot(pose.x - tileOffset.x, pose.y - tileOffset.y)).toBeGreaterThan(1)
      saw = true
    }
    expect(saw).toBe(true)
  })

  it('cancels an undone cart once the flight has left', () => {
    const game = field()
    game.tiles[5][5] = 'kitchen'
    game.bumpMap()
    const flight = parked(game, { c: 11, r: 6 })
    game.tick(0.5)
    expect(game.cartPoses().some((pose) => pose.standId === '11,6')).toBe(true)
    flight.phase = 'gone'
    game.tick(0.5)
    expect(game.cartPoses().filter((pose) => pose.standId === '11,6')).toEqual([])
    game.tick(2)
    expect(game.cartPoses().filter((pose) => pose.standId === '11,6')).toEqual([])
  })
})
