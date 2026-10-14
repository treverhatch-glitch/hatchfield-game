import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('heavyJetStress', () => {
  it(
    'runs heavy jet operations on a heavy runway without stuck vehicles or state errors',
    () => {
      withSeed(202, () => {
        const game = createTestAirport({
          difficulty: 'easy',
          starterKit: true,
          signedAirlines: ['summit', 'exfed'],
          mechanics: 2,
          deskStaff: 2,
          fuelBrand: 'apex',
          fuelLoads: 25,
          customSetup: (g) => {
            // Upgrade runway to heavy (20x3)
            for (let c = 5; c <= 25; c++) {
              for (let r = 26; r <= 28; r++) {
                g.tiles[r][c] = 'runway'
              }
            }
            // Mark stands as heavy (L)
            g.standClass['12,21'] = 'L'
            g.standClass['20,21'] = 'L'
            g.fieldXp = 3000
          },
        })

        const metrics = runSimDays(game, 10, { dt: 0.25, speed: 5 })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(10)
        expect(game.flightsDone).toBeGreaterThan(0)
      })
    },
    20_000,
  )
})
