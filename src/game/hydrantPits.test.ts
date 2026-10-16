import { describe, expect, it } from 'vitest'
import { HYDRANT_CARD } from '../fuel/hydrant.ts'
import { BULLDOZE_REFUND } from './catalog.ts'
import { buildLogisticsConfig } from './logisticsBridge.ts'
import { progressionBuildable } from '../progression/unlocks.ts'
import type { Flight } from './types.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  game.schedule = []
  game.flights = []
  game.spawnCool = 10_000
  game.offerCool = 10_000
  game.cash = 200_000
  return game
}

function ready(game: Game) {
  game.fieldXp = 700
  game.researchUnlocked.push('hydrant_fuel')
}

function parked(stand: { c: number; r: number }, id: string): Flight {
  return {
    id,
    airline: 'harbor',
    flightNo: id,
    airframeId: 'b738',
    airframeName: 'Boeing 737-800',
    pax: 140,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'servicing',
    stand,
    x: stand.c,
    y: stand.r,
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
}

describe('hydrant pits', () => {
  it('stamps a pit on one stand and leaves the others on a bowser', () => {
    const game = field()
    const pit = progressionBuildable('hydrant')!
    expect(game.commission('hydrant')).toBe(false)
    expect(game.news[0]?.text).toMatch(/Field level 5/)
    expect(game.progressionBuilt).not.toContain('hydrant')

    ready(game)
    game.researchUnlocked = game.researchUnlocked.filter((id) => id !== 'hydrant_fuel')
    expect(game.commission('hydrant')).toBe(false)
    expect(game.news[0]?.text).toMatch(/Research the hydrant system/)

    game.researchUnlocked.push('hydrant_fuel')
    expect(game.commission('hydrant')).toBe(true)
    expect(game.hydrantArm).toBe(true)
    expect(game.progressionBuilt).not.toContain('hydrant')

    const cash = game.cash
    const upkeep = game.landsideUpkeep()
    game.clickTile({ c: 4, r: 4 })
    expect(game.news[0]?.text).toMatch(/goes on a stand/)
    expect(game.cash).toBe(cash)

    game.clickTile({ c: 12, r: 7 })
    expect(game.standPits['12,7']).toBe(true)
    expect(game.standPits['12,10']).toBeUndefined()
    expect(game.cash).toBe(cash - pit.cost)
    expect(game.landsideUpkeep() - upkeep).toBe(pit.upkeepPerDay)
    expect(game.progressionBuilt).not.toContain('hydrant')

    game.clickTile({ c: 12, r: 7 })
    expect(game.cash).toBe(cash - pit.cost)
    expect(game.news[0]?.text).toMatch(/already has a pit/)

    game.selectedBuilding = '12,7'
    expect(game.buildingCard()?.note).toBe(HYDRANT_CARD.short)
    game.selectedBuilding = '12,10'
    expect(game.buildingCard()?.note).toBe(HYDRANT_CARD.bowser)

    game.scaleFleet.hydrant_dispenser = 1
    game.selectedBuilding = '12,7'
    expect(game.buildingCard()?.note).toBe(HYDRANT_CARD.hydrant)

    const bare = game.refundFor('stand', { c: 12, r: 10 })
    const withPit = game.refundFor('stand', { c: 12, r: 7 })
    expect(withPit - bare).toBe(Math.round(pit.cost * BULLDOZE_REFUND))
  })

  it('splits the fuel draw by the stand, not by the research flag', () => {
    const game = field()
    ready(game)
    game.flights.push(parked({ c: 12, r: 7 }, 'on-pit'), parked({ c: 12, r: 10 }, 'on-bowser'))
    game.showFuelRack()
    let view = game.fuelView()
    expect(view.hydrantDrawPerMin).toBe(0)
    expect(view.truckDrawPerMin).toBeGreaterThan(0)

    game.commission('hydrant')
    game.clickTile({ c: 12, r: 7 })
    game.scaleFleet.hydrant_dispenser = 1
    game.showFuelRack()
    view = game.fuelView()
    expect(view.hydrantDrawPerMin).toBeGreaterThan(0)
    expect(view.truckDrawPerMin).toBeGreaterThan(0)
    expect(view.hydrantDrawPerMin).toBeCloseTo(view.truckDrawPerMin, 5)

    game.scaleFleet.hydrant_dispenser = 0
    game.showFuelRack()
    view = game.fuelView()
    expect(view.hydrantDrawPerMin).toBe(0)
    expect(view.truckDrawPerMin).toBeGreaterThan(0)

    game.tiles[5][6] = 'depot'
    game.bumpMap()
    const config = buildLogisticsConfig(game.tiles, game.standAccess, false, {
      hydrantStands: ['12,7'],
    })
    expect(config?.stands.find((stand) => stand.id === '12,7')?.hydrant).toBe(true)
    expect(config?.stands.find((stand) => stand.id === '12,10')?.hydrant).toBe(false)
    const all = buildLogisticsConfig(game.tiles, game.standAccess, false, { hydrant: true })
    expect(all?.stands.every((stand) => stand.hydrant)).toBe(true)
  })
})
