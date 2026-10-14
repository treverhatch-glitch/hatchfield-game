import { describe, expect, it } from 'vitest'
import { PERSONAS, runHeadless } from './run.ts'

const enabled = process.env.TUNE_BOTS === '1'

describe.skipIf(!enabled)('playtest bot economy', () => {
  it('prints day-30 and final cash for each persona', { timeout: 600_000 }, () => {
    const reports = runHeadless({
      onProgress: (line) => {
        console.log(line)
      },
    })
    const rows = reports.map((report) => {
      const cash = report.cashCurve.map((point) => point.cash)
      const at = (day: number) => report.cashCurve.find((point) => point.day === day)?.cash ?? null
      return {
        persona: report.persona,
        days: report.daysRan,
        start: report.cashStart,
        day30: at(30),
        end: report.cashEnd,
        min: cash.length ? Math.min(...cash) : null,
        flights: report.built.flightsDone,
        signed: report.built.signed.length,
        shops: `${report.built.leasedShops}/${report.built.shopUnits}`,
        rating: report.satisfaction.at(-1)?.fieldRating ?? null,
      }
    })
    console.log(JSON.stringify(rows, null, 2))
    expect(rows.length).toBe(PERSONAS.length)
  })
})
