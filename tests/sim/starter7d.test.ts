import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('starter7d', () => {
  it(
    'runs a starter kit airport for 7 days without lost pax, lost bags, or stuck vehicles',
    () => {
      withSeed(42, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['northline'],
          deskStaff: 1,
          mechanics: 1,
        })

        const metrics = runSimDays(game, 7, { dt: 0.25, speed: 5 })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(7)
        expect(game.flightsDone).toBeGreaterThan(0)
        expect(game.cash).toBeGreaterThan(0)
      })
    },
    15_000,
  )
})
