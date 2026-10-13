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
  game.offerCool = 1e9
  game.heloCool = 1e9
  game.milCool = 1e9
  game.ambuCool = 1e9
  game.threatCool = 1e9
  game.emergencyCool = 1e9
  return game
}

function parked(game: Game, stand: Vec): Flight {
  const f: Flight = {
    id: 'flt-pax',
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
      landing: true,
      bags: true,
      bagsLoad: true,
      fuel: false,
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
  }
  game.flights.push(f)
  return f
}

describe('catering wiring', () => {
  it('books a galley at the stand and posts the meal fee once', () => {
    const game = field()
    game.tiles[10][15] = 'depot'
    game.bumpMap()
    const f = parked(game, { c: 12, r: 21 })
    game.beginServicing(f)
    expect(f.groundTurn).toBe('12,21')
    const galley = game.galleyFor(f.id)
    expect(galley?.status).toBe('waiting')
    expect(galley?.standId).toBe('12,21')
    game.tick(5)
    game.tick(5)
    expect(game.galleyFor(f.id)?.status === 'complete' || game.galleyFor(f.id)?.status === 'short').toBe(true)
    expect(game.cateringPoses().length === 0 || game.cateringPoses().every((p) => p.crew.length === 2)).toBe(true)
    const fees = game.groundBooks.cateringFees
    expect(fees).toBeGreaterThan(0)
    game.tick(5)
    expect(game.groundBooks.cateringFees).toBe(fees)
  })

  it('shows the crew on the stand while the lift is up', () => {
    const game = field()
    game.tiles[10][15] = 'depot'
    game.bumpMap()
    const f = parked(game, { c: 12, r: 21 })
    game.beginServicing(f)
    let sawLift = false
    for (let i = 0; i < 12 && !sawLift; i++) {
      game.tick(0.4)
      const pose = game.cateringPoses().find((p) => p.standId === '12,21')
      if (pose && pose.liftHeight > 0 && pose.crew.some((c) => c.at === 'lift' || c.at === 'galley')) sawLift = true
    }
    expect(sawLift).toBe(true)
  })
})
