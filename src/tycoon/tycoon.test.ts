import { describe, expect, it } from 'vitest'
import { Bank } from '../core/bank.ts'
import { SIM_MINUTES_PER_GAME_DAY } from '../core/clock.ts'
import { AWARD_CLEANEST, CAMPAIGNS, DAYS_PER_YEAR, LEASE_DAYS } from './config.ts'
import { TycoonEngine } from './engine.ts'
import type { TycoonBooks, TycoonPulse } from './types.ts'

function books(opening = 200_000) {
  const bank = new Bank(opening)
  let cash = opening
  const api: TycoonBooks = {
    balance: () => cash,
    post(category, amount, meta) {
      const rounded = Math.round(amount)
      if (!rounded) return false
      if (rounded < 0 && cash < -rounded) return false
      cash += rounded
      bank.post(category, rounded, meta)
      return true
    },
    entriesBetween: (start, end) => bank.entriesBetween(start, end),
  }
  return {
    api,
    bank,
    cash: () => cash,
  }
}

const busy: TycoonPulse = { passengers: 80, satisfaction: 84, cleanliness: 90 }
const quiet: TycoonPulse = { passengers: 0, satisfaction: 20, cleanliness: 40 }

function field(seed = 1) {
  const engine = new TycoonEngine(seed)
  const ledger = books()
  const units = [
    { id: 'T1:food:0', kind: 'food' as const, label: 'T1 food 1' },
    { id: 'T1:shop:0', kind: 'retail' as const, label: 'T1 shop 1' },
  ]
  engine.syncUnits(units)
  return { engine, ledger, units }
}

describe('shop tenant bidding', () => {
  it('offers rent, a revenue share, and a quality tier for an empty food or shop unit', () => {
    const { engine } = field()
    const view = engine.view(0)
    expect(view.units).toHaveLength(2)
    for (const unit of view.units) {
      expect(unit.bids).toHaveLength(3)
      expect(unit.bids.map((b) => b.quality)).toEqual([1, 2, 3])
      const economy = unit.bids[0]
      const premium = unit.bids[2]
      expect(economy.dailyRent).toBeGreaterThan(premium.dailyRent)
      expect(premium.revenueShare).toBeGreaterThan(economy.revenueShare)
      expect(economy.revenueShare).toBeGreaterThan(0)
    }
  })

  it('leases the chosen brand and posts rent plus sales share through the ledger', () => {
    const { engine, ledger } = field()
    const bid = engine.view(0).units[0].bids[1]
    engine.acceptBid(bid.unitId, bid.id, 0)
    const again = engine.acceptBid(bid.unitId, bid.id, 0)
    expect(again[0].tone).toBe('bad')
    engine.catchUp(ledger.api, 1, () => busy)
    expect(engine.view(1).units[0].lease?.brand).toBe(bid.brand)
    expect(engine.view(1).units[0].daysLeft).toBe(LEASE_DAYS - 1)
    const totals = ledger.bank.ledger().byCategory
    expect(totals.contract_fees).toBe(bid.dailyRent)
    expect(totals.retail_sales).toBeGreaterThan(0)
    expect(ledger.cash()).toBeGreaterThan(200_000)
  })

  it('renews a happy tenant and reopens bids when one leaves', () => {
    const happy = field(2)
    const stay = happy.engine.view(0).units[0].bids[2]
    happy.engine.acceptBid(stay.unitId, stay.id, 0)
    happy.engine.catchUp(happy.ledger.api, LEASE_DAYS, () => busy)
    const renewed = happy.engine.view(LEASE_DAYS).units[0].lease
    expect(renewed?.renewed).toBe(1)
    expect(renewed?.dailyRent).toBeGreaterThan(stay.dailyRent)
    expect(renewed?.brand).toBe(stay.brand)

    const unhappy = field(3)
    const go = unhappy.engine.view(0).units[0].bids[0]
    unhappy.engine.acceptBid(go.unitId, go.id, 0)
    const notes = unhappy.engine.catchUp(unhappy.ledger.api, LEASE_DAYS, () => quiet)
    expect(notes.some((n) => n.text.includes('left'))).toBe(true)
    const vacated = unhappy.engine.view(LEASE_DAYS).units[0]
    expect(vacated.lease).toBeNull()
    expect(vacated.bids).toHaveLength(3)
  })

  it('round-trips leases through a save', () => {
    const { engine } = field(4)
    const bid = engine.view(0).units[1].bids[0]
    engine.acceptBid(bid.unitId, bid.id, 0)
    const copy = new TycoonEngine(9)
    copy.restore(engine.snapshot(), 0)
    expect(copy.view(0).units[1].lease?.brand).toBe(bid.brand)
    expect(copy.view(0).units[1].bids).toHaveLength(0)
  })
})

