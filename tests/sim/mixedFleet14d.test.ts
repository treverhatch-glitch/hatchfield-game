import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('mixedFleet14d', () => {
  it(
    'runs a 14-day simulation with a mixed passenger and cargo fleet',
    () => {
      withSeed(101, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['northline', 'harbor', 'upps'],
          janitors: 1,
          mechanics: 2,
          deskStaff: 2,
          fuelBrand: 'apex',
          fuelLoads: 20,
          caterBrand: 'skybite',
        })

        const metrics = runSimDays(game, 14, { dt: 0.25, speed: 5 })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(14)
        expect(game.flightsDone).toBeGreaterThan(5)
      })
    },
    20_000,
  )
})
