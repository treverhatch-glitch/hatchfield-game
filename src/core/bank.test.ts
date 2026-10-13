import { describe, expect, it, vi } from 'vitest'
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
})

describe('daily operating balance', () => {
  it('targets 55–60% payroll and a 15–30% mid-game margin', () => {
    const income = 203_000
    const payroll = payrollForGameDay(income, 'midgame')
    const otherDailyCosts = 35_000
    expect(payroll / income).toBeCloseTo(0.575, 3)
    expect(operatingMargin(income, payroll + otherDailyCosts)).toBeGreaterThanOrEqual(0.15)
    expect(operatingMargin(income, payroll + otherDailyCosts)).toBeLessThanOrEqual(0.3)
  })

  it('keeps the early operating margin between zero and ten percent', () => {
    const income = 20_000
    const payroll = payrollForGameDay(income, 'early')
    const otherDailyCosts = 3_000
    expect(operatingMargin(income, payroll + otherDailyCosts)).toBe(0.1)
  })

  it('charges the city levy once daily at 0.5% above protected cash', () => {
    expect(cityLevyForGameDay(140_000)).toBe(0)
    expect(cityLevyForGameDay(240_000)).toBe(500)
  })
})
