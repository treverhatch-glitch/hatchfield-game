import { beforeEach, describe, expect, it } from 'vitest'
import {
  CASH_DEBT_FLOOR,
  EMERGENCY_REFUSE_FINE,
  EMERGENCY_UNABLE_REP,
  LOAN_PRODUCTS,
  PAYROLL_SHORT_SLIDER_FLOOR,
  SECURITY_INCIDENT_SLIDER_FLOOR,
} from './catalog.ts'
import { loanInstallment, settleLoanTick } from './economy.ts'
import { financeBreakdown, ledgerBalances } from './financeBreakdown.ts'
import { Game } from './sim.ts'
import type { PendingEmergency, ScheduleSlot } from './types.ts'

/** Regression cover for the early-game death spiral in #192. */

function fresh(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.buyLand('city')
  return game
}

/** Mulberry32 so the day-long runs below do not depend on Math.random. */
function withSeed<T>(seed: number, run: () => T): T {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    return run()
  } finally {
    Math.random = orig
  }
}

const bridge = LOAN_PRODUCTS.find((p) => p.id === 'bridge')!
const bridgeOpened = bridge.principal + bridge.fee

beforeEach(() => {
  localStorage.clear()
})

describe('loan repays on a schedule', () => {
  it('pays interest plus an installment and clears the bridge within its term', () => {
    let balance = bridgeOpened
    let ticks = 0
    while (balance > 0 && ticks < 1000) {
      const tick = settleLoanTick(balance, 1_000_000, bridgeOpened, bridge)
      expect(tick.short).toBe(0)
      expect(tick.balance).toBeLessThan(balance)
      balance = tick.balance
      ticks += 1
    }
    expect(balance).toBe(0)
    const termTicks = Math.floor((bridge.termDays * 180) / bridge.every)
    expect(ticks).toBeLessThanOrEqual(termTicks)
    expect(ticks).toBeGreaterThanOrEqual(termTicks - 1)
  })

  it('never takes cash it does not have, and only unpaid interest capitalizes', () => {
    const broke = settleLoanTick(bridgeOpened, -5_000, bridgeOpened, bridge)
    expect(broke.interestPaid).toBe(0)
    expect(broke.principalPaid).toBe(0)
    expect(broke.balance).toBe(bridgeOpened + broke.interest)
    const partial = settleLoanTick(bridgeOpened, broke.interest, bridgeOpened, bridge)
    expect(partial.interestPaid).toBe(partial.interest)
    expect(partial.principalPaid).toBe(0)
    expect(partial.balance).toBe(bridgeOpened)
    expect(partial.short).toBe(loanInstallment(bridgeOpened, bridge))
  })

  it('costs a starter field well under its daily margin', () => {
    const perDay = 180 / bridge.every
    const first = settleLoanTick(bridgeOpened, 1_000_000, bridgeOpened, bridge)
    // Was ~$4.1k a game day of interest alone, with no principal coming off.
    expect((first.interest + first.installment) * perDay).toBeLessThan(2_600)
  })

  it('shrinks the open loan in the sim and books interest and principal in the bank', () => {
    const game = fresh()
    game.cash = 200_000
    game.takeLoanProduct('bridge')
    const opened = game.loanBalance
    const cash0 = game.cash
    const bank0 = game.bank.balance
    for (let i = 0; i < 5; i++) {
      game.interestCool = 0
      game.speed = 1
      game.tick(0.01)
    }
    expect(game.loanBalance).toBeLessThan(opened)
    const by = game.bank.ledger().byCategory
    expect(by.loan_proceeds).toBe(bridge.principal)
    expect(by.loan_interest ?? 0).toBeLessThan(0)
    expect(by.loan_repayment ?? 0).toBeLessThan(0)
    expect(-(by.loan_repayment ?? 0)).toBeCloseTo(opened - game.loanBalance, 0)
    // Whatever else moved this tick, the loan lines moved cash and bank together.
    expect(game.cash - cash0).toBeCloseTo(game.bank.balance - bank0, 0)
  })

  it('does not lift negative cash to zero on a short tick, and dips reputation once a day', () => {
    const game = fresh()
    game.takeLoanProduct('bridge')
    game.cash = -10_000
    const rep0 = game.reputation
    for (let i = 0; i < 3; i++) {
      game.interestCool = 0
      game.speed = 1
      game.tick(0.01)
    }
    expect(game.cash).toBeLessThanOrEqual(-10_000 + 1)
    expect(rep0 - game.reputation).toBeLessThanOrEqual(1.5 + 1e-9)
  })
})

