import { describe, expect, it } from 'vitest'
import { TEST_TIMEOUT_MS, buildAirport, expectHealthy, runDays, useSeed } from './harness.ts'

describe('payroll shortfall', () => {
  useSeed(31)

  it('a near-empty bank takes the payroll hit without NaN or a runaway hole', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({ deskStaff: 2, janitors: 2, mechanics: 2, cash: 150_000 })
    const bill = g.payrollPreview()
    expect(bill).toBeGreaterThan(0)
    g.cash = 500
    const m = runDays(g, 4)
    expectHealthy(m)
    expect(g.payrollDay).toBeGreaterThanOrEqual(3)
    expect(Number.isFinite(g.cash)).toBe(true)
    expect(g.bank.ledger().totalExpense).toBeGreaterThan(0)
    // Whatever the shortfall rule is, four days of wages must not dig a hole bigger than a week of payroll.
    expect(m.minCash).toBeGreaterThan(-bill * 7)
  })
})
