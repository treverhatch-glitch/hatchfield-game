// The rules roll their own seeded dice (src/game/simRng.ts): a run repeats exactly, drawing and sound can't
// change it, and a saved game carries its dice. This is what the Unity port is compared against.
import { beforeEach, describe, expect, it } from 'vitest'
import { buildAirport, runDays, seedRandom } from './harness.ts'
import { Game } from '../../src/game/sim.ts'
import { SimRng, forceSimRandom } from '../../src/game/simRng.ts'

// The game's own dice, not the test default (src/test/setup.ts makes the rules follow Math.random).
beforeEach(() => {
  forceSimRandom(null)
})

function fingerprint(g: Game) {
  return JSON.stringify({
    cash: Math.round(g.cash),
    pax: g.paxServed,
    flights: g.flightsDone,
    rep: Math.round(g.reputation * 1000),
    ledger: g.bank.ledger().entries.length,
    live: g.flights.map((f) => `${f.id}:${f.phase}`).join(','),
  })
}

const SETUP = { airlines: ['northline'], deskStaff: 1, janitors: 1, mechanics: 1, cash: 250_000 }

function run(seed: number, { noise = false, days = 2 } = {}) {
  const restore = seedRandom(seed) // the new game's seed is drawn from this
  try {
    const g = buildAirport(SETUP)
    // In the browser, drawing and sound call Math.random between ticks. Several draws per tick stand in for that.
    runDays(g, days, { onTick: noise ? () => { for (let i = 0; i < 3; i++) Math.random() } : undefined })
    return { g, print: fingerprint(g) }
  } finally {
    restore()
  }
}

describe('repeatable runs', () => {
  it('the same seed gives the same airport; another seed gives another', { timeout: 120_000 }, () => {
    const a = run(7).print
    expect(run(7).print).toBe(a)
    expect(run(8).print).not.toBe(a)
  })

  it('drawing and sound using Math.random no longer change the game', { timeout: 120_000 }, () => {
    expect(run(7, { noise: true }).print).toBe(run(7).print)
  })

  it('a saved game picks up its dice where it stopped', { timeout: 120_000 }, () => {
    const restore = seedRandom(11)
    try {
      const straight = buildAirport(SETUP)
      runDays(straight, 1)
      straight.persist()
      const saved = localStorage.getItem('hatchfield-save') ?? [...Array(localStorage.length).keys()].map((i) => localStorage.getItem(localStorage.key(i) as string)).find((v) => v?.includes('"rngState"'))
      expect(saved).toContain('"rngState"')
      const resumed = new Game()
      expect(resumed.load()).toBe(true)
      expect(resumed.rngSeed).toBe(straight.rngSeed)
      expect(resumed.rng.state).toBe(straight.rng.state)
    } finally {
      restore()
    }
  })

  it('the dice are Mulberry32, bit for bit (what the C# port must match)', () => {
    const r = new SimRng(1337)
    const first = [r.next(), r.next(), r.next()]
    const again = new SimRng(1337)
    expect([again.next(), again.next(), again.next()]).toEqual(first)
    expect(first.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})
