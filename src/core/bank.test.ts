import { describe, expect, it, vi } from 'vitest'
import { SIM_MINUTES_PER_GAME_DAY } from './clock.ts'
import {
  Bank,
  cityLevyForGameDay,
  operatingMargin,
  payrollForGameDay,
} from './bank.ts'

describe('shared bank', () => {
  it('posts typed money events into the ledger read by HUD and reports', () => {
    const bank = new Bank(150_000)
    const listener = vi.fn()
    bank.onPost(listener)
    bank.post('landing_fees', 12_000, { simMinutes: 100, source: 'airlines', sourceId: 'HF101' })
    bank.post('fuel_purchase', -4_500, { simMinutes: 110, source: 'logistics' })
    const ledger = bank.ledger()
    expect(ledger).toMatchObject({
      openingBalance: 150_000,
      balance: 157_500,
      totalIncome: 12_000,
      totalExpense: 4_500,
      net: 7_500,
    })
    expect(ledger.byCategory).toEqual({ landing_fees: 12_000, fuel_purchase: -4_500 })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('rejects category direction mistakes instead of hiding accounting bugs', () => {
    const bank = new Bank()
    expect(() => bank.post('payroll', 100, { simMinutes: 0 })).toThrow(/expense category/)
    expect(() => bank.post('retail_sales', -100, { simMinutes: 0 })).toThrow(/income category/)
  })

  it('folds a second same-day retail sale into the open line', () => {
    const bank = new Bank(1_000)
    bank.post('retail_sales', 12, { simMinutes: 10 })
    expect(bank.addToLatest('retail_sales', 18, 20)).toBe(true)
    expect(bank.addToLatest('retail_sales', 5, SIM_MINUTES_PER_GAME_DAY + 1)).toBe(false)
    const ledger = bank.ledger()
    expect(ledger.entries).toHaveLength(1)
    expect(ledger.entries[0].amount).toBe(30)
    expect(ledger.byCategory.retail_sales).toBe(30)
    expect(ledger.balance).toBe(1_030)
    expect(ledger.entries[0].balanceAfter).toBe(1_030)
  })

  it('drops old journal lines without moving the balance or category totals', () => {
    const bank = new Bank(1_000)
    bank.post('landing_fees', 400, { simMinutes: 10 })
    bank.post('payroll', -50, { simMinutes: 2_000 })
    expect(bank.retainFrom(1_440)).toBe(1)
    const ledger = bank.ledger()
    expect(ledger.entries.map((entry) => entry.meta.simMinutes)).toEqual([2_000])
    expect(ledger.balance).toBe(1_350)
    expect(ledger.byCategory).toEqual({ landing_fees: 400, payroll: -50 })
  })

  it('provides immutable daily views and serializable restoration', () => {
    const bank = new Bank(10_000)
    bank.post('retail_sales', 500, { simMinutes: 100 })
    bank.post('payroll', -300, { simMinutes: 1_500 })
    const dayZero = bank.ledgerForGameDay(0)
    expect(dayZero.net).toBe(500)
    dayZero.entries[0].amount = 99_999
    expect(bank.ledger().entries[0].amount).toBe(500)
    expect(new Bank(0, bank.snapshot()).ledger()).toEqual(bank.ledger())
  })

  it('records an unpaid bill without moving the balance or category totals', () => {
    const bank = new Bank(1_000)
    bank.post('penalties', -300, { simMinutes: 10 })
    bank.post('penalties', -4_700, { simMinutes: 11, unpaid: true, label: 'unpaid' })
    bank.post('payroll', -800, { simMinutes: 1_500, unpaid: true })
    const ledger = bank.ledger()
    expect(ledger.balance).toBe(700)
    expect(ledger.totalExpense).toBe(300)
    expect(ledger.byCategory).toEqual({ penalties: -300 })
    expect(ledger.entries.filter((entry) => entry.meta.unpaid).map((entry) => entry.amount)).toEqual([-4_700, -800])
    expect(ledger.entries.filter((entry) => entry.meta.unpaid).every((entry) => entry.balanceAfter === 700)).toBe(true)

    const day = bank.ledgerForGameDay(0)
    expect(day.net).toBe(-300)
    expect(day.byCategory).toEqual({ penalties: -300 })
    expect(day.entries.some((entry) => entry.meta.unpaid)).toBe(true)

    expect(new Bank(0, bank.snapshot()).ledger()).toEqual(ledger)
    expect(bank.retainFrom(1_440)).toBe(2)
    const kept = bank.ledger()
    expect(kept.balance).toBe(700)
    expect(kept.byCategory).toEqual({ penalties: -300 })
    expect(kept.entries.map((entry) => entry.amount)).toEqual([-800])
  })
})

describe('daily operating balance', () => {
  it('targets a 40% mid-game payroll share', () => {
    const income = 203_000
    const payroll = payrollForGameDay(income, 'midgame')
    const otherDailyCosts = 35_000
    expect(payroll / income).toBeCloseTo(0.4, 3)
    expect(operatingMargin(income, payroll + otherDailyCosts)).toBeCloseTo(0.4276, 3)
  })

  it('keeps the early payroll share at 45%', () => {
    const income = 20_000
    const payroll = payrollForGameDay(income, 'early')
    const otherDailyCosts = 3_000
    expect(payroll / income).toBeCloseTo(0.45, 3)
    expect(operatingMargin(income, payroll + otherDailyCosts)).toBeCloseTo(0.4, 3)
  })

  it('charges the city levy once daily at 0.5% above protected cash', () => {
    expect(cityLevyForGameDay(140_000)).toBe(0)
    expect(cityLevyForGameDay(240_000)).toBe(500)
  })
})
