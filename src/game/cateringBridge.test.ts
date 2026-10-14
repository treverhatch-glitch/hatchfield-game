import { describe, expect, it } from 'vitest'
import { CateringBridge, cateringCue } from './cateringBridge.ts'
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
    game.tiles[5][6] = 'depot'
    game.bumpMap()
    const f = parked(game, { c: 11, r: 6 })
    game.beginServicing(f)
    expect(f.groundTurn).toBe('11,6')
    const galley = game.galleyFor(f.id)
    expect(galley?.status).toBe('waiting')
    expect(galley?.standId).toBe('11,6')
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
    game.tiles[5][6] = 'depot'
    game.bumpMap()
    const f = parked(game, { c: 11, r: 6 })
    game.beginServicing(f)
    let sawLift = false
    for (let i = 0; i < 12 && !sawLift; i++) {
      game.tick(0.4)
      const pose = game.cateringPoses().find((p) => p.standId === '11,6')
      if (pose && pose.liftHeight > 0 && pose.crew.some((c) => c.at === 'lift' || c.at === 'galley')) sawLift = true
    }
    expect(sawLift).toBe(true)
  })
})

describe('CateringBridge edge cases and cues', () => {
  it('returns expected cues for all catering event types', () => {
    expect(cateringCue({ type: 'catering_phase', phase: 'lift_raise' } as any)).toBe('catering_lift_start')
    expect(cateringCue({ type: 'catering_phase', phase: 'carts_out' } as any)).toBe('catering_lift_start')
    expect(cateringCue({ type: 'catering_phase', phase: 'carts_in' } as any)).toBe('catering_lift_start')
    expect(cateringCue({ type: 'catering_phase', phase: 'lift_lower' } as any)).toBe('catering_lift_stop')
    expect(cateringCue({ type: 'catering_phase', phase: 'crew_board' } as any)).toBe('catering_lift_stop')
    expect(cateringCue({ type: 'catering_phase', phase: 'parking' } as any)).toBe('truck_arrive')
    expect(cateringCue({ type: 'catering_phase', phase: 'driving_to_stand' } as any)).toBe('truck_arrive')
    expect(cateringCue({ type: 'catering_phase', phase: 'idle' } as any)).toBeNull()
    expect(cateringCue({ type: 'catering_done' } as any)).toBe('cash_in')
    expect(cateringCue({ type: 'shop_out_of_stock' } as any)).toBe('rating_down')
    expect(cateringCue({ type: 'catering_late' } as any)).toBe('disruption')
    expect(cateringCue({ type: 'unknown' } as any)).toBeNull()
  })

  it('handles orderFor with zero, negative, NaN, and large inputs deterministically', () => {
    const bridge = new CateringBridge()

    const gZero = bridge.orderFor('flt-0', '10,10', 0, 0, false, 0)
    expect(gZero).toBeTruthy()
    expect(gZero.status).toBe('waiting')

    const gNeg = bridge.orderFor('flt-neg', '10,10', -50, -20, false, -10)
    expect(gNeg).toBeTruthy()

    const gNan = bridge.orderFor('flt-nan', '10,10', NaN, NaN, false, NaN)
    expect(gNan).toBeTruthy()

    const gLarge = bridge.orderFor('flt-large', '10,10', 1e9, 1e9, true, 1e9)
    expect(gLarge).toBeTruthy()

    // Deterministic re-call returns exact same order reference
    const reCall = bridge.orderFor('flt-0', '10,10', 100, 100, true, 500)
    expect(reCall).toBe(gZero)
  })

  it('handles stockout for food and shop without throwing', () => {
    const bridge = new CateringBridge()

    const resFood = bridge.stockout('pax-1', 'food')
    expect(resFood).toBeTruthy()

    const resShop = bridge.stockout('pax-2', 'shop')
    expect(resShop).toBeTruthy()
  })

  it('handles poses with null, negative, NaN, and large kitchen coordinates', () => {
    const bridge = new CateringBridge()

    // Null kitchen
    const nullPoses = bridge.poses(null)
    expect(Array.isArray(nullPoses)).toBe(true)

    // Invalid/NaN kitchen
    const nanPoses = bridge.poses({ c: NaN, r: NaN })
    expect(Array.isArray(nanPoses)).toBe(true)

    // Negative kitchen
    const negPoses = bridge.poses({ c: -10, r: -20 })
    expect(Array.isArray(negPoses)).toBe(true)

    // Large kitchen
    const largePoses = bridge.poses({ c: 1e6, r: 1e6 })
    expect(Array.isArray(largePoses)).toBe(true)

    // Ensure all poses output fields are finite numbers and not NaN
    for (const pose of largePoses) {
      expect(Number.isNaN(pose.x)).toBe(false)
      expect(Number.isNaN(pose.y)).toBe(false)
      expect(Number.isNaN(pose.heading)).toBe(false)
      expect(Number.isNaN(pose.liftHeight)).toBe(false)
    }
  })
})
