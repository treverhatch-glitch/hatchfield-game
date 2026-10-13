import { describe, expect, it } from 'vitest'
import { RoadGraph } from '../logistics/roads.ts'
import { buildLogisticsConfig } from './logisticsBridge.ts'
import { Game } from './sim.ts'
import { SIZE, type Flight, type Vec } from './types.ts'
import { walkableFor } from './path.ts'

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
  return game
}

function findGrass(game: Game, besidePavement: boolean): Vec | null {
  for (let r = 1; r < SIZE - 1; r++) {
    for (let c = 1; c < SIZE - 1; c++) {
      const v = { c, r }
      if (game.tile(v) !== 'grass' || game.siteAt(v)) continue
      const near = [
        { c: c + 1, r },
        { c: c - 1, r },
        { c: c, r: r + 1 },
        { c, r: r - 1 },
      ].some((p) => {
        const tile = game.tile(p)
        return tile === 'taxi' || tile === 'stand' || tile === 'runway' || tile === 'road'
      })
      if (near === besidePavement) return v
    }
  }
  return null
}

function parked(game: Game, stand: Vec): Flight {
  const f: Flight = {
    id: 'flt-ramp',
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
  game.flights.push(f)
  return f
}

describe('ground logistics wiring', () => {
  it('gates the kitchen and depot on field level, and leaves the fuel farm at level 1', () => {
    const game = field()
    expect(game.fieldLevel()).toBe(1)
    const cell = findGrass(game, true)
    expect(cell).toBeTruthy()
    game.setTool('kitchen')
    game.placeSingle(cell!)
    expect(game.sites).toHaveLength(0)
    expect(game.tile(cell!)).toBe('grass')
    expect(game.news.some((n) => n.text.includes('Field level 2'))).toBe(true)

    game.setTool('depot')
    game.placeSingle(cell!)
    expect(game.sites).toHaveLength(0)

    game.fieldXp = 90
    expect(game.fieldLevel()).toBe(2)
    game.setTool('depot')
    game.placeSingle(cell!)
    expect(game.sites).toHaveLength(1)
    expect(game.sites[0].tile).toBe('depot')

    const farm = findGrass(game, true)
    const fresh = field()
    const fuelCell = findGrass(fresh, true)
    fresh.setTool('fuel')
    fresh.placeSingle(fuelCell!)
    expect(fresh.sites).toHaveLength(1)
    expect(fresh.sites[0].tile).toBe('fuel')
    expect(farm).toBeTruthy()
  })

  it('keeps the starter kit on the old fuel truck until a depot exists', () => {
    const game = field()
    expect(game.groundSnapshot()).toBeNull()
    expect(game.servicePoses()).toEqual([])
    const f = parked(game, { c: 12, r: 21 })
    game.beginServicing(f)
    expect(f.groundTurn).toBeFalsy()
    expect(game.trucks.some((t) => t.kind === 'fuel')).toBe(true)
  })

  it('builds a service-road graph and runs the turnaround through the module', () => {
    const game = field()
    game.tiles[10][15] = 'depot'
    game.tiles[10][17] = 'kitchen'
    game.bumpMap()
    const config = buildLogisticsConfig(game.tiles, game.standAccess, false)
    expect(config).toBeTruthy()
    const roads = new RoadGraph(config!.nodes, config!.edges)
    expect(roads.distance(config!.depotNode, '12,21')).toBeLessThan(Infinity)
    expect(config!.stands.find((s) => s.id === '12,21')?.access).toBe('bridge')
    expect(roads.route(config!.depotNode, '12,21').length).toBeGreaterThan(2)

    const f = parked(game, { c: 12, r: 21 })
    game.beginServicing(f)
    expect(f.groundTurn).toBe('12,21')
    expect(game.trucks.some((t) => t.kind === 'fuel' || t.kind === 'catering')).toBe(false)

    game.tick(3)
    const poses = game.servicePoses()
    expect(poses.length).toBeGreaterThan(0)
    const moved = poses.filter((p) => Math.hypot(p.x - 15, p.y - 10) > 0.4)
    expect(moved.length).toBeGreaterThan(0)
    for (const pose of moved) {
      const tile = game.tile({ c: Math.round(pose.x), r: Math.round(pose.y) })
      expect(tile && walkableFor('truck', tile)).toBe(true)
    }

    let ready = false
    for (let i = 0; i < 24 && !ready; i++) {
      game.tick(5)
      ready = game.groundClear(f)
    }
    expect(ready).toBe(true)
    expect(game.groundBooks.fuelSales).toBeGreaterThan(0)
    expect(game.groundBooks.cateringFees).toBeGreaterThan(0)
    expect(f.posted.fuel).toBe(true)
    expect(game.cash).toBeGreaterThan(400_000)
  })

  it('warns in the advisor when the kitchen is missing', () => {
    const game = field()
    game.tiles[10][15] = 'depot'
    game.bumpMap()
    game.tick(1)
    const note = game.advice.find((a) => a.id === 'low-meals')
    expect(note?.title).toBe('Catering kitchen running low')
    expect(note?.fix).toMatch(/catering kitchen/i)
    expect(note?.scope).toBe('apron')
    expect(game.hallGuests.filter((g) => g.lost).length).toBe(0)
  })
})
