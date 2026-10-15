import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.beginNew('standard')
  game.buyLand('city')
  return game
}

describe('opt-in scenarios', () => {
  it('leaves a new game without a scenario', () => {
    const game = field()
    expect(game.scenarioRun).toBeNull()
    expect(game.scenarioNoPlots).toBe(false)
    expect(game.nextParcelOffer()).not.toBeNull()
  })

  it('blocks further parcels on Island Hop and refuses a second start', () => {
    const game = field()
    expect(game.startScenario('island-hop')).toBe(true)
    expect(game.scenarioRun?.status).toBe('running')
    expect(game.nextParcelOffer()).toBeNull()
    expect(game.buyParcel()).toBe(false)
    expect(game.news[0]?.text).toContain('no further parcels')
    expect(game.startScenario('mega-hub')).toBe(false)
    expect(game.scenarioRun?.id).toBe('island-hop')
  })

  it('puts rescue debt on the loan book without wiring cash', () => {
    const game = field()
    const cash = game.cash
    expect(game.startScenario('rescue-failing-airport')).toBe(true)
    expect(game.cash).toBe(cash)
    expect(game.loanBalance).toBe(250_000)
    expect(game.loanProductId).toBe('bridge')
  })

  it('keeps a scenario curfew and a runway cap, and scores the passenger goal on the day close', () => {
    const game = field()
    expect(game.startScenario('cramped-city')).toBe(true)
    expect(game.scenarioCurfew).toBe(true)

    const mountain = field()
    expect(mountain.startScenario('mountain-gateway')).toBe(true)
    expect(mountain.scenarioMaxRunwayM).toBe(1800)
    mountain.chooseFreehand()
    mountain.scenarioMaxRunwayM = 200
    const cash = mountain.cash
    mountain.placeRunway({ c: 2, r: 20 })
    expect(mountain.cash).toBe(cash)
    expect(mountain.news[0]?.text).toContain('200 m')

    const hop = field()
    hop.startScenario('island-hop')
    hop.dayPax = 500
    hop.clock = 180
    hop.sampleEconomy(1)
    expect(hop.scenarioRun?.status).toBe('met')
    expect(hop.scenarioNoPlots).toBe(false)
    expect(hop.news[0]?.text).toContain('Island Hop met')
  })

  it('restores a running scenario without charging the debt again', () => {
    const game = field()
    game.startScenario('rescue-failing-airport')
    expect(game.loanBalance).toBe(250_000)
    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.scenarioRun?.id).toBe('rescue-failing-airport')
    expect(loaded.scenarioRun?.status).toBe('running')
    expect(loaded.loanBalance).toBe(250_000)
  })
})