describe('cash and the bank ledger tell the same story', () => {
  it('books every charge, and only what cash absorbed above the debt floor', () => {
    const game = fresh()
    game.cash = 1_000
    const bank0 = game.bank.balance
    expect(game.charge(600)).toBe(600)
    expect(game.bank.ledger().byCategory.penalties).toBe(-600)
    expect(game.charge(500, 'building_upkeep')).toBe(500)
    expect(game.bank.ledger().byCategory.building_upkeep).toBe(-500)
    game.cash = CASH_DEBT_FLOOR + 300
    const before = game.bank.balance
    expect(game.charge(5_000)).toBe(300)
    expect(game.cash).toBe(CASH_DEBT_FLOOR)
    expect(game.bank.balance).toBe(before - 300)
    expect(game.bank.ledger().byCategory.penalties).toBe(-900)
    expect(game.charge(5_000)).toBe(0)
    expect(game.cash).toBe(CASH_DEBT_FLOOR)
    expect(game.bank.balance).toBe(bank0 - 1_400)
    const unpaid = game.bank.ledger().entries.filter((entry) => entry.meta.unpaid)
    expect(unpaid.map((entry) => entry.amount)).toEqual([-4_700, -5_000])
    expect(ledgerBalances(game.bank.ledger())).toBe(true)
    const skipped = financeBreakdown(game.bank.ledger()).find((line) => line.unpaid && line.category === 'penalties')
    expect(skipped).toMatchObject({ label: 'Penalties unpaid', amount: -9_700 })
    expect(skipped?.why).toMatch(/Not taken from cash/)
  })

  it('does not book a sandbox bill as unpaid', () => {
    const game = fresh()
    game.sandbox = true
    const cash = game.cash
    const balance = game.bank.balance
    const lines = game.bank.ledger().entries.length
    expect(game.charge(5_000)).toBe(0)
    expect(game.cash).toBe(cash)
    expect(game.bank.balance).toBe(balance)
    expect(game.bank.ledger().entries).toHaveLength(lines)
    expect(game.bank.ledger().entries.some((entry) => entry.meta.unpaid)).toBe(false)
  })

  it('keeps cash minus bank balance constant over game days with no player spending', () => {
    withSeed(192, () => {
      const game = fresh()
      game.buildStarterKit()
      game.offer = { airline: 'bushline', age: 0, deadline: 36 }
      game.acceptOffer()
      game.takeLoan()
      const gap0 = game.cash - game.bank.balance
      game.speed = 5
      while (game.clock < 180 * 3) {
        if (game.parkingOffer) game.acceptParking()
        game.tick(0.25)
        expect(Number.isFinite(game.cash)).toBe(true)
      }
      expect(game.flightsDone).toBeGreaterThan(0)
      expect(game.cash - game.bank.balance).toBeCloseTo(gap0, 0)
    })
  })
})

