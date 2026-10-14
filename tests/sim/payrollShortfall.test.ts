import { describe, expect, it } from 'vitest'
import {
  assertSimHealth,
  createTestAirport,
  runSimDays,
  withSeed,
} from './harness.ts'

describe('payrollShortfall', () => {
  it(
    'handles payroll deductions and low-cash shortfall without ledger NaN or simulation crash',
    () => {
      withSeed(505, () => {
        const game = createTestAirport({
          difficulty: 'standard',
          starterKit: true,
          signedAirlines: ['northline'],
          janitors: 2,
          mechanics: 2,
          deskStaff: 2,
          researchers: 1,
        })

        // Force low cash to induce payroll shortfall
        game.cash = 100

        const metrics = runSimDays(game, 7, { dt: 0.25, speed: 5 })

        assertSimHealth(metrics, { maxLostPax: 0, maxLostBags: 0 })
        expect(metrics.nanErrors).toEqual([])
        expect(metrics.cashPerDay.length).toBeGreaterThanOrEqual(7)
      })
    },
    15_000,
  )
})
