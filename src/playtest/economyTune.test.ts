import { describe, expect, it } from 'vitest'
import { FIELD_TASK_FAIL_FINE } from '../game/catalog.ts'
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
        fieldAskFines: report.books.fieldAskFines,
        taskMiss: report.books.sinks.find((row) => row.category === 'task_miss')?.amount ?? 0,
      }
    })
    console.log(JSON.stringify(rows, null, 2))
    expect(rows.length).toBe(PERSONAS.length)
    const careful = rows.find((row) => row.persona === 'careful')
    expect(careful?.day30).toBeGreaterThan(0)
    expect(careful?.end).toBeGreaterThan(0)
    expect(careful?.taskMiss).toBe(-FIELD_TASK_FAIL_FINE * (careful?.fieldAskFines ?? 0))
  })
})
