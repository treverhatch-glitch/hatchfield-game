import { describe, expect, it } from 'vitest'
import { TEST_TIMEOUT_MS, buildAirport, expectHealthy, runDays, useSeed } from './harness.ts'

describe('fuel outage and recovery', () => {
  useSeed(5)

  it('an empty farm holds departures, then a fuel buy releases them', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({ deskStaff: 1 })
    expectHealthy(runDays(g, 2))

    // Outage: farm drained, no restocking.
    g.fuelLoads = 0
    let held = 0
    const out = runDays(g, 2, {
      autoFuel: false,
      onTick: (game) => {
        game.fuelLoads = 0
        held = Math.max(held, game.flights.filter((f) => f.fuelHeld).length)
      },
    })
    expect(out.nan).toEqual([])
    expect(held, 'a departure should wait on fuel').toBeGreaterThan(0)

    // Recovery: restock and keep flying.
    g.buyLoads()
    expect(g.fuelLoads).toBeGreaterThan(0)
    const done0 = g.flightsDone
    const back = runDays(g, 3)
    expectHealthy(back)
    expect(g.flightsDone).toBeGreaterThan(done0)
  })
})
