/**
 * Spot-only careful probes. No fuel term.
 * (a) accepts every spot card. (b) ignores every spot card.
 */
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { spotProbePersonas, runHeadless } from '../src/playtest/run.ts'
import { summarizeRun } from '../src/playtest/summary.ts'

describe('spot-only fuel probe', () => {
  it('runs accept-all and ignore-all for 90 days', () => {
    const reports = runHeadless({
      personas: spotProbePersonas(90),
      onProgress: (line) => console.log(line),
    })
    const body = reports.map(summarizeRun)
    writeFileSync(new URL('../docs/playtest/bots/spot90.json', import.meta.url), JSON.stringify(body, null, 2))
    expect(reports).toHaveLength(2)
    for (const report of reports) {
      expect(report.nanFlags).toEqual([])
      expect(report.consoleErrors).toEqual([])
    }
  })
})
