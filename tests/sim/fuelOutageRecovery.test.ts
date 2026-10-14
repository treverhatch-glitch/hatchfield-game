import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('fuelOutageRecovery', () => {
  it(
    'handles fuel depletion and resumes flight turnarounds when fuel stock is restored',
    () => {
      withSeed(404, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['northline'],
          fuelBrand: 'apex',
          fuelLoads: 0, // Depleted fuel at start to simulate fuel outage
        })

        let outageObserved = false

        const metrics = runSimDays(game, 10, {
          dt: 0.25,
          speed: 5,
          onDayClose: (g, day) => {
            if (day === 2) {
              if (g.fuelLoads <= 0) {
                outageObserved = true
              }
              // Resupply fuel on day 2
              g.fuelLoads += 15
              g.tankLitres += 15_000
            }
          },
        })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(outageObserved).toBe(true)
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(10)
        expect(game.flightsDone).toBeGreaterThan(0)
      })
    },
    20_000,
  )
})
