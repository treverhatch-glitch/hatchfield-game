import { describe, expect, it } from 'vitest'
import { mulberry32 } from './personas.ts'
import { PERSONAS, runHeadless } from './run.ts'

describe('careful relations over 60 days', () => {
  it('reaches Preferred with one or two carriers by day 30 and Trusted by day 60', { timeout: 240_000 }, () => {
    const spec = PERSONAS.find((persona) => persona.id === 'careful')
    expect(spec).toBeTruthy()
    const random = Math.random
    Math.random = mulberry32(0x5eed)
    let report: ReturnType<typeof runHeadless>[number]
    try {
      ;[report] = runHeadless({ personas: [{ ...spec!, days: 60 }] })
    } finally {
      Math.random = random
    }
    const at = (day: number) => report.days.find((row) => row.day === day)
    const day30 = at(30)
    const day60 = at(60) ?? report.days.at(-1)
    const detail = report.books.relations
      .map(
        (row) =>
          `${row.name} ${row.score} T${row.tier} on-time ${row.onTime} delayed ${row.delayed} kept ${row.kept} missed ${row.missed} fines ${row.fines}`,
      )
      .join('; ')
    expect(day30, detail).toBeTruthy()
    expect(day60, detail).toBeTruthy()
    expect(day30!.relationTier2, `day 30 best ${day30!.relationBest} day 60 best ${day60!.relationBest} ${detail}`).toBeGreaterThanOrEqual(1)
    expect(day30!.relationTier2, `day 30 best ${day30!.relationBest} count ${day30!.relationTier2} ${detail}`).toBeLessThanOrEqual(2)
    expect(day30!.relationTier3, `day 30 best ${day30!.relationBest} ${detail}`).toBe(0)
    expect(day60!.relationTier3, `day 60 best ${day60!.relationBest} ${detail}`).toBeGreaterThanOrEqual(1)
    expect(report.consoleErrors).toEqual([])
  })
})
