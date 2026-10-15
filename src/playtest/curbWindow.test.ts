import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { mulberry32 } from './personas.ts'
import { PERSONAS, runHeadless } from './run.ts'

/**
 * The starter curb stays under pressure 1 through the opening, then a field
 * that has signed eight carriers and flown about 80 turns crosses 1 between
 * day 15 and 35. Careful's curb stamp is left off so the reading is the
 * starter curb alone. The bay that brings it back under 1 is pinned in
 * src/landside/landside.test.ts.
 */
describe('starter curb pressure window', () => {
  it('crosses 1 between day 15 and 35 once the book is real, and not before day 5', { timeout: 180_000 }, () => {
    const spec = PERSONAS.find((persona) => persona.id === 'careful')
    expect(spec).toBeTruthy()
    const peaks = new Map<number, { pressure: number; flights: number; carriers: number; bays: number; ranks: number; curbLanes: number }>()
    const orig = Game.prototype.tick
    Game.prototype.tick = function (this: Game, dt: number) {
      orig.call(this, dt)
      const day = this.gameDay()
      const curb = this.landsideView()
      const prev = peaks.get(day) ?? {
        pressure: 0,
        flights: 0,
        carriers: 0,
        bays: curb.busBays,
        ranks: curb.taxiRanks,
        curbLanes: curb.curbLanes,
      }
      if (curb.pressure > prev.pressure) prev.pressure = curb.pressure
      if (this.flightsDone > prev.flights) prev.flights = this.flightsDone
      if (this.signed.length > prev.carriers) prev.carriers = this.signed.length
      prev.bays = curb.busBays
      prev.ranks = curb.taxiRanks
      prev.curbLanes = curb.curbLanes
      peaks.set(day, prev)
    }
    const random = Math.random
    Math.random = mulberry32(0x5eed)
    const origKit = Game.prototype.buildStarterKit
    Game.prototype.buildStarterKit = function (this: Game) {
      const built = origKit.call(this)
      this.paxDesks = 48
      this.paxKiosks = 8
      return built
    }
    try {
      runHeadless({
        personas: [
          {
            ...spec!,
            days: 36,
            decide: (view, memory, rng) => {
              const decision = spec!.decide(view, memory, rng)
              return { ...decision, intents: decision.intents.filter((intent) => intent.do !== 'curb') }
            },
          },
        ],
      })
    } finally {
      Game.prototype.tick = orig
      Game.prototype.buildStarterKit = origKit
      Math.random = random
    }

    const days = [...peaks.keys()].sort((a, b) => a - b)
    expect(days.length).toBeGreaterThan(30)
    for (const day of days) {
      if (day >= 5) break
      expect(peaks.get(day)!.pressure, `day ${day}`).toBeLessThan(1)
    }
    for (const day of days) {
      if (day >= 15) break
      expect(peaks.get(day)!.pressure, `day ${day} before the window`).toBeLessThan(1)
    }
    const crossed = days.filter((day) => peaks.get(day)!.pressure > 1)
    expect(crossed.length, 'pressure never crossed 1').toBeGreaterThan(0)
    expect(crossed[0]!, `first cross on day ${crossed[0]}`).toBeGreaterThanOrEqual(15)
    expect(crossed[0]!, `first cross on day ${crossed[0]}`).toBeLessThanOrEqual(35)
    const grown = days.find((day) => {
      const row = peaks.get(day)!
      return row.carriers >= 8 && row.flights >= 80
    })
    expect(grown, `days ${days.length} last ${JSON.stringify(peaks.get(days.at(-1)!))}`).toBeDefined()
    expect(grown!).toBeGreaterThanOrEqual(15)
    expect(grown!).toBeLessThanOrEqual(35)
    const at = peaks.get(grown!)!
    expect(at.pressure, `day ${grown} carriers ${at.carriers} flights ${at.flights}`).toBeGreaterThan(1)
    expect(at.bays, 'starter curb only').toBe(0)
    expect(at.ranks).toBe(0)
    expect(at.curbLanes).toBe(0)
  })
})
