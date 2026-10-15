/**
 * Every signed carrier after 60 days has flown, or the books name why it has not.
 */
import { describe, expect, it } from 'vitest'
import { mulberry32 } from './personas.ts'
import { PERSONAS, runHeadless } from './run.ts'

describe('helicopter carriers over 60 days', () => {
  it('gives every signed carrier a turn or a visible block', { timeout: 600_000 }, () => {
    const specs = PERSONAS.filter((persona) => persona.id === 'careful' || persona.id === 'greedy').map((persona) => ({
      ...persona,
      days: 60,
    }))
    const random = Math.random
    const reports: ReturnType<typeof runHeadless> = []
    try {
      for (const spec of specs) {
        Math.random = mulberry32(spec.seed)
        reports.push(...runHeadless({ personas: [spec] }))
      }
    } finally {
      Math.random = random
    }
    const lines: string[] = []
    const failures: string[] = []
    for (const report of reports) {
      lines.push(report.persona)
      for (const row of report.books.relations) {
        const turns = row.onTime + row.delayed
        lines.push(
          `${row.name} T${row.tier} ${row.label} ${row.score} on-time ${row.onTime} delayed ${row.delayed} kept ${row.kept} blocked ${row.blocked ?? '—'}`,
        )
        if (!(turns > 0 || row.blocked)) failures.push(`${report.persona} ${row.name}`)
      }
    }
    console.log(lines.join('\n'))
    expect(failures, lines.join('\n')).toEqual([])
  })
})