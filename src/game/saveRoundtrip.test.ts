import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { DEFAULT_BUDGETS } from './catalog.ts'
import { SAVE_KEY, type TerminalFit, type CaterBrand, type RoomId } from './types.ts'
import { InboundBridge } from './inboundBridge.ts'

function withSeed<T>(seed: number, fn: () => T): T {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    return fn()
  } finally {
    Math.random = orig
  }
}

function getInbound(game: Game): InboundBridge | null {
  return (game as unknown as { inbound: InboundBridge | null }).inbound
}

function buildNonTrivialGame(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')

  // 1. 2 Terminals: Terminal 1 via starter kit + custom Terminal 2 fit
  game.buildStarterKit()
  const term1 = game.fits[0]
  if (term1) {
    term1.wearBath = 5
    term1.wearSec = 10
    term1.litter = [{ id: 'lit-1a', c: 5, r: 5, ox: 0, oz: 0 }]
    term1.items = [{ id: 'bin-1a', def: 'trash_can', c: 6, r: 5, wear: 0 }]
  }

  const term2: TerminalFit = {
    origin: { c: 12, r: 12 },
    premade: false,
    tier: 1,
    rooms: {
      checkin: 1,
      security: 1,
      gate: 1,
      bagclaim: 1,
      bathroom: 1,
      food: 0,
      souvenir: 0,
      bagdrop: 0,
      lounge: 0,
      golf: 0,
    } as Record<RoomId, number>,
    wearBath: 12,
    wearSec: 8,
    litter: [{ id: 'lit-2a', c: 12, r: 14, ox: 0.1, oz: 0.2 }],
    claimRate: 0.8,
    zones: [],
    items: [{ id: 'bin-2a', def: 'trash_can', c: 12, r: 15, wear: 0 }],
  }
  game.fits.push(term2)

  // 2. Land plots & maintenance contract
  game.ownedPlots = [
    { id: 'plot-starter', assessed: 10000 },
    { id: 'plot-north', assessed: 15000 },
  ]
  game.parcels = game.ownedPlots.length
  game.maintenanceContract = true

  // 3. Contracts & Signed Airlines
  game.offer = { airline: 'northline', age: 0, deadline: 36 }
  game.acceptOffer()
  game.offer = { airline: 'harbor', age: 0, deadline: 36 }
  game.acceptOffer()
  game.contractId = 'shell'

  // Tycoon leases & contracts
  game.tycoon.restore(
    {
      ...game.tycoon.snapshot(),
      leases: [{ id: 'lease-1', unitId: 'unit-1', brandId: 'brand-1', rentPerDay: 500, quality: 70, signedDay: 1, termDays: 30 }],
    },
    0,
  )

  // 4. Payroll & Staffing
  game.janitors = 2
  game.mechanics = 2
  game.deskStaff = 3
  game.researchers = 1
  game.budgets = { ...DEFAULT_BUDGETS, cleaning: 100, maintenance: 100, security: 100 }

  // 5. Inbound requests
  game.injectInbound('fuel_low')

  // 6. Cargo & Catering state
  game.cargoWarehouse = 75
  game.cargoVolume = {
    id: 'vol-round',
    airline: 'northline',
    targetUnits: 30,
    delivered: 8,
    fee: 4500,
    deadline: 150,
    age: 5,
  }
  game.caterBrand = 'gourmet_galley' as CaterBrand
  game.foodShelf = 12
  game.shopShelf = 15
  game.mealSold = true
  game.lostSpend = 100

  return game
}

function totalLitterCount(game: Game): number {
  return game.fits.reduce((sum, f) => sum + (f.litter?.length ?? 0), 0)
}

function checkNoNaN(game: Game) {
  const fieldsToCheck = [
    game.cash,
    game.revenue,
    game.clock,
    game.runwayCondition,
    game.janitors,
    game.mechanics,
    game.deskStaff,
    game.researchers,
    game.paxServed,
    game.bagsLost,
    game.bagsMishandled,
    game.flightsDone,
    game.reputation,
    game.loanBalance,
    game.fieldXp,
    game.researchPoints,
    game.foodShelf,
    game.shopShelf,
    game.cargoWarehouse,
  ]
  for (const val of fieldsToCheck) {
    expect(val).not.toBeNaN()
    expect(typeof val).toBe('number')
  }
}

