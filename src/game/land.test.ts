import { describe, expect, it } from 'vitest'
import { payrollForGameDay } from '../core/bank.ts'
import { LAND_PLOT } from './catalog.ts'
import { cityLevy } from './economy.ts'
import { BAG_SYSTEMS, PAX_UNITS } from '../scale/data.ts'
import { Game } from './sim.ts'
import { SAVE_KEY, SANDBOX_CASH } from './types.ts'

describe('land plots in the sim', () => {
  it('grants the starter plot with the site and sells the next one at field level 2', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('standard')
    expect(game.buyLand('city')).toBe(true)
    expect(game.parcels).toBe(1)
    expect(game.ownedPlots).toHaveLength(1)
    game.cash = 200_000
    const before = game.cash
    expect(game.buyParcel()).toBe(false)
    expect(game.parcels).toBe(1)
    expect(game.cash).toBe(before)
    expect(game.news[0]?.text ?? '').toMatch(/Field Level 2/)

    game.grantFieldXp(90)
    const offer = game.nextParcelOffer()
    expect(offer?.locked).toBe(false)
    expect(game.buyParcel()).toBe(true)
    expect(game.parcels).toBe(2)
    expect(game.cash).toBe(before - (offer?.price ?? 0))
    expect(game.buyPlot(game.ownedPlots[1]!.id)).toBe(false)
  })

  it('posts land holding once per game day and waives it in sandbox', () => {
    const live = new Game()
    live.sandbox = false
    live.beginNew('standard')
    live.buyLand('city')
    live.cash = 80_000
    const holding = live.dailyHoldingQuote()
    expect(holding).toBeGreaterThan(0)
    const upkeep = live.landsideUpkeep()
    const pillar =
      BAG_SYSTEMS.carts.upkeepPerDay +
      2 * PAX_UNITS.desk.upkeepPerDay +
      PAX_UNITS.scanner.upkeepPerDay
    const payroll = payrollForGameDay(0, 'early', live.payrollPreview())
    live.clock = 180
    live.tickPayroll(0)
    const afterBills = 80_000 - upkeep - pillar - holding - payroll
    expect(live.cash).toBe(afterBills - cityLevy(afterBills))
    expect(live.news.some((item) => item.text.includes('land holding'))).toBe(true)
    const settled = live.cash
    live.tickPayroll(0)
    expect(live.cash).toBe(settled)

    live.toggleMaintenanceContract()
    expect(live.dailyHoldingQuote()).toBe(holding + LAND_PLOT.maintenanceContract)

    const sandbox = new Game()
    sandbox.sandbox = true
    sandbox.beginNew('easy')
    sandbox.buyLand('city')
    sandbox.cash = SANDBOX_CASH
    expect(sandbox.dailyHoldingQuote()).toBe(0)
    const bill = sandbox.payrollPreview()
    sandbox.clock = 180
    sandbox.tickPayroll(0)
    expect(sandbox.cash).toBe(SANDBOX_CASH - bill)
  })

  it('keeps owned plots and the maintenance contract in the save', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('factory')
    game.grantFieldXp(90)
    game.cash = 200_000
    expect(game.buyParcel()).toBe(true)
    game.toggleMaintenanceContract()
    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.parcels).toBe(game.parcels)
    expect(loaded.ownedPlots).toEqual(game.ownedPlots)
    expect(loaded.maintenanceContract).toBe(true)
    localStorage.removeItem(SAVE_KEY)
  })
})