describe('a short payroll day', () => {
  it('journals the payroll cash cannot pay without moving the bank', () => {
    const game = fresh()
    game.cash = -8_000
    const before = game.bank.balance
    const beforeCount = game.bank.ledger().entries.length
    game.clock = 181
    game.tickPayroll(0)
    const added = game.bank.ledger().entries.slice(beforeCount)
    const paid = added.filter((entry) => !entry.meta.unpaid).reduce((sum, entry) => sum + entry.amount, 0)
    const unpaidPayroll = added.filter((entry) => entry.meta.unpaid && entry.category === 'payroll')
    expect(unpaidPayroll.length).toBeGreaterThan(0)
    expect(added.some((entry) => entry.category === 'payroll' && !entry.meta.unpaid)).toBe(false)
    expect(game.bank.balance - before).toBeCloseTo(paid, 5)
    expect(game.bank.ledger().byCategory.payroll ?? 0).toBe(0)
  })

  it('keeps debt as debt and stops the slider cut above the threat-exposure line', () => {
    const game = fresh()
    game.buildStarterKit()
    game.cash = -8_000
    game.budgets.maintenance = 100
    game.budgets.security = 100
    for (let day = 1; day <= 8; day++) {
      game.cash = Math.min(game.cash, -8_000)
      game.clock = day * 180 + 1
      game.tickPayroll(0)
      expect(game.cash).toBeLessThan(0)
    }
    expect(game.budgets.security).toBe(PAYROLL_SHORT_SLIDER_FLOOR)
    expect(game.budgets.maintenance).toBe(PAYROLL_SHORT_SLIDER_FLOOR)
    // A slider the player set lower is left alone.
    game.budgets.security = 30
    game.clock = 9 * 180 + 1
    game.tickPayroll(0)
    expect(game.budgets.security).toBe(30)
  })

  it('holds the security slider at 70% while incidents are still rising', () => {
    const game = fresh()
    game.buildStarterKit()
    game.cash = -8_000
    game.budgets.maintenance = 100
    game.budgets.security = 100
    game.securityIncidents = 1
    for (let day = 1; day <= 8; day++) {
      game.cash = Math.min(game.cash, -8_000)
      game.securityIncidents += 1
      game.clock = day * 180 + 1
      game.tickPayroll(0)
    }
    expect(game.budgets.security).toBe(SECURITY_INCIDENT_SLIDER_FLOOR)
    expect(game.budgets.maintenance).toBe(PAYROLL_SHORT_SLIDER_FLOOR)
  })
})

describe('starter daily bills', () => {
  it('keeps land holding under $800 a day and the hall under $900', () => {
    const game = fresh()
    game.buildStarterKit()
    expect(game.dailyHoldingQuote()).toBeGreaterThan(0)
    expect(game.dailyHoldingQuote()).toBeLessThan(800)
    expect(game.landsideUpkeep()).toBeGreaterThan(0)
    expect(game.landsideUpkeep()).toBeLessThan(900)
  })
})

describe('carrier Standing from schedule slips', () => {
  function slot(id: string, eta: number): ScheduleSlot {
    return {
      id,
      airline: 'bushline',
      flightNo: id,
      eta,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: false,
      flightId: null,
    }
  }

  it('stops charging Standing once a held slot has booked its full delay', () => {
    const game = fresh()
    game.airlineHeat.bushline = 60
    const held = slot('s1', game.clock + 5)
    game.schedule = [held, slot('s2', game.clock + 20), slot('s3', game.clock + 34)]
    for (let i = 0; i < 40; i++) game.delaySlot(held, 10, 'Runway backlog')
    const lost = 60 - game.heatOf('bushline')
    // Every slot caps at 120s of delay, so the nick is bounded by booked delay, not retry count.
    expect(lost).toBeGreaterThan(0)
    expect(lost).toBeLessThan(10)
  })
})

describe('emergencies the field cannot host', () => {
  it('cost the fee and a little reputation, not the refuse fine', () => {
    const game = fresh()
    game.cash = 50_000
    const rep0 = game.reputation
    const e: PendingEmergency = {
      id: 'em-1',
      kind: 'tanker_mx',
      blurb: 'test',
      fee: 9_000,
      age: 0,
      deadline: 20,
      airline: null,
      needs: { stand: true, fire: true, fuel: true, hangar: true, minRunway: 0 },
    }
    expect(game.canHostEmergency(e)).toBe(false)
    game.pendingEmergency = e
    game.resolveEmergency('refuse')
    expect(game.cash).toBe(50_000)
    expect(game.reputation).toBeCloseTo(rep0 - EMERGENCY_UNABLE_REP)
    expect(game.news[0]?.text ?? '').toMatch(/could not host/i)
  })

  it('still fines a refusal the field could have hosted', () => {
    const game = fresh()
    game.cash = 50_000
    const e: PendingEmergency = {
      id: 'em-2',
      kind: 'tanker',
      blurb: 'test',
      fee: 5_000,
      age: 0,
      deadline: 20,
      airline: null,
      needs: { stand: false, fire: false, fuel: false, hangar: false, minRunway: 0 },
    }
    game.emergencyHostGap = () => null
    game.pendingEmergency = e
    game.resolveEmergency('refuse')
    expect(game.cash).toBe(50_000 - EMERGENCY_REFUSE_FINE)
  })
})
