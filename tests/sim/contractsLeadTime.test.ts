import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('contractsLeadTime', () => {
  it(
    'evaluates airline contract offers and schedule lead time execution',
    () => {
      withSeed(909, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: [], // Start with no signed airlines to test incoming offers
          deskStaff: 1,
          mechanics: 1,
        })

        // Trigger offer arrival
        game.offerCool = 0
        game.considerOffers()

        const metrics = runSimDays(game, 10, {
          dt: 0.25,
          speed: 5,
          onTick: (g) => {
            if (g.offer) {
              g.acceptOffer()
            }
          },
        })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(10)
        expect(game.signed.length).toBeGreaterThan(0)
      })
    },
    15_000,
  )
})
