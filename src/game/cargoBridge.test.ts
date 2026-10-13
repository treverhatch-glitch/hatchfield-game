import { describe, expect, it } from 'vitest'
import { defaultConfig, LogisticsSim } from '../logistics/index.ts'
import { Game } from './sim.ts'
import { CARGO_CASH_SCALE, CargoBridge } from './cargoBridge.ts'
import type { Flight, Vec } from './types.ts'

function handlers(sim?: LogisticsSim) {
  const posts: { amount: number; category: string }[] = []
  let bridge: CargoBridge
  bridge = new CargoBridge({
    postMoney: (amount, category) => posts.push({ amount, category }),
    loaders: () =>
      sim
        ? {
            reserve: (request) => sim.reserveLoader(request.flightId, request.preferred, request.allowUldFallback),
            release: (id) => sim.releaseLoader(id),
          }
        : { reserve: () => null, release: () => {} },
    cue: () => {},
    notify: () => {},
    onNotes: () => {},
    standCell: () => ({ c: 4, r: 5 }),
  })
  return { posts, get bridge() { return bridge } }
}

describe('cargo wiring', () => {
  it('reserves a main-deck loader for a 747-8F and posts the airport share once', () => {
    const sim = new LogisticsSim(defaultConfig({
      vehicles: { ...defaultConfig().vehicles, main_deck_loader: 1 },
    }))
    const { posts, bridge } = handlers(sim)
    bridge.adapter.tick(400)
    const load = bridge.prepare('f-heavy', 'b748f', '4,5', 137, 0)
    expect(load.tonnes).toBeGreaterThan(0)
    expect(load.requiredLoader).toBe('main_deck_loader')
    expect(sim.vehicles.some((v) => v.heldFor === 'f-heavy' && v.type === 'main_deck_loader')).toBe(true)
    sim.startTurnaround('stand-4', 'b748f', 80, {
      flightId: 'f-heavy',
      outboundCargoKg: Math.round(load.tonnes * 1000),
      kind: 'outbound',
      departingPax: 0,
    })
    expect(sim.turnaroundAt('stand-4')?.services.cargo_load).toBeTruthy()
    bridge.departed('f-heavy')
    expect(sim.vehicles.some((v) => v.heldFor === 'f-heavy')).toBe(false)
    expect(posts.length).toBeGreaterThan(0)
    expect(posts.every((p) => p.category === 'cargo_airport_revenue')).toBe(true)
    const scaled = bridge.adapter.snapshot().airportRevenue * CARGO_CASH_SCALE
    expect(posts.reduce((sum, p) => sum + p.amount, 0)).toBeCloseTo(scaled, 1)
    expect(scaled).toBeLessThan(bridge.adapter.snapshot().handlerRevenue)
  })

  it('rejects freight when no loader is free and raises an advisor card', () => {
    const { bridge } = handlers()
    bridge.adapter.tick(400)
    const load = bridge.prepare('f-none', 'b748f', '4,5', 137, 0)
    expect(load.tonnes).toBe(0)
    expect(load.rejected.some((entry) => /loader/i.test(entry.reason))).toBe(true)
    expect(bridge.notes.some((n) => n.title === 'No cargo loader free')).toBe(true)
  })

  it('aggregates inbound tug loads into one import shipment', () => {
    const { bridge } = handlers()
    bridge.prepare('f-in', 'b738', '4,5', 4, 20)
    bridge.inbound('4,5', 4000, 9000)
    bridge.inbound('4,5', 5000, 9000)
    const imports = bridge.adapter.snapshot().imports
    expect(imports).toHaveLength(1)
    expect(imports[0]?.id).toBe('imp_f-in')
    expect(imports[0]?.tonnes).toBeCloseTo(9)
  })
})

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
    id: 'flt-heavy',
    airline: 'northline',
    flightNo: 'NL200',
    airframeId: 'b748f',
    airframeName: '747-8F',
    pax: 0,
    cargo: true,
    craft: 'jet',
    kind: 'freighter',
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
      catering: true,
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

describe('cargo on the field', () => {
  it('arms a freighter turnaround with a reserved main-deck loader', () => {
    const game = field()
    game.tiles[10][15] = 'depot'
    game.bumpMap()
    for (let i = 0; i < 10; i++) game.tick(5)
    const f = parked(game, { c: 12, r: 21 })
    game.beginServicing(f)
    expect(f.groundTurn).toBe('12,21')
    expect(game.loaderHold(f.id)).toBe('main_deck_loader')
    expect(game.cargoLoadArmed('12,21')).toBe(true)
    const snap = game.cargoSnapshot()
    expect(snap?.reservedTonnes ?? 0).toBeGreaterThan(0)
    expect(game.groundBooks.cargoRevenue).toBe(0)
    game.crashCool = 1e9
    f.phase = 'takeoff'
    f.phaseTime = 30
    f.z = 8
    game.tick(0.2)
    expect(game.groundBooks.cargoRevenue).toBeGreaterThan(0)
    expect(game.loaderHold(f.id)).toBeNull()
  })
})
