import { describe, expect, it } from 'vitest'
import {
  assertBoundedCashGrowth,
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('inboundRequests30d', () => {
  it(
    'handles inbound requests and emergency calls over 30 days with bounded cash growth',
    () => {
      withSeed(808, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['northline'],
          janitors: 1,
          mechanics: 1,
          deskStaff: 1,
        })

        const metrics = runSimDays(game, 30, {
          dt: 0.8,
          speed: 5,
          onTick: (g) => {
            // Automatically respond to pending emergencies or inbound offers
            if (g.pendingEmergency && g.canHostEmergency(g.pendingEmergency)) {
              g.resolveEmergency('accept')
            }
            if (g.pendingThreat) {
              g.resolveThreat('scramble')
            }
            const offer = g.inboundOffer()
            if (offer) {
              g.acceptInbound(offer.id)
            }
          },
        })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        assertBoundedCashGrowth(metrics.cashPerDay, 20, 30, 3)
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(30)
      })
    },
    20_000,
  )
})
