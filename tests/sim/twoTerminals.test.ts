import { describe, expect, it } from 'vitest'
import {
  TEST_TIMEOUT_MS,
  buildAirport,
  expectHealthy,
  runDays,
  settleBuilds,
  useSeed,
} from './harness.ts'

describe('two terminals', () => {
  useSeed(22)

  it('a second hall with its own stand shares the field', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({ airlines: ['northline', 'bushline'], cash: 400_000, deskStaff: 2 })
    // Let the opening window pass, then queue a second hall east of the first
    // (layout from scripts/soak-heavy-campus.mts). Premade halls build via a contractor.
    runDays(g, 1)
    // r13: the starter's second runway (r18-19) keeps a shoulder on r16-17.
    const t2 = { c: 22, r: 13 }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.tiles[t2.r + r][t2.c + c] = 'grass'
    g.tool = 'premade'
    g.placePremade(t2)
    expect(settleBuilds(g)).toBe(true)
    g.tiles[16][24] = 'stand'
    for (let r = 17; r <= 25; r++) g.tiles[r][24] = 'taxi'
    // Join the first stand's lead-in (column 20) so both stands reach the strip.
    for (let c = 21; c <= 23; c++) g.tiles[25][c] = 'taxi'
    expect(g.fits).toHaveLength(2)
    expect(g.pathStandToRunway({ c: 24, r: 16 })).not.toBeNull()

    const m = runDays(g, 7)
    expectHealthy(m)
    expect(m.flightsDone).toBeGreaterThan(5)
  })
})
