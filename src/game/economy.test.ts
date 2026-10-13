import { describe, expect, it } from 'vitest'
import { LAND, LOAN_PRODUCTS, START_CASH, STARTER_KIT_COST } from './catalog.ts'
import { operatingMargin, payrollForGameDay } from '../core/bank.ts'
import {
  CITY_LEVY_FLOOR,
  budgetLineCost,
  cityLevy,
  fieldOpsMultiplier,
  loanInterestDue,
  loansAvailable,
  nextLoanBalance,
  payrollAmount,
  settlePayroll,
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

  it('emits a payroll shortfall only when cash cannot cover the bill', () => {
    expect(settlePayroll(2_000, 5_000)).toEqual({ due: 2_000, paid: 2_000, shortfall: 0 })
    expect(settlePayroll(2_000, 750)).toEqual({ due: 2_000, paid: 750, shortfall: 1_250 })
    expect(settlePayroll(2_000, 0)).toEqual({ due: 2_000, paid: 0, shortfall: 2_000 })
    expect(settlePayroll(2_000, Number.NaN).shortfall).toBe(2_000)
    expect(settlePayroll(2_000, -40).shortfall).toBe(2_000)
    expect(settlePayroll(Number.NaN, 100).shortfall).toBe(0)
    // A remainder that prints as $0 is not a shortfall row.
    expect(settlePayroll(2_361, 2_360.6).shortfall).toBe(0)

    const dollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
    const shortfallLine = (game: Game) => game.news.find((n) => /Payroll short|Payroll missed/.test(n.text))

    const covered = new Game()
    covered.sandbox = false
    covered.clock = 180
    const coveredDue = covered.payrollPreview()
    covered.cash = coveredDue + 10_000
    covered.tickPayroll(0)
    expect(shortfallLine(covered)).toBeUndefined()
    expect(covered.cash).toBe(10_000)
    expect(covered.reputation).toBe(40)

    const cents = new Game()
    cents.sandbox = false
    cents.clock = 180
    const centsDue = cents.payrollPreview()
    cents.cash = centsDue - 0.4
    cents.tickPayroll(0)
    expect(shortfallLine(cents)).toBeUndefined()
    expect(cents.cash).toBeCloseTo(0)
    expect(cents.reputation).toBe(40)

    const partial = new Game()
    partial.sandbox = false
    partial.clock = 180
    const due = partial.payrollPreview()
    const paid = 400
    partial.cash = paid
    partial.tickPayroll(0)
    const shortfall = due - paid
    expect(shortfall).toBeGreaterThan(0)
    expect(settlePayroll(due, paid).shortfall).toBe(shortfall)
    const partialLine = shortfallLine(partial)
    expect(partialLine?.text).toContain(dollars(shortfall))
    expect(partialLine?.text).toContain(dollars(paid))
    expect(partialLine?.text).not.toMatch(/\$0/)
    expect(partial.cash).toBe(0)
    expect(partial.reputation).toBe(36)

    const broke = new Game()
    broke.sandbox = false
    broke.clock = 180
    const brokeDue = broke.payrollPreview()
    broke.cash = 0
    broke.tickPayroll(0)
    const brokeLine = shortfallLine(broke)
    expect(brokeLine?.text).toMatch(/Payroll missed entirely/)
    expect(brokeLine?.text).toContain(dollars(brokeDue))
    expect(brokeLine?.text).not.toMatch(/paid \$0|short \$0|shortfall \$0/)
    expect(settlePayroll(brokeDue, 0).shortfall).toBe(brokeDue)
    expect(broke.cash).toBe(0)
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
    // Half a percent of the surplus, once per game day.
    expect(cityLevy(150_000)).toBe(50)
    expect(cityLevy(220_000)).toBe(400)
    expect(cityLevy(500_000)).toBe(1_800)
    const sandboxAfterLand = SANDBOX_CASH - LAND.city.cost
    expect(sandboxAfterLand).toBe(9_904_999)
    expect(cityLevy(sandboxAfterLand)).toBe(48_825)
    expect(cityLevy(sandboxAfterLand, true)).toBe(0)
    expect(cityLevy(SANDBOX_CASH, true)).toBe(0)

    const sandbox = new Game()
    sandbox.sandbox = true
    sandbox.cash = SANDBOX_CASH
    sandbox.clock = 180
    const bill = sandbox.payrollPreview()
    expect(bill).toBeGreaterThan(0)
    sandbox.tickPayroll(0)
    expect(sandbox.cash).toBe(SANDBOX_CASH - bill)
    expect(sandbox.news.some((n) => n.text.includes('city levy'))).toBe(false)
    sandbox.tickPayroll(0)
    expect(sandbox.cash).toBe(SANDBOX_CASH - bill)

    const live = new Game()
    live.sandbox = false
    live.cash = 500_000
    live.clock = 90
    live.earn(203_000, 'turns')
    live.clock = 180
    const earlyBill = payrollForGameDay(203_000, 'early', live.payrollPreview())
    live.tickPayroll(0)
    const afterEarly = 500_000 + 203_000 - earlyBill
    const earlyLevy = cityLevy(afterEarly)
    expect(earlyLevy).toBeGreaterThan(0)
    expect(earlyLevy).toBeLessThan(5_000)
    expect(live.cash).toBe(afterEarly - earlyLevy)
    expect(live.news.some((n) => n.text.includes('city levy'))).toBe(true)
    live.tickPayroll(0)
    expect(live.cash).toBe(afterEarly - earlyLevy)

    const mid = new Game()
    mid.sandbox = false
    mid.cash = 500_000
    mid.payrollDay = 3
    mid.clock = 600
    mid.earn(203_000, 'mid-day turns')
    mid.clock = 720
    const midBill = payrollForGameDay(203_000, 'midgame', mid.payrollPreview())
    const other = 35_000
    const margin = operatingMargin(203_000, midBill + other)
    expect(margin).toBeGreaterThanOrEqual(0.15)
    expect(margin).toBeLessThanOrEqual(0.3)
    expect(operatingMargin(20_000, payrollForGameDay(20_000, 'early') + 3_000)).toBeCloseTo(0.1)
    mid.tickPayroll(0)
    const afterMid = 500_000 + 203_000 - midBill
    expect(mid.cash).toBe(afterMid - cityLevy(afterMid))
  })

  it('measures a prefab hall without marking passengers or bags lost', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    expect(game.branding.airportName).toBe('Hatchfield')
    const report = game.flowAudit()
    expect(report.totals.lost).toBe(0)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsMishandled).toBe(0)
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
