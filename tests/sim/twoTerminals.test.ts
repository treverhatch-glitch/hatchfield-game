import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('twoTerminals', () => {
  it(
    'operates a multi-terminal campus with routing across both halls',
    () => {
      withSeed(303, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['northline', 'harbor'],
          janitors: 2,
          deskStaff: 3,
          mechanics: 2,
          customSetup: (g) => {
            // Stamp a second prefab terminal at origin (c5, r10)
            const origin2 = { c: 5, r: 10 }
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                g.tiles[origin2.r + r][origin2.c + c] = 'terminal'
              }
            }
            // Add a stand beside terminal 2
            g.tiles[12][2] = 'stand'
            g.standClass['2,12'] = 'M'
            g.standAccess['2,12'] = 'jetway'
            // Taxi link for stand 2 to the runway
            for (let r = 13; r <= 25; r++) {
              g.tiles[r][2] = 'taxi'
            }

            g.fits.push({
              origin: origin2,
              premade: true,
              tier: 1,
              rooms: {
                checkin: 2,
                security: 2,
                gate: 2,
                bagclaim: 1,
                food: 1,
                souvenir: 1,
                bagdrop: 1,
                lounge: 1,
                bathroom: 2,
                rdesk: 0,
                rboard: 0,
                rmachine: 0,
                golf: 0,
                waterfall: 0,
                gaming: 0,
                dayhotel: 0,
                spa: 0,
                pool: 0,
              },
              wearBath: 0,
              wearSec: 0,
              claimRate: 0.8,
            })
            g.assignHallStaff()
          },
        })

        expect(game.fits.length).toBe(2)

        const metrics = runSimDays(game, 10, { dt: 0.25, speed: 5 })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(10)
        expect(game.flightsDone).toBeGreaterThan(0)
      })
    },
    20_000,
  )
})
