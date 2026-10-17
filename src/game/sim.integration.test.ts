import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { SAVE_KEY } from './types.ts'
import { withSeed } from '../test/withSeed.ts'

describe('sim integration', () => {
  it('starter kit → signed airline → flight completes and cash posts', () => {
    withSeed(7, () => {
      const game = new Game()
      game.sandbox = false
      game.beginNew('easy')
      game.startFocus = 'pax'
      expect(game.buyLand('city')).toBe(true)
      game.buildStarterKit()
      expect(game.fits.length).toBeGreaterThan(0)
      game.offer = { airline: 'northline', age: 0, deadline: 36 }
      game.acceptOffer()
      expect(game.signed).toContain('northline')

      const revenueBefore = game.revenue
      game.speed = 5
      let ticks = 0
      let paidOnComplete = false
      while (game.flightsDone < 1 && ticks < 8000) {
        const before = game.flightsDone
        const logged = game.settledPayments.length
        game.tick(0.05)
        ticks += 1
        if (game.flightsDone > before) {
          const fresh = game.settledPayments.slice(logged)
          if (fresh.some((line) => line.amount > 0)) paidOnComplete = true
        }
      }
      expect(game.flightsDone).toBeGreaterThanOrEqual(1)
      expect(game.revenue).toBeGreaterThan(revenueBefore)
      expect(paidOnComplete).toBe(true)
    })
  })

  it('bridge loan wires cash and does not snowball past 1.5×', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('standard')
    expect(game.buyLand('city')).toBe(true)
    game.cash = 80_000
    game.takeLoanProduct('bridge')
    expect(game.loanBalance).toBe(45_000 + 2_800)
    expect(game.cash).toBe(80_000 + 45_000)
    expect(game.site).toBe('city')

    game.interestCool = 0
    game.speed = 1
    game.tick(1)
    expect(game.loanBalance).toBeLessThan(game.loanOpened * 1.5)
    expect(game.site).toBe('city')
    expect(game.cash).toBeLessThan(125_000)
  })

  it('save/load round-trips the field and beginNew clears the save', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.cargoVolume = {
      id: 'vol-round',
      airline: 'northline',
      targetUnits: 12,
      delivered: 3,
      fee: 4200,
      deadline: 200,
      age: 4,
    }
    game.persist()

    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.cargoVolume?.id).toBe('vol-round')
    expect(loaded.signed).toContain('northline')
    expect(loaded.fits.length).toBe(game.fits.length)
    expect(loaded.site).toBe('city')

    loaded.beginNew('easy')
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })
})
