import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildAirport, runDays, seedRandom } from './harness.ts'
it('det dump', { timeout: 600_000 }, () => {
  const restore = seedRandom(99)
  try {
    const g = buildAirport()
    const m = runDays(g, 2) as unknown as Record<string, unknown>
    const out = { m, cash: g.cash, bagsLost: (g as unknown as { bagsLost: number }).bagsLost }
    writeFileSync(process.env.DET_OUT!, JSON.stringify(out))
  } finally { restore() }
})
