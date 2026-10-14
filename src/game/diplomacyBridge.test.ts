import { describe, expect, it } from 'vitest'
import { createDiplomacyBridge } from './diplomacyBridge.ts'
import type { DiplomacyAdapterHost } from '../diplomacy/adapter.ts'
import { Game } from './sim.ts'

function host(news: string[] = []): DiplomacyAdapterHost {
  return {
    addMoney() {},
    getCash: () => 1_000_000,
    getContext: () => ({
      fieldLevel: 1,
      metrics: {
        onTimePct: 92,
        feeIndex: 1,
        cafes: 1,
        loungeSeats: 24,
        standCount: 4,
        standUtilization: 0.4,
        familyAmenities: 1,
        cargoFacilities: 0,
      },
    }),
    notify(message) {
      news.push(message)
    },
  }
}

describe('diplomacy bridge', () => {
  it('grades a signed carrier and resumes from the save', () => {
    const news: string[] = []
    const bridge = createDiplomacyBridge(host(news), 1)
    expect(bridge.gradeFlight({
      flightId: 'early',
      airlineId: 'northline',
      delayMinutes: 0,
      bagFault: false,
      paxMood: 0.8,
      standFit: true,
    }).grade).toBeNull()
    bridge.mirrorSigned('northline')
    expect(bridge.relation('northline')?.status).toBe('signed')
    const graded = bridge.gradeFlight({
      flightId: 'nl1',
      airlineId: 'northline',
      delayMinutes: 0,
      bagFault: false,
      paxMood: 0.8,
      standFit: true,
    })
    expect(graded.grade).toBe('A')
    expect(bridge.gradeFlight({
      flightId: 'nl1',
      airlineId: 'northline',
      delayMinutes: 0,
      bagFault: false,
      paxMood: 0.8,
      standFit: true,
    }).grade).toBeNull()
    expect(bridge.feeFactor('northline')).toBe(1)
    expect(bridge.capacityFactor('northline')).toBe(1)
    bridge.tick(1440)
    expect(bridge.day()).toBeCloseTo(1)
    expect(news.some((line) => /Tier 1/.test(line))).toBe(true)
    const saved = bridge.save()
    const again = createDiplomacyBridge(host(), 99)
    again.load(saved)
    expect(again.relation('northline')?.status).toBe('signed')
    expect(again.day()).toBeCloseTo(1)
  })

  it('opens tier 1 on the live field after one sim day', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.scheduleAuto = false
    game.schedule = []
    game.spawnCool = 1e9
    game.offerCool = 1e9
    game.heloCool = 1e9
    game.milCool = 1e9
    game.ambuCool = 1e9
    game.threatCool = 1e9
    game.emergencyCool = 1e9
    game.signed = ['northline']
    game.speed = 1
    game.tick(180)
    expect(game.diplomacyDay()).toBeGreaterThanOrEqual(1)
    expect(game.diplomacyRoster().some((row) => row.id === 'northline')).toBe(true)
  })

  it('keeps a published fee rise across save and load', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.signed = ['northline']
    game.tick(180)
    game.setPublishedFeeIndex(1.05)
    expect(game.publishedFeeIndex).toBe(1.05)
    expect(game.landingFeeMult('northline')).toBeCloseTo(1.05)
    const card = game.diplomacyCards().find((row) => row.id === 'northline')
    expect(card?.breakdown?.lines.some((line) => line.kind === 'fee_rise')).toBe(true)
    game.persist()
    const again = new Game()
    expect(again.load()).toBe(true)
    expect(again.publishedFeeIndex).toBe(1.05)
    const restored = again.diplomacyCards().find((row) => row.id === 'northline')
    expect(restored?.breakdown?.lines.some((line) => line.kind === 'fee_rise')).toBe(true)
  })

  it('splits diplomacy spend, receipts, and legal bills off host fees', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.signed = ['northline']
    game.speed = 1
    game.tick(0.01)
    const cash = game.cash
    const host = game.bank.ledger().byCategory.host_fees ?? 0
    const penalties = game.bank.ledger().byCategory.penalties ?? 0
    const payroll = game.payrollCharged()
    const result = game.diplomacyApologize('northline')
    expect(result.ok).toBe(true)
    expect(result.cost).toBeGreaterThan(0)
    expect(game.bank.ledger().byCategory.diplomacy).toBe(-result.cost)
    expect(game.bank.ledger().byCategory.host_fees ?? 0).toBe(host)
    expect(game.bank.ledger().byCategory.penalties ?? 0).toBe(penalties)
    expect(game.cash).toBeCloseTo(cash - result.cost, 5)
    expect(game.cash).toBeCloseTo(game.bank.balance, 5)

    const book = game as unknown as {
      postDiplomacyMoney(amount: number, category: string): void
    }
    const mid = game.cash
    const revenue = game.revenue
    book.postDiplomacyMoney(1_000_000, 'diplomacy')
    expect(game.bank.ledger().byCategory.diplomacy_income).toBe(1_000_000)
    expect(game.bank.ledger().byCategory.host_fees ?? 0).toBe(host)
    expect(game.cash).toBeCloseTo(mid + 1_000_000, 5)
    expect(game.revenue).toBeCloseTo(revenue + 1_000_000, 5)
    expect(game.payrollCharged()).toBe(payroll)

    book.postDiplomacyMoney(-250, 'legal')
    expect(game.bank.ledger().byCategory.legal).toBe(-250)
    expect(game.bank.ledger().byCategory.penalties ?? 0).toBe(penalties)
    expect(game.bank.ledger().byCategory.diplomacy).toBe(-result.cost)

    book.postDiplomacyMoney(80, 'legal')
    expect(game.bank.ledger().byCategory.refunds).toBe(80)
    expect(game.cash).toBeCloseTo(game.bank.balance, 5)

    const diplomacy = game.bank.ledger().byCategory.diplomacy
    const drawer = game.cash
    game.sandbox = true
    book.postDiplomacyMoney(-100, 'diplomacy')
    expect(game.bank.ledger().byCategory.diplomacy).toBe(diplomacy)
    expect(game.cash).toBe(drawer)
  })
})
