import { describe, expect, it } from 'vitest'
import { LAND, LOAN_PRODUCTS, START_CASH, STARTER_KIT_COST } from './catalog.ts'
import {
  CITY_LEVY_FLOOR,
  budgetLineCost,
  cityLevy,
  fieldOpsMultiplier,
  loanInterestDue,
  loansAvailable,
  nextLoanBalance,
  payrollAmount,
} from './economy.ts'
import { Game } from './sim.ts'
import { SANDBOX_CASH } from './types.ts'

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

  it('clips surplus cash with a small levy and leaves a sandbox pile alone', () => {
    const easyAfterKit = START_CASH.easy - LAND.city.cost - STARTER_KIT_COST
    const standardAfterLand = START_CASH.standard - LAND.city.cost
    expect(easyAfterKit).toBe(77_000)
    expect(standardAfterLand).toBe(55_000)
    expect(easyAfterKit).toBeLessThanOrEqual(CITY_LEVY_FLOOR)
    expect(cityLevy(easyAfterKit)).toBe(0)
    expect(cityLevy(standardAfterLand)).toBe(0)
    expect(cityLevy(CITY_LEVY_FLOOR)).toBe(0)
    // A grown field, not a trial pile: 3% of the surplus only.
    expect(cityLevy(150_000)).toBe(300)
    expect(cityLevy(220_000)).toBe(2_400)
    expect(cityLevy(500_000)).toBe(10_800)
    // The figure that was draining sandbox: cash after buying the city plot, about $293k a tick.
    const sandboxAfterLand = SANDBOX_CASH - LAND.city.cost
    expect(sandboxAfterLand).toBe(9_904_999)
    expect(cityLevy(sandboxAfterLand)).toBe(292_950)
    expect(cityLevy(sandboxAfterLand, true)).toBe(0)
    expect(cityLevy(SANDBOX_CASH, true)).toBe(0)

    const sandbox = new Game()
    sandbox.sandbox = true
    sandbox.cash = SANDBOX_CASH
    sandbox.payrollCool = 0
    const bill = sandbox.payrollPreview()
    expect(bill).toBeGreaterThan(0)
    sandbox.tickPayroll(0)
    expect(sandbox.cash).toBe(SANDBOX_CASH - bill)
    expect(sandbox.news.some((n) => n.text.includes('city levy'))).toBe(false)

    const live = new Game()
    live.sandbox = false
    live.cash = 180_000
    live.payrollCool = 0
    const liveBill = live.payrollPreview()
    live.tickPayroll(0)
    const afterPay = 180_000 - liveBill
    // Payroll every 30s. The 3% levy waits for the sim day so it is not charged six times.
    expect(live.cash).toBe(afterPay)
    expect(live.news.some((n) => n.text.includes('city levy'))).toBe(false)
    live.clock = 180
    live.payrollCool = 0
    const bill2 = live.payrollPreview()
    live.tickPayroll(0)
    const afterSecond = afterPay - bill2
    const levy = cityLevy(afterSecond)
    expect(levy).toBeGreaterThan(0)
    expect(levy).toBeLessThan(5_000)
    expect(live.cash).toBe(afterSecond - levy)
    expect(live.news.some((n) => n.text.includes('city levy'))).toBe(true)
    live.payrollCool = 0
    live.tickPayroll(0)
    expect(live.cash).toBe(afterSecond - levy - live.payrollPreview())
  })

  it('keeps a recent earning on the hourly readout through a quiet hour', () => {
    const game = new Game()
    game.sandbox = false
    game.earn(5_000, 'NL1 landing')
    game.sampleEconomy(7.5)
    expect(game.incomePerHour).toBe(5_000)
    game.sampleEconomy(7.5)
    expect(game.incomePerHour).toBe(0)
    expect(game.incomeRate()).toBe(5_000)
    game.hourIncome = 800
    game.econHour = 1
    expect(game.incomeRate()).toBeGreaterThan(0)
  })
})
