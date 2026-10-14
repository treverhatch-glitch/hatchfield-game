import { beforeEach, describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'

function fresh(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  return game
}

function stubJet(phase: Flight['phase'] = 'landing'): Flight {
  return {
    id: 'f-test',
    flightNo: 'T100',
    airline: 'northline',
    craft: 'jet',
    phase,
    ledger: [],
    waitingOn: { paxIn: 0, paxOut: 0 },
  } as unknown as Flight
}

beforeEach(() => {
  localStorage.clear()
})

describe('crash charges', () => {
  it('rolls once per flight per moment, so frame repeats cannot stack fines', () => {
    const game = fresh()
    game.crashCool = 0
    game.runwayCondition = 0
    const f = stubJet()
    let rolls = 0
    const real = Math.random
    Math.random = () => {
      rolls += 1
      return 0.999 // never crashes
    }
    try {
      for (let i = 0; i < 50; i++) game.checkCrash(f, 'landing')
    } finally {
      Math.random = real
    }
    expect(rolls).toBe(1)
    expect(game.crashes).toBe(0)
  })

  it('never charges for a flight that is already gone', () => {
    const game = fresh()
    game.crashCool = 0
    const cash = game.cash
    expect(game.checkCrash(stubJet('gone'), 'landing')).toBe(false)
    expect(game.cash).toBe(cash)
  })

  it('records a real crash in the counter and the flight ledger', () => {
    const game = fresh()
    game.crashCool = 0
    game.runwayCondition = 0
    const f = stubJet()
    const cash = game.cash
    const real = Math.random
    Math.random = () => 0
    try {
      expect(game.checkCrash(f, 'landing')).toBe(true)
    } finally {
      Math.random = real
    }
    expect(game.crashes).toBe(1)
    expect(f.phase).toBe('gone')
    expect(f.ledger).toHaveLength(1)
    expect(game.cash).toBe(cash - -f.ledger[0].amount)
  })
})

describe('airline roster', () => {
  it('lists Zoomjet so it can be signed', () => {
    const game = fresh()
    const ids = game.allAirlines().map((a) => a.id)
    expect(ids).toContain('zoomjet')
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('GA bag handling', () => {
  it('books no outbound bag fee for general aviation', () => {
    const game = fresh()
    const f = { ...stubJet('deboard'), airline: 'ga', bagUnits: 0, bagsDeposited: 0 } as unknown as Flight
    const cash = game.cash
    ;(game as unknown as { noteOutboundBagFee(f: Flight): void }).noteOutboundBagFee(f)
    expect(f.ledger).toHaveLength(0)
    expect(game.cash).toBe(cash)
  })
})
