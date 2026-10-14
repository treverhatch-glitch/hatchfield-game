import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cogsFor } from '../catering/hallShelf'
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock'
import { Game } from './sim'

function starter(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

describe('prefab hall stock', () => {  it('holds a shelf still when no runner is asked', () => {
    const sim = readFileSync('src/game/sim.ts', 'utf8')
    expect(sim).not.toMatch(/this\.foodShelf\s*\+=/)
    expect(sim).not.toMatch(/this\.shopShelf\s*\+=/)
    const game = starter()
    game.setHallReorder('food', 0)
    game.setHallReorder('shop', 0)
    game.foodShelf = 3
    game.shopShelf = 3
    game.setSpeed(1)
    for (let i = 0; i < 40; i++) game.tick(0.5)
    expect(game.foodShelf).toBeLessThanOrEqual(3)
    expect(game.shopShelf).toBeLessThanOrEqual(3)
    game.foodShelf = 0
    game.shopShelf = 0
    const lines = game.infoLines('retail')
    expect(lines[0]).toMatch(/^Out of stock, restock run \d+ s away$/)
    expect(lines[1]).toMatch(/^Out of stock, restock run \d+ s away$/)
  })

  it('posts retail_cogs for the cash the restock moved', () => {
    const game = starter()
    game.setHallReorder('shop', 0)
    game.setHallReorder('food', 80)
    game.foodShelf = 10
    game.setSpeed(1)
    const expected = -cogsFor({ burger: 70, water: 20 })
    let posted = false
    for (let i = 0; i < 800 && !posted; i++) {
      const before = game.bank.ledger().entries.length
      const cash = game.cash
      game.tick(0.05)
      const fresh = game.bank.ledger().entries.slice(before)
      const cogs = fresh.filter((e) => e.category === 'retail_cogs')
      if (cogs.length === 0) continue
      posted = true
      const cogsSum = cogs.reduce((sum, e) => sum + e.amount, 0)
      const other = fresh.reduce((sum, e) => sum + e.amount, 0) - cogsSum
      expect(cogsSum).toBe(expected)
      expect(game.cash - cash).toBeCloseTo(other + cogsSum, 5)
      expect(game.cash).toBeCloseTo(game.bank.balance, 5)
    }
    expect(posted).toBe(true)
  })

  it('does not empty the starter shelves in the first three days', () => {
    const game = starter()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.setSpeed(1)
    let minFood = game.foodShelf
    let minShop = game.shopShelf
    const steps = Math.round((REAL_SECONDS_PER_GAME_DAY * 3) / 1)
    for (let i = 0; i < steps; i++) {
      game.tick(1)
      minFood = Math.min(minFood, game.foodShelf)
      minShop = Math.min(minShop, game.shopShelf)
    }
    expect(minFood).toBeGreaterThan(0)
    expect(minShop).toBeGreaterThan(0)
    expect(game.foodCourtRevenue).toBeGreaterThan(0)
  }, 180_000)
})
