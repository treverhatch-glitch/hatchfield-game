import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('nightOps', () => {
  it(
    'executes night operations and cargo night banks without state issues',
    () => {
      withSeed(1010, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['upps', 'northline'],
          janitors: 1,
          mechanics: 1,
          deskStaff: 1,
          customSetup: (g) => {
            // Unlock night_bank research
            g.researchUnlocked.push('night_bank')
            g.researchPoints = 100
          },
        })

        let nightOpsCount = 0

        const metrics = runSimDays(game, 10, {
          dt: 0.25,
          speed: 5,
          onTick: (g) => {
            if (g.isNight()) {
              nightOpsCount++
            }
          },
        })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(10)
        expect(nightOpsCount).toBeGreaterThan(0)
      })
    },
    20_000,
  )
})
