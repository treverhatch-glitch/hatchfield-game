/**
 * INTO_PLANE_BOTS=1 npx vitest run src/playtest/intoPlaneBots.test.ts
 * Prints fuel_sales for a 90-day Careful, Greedy, and Chaotic run.
 * The 15 Oct trial billed litres × $0.12 and fuel sales fell to about 28%
 * of the flat pump, so the wing bill stayed the flat $2,400.
 */
import { describe, expect, it } from 'vitest'
import { PERSONAS, runHeadless } from './run.ts'

const enabled = process.env.INTO_PLANE_BOTS === '1'

describe.skipIf(!enabled)('into-plane 90-day bots', () => {
  it('prints fuel income for Careful, Greedy, and Chaotic', { timeout: 900_000 }, () => {
    const reports = runHeadless({
      personas: PERSONAS.map((spec) => ({ ...spec, days: 90 })),
      onProgress: (line) => {
        console.log(line)
      },
    })
    const rows = reports.map((report) => {
      const fuelSales = report.books.sinks.find((row) => row.category === 'fuel_sales')?.amount ?? 0
      const fuelPurchase = report.books.sinks.find((row) => row.category === 'fuel_purchase')?.amount ?? 0
      return {
        persona: report.persona,
        days: report.daysRan,
        cashEnd: Math.round(report.cashEnd),
        flights: report.built.flightsDone,
        fuelSales,
        fuelPurchase,
        softlocks: report.softlocks,
      }
    })
    console.log(JSON.stringify(rows, null, 2))
    expect(rows.map((row) => row.persona)).toEqual(['careful', 'greedy', 'chaotic'])
    expect(rows.find((row) => row.persona === 'careful')?.days).toBeGreaterThanOrEqual(90)
    expect(rows.find((row) => row.persona === 'greedy')?.days).toBeGreaterThanOrEqual(90)
  })
})
