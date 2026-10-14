import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('litterAndJanitors', () => {
  it(
    'simulates passenger litter accumulation and janitors sweeping terminal halls',
    () => {
      withSeed(606, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['northline', 'harbor'],
          janitors: 2,
          deskStaff: 2,
        })

        const metrics = runSimDays(game, 7, { dt: 0.25, speed: 5 })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(7)
        expect(game.janitors).toBe(2)
      })
    },
    15_000,
  )
})
