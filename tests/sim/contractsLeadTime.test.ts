import { describe, expect, it } from 'vitest'
import { TEST_TIMEOUT_MS, buildAirport, expectHealthy, runDays, useSeed } from './harness.ts'

describe('contract lead time', () => {
  useSeed(12)

  it('a newly signed carrier does not fly before its lead gate opens', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({ deskStaff: 1, cash: 200_000 })
    expectHealthy(runDays(g, 2))

    // A second carrier signs mid-run; it gets a lead before its first flight.
    g.paxDesks = 8
    g.offer = { airline: 'harbor', age: 0, deadline: 36 }
    g.acceptOffer()
    const gate = g.leadGateClock('harbor')
    const lead = g.commercialLead['harbor']
    expect(lead).toBeDefined()

    let earliest = Infinity
    const m = runDays(g, 6, {
      onTick: (game) => {
        for (const f of game.flights) {
          if (f.airline === 'harbor') earliest = Math.min(earliest, game.clock)
        }
      },
    })
    expectHealthy(m)
    if (gate > 0) {
      // Allow one step of slack: the check runs after the tick that spawns the flight.
      expect(earliest).toBeGreaterThanOrEqual(gate - 5)
    }
    for (const slot of g.openSchedule()) {
      if (slot.airline === 'harbor' && g.leadGateClock('harbor') > 0) {
        expect(slot.eta).toBeGreaterThanOrEqual(g.leadGateClock('harbor') - 0.05)
      }
    }
  })
})
