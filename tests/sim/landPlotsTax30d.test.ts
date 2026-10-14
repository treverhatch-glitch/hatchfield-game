import { describe, expect, it } from 'vitest'
import {
  assertBoundedCashGrowth,
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('landPlotsTax30d', () => {
  it(
    'runs 30 days with plot expansions and holding taxes with bounded cash growth',
    () => {
      withSeed(707, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['northline'],
          janitors: 1,
          mechanics: 1,
          deskStaff: 1,
        })

        // Buy an extra parcel at start
        game.cash += 50_000
        game.buyParcel()

        const metrics = runSimDays(game, 30, { dt: 0.8, speed: 5 })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        assertBoundedCashGrowth(metrics.cashPerDay, 20, 30, 3)
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(30)
      })
    },
    20_000,
  )
})
