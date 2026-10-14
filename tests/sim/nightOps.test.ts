import { describe, expect, it } from 'vitest'
import { TEST_TIMEOUT_MS, buildAirport, expectHealthy, runDays, useSeed } from './harness.ts'

describe('night operations', () => {
  useSeed(21)

  it('traffic keeps moving through the night third of each day', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({ deskStaff: 2, mechanics: 1, cash: 200_000 })
    let nightTicks = 0
    let airborneAtNight = 0
    const m = runDays(g, 6, {
      onTick: (game) => {
        if (!game.isNight()) return
        nightTicks += 1
        if (game.flights.length > 0) airborneAtNight += 1
      },
    })
    expectHealthy(m)
    expect(nightTicks).toBeGreaterThan(0)
    expect(airborneAtNight, 'some flight is live during night ticks').toBeGreaterThan(0)
    expect(m.flightsDone).toBeGreaterThan(5)
  })
})
