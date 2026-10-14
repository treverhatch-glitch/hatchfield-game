import { describe, expect, it } from 'vitest'
import type { Flight, Truck } from './types.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
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
}

describe('scale fuel stays in step with bowser loads', () => {
  it('opens tank room when a load is pumped, then the road tanker refills it', () => {
    const game = field()
    expect(game.tankLitres).toBe(80_000)
    expect(game.fuelLoads).toBe(4)
    bowser(game)
    expect(game.fuelLoads).toBe(3)
    expect(game.tankLitres).toBe(60_000)
    game.cash += 50_000
    game.tick(12)
    expect(game.fuelLoads).toBeGreaterThanOrEqual(4)
    expect(game.tankLitres).toBeGreaterThan(60_000)
  })

  it('keeps bought loads in the tank', () => {
    const game = field()
    game.tankTier = 2
    game.tankLitres = 0
    game.fuelLoads = 0
    game.cash += 50_000
    game.buyLoads()
    expect(game.fuelLoads).toBe(4)
    expect(game.tankLitres).toBe(80_000)
  })

  it('delivers rail fuel only while the line reaches the map edge', () => {
    const game = field()
    game.cash += 200_000
    game.fieldXp = 700
    game.researchUnlocked.push('hydrant_fuel', 'rail_fuel', 'heavy_pack', 'widebody_ops')
    game.contractId = 'mega_jumbo'
    game.fuelSupply = 'rail'
    game.tankTier = 3
    game.tankLitres = 10_000
    game.tiles[5][6] = 'oil'
    const dry = game.tankLitres
    game.tick(2)
    expect(game.tankLitres).toBe(dry)
    for (let r = 6; r < 32; r++) game.tiles[r][6] = 'fuel_rail'
    game.tick(2)
    expect(game.tankLitres).toBeGreaterThan(dry + 1_000)
    expect(game.news.some((n) => n.text.includes('Fuel rail is flowing'))).toBe(true)
  })

  it('holds a widebody slot when the pillar is short instead of sending a narrowbody', () => {
    const game = field()
    game.cash += 500_000
    game.fieldXp = 420
    game.researchUnlocked.push('night_bank', 'deice', 'stand_class', 'widebody_ops')
    for (let c = 8; c < 28; c++) {
      game.tiles[26][c] = 'runway'
      game.tiles[27][c] = 'runway'
    }
    game.reputation = 90
    game.offer = { airline: 'summit', age: 0, deadline: 40 }
    game.acceptOffer()
    game.schedule = []
    game.fieldXp = 420
    game.addManualSlot('summit', 8)
    game.spawnCool = 0
    game.speed = 1
    game.tick(12)
    expect(game.flights.some((f) => f.kind === 'widebody' || f.airframeId === 'b738')).toBe(false)
    expect(game.news.some((n) => /delayed —/.test(n.text))).toBe(true)
  })
})
