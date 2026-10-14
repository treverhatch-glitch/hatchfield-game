import { describe, expect, it } from 'vitest'
import {
  assertBoundedCashGrowth,
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('longRun30dNoStuck', () => {
  it(
    'runs for 30 game days with zero stuck vehicles and bounded cash growth',
    () => {
      withSeed(1111, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['northline', 'harbor'],
          janitors: 2,
          mechanics: 2,
          deskStaff: 2,
          fuelBrand: 'apex',
          fuelLoads: 30,
        })

        const metrics = runSimDays(game, 30, { dt: 0.8, speed: 5 })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        assertBoundedCashGrowth(metrics.cashPerDay, 20, 30, 3)
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(30)
        expect(game.flightsDone).toBeGreaterThan(10)
      })
    },
    20_000,
  )
})
