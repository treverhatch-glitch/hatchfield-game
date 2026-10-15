import { describe, expect, it } from 'vitest'
import { PERSONAS, runHeadless } from './run.ts'

const enabled = process.env.PENALTY_AUDIT === '1'

describe.skipIf(!enabled)('penalty audit bots', () => {
  it('prints cash and fine sources for each persona', { timeout: 600_000 }, () => {
    const reports = runHeadless({
      personas: PERSONAS.map((spec) => ({ ...spec, days: 90 })),
      onProgress: (line) => {
        console.log(line)
      },
    })
    const rows = reports.map((report) => {
      const cash = report.cashCurve.map((point) => point.cash)
      return {
        persona: report.persona,
        days: report.daysRan,
        start: report.cashStart,
        end: report.cashEnd,
        min: cash.length ? Math.min(...cash) : null,
        rating: report.satisfaction.at(-1)?.fieldRating ?? null,
        flights: report.built.flightsDone,
        penaltyTotal: report.books.penaltyTotal,
        penaltyBreakdown: report.books.penaltyBreakdown,
        penaltySources: report.books.penaltySources,
        sinks: report.books.sinks.filter((row) =>
          [
            'penalties',
            'security_shock',
            'task_miss',
            'emergency_refuse',
            'inbound_fine',
            'missed_connection',
            'cargo_miss',
            'crash_fine',
          ].includes(row.category),
        ),
      }
    })
    console.log(JSON.stringify(rows, null, 2))
    expect(rows.length).toBe(PERSONAS.length)
  })
})
