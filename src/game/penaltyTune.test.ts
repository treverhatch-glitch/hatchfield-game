import { describe, expect, it } from 'vitest'
import {
  CRASH_FINE_CAP,
  SECURITY_HARD_FINE,
  SECURITY_PUBLIC_HARD_FINE,
  SECURITY_SOFT_FINE,
} from './catalog.ts'
import { Game } from './sim.ts'
import { STUCK_WATCH } from './stuckWatchdogData.ts'
import type { Flight } from './types.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.buyLand('city')
  game.cash = 80_000
  return game
}

function jet(id: string): Flight {
  return {
    id,
    airline: 'northline',
    flightNo: 'NL1',
    airframeId: 'b738',
    airframeName: '737-800',
    pax: 40,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'landing',
    stand: null,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
      bags: false,
      bagsLoad: false,
      fuel: false,
      catering: false,
      bagDrop: false,
      mx: false,
      deiced: true,
    },
    waitingOn: {
      bags: false,
      bagsLoad: false,
      fuel: false,
      catering: false,
      mx: false,
      deice: false,
      paxOut: 0,
      paxIn: 0,
    },
    phaseTime: 0,
    ledger: [{ label: 'landing', amount: 9_000 }],
  }
}

describe('penalty outliers', () => {
  it('caps one crash and does not bill the write-off a second time when listed', () => {
    const game = field()
    game.public = true
    game.runwayCondition = 0
    game.budgets.ambulance = 100
    game.budgets.fire = 100
    const flight = jet('crash-1')
    game.flights.push(flight)
    game.crashFlight(flight, 'landing')
    const ledger = game.bank.ledger()
    expect(ledger.byCategory.crash_fine).toBe(-CRASH_FINE_CAP)
    expect(ledger.byCategory.security_shock ?? 0).toBe(0)
    expect(game.news.some((item) => item.text.includes('Fund maintenance'))).toBe(true)
    expect(game.news.some((item) => item.text.includes('Fine $0'))).toBe(false)
  })

  it('refunds a stuck flight only up to the cap', () => {
    expect(STUCK_WATCH.maxRefund).toBeGreaterThan(STUCK_WATCH.minRefund)
    expect(STUCK_WATCH.maxRefund).toBe(2_500)
  })

  it('tells a listed field the higher threat fine before it fires', () => {
    const listed = field()
    listed.public = true
    listed.pendingThreat = {
      id: 'thr-hard',
      severity: 'hard',
      blurb: 'Hard alarm',
      age: 0,
      deadline: 18,
    }
    listed.budgets.security = 10
    listed.resolveThreat('ignore')
    expect(listed.bank.ledger().byCategory.security_shock).toBe(-SECURITY_PUBLIC_HARD_FINE)
    expect(SECURITY_PUBLIC_HARD_FINE).toBeGreaterThan(SECURITY_HARD_FINE)
    expect(SECURITY_PUBLIC_HARD_FINE).toBeLessThan(SECURITY_HARD_FINE * 4)

    const priv = field()
    priv.pendingThreat = {
      id: 'thr-soft',
      severity: 'soft',
      blurb: 'Soft alarm',
      age: 0,
      deadline: 24,
    }
    priv.resolveThreat('ignore')
    expect(priv.bank.ledger().byCategory.security_shock).toBe(-SECURITY_SOFT_FINE)
    expect(priv.news.some((item) => item.text.includes('raise the security budget'))).toBe(true)
  })
})
