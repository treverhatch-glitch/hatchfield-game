import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'

function completedTurn(): Flight {
  return {
    id: 'carbon-turn',
    airline: 'northline',
    flightNo: 'NL401',
    airframeId: 'a320neo',
    airframeName: 'Airbus A320neo',
    pax: 150,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'gone',
    stand: { c: 4, r: 4 },
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
      bags: true,
      bagsLoad: true,
      fuel: true,
      catering: true,
      bagDrop: true,
      mx: true,
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
}

describe('live carbon tracking', () => {
  it('records completed flights and buildings, buys offsets, completes Green Pioneer, and saves it', () => {
    const game = new Game()
    game.beginNew('easy')
    expect(game.buyLand('city')).toBe(true)
    game.tiles[6][6] = 'fuel'
    expect(game.startGreenPioneer()).toBe(true)

    game.noteTurn(completedTurn())
    game.clock = 180
    game.sampleEconomy(1)

    const open = game.carbonView()
    expect(open.latestDay?.flights).toHaveLength(1)
    expect(open.latestDay?.flights[0]).toMatchObject({
      flightNo: 'NL401',
      aircraftClass: 'narrowbody',
      kg: 2500,
    })
    expect(open.latestDay?.buildings).toContainEqual({
      id: 'fuel:6,6',
      type: 'fuel',
      label: 'Fuel farm',
      kg: 120,
    })
    expect(open.greenPioneer?.status).toBe('running')

    const cash = game.cash
    expect(game.buyCarbonOffsets()).toBe(true)
    expect(game.cash).toBeLessThan(cash)
    expect(game.carbonView().greenPioneer?.status).toBe('met')
    expect(game.carbonView().netTonnes).toBe(0)

    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.carbonView().greenPioneer?.status).toBe('met')
    expect(loaded.carbonView().latestDay?.flights[0]?.flightNo).toBe('NL401')
  })
})
