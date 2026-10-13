import { describe, expect, it } from 'vitest'
import { LOAN_PRODUCTS } from './catalog.ts'
import {
  budgetLineCost,
  fieldOpsMultiplier,
  loanInterestDue,
  loansAvailable,
  nextLoanBalance,
  payrollAmount,
} from './economy.ts'

const emptyLine = {
  mechanics: 0,
  hangars: 0,
  researchers: 0,
  desks: 0,
  boards: 0,
  machines: 0,
  securityPosts: 0,
  deskStaff: 0,
  cleanRooms: 0,
  janitors: 0,
  fireStations: 1,
  signed: 0,
  helipads: 0,
}

describe('economy', () => {
  it('caps field ops payroll as the field gets busier', () => {
    expect(fieldOpsMultiplier(1, 2, 0)).toBe(1)
    expect(fieldOpsMultiplier(3, 4, 10)).toBeCloseTo(1 + 2 * 0.055 + 2 * 0.04 + 10 * 0.0035)
    expect(fieldOpsMultiplier(40, 40, 400)).toBe(1.65)
  })

  it('charges the interest floor and only capitalizes the unpaid short', () => {
    const bridge = LOAN_PRODUCTS.find((p) => p.id === 'bridge')!
    const opened = bridge.principal + bridge.fee
    expect(loanInterestDue(opened, bridge.rate, bridge.interestFloor)).toBe(bridge.interestFloor)
    expect(loanInterestDue(500_000, bridge.rate, bridge.interestFloor)).toBe(Math.round(500_000 * bridge.rate))
    const short = 400
    expect(nextLoanBalance(opened, short, opened)).toBe(opened + short)
    expect(nextLoanBalance(opened * 2, 10_000, opened)).toBeCloseTo(opened * 2.1)
  })

  it('locks bigger loans until field level and reputation, unless sandbox', () => {
    const early = loansAvailable(LOAN_PRODUCTS, 1, 0, false).map((p) => p.id)
    expect(early).toEqual(['micro', 'bridge'])
    expect(loansAvailable(LOAN_PRODUCTS, 1, 0, true)).toHaveLength(LOAN_PRODUCTS.length)
  })

  it('prices a bare payroll line and scales it', () => {
    const fire = budgetLineCost({ ...emptyLine, key: 'fire', budgetPct: 100 })
    expect(fire).toBe(780)
    const skeleton = budgetLineCost({ ...emptyLine, key: 'fire', budgetPct: 100, fireStations: 0 })
    expect(skeleton).toBeCloseTo(780 * 0.35)
    const lines = (['maintenance', 'security', 'cleaning', 'fire', 'ambulance'] as const).map((key) =>
      budgetLineCost({ ...emptyLine, key, budgetPct: 100, signed: 1 }),
    )
    expect(payrollAmount(lines, 1)).toBe(Math.round(lines.reduce((n, c) => n + c, 0)))
  })
})
