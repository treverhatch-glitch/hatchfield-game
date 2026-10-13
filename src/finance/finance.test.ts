import { describe, expect, it } from 'vitest'
import { dailyPremium } from './insurance.ts'
import { amortise, earlyRepay, remainingBalance } from './loans.ts'

describe('finance - loans', () => {
  it('amortise generates correct 360-day schedule', () => {
    const principal = 100000
    const annualRate = 0.06 // 6%
    const days = 360

    const loan = amortise(principal, annualRate, days)

    expect(loan.principal).toBe(100000)
    expect(loan.annualRate).toBe(0.06)
    expect(loan.days).toBe(360)
    expect(loan.dailyPayment).toBeGreaterThan(100000 / 360)
    expect(loan.schedule.length).toBe(360)

    // Verify first entry
    const day1 = loan.schedule[0]
    expect(day1.day).toBe(1)
    expect(day1.interestPayment).toBeCloseTo((100000 * 0.06) / 360, 4)
    expect(day1.payment).toBeCloseTo(loan.dailyPayment, 4)

    // Verify final entry balance is zero
    const lastDay = loan.schedule[359]
    expect(lastDay.day).toBe(360)
    expect(lastDay.remainingBalance).toBe(0)

    // Total principal paid equals initial principal
    const totalPrincipal = loan.schedule.reduce(
      (sum, e) => sum + e.principalPayment,
      0
    )
    expect(totalPrincipal).toBeCloseTo(principal, 4)
  })

  it('amortise handles zero interest rate', () => {
    const loan = amortise(12000, 0, 12)
    expect(loan.dailyPayment).toBe(1000)
    expect(loan.schedule.length).toBe(12)
    expect(loan.schedule[0].interestPayment).toBe(0)
    expect(loan.schedule[0].principalPayment).toBe(1000)
    expect(loan.schedule[11].remainingBalance).toBe(0)
  })

  it('amortise safely handles zero and negative inputs without NaN', () => {
    const zeroP = amortise(0, 0.05, 360)
    expect(zeroP.dailyPayment).toBe(0)
    expect(zeroP.schedule).toEqual([])
    expect(Number.isNaN(zeroP.dailyPayment)).toBe(false)

    const negDays = amortise(10000, 0.05, -30)
    expect(negDays.schedule).toEqual([])
    expect(Number.isNaN(negDays.dailyPayment)).toBe(false)

    const nanLoan = amortise(NaN, NaN, NaN)
    expect(nanLoan.dailyPayment).toBe(0)
    expect(nanLoan.schedule).toEqual([])
    expect(Number.isNaN(nanLoan.dailyPayment)).toBe(false)
  })

  it('remainingBalance calculates correct balance for schedule', () => {
    const loan = amortise(10000, 0.05, 100)

    // Day 0 = full initial principal
    expect(remainingBalance(loan, 0)).toBe(10000)
    expect(remainingBalance(loan, -5)).toBe(10000)

    // Day 1..100
    expect(remainingBalance(loan, 1)).toBe(loan.schedule[0].remainingBalance)
    expect(remainingBalance(loan, 50)).toBe(loan.schedule[49].remainingBalance)
    expect(remainingBalance(loan, 100)).toBe(0)

    // Day > 100
    expect(remainingBalance(loan, 150)).toBe(0)

    // Null/undefined inputs
    expect(remainingBalance(null, 10)).toBe(0)
  })

  it('earlyRepay calculates 2% fee on remaining balance', () => {
    const loan = amortise(10000, 0, 10) // $1000 per day

    // Early repay on day 1 (repaying $10,000 balance before day 1 payment)
    const repayDay1 = earlyRepay(loan, 1)
    expect(repayDay1.principalPaid).toBe(10000)
    expect(repayDay1.fee).toBe(200) // 2% of 10,000
    expect(repayDay1.payoffAmount).toBe(10200)

    // Early repay on day 6 (after 5 days paid, balance is $5,000)
    const repayDay6 = earlyRepay(loan, 6)
    expect(repayDay6.principalPaid).toBe(5000)
    expect(repayDay6.fee).toBe(100)
    expect(repayDay6.payoffAmount).toBe(5100)

    // Early repay past end
    const repayPast = earlyRepay(loan, 15)
    expect(repayPast.payoffAmount).toBe(0)
    expect(repayPast.fee).toBe(0)

    // Null/invalid schedule
    expect(earlyRepay(null, 1)).toEqual({
      payoffAmount: 0,
      fee: 0,
      principalPaid: 0,
    })
  })
})

describe('finance - insurance', () => {
  it('dailyPremium calculates base rate correctly', () => {
    // Base rate: 0.5% per 30 days prorated daily
    // $600,000 * 0.005 / 30 = $100 per day
    const premium = dailyPremium(600000, [], 10)
    expect(premium).toBeCloseTo(100, 5)
  })

  it('dailyPremium adds incident severity surcharges', () => {
    const asset = 600000 // base $100/day
    const incidents = [
      { day: 10, severity: 1 }, // +15%
      { day: 10, severity: 2 }, // +40%
      { day: 10, severity: 3 }, // +90%
    ]

    // On day 10, total surcharge = 15% + 40% + 90% = +145% -> multiplier 2.45
    const premiumDay10 = dailyPremium(asset, incidents, 10)
    expect(premiumDay10).toBeCloseTo(100 * (1 + 0.15 + 0.4 + 0.9), 5)
  })

  it('dailyPremium decays incident surcharges with 30-day half-life', () => {
    const asset = 600000 // base $100/day
    const incidents = [{ day: 0, severity: 2 }] // +40% at day 0

    // Day 0: +40% -> $140
    expect(dailyPremium(asset, incidents, 0)).toBeCloseTo(140, 5)

    // Day 30 (1 half-life elapsed): +20% -> $120
    expect(dailyPremium(asset, incidents, 30)).toBeCloseTo(120, 5)

    // Day 60 (2 half-lives elapsed): +10% -> $110
    expect(dailyPremium(asset, incidents, 60)).toBeCloseTo(110, 5)
  })

  it('dailyPremium handles future/invalid incidents and zero asset values safely without NaN', () => {
    expect(dailyPremium(0, [{ day: 1, severity: 3 }], 10)).toBe(0)
    expect(dailyPremium(-5000, [], 10)).toBe(0)
    expect(dailyPremium(NaN, [], 10)).toBe(0)

    // Future incident ignored
    const futureInc = [{ day: 20, severity: 3 }]
    expect(dailyPremium(600000, futureInc, 10)).toBeCloseTo(100, 5)

    // Null/undefined incidents handled safely
    expect(dailyPremium(600000, null, 10)).toBeCloseTo(100, 5)
  })
})
