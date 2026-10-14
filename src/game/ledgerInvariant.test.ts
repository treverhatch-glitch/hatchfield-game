import { describe, expect, it } from 'vitest'
import { payrollForGameDay } from '../core/bank.ts'
import { spawnHallGuest } from './guests.ts'
import { ledgerBalances } from './financeBreakdown.ts'
import { SMALL_FIELD_FEE_FACTOR } from './economyTuning.ts'
import { loanFeeForAmount } from './economy.ts'
import {
  FIELD_TASK_FAIL_FINE,
  LOAN_PRODUCTS,
  POLICE_COST,
  RUNWAY_PREFAB_COST,
  START_CASH,
  STARTER_KIT_COST,
} from './catalog.ts'
import { Game } from './sim.ts'
import type { FieldTask } from './types.ts'

function live(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

function ask(game: Game, id: string, kind: FieldTask['kind']): void {
  game.fieldTask = {
    id,
    airline: 'northline',
    kind,
    title: kind,
    blurb: kind,
    bonus: 1000,
    deadline: game.clock + 80,
    age: 0,
  }
}

describe('ledger invariants', () => {
  it('opens the bank at the starting cash and keeps every later move on both sides', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('standard')
    expect(game.cash).toBe(START_CASH.standard)
    expect(game.cash).toBe(game.bank.balance)
    expect(ledgerBalances(game.bank.ledger())).toBe(true)

    game.buyLand('city')
    game.buildStarterKit()
    expect(game.cash).toBe(START_CASH.standard - 95_000 - STARTER_KIT_COST)
    expect(game.cash).toBe(game.bank.balance)

    const held = game.cash
    expect(game.spend(RUNWAY_PREFAB_COST, 'runway')).toBe(false)
    game.placeRunway({ c: 2, r: 20 })
    expect(game.cash).toBe(held)
    expect(game.sites.some((site) => site.kind === 'runway')).toBe(false)
    expect(game.cash).toBe(game.bank.balance)
  })

  it('books a drawn loan as principal in, and owes principal plus fee', () => {
    const game = live()
    const micro = LOAN_PRODUCTS.find((product) => product.id === 'micro')!
    game.drawLoan(micro.principal)
    expect(game.loanBalance).toBe(micro.principal + micro.fee)
    expect(game.bank.ledger().byCategory.loan_proceeds).toBe(micro.principal)
    expect(game.cash).toBe(game.bank.balance)

    game.repayLoan()
    expect(game.loanBalance).toBe(0)
    const principal = 30_000
    const fee = loanFeeForAmount(principal)
    game.drawLoan(principal)
    expect(game.loanProductId).toBe('drawn')
    expect(game.loanBalance).toBe(principal + fee)
    expect(game.bank.ledger().byCategory.loan_proceeds).toBe(micro.principal + principal)
    expect(game.cash).toBe(game.bank.balance)
  })

  it('charges the payroll line it shows', () => {
    const game = live()
    game.earn(80_000, 'probe landing', undefined, 'landing_fees', false)
    const due = game.payrollCharged()
    const phase = 'early' as const
    expect(due).toBe(payrollForGameDay(80_000, phase, game.payrollPreview()))
    expect(due).toBeGreaterThan(game.payrollPreview())
    const before = game.bank.ledger().byCategory.payroll ?? 0
    game.clock = 180
    game.tickPayroll(0)
    expect((game.bank.ledger().byCategory.payroll ?? 0) - before).toBe(-due)
    expect(game.cash).toBeCloseTo(game.bank.balance, 5)
  })

  it('quotes a catering bill for a $0 airline rate and lists hall shops', () => {
    const game = live()
    expect(game.airline('zoomjet').catering).toBe(0)
    expect(game.quotedCatering('zoomjet', 40)).toBeGreaterThan(0)
    expect(game.hallShopLines().length).toBeGreaterThan(0)
    expect(game.hallShopLines().join(' ')).toMatch(/Burger Bar|Café|cafe/i)
  })

  it('changes the on-screen negotiation value with the contract length', () => {
    const game = live()
    game.presentNegotiation('northline')
    const margins = [6, 12, 24].map((months) => {
      game.setNegotiationTerm(months)
      return game.negotiationPanel()?.margin ?? 0
    })
    expect(margins[0]).not.toBe(margins[1])
    expect(margins[1]).not.toBe(margins[2])
    expect(margins[0]).toBeGreaterThan(margins[2])
  })

  it('counts a meal at a bundle counter and keeps the ledger closed', () => {
    const game = live()
    game.foodShelf = 4
    const guest = spawnHallGuest('meal', 'depart', 'budget')
    guest.node = 'food'
    guest.needs.hunger = 90
    guest.wallet = 80
    guest.prefs.food = 1
    guest.hallId = game.hallKey(game.activeHall()!)
    const cash = game.cash
    game.serveNode(guest, game.hallOpen())
    expect(game.foodCourtRevenue).toBeGreaterThan(0)
    expect(game.cash).toBeGreaterThan(cash)
    expect(game.bank.ledger().byCategory.retail_sales).toBeGreaterThan(0)
    expect(game.cash).toBeCloseTo(game.bank.balance, 5)
    const ledger = game.bank.ledger()
    const signed =
      ledger.openingBalance +
      ledger.entries.reduce((sum, entry) => sum + (entry.meta.unpaid ? 0 : entry.amount), 0)
    expect(signed).toBeCloseTo(ledger.balance, 5)
    expect(ledgerBalances(ledger)).toBe(true)
  })

  it('scales turn fees only while the field is still a small starter', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('standard')
    game.buyLand('city')
    const bare = game.cash
    game.earn(1_000, 'bare landing', undefined, 'landing_fees', false)
    expect(game.cash - bare).toBe(1_000)
    game.signed.push('zoomjet')
    const small = game.cash
    game.earn(1_000, 'small landing', undefined, 'landing_fees', false)
    expect(game.cash - small).toBe(Math.round(1_000 * SMALL_FIELD_FEE_FACTOR))
    expect(game.cash).toBeCloseTo(game.bank.balance, 5)
  })

  it('keeps a field ask on Later, retires it on Decline, and does not spend a second Build', () => {
    const game = live()
    ask(game, 'ask-clear', 'police')
    const parked = game.cash
    game.ackLetter('field:ask-clear')
    expect(game.fieldTask?.id).toBe('ask-clear')
    expect(game.cash).toBe(parked)
    game.declineFieldTask()
    expect(game.fieldTask).toBeNull()
    expect(game.cash).toBe(parked)

    ask(game, 'ask-pay', 'police')
    const cash = game.cash
    game.buildFieldTask()
    expect(game.cash).toBe(cash - POLICE_COST)
    game.buildFieldTask()
    expect(game.cash).toBe(cash - POLICE_COST)
    expect(game.cash).toBeCloseTo(game.bank.balance, 5)
  })

  it('books a failed field ask on its own line', () => {
    const game = live()
    ask(game, 'ask-miss', 'helipad')
    game.fieldTask!.deadline = game.clock
    const cash = game.cash
    game.tickFieldTask(0)
    expect(game.fieldTask).toBeNull()
    expect(game.cash).toBe(cash - FIELD_TASK_FAIL_FINE)
    expect(game.bank.ledger().byCategory.task_miss).toBe(-FIELD_TASK_FAIL_FINE)
    expect(game.bank.ledger().byCategory.penalties ?? 0).toBe(0)
  })
})