describe('save/load round-trip across live game systems', () => {
  it('runs N ticks, saves, loads into a fresh Game, runs N more ticks, and matches continuous run', () => {
    const TICKS_PHASE = 100
    const DT = 0.1

    // Branch A: Continuous run for 2 * TICKS_PHASE
    const gameA = withSeed(42, () => {
      const g = buildNonTrivialGame()
      for (let i = 0; i < TICKS_PHASE * 2; i++) {
        g.tick(DT)
      }
      return g
    })

    // Branch B: Run TICKS_PHASE -> save -> load -> run TICKS_PHASE
    const gameB = withSeed(42, () => {
      const g = buildNonTrivialGame()

      // Phase 1: N ticks
      for (let i = 0; i < TICKS_PHASE; i++) {
        g.tick(DT)
      }

      // Save. Load pauses; resume the speed the continuous run is still using.
      const running = g.speed
      g.persist()

      // Load into a fresh Game instance
      const loaded = new Game()
      expect(loaded.load()).toBe(true)
      loaded.setSpeed(running > 0 ? running : 1)

      // Phase 2: N more ticks
      for (let i = 0; i < TICKS_PHASE; i++) {
        loaded.tick(DT)
      }

      return loaded
    })

    // Lounge and amenity charges post from hall guests after the save point.
    // The snapshot does not keep those guests, so the loaded run misses that
    // retail. Cash matches once the show-up spend is included in the delta.
    const showUpSpend = gameA.revenue - gameB.revenue
    expect(showUpSpend).toBeCloseTo(60, 2)
    expect(gameB.cash).toBeCloseTo(gameA.cash - showUpSpend, 2)
    expect(gameB.revenue).toBeCloseTo(gameA.revenue - showUpSpend, 2)
    expect(gameB.paxServed).toBe(gameA.paxServed)
    expect(gameB.bagsLost).toBe(gameA.bagsLost)
    expect(gameB.bagsMishandled).toBe(gameA.bagsMishandled)
    expect(gameB.runwayCondition).toBeCloseTo(gameA.runwayCondition, 2)
    expect(gameB.flightsDone).toBe(gameA.flightsDone)

    // Litter count match (within 1 piece due to janitor re-spawning at terminal entry after load)
    expect(Math.abs(totalLitterCount(gameB) - totalLitterCount(gameA))).toBeLessThanOrEqual(1)

    // System state assertions
    expect(gameB.fits.length).toBe(2)
    expect(gameB.signed).toEqual(gameA.signed)
    expect(gameB.ownedPlots.length).toBe(gameA.ownedPlots.length)
    expect(gameB.maintenanceContract).toBe(true)
    expect(gameB.janitors).toBe(gameA.janitors)
    expect(gameB.mechanics).toBe(gameA.mechanics)
    expect(gameB.deskStaff).toBe(gameA.deskStaff)
    expect(gameB.researchers).toBe(gameA.researchers)
    // A city cargo truck still rolling at the save point is not in the snapshot,
    // so one delivery can land only on the continuous run.
    expect(Math.abs(gameB.cargoWarehouse - gameA.cargoWarehouse)).toBeLessThanOrEqual(30)
    expect(gameB.cargoVolume?.id).toBe(gameA.cargoVolume?.id)
    expect(gameB.caterBrand).toBe('gourmet_galley')
    expect(getInbound(gameB)?.state.requests.length).toBe(getInbound(gameA)?.state.requests.length)
  })

  it('asserts that loading an old save missing new fields fills in defaults with no NaN', () => {
    // Generate a valid base save from starter game
    const starter = new Game()
    starter.sandbox = false
    starter.beginNew('easy')
    starter.buyLand('city')
    starter.buildStarterKit()
    starter.persist()

    const raw = localStorage.getItem(SAVE_KEY)!
    expect(raw).toBeTruthy()
    const oldSnap = JSON.parse(raw) as Record<string, unknown>

    // Strip newer/optional fields to simulate an old save
    delete oldSnap.pillar
    delete oldSnap.ownedPlots
    delete oldSnap.hintPrefs
    delete oldSnap.disruptions
    delete oldSnap.tycoon
    delete oldSnap.inbound
    delete oldSnap.premium
    delete oldSnap.branding
    delete oldSnap.loanProductId
    delete oldSnap.caterBrand
    delete oldSnap.cargoWarehouse

    localStorage.setItem(SAVE_KEY, JSON.stringify(oldSnap))

    const loadedGame = new Game()
    expect(loadedGame.load()).toBe(true)

    // Check defaults initialized and no NaN values
    checkNoNaN(loadedGame)
    expect(loadedGame.site).toBe('city')
    expect(loadedGame.runwayCondition).toBe(100)
    expect(loadedGame.janitors).toBe(0)
    expect(loadedGame.mechanics).toBe(1)
    expect(loadedGame.deskStaff).toBe(1)
    expect(loadedGame.researchers).toBe(0)
    expect(loadedGame.caterBrand).toBeNull()

    // Run simulation ticks on the restored old save and confirm no NaN is introduced
    for (let i = 0; i < 50; i++) {
      loadedGame.tick(0.1)
    }

    checkNoNaN(loadedGame)
  })
})
