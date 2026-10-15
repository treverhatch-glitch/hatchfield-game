import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PERSONAS, runHeadless } from './run.ts'

/**
 * Reachability check for the mid/late checklist. Not part of `npm test`.
 * CAREFUL_150=1 npx vitest run src/playtest/careful150.test.ts --testTimeout 900000
 */
const enabled = process.env.CAREFUL_150 === '1'

describe.skipIf(!enabled)('careful bot to day 150', () => {
  it('records the day each field level first opens', () => {
    const spec = PERSONAS.find((persona) => persona.id === 'careful')
    expect(spec).toBeTruthy()
    const [report] = runHeadless({
      personas: [{ ...spec!, days: 150 }],
      onProgress: (line) => {
        console.log(line)
      },
    })
    const first = new Map<string, number>()
    for (const row of report.days) {
      const key = `FL${row.fieldLevel}`
      if (!first.has(key)) first.set(key, row.day)
      const star = `P${row.prestigeStars}`
      if (row.prestigeStars > 0 && !first.has(star)) first.set(star, row.day)
    }
    const last = report.days.at(-1)
    const summary = {
      daysRan: report.daysRan,
      cashStart: Math.round(report.cashStart),
      cashEnd: Math.round(report.cashEnd),
      flights: report.built.flightsDone,
      signed: report.built.signed,
      stands: report.built.stands,
      runway: report.built.runway,
      treeNodes: last?.treeNodes ?? 0,
      fieldLevel: last?.fieldLevel ?? 0,
      prestigeStars: last?.prestigeStars ?? 0,
      first: [...first.entries()],
      curve: report.days
        .filter((row) => row.day % 10 === 0 || row.day === 1)
        .map((row) => ({
          day: row.day,
          fl: row.fieldLevel,
          stars: row.prestigeStars,
          tree: row.treeNodes,
        })),
      softlocks: report.softlocks,
      errors: report.consoleErrors,
    }
    writeFileSync('/tmp/careful-150.json', JSON.stringify(summary, null, 2))
    console.log(`CAREFUL150 ${JSON.stringify(summary)}`)
    expect(report.consoleErrors).toEqual([])
    expect(report.daysRan).toBeGreaterThanOrEqual(150)
  }, 900_000)
})
