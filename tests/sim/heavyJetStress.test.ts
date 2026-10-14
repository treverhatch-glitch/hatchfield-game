import { describe, expect, it } from 'vitest'
import { TEST_TIMEOUT_MS, buildAirport, expectHealthy, runDays, useSeed } from './harness.ts'

describe('heavy jet stress', () => {
  useSeed(380)

  it('widebody carriers on a heavy strip and a tier-3 hall', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({
      airlines: ['northline', 'harbor', 'crown'],
      cash: 600_000,
      fieldXp: 2300,
      deskStaff: 3,
      mechanics: 2,
    })
    while ((g.fits[0].tier ?? 1) < 3) g.upgradeHall()
    g.assignHallStaff()
    // Lengthen the starter strip in place so the stand lead-ins still meet it.
    for (const p of g.prefabRunway({ c: 8, r: 26 }, 'heavy')) g.tiles[p.r][p.c] = 'runway'
    g.researchPoints = 400
    g.buyResearch('heavy_pack')
    expect(g.hasHeavyRunway()).toBe(true)

    const m = runDays(g, 6)
    expectHealthy(m)
    expect(m.flightsDone).toBeGreaterThan(5)
  })
})
