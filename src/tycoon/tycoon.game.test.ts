import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { CAMPAIGNS, DAYS_PER_YEAR } from './config.ts'

function airport() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 80_000
  game.scheduleAuto = false
  game.speed = 0
  return game
}

describe('tycoon hooks on the field', () => {
  it('bids on starter food and shop units and pays rent into cash and the bank', () => {
    const game = airport()
    const before = game.cash
    game.pokeTycoon()
    const units = game.tycoonView().units
    expect(units.some((u) => u.kind === 'food' && u.bids.length === 3)).toBe(true)
    expect(units.some((u) => u.kind === 'retail' && u.bids.length === 3)).toBe(true)
    const food = units.find((u) => u.kind === 'food')!
    game.acceptTenantBid(food.id, food.bids[0].id)
    game.clock = 180
    game.pokeTycoon()
    expect(game.cash).toBeGreaterThan(before)
    expect(game.bank.ledger().byCategory.contract_fees).toBe(food.bids[0].dailyRent)
    expect(game.tycoonView().units.find((u) => u.id === food.id)?.lease?.brand).toBe(food.bids[0].brand)
  })

  it('spends campaign cash even in the trial sandbox and then lets demand lapse', () => {
    const game = airport()
    game.sandbox = true
    const cost = CAMPAIGNS.find((c) => c.kind === 'airline')!.cost
    const before = game.cash
    expect(game.tycoonDemand()).toBe(1)
    game.startAdCampaign('airline')
    expect(game.cash).toBe(before - cost)
    expect(game.bank.ledger().byCategory.advertising).toBe(-cost)
    expect(game.tycoonDemand()).toBeGreaterThan(1)
    expect(game.tycoonAirlineInterest()).toBeGreaterThan(0)
    game.startAdCampaign('local')
    expect(game.cash).toBe(before - cost)
    const days = CAMPAIGNS.find((c) => c.kind === 'airline')!.days
    game.clock = 180 * days
    game.pokeTycoon()
    expect(game.tycoonDemand()).toBe(1)
    expect(game.tycoonAirlineInterest()).toBe(0)
  })

  it('shows the year report once, then again only on the next year', () => {
    const game = airport()
    game.pokeTycoon()
    const food = game.tycoonView().units.find((u) => u.kind === 'food')!
    game.acceptTenantBid(food.id, food.bids[2].id)
    expect(game.pendingYearReport()).toBeNull()
    game.clock = 180 * DAYS_PER_YEAR
    game.pokeTycoon()
    const report = game.pendingYearReport()
    expect(report?.year).toBe(1)
    expect(report?.revenue).toBeGreaterThan(0)
    expect(report?.best.label).not.toBe(report?.worst.label)
    game.dismissYearReport()
    expect(game.pendingYearReport()).toBeNull()
    game.clock = 180 * (DAYS_PER_YEAR + 1)
    game.pokeTycoon()
    expect(game.pendingYearReport()).toBeNull()
    game.clock = 180 * DAYS_PER_YEAR * 2
    game.pokeTycoon()
    expect(game.pendingYearReport()?.year).toBe(2)
  })
})
