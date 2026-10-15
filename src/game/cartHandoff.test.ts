import { describe, expect, it } from 'vitest'
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
})