describe('advertising campaigns', () => {
  it('charges the ledger and lifts demand or airline interest until the term ends', () => {
    const { engine, ledger } = field()
    const local = CAMPAIGNS.find((c) => c.kind === 'local')!
    const airline = CAMPAIGNS.find((c) => c.kind === 'airline')!
    const broke = books(100)
    expect(engine.startCampaign(broke.api, 'local', 0, 10)[0].tone).toBe('bad')
    expect(broke.cash()).toBe(100)
    expect(engine.demandMultiplier(0)).toBe(1)

    expect(engine.startCampaign(ledger.api, 'regional', 0, 10)[0].tone).toBe('good')
    expect(ledger.bank.ledger().byCategory.advertising).toBe(-CAMPAIGNS.find((c) => c.kind === 'regional')!.cost)
    expect(engine.demandMultiplier(0)).toBeCloseTo(1.14)
    expect(engine.airlineInterest(0)).toBeGreaterThan(0)
    expect(engine.startCampaign(ledger.api, 'local', 0, 20)[0].text).toMatch(/already running/)

    const regionalDays = CAMPAIGNS.find((c) => c.kind === 'regional')!.days
    engine.catchUp(ledger.api, regionalDays, () => busy)
    expect(engine.demandMultiplier(regionalDays)).toBe(1)
    expect(engine.startCampaign(ledger.api, 'airline', regionalDays, 30)[0].tone).toBe('good')
    expect(engine.airlineInterest(regionalDays)).toBe(airline.airlineInterest)
    expect(engine.demandMultiplier(regionalDays)).toBeCloseTo(1 + airline.demandBoost)
    expect(local.demandBoost).toBeGreaterThan(0)
  })
})

describe('year report and awards', () => {
  it('opens one report per year with revenue, costs, passengers, satisfaction, and best and worst', () => {
    const { engine, ledger } = field(5)
    const bid = engine.view(0).units[0].bids[2]
    const shop = engine.view(0).units[1].bids[2]
    engine.acceptBid(bid.unitId, bid.id, 0)
    engine.acceptBid(shop.unitId, shop.id, 0)
    engine.startCampaign(ledger.api, 'local', 0, 5)
    ledger.api.post('loan_proceeds', 50_000, { simMinutes: 10, source: 'test' })
    const pulse: TycoonPulse = {
      passengers: 200,
      satisfaction: 80,
      cleanliness: AWARD_CLEANEST.cleanliness,
    }
    const notes = engine.catchUp(ledger.api, DAYS_PER_YEAR, () => pulse)
    const report = engine.pendingReport()
    expect(report?.year).toBe(1)
    expect(report?.passengers).toBe(200 * DAYS_PER_YEAR)
    expect(report?.satisfaction).toBe(80)
    expect(report?.revenue).toBeGreaterThan(0)
    expect(report?.costs).toBe(CAMPAIGNS.find((c) => c.kind === 'local')!.cost)
    expect(report?.revenue).toBeLessThan(50_000)
    expect(report?.best.id).not.toBe(report?.worst.id)
    expect(['revenue', 'costs', 'passengers', 'satisfaction']).toContain(report?.best.id)
    expect(report?.awards.map((a) => a.name)).toEqual(
      expect.arrayContaining(['Best Regional Airport', 'Cleanest Terminal', 'Leased Concourse']),
    )
    expect(engine.view(DAYS_PER_YEAR).prestige).toBeGreaterThan(0)
    expect(notes.filter((n) => n.reputation).reduce((sum, n) => sum + (n.reputation ?? 0), 0)).toBeGreaterThan(0)

    engine.dismissReport()
    expect(engine.pendingReport()).toBeNull()
    engine.catchUp(ledger.api, DAYS_PER_YEAR + 1, () => pulse)
    expect(engine.pendingReport()).toBeNull()

    engine.catchUp(ledger.api, DAYS_PER_YEAR * 2, () => quiet)
    expect(engine.pendingReport()?.year).toBe(2)
    expect(engine.pendingReport()?.awards).toHaveLength(0)
  })

  it('stamps rent inside the year the ledger already uses', () => {
    const { engine, ledger } = field()
    const bid = engine.view(0).units[0].bids[0]
    engine.acceptBid(bid.unitId, bid.id, 0)
    engine.catchUp(ledger.api, 1, () => busy)
    const day = ledger.bank.ledgerForGameDay(0)
    expect(day.byCategory.contract_fees).toBe(bid.dailyRent)
    const stamp = ledger.bank.ledger().entries[0].meta.simMinutes
    expect(stamp).toBeGreaterThanOrEqual(0)
    expect(stamp).toBeLessThan(SIM_MINUTES_PER_GAME_DAY)
  })
})
