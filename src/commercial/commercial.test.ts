import { describe, expect, it } from 'vitest'
import { DEFAULT_AIRFRAMES } from '../contracts/airframes.ts'
import { makeOffer, signContract } from '../contracts/contracts.ts'
import { line, SUMMER } from '../contracts/testkit.ts'
import {
  CARGO_INTAKE_FEE,
  CLEANING_FEE,
  DEICE_FEE,
  GA_PARK_DAY_RATE,
  HELO_LANDING,
  HOTEL_NIGHT_FEE,
  PARK_LONG_FEE,
  PARK_SHORT_FEE,
} from '../game/catalog.ts'
import { defaultConfig } from '../logistics/defaults.ts'
import {
  ELASTICITY_KEYS,
  capacityBadge,
  collectDeposit,
  committedContractPax,
  contractDailyPax,
  dailyCapacity,
  earliestFlightDay,
  elasticity,
  feePriceIndex,
  flightRespectsLead,
  forfeitDeposit,
  peakHourCapacity,
  priceFactors,
  priceTurn,
  refundDeposit,
  remainingDailyPax,
  resolveLead,
  scheduleElasticity,
  DEFAULT_FEE_SCHEDULE,
  type CapacityPlant,
  type TurnUsage,
} from './index.ts'

function plant(over: Partial<CapacityPlant> = {}): CapacityPlant {
  return {
    terminalHold: 1000,
    terminalTurnsPerDay: 10,
    securityLanes: 2,
    securityPaxPerHour: 200,
    checkInPositions: 4,
    checkInPaxPerHour: 50,
    opsHours: 10,
    stands: [{ icao: 'C', count: 2, turnsPerDay: 5, paxPerTurn: 100 }],
    bhsBagsPerHour: 200,
    bagsPerPax: 0.8,
    ...over,
  }
}

/** 10,000 / 4,000 / 2,000 / 1,000 / 2,500 — gates bind. */
const BASE = plant()

describe('capacity', () => {
  it('daily pax is the minimum link and names it', () => {
    const cap = dailyCapacity(BASE)
    expect(cap.links).toEqual({
      terminal: 10_000,
      security: 4_000,
      checkin: 2_000,
      gates: 1_000,
      bhs: 2_500,
    })
    expect(cap.dailyPax).toBe(1_000)
    expect(cap.binding).toBe('gates')
    expect(cap.dailyPax).toBe(Math.min(...Object.values(cap.links)))

    const securityBinds = dailyCapacity(plant({ securityLanes: 1, securityPaxPerHour: 50, opsHours: 10 }))
    expect(securityBinds.links.security).toBe(500)
    expect(securityBinds.binding).toBe('security')
    expect(securityBinds.dailyPax).toBe(500)
  })

  it('colours the offer badge at 70% and 100%, and on a peak-hour overrun', () => {
    const open = capacityBadge({ estPaxPerDay: 1500, remaining: 7000 })
    expect(open.text).toBe('1,500 / 7,000')
    expect(open.tone).toBe('green')
    expect(open.blocksSigning).toBe(false)

    expect(capacityBadge({ estPaxPerDay: 699, remaining: 1000 }).tone).toBe('green')
    expect(capacityBadge({ estPaxPerDay: 700, remaining: 1000 }).tone).toBe('yellow')
    expect(capacityBadge({ estPaxPerDay: 1000, remaining: 1000 }).tone).toBe('yellow')
    expect(capacityBadge({ estPaxPerDay: 1001, remaining: 1000 }).tone).toBe('red')

    const peakCap = peakHourCapacity(BASE)
    const crowded = capacityBadge({
      estPaxPerDay: 100,
      remaining: 7000,
      peakHourPax: peakCap + 1,
      peakHourCap: peakCap,
    })
    expect(crowded.tone).toBe('red')
    expect(crowded.peakHourOver).toBe(true)
    expect(crowded.blocksSigning).toBe(false)
  })

  it('signed contracts reduce remaining capacity and still allow signing when red', () => {
    const wide = dailyCapacity(
      plant({
        terminalHold: 7000,
        terminalTurnsPerDay: 1,
        securityLanes: 10,
        securityPaxPerHour: 100,
        checkInPositions: 10,
        checkInPaxPerHour: 100,
        opsHours: 16,
        stands: [{ icao: 'C', count: 10, turnsPerDay: 10, paxPerTurn: 200 }],
        bhsBagsPerHour: 1000,
      }),
    )
    expect(wide.dailyPax).toBe(7000)

    const offer = makeOffer({
      id: 'nl',
      airlineId: 'northline',
      lines: [line('l1', 'a320', 480)],
      services: ['fuel', 'baggage'],
    })
    const signed = signContract(offer, SUMMER, [])
    expect(signed.ok).toBe(true)
    if (!signed.ok) return
    const committed = committedContractPax([signed.contract], DEFAULT_AIRFRAMES)
    expect(committed).toBe(contractDailyPax(signed.contract, DEFAULT_AIRFRAMES))
    expect(committed).toBe(144)

    const before = remainingDailyPax(wide.dailyPax, 0)
    const after = remainingDailyPax(wide.dailyPax, committed)
    expect(before - after).toBe(144)
    expect(capacityBadge({ estPaxPerDay: 1500, remaining: before }).text).toBe('1,500 / 7,000')
    expect(capacityBadge({ estPaxPerDay: 1500, remaining: after }).text).toBe('1,500 / 6,856')

    const red = capacityBadge({ estPaxPerDay: 2000, remaining: 1000 })
    expect(red.tone).toBe('red')
    expect(red.blocksSigning).toBe(false)
    const over = signContract(
      makeOffer({ id: 'over', airlineId: 'harbor', lines: [line('h', 'a320', 600)], services: [] }),
      SUMMER,
      [],
    )
    expect(over.ok).toBe(true)
  })
})

describe('lead time', () => {
  it('uses the role band, and the first starter contract flies on day 0', () => {
    expect(resolveLead()).toBe(7)
    expect(resolveLead({ role: 'commuter' })).toBe(4)
    expect(resolveLead({ role: 'commuter', days: 3 })).toBe(3)
    expect(resolveLead({ role: 'commuter', days: 5 })).toBe(5)
    expect(resolveLead({ role: 'commuter', days: 1 })).toBe(3)
    expect(resolveLead({ role: 'flag' })).toBe(12)
    expect(resolveLead({ role: 'flag', days: 10 })).toBe(10)
    expect(resolveLead({ role: 'flag', days: 14 })).toBe(14)
    expect(resolveLead({ role: 'flag', days: 9 })).toBe(10)
    expect(resolveLead({ role: 'flag', days: 20 })).toBe(14)
    expect(resolveLead({ role: 'hub' })).toBe(14)
    expect(resolveLead({ role: 'hub', days: 3 })).toBe(14)

    const starter = resolveLead({ role: 'flag', starter: true, days: 14 })
    expect(starter).toBe(0)
    expect(earliestFlightDay(0, starter)).toBe(0)
    expect(flightRespectsLead(0, 0, starter)).toBe(true)

    const commuter = resolveLead({ role: 'commuter' })
    expect(earliestFlightDay(10, commuter)).toBe(14)
    expect(flightRespectsLead(13, 10, commuter)).toBe(false)
    expect(flightRespectsLead(14, 10, commuter)).toBe(true)
  })
})

describe('deposits', () => {
  it('collects, refunds at term end, and forfeits on airline early cancel', () => {
    const season = 100_000
    const big = collectDeposit({ contractId: 'c1', tier: 'big', seasonRevenue: season, day: 3 })
    expect(big.account.held).toBe(15_000)
    expect(big.entry.kind).toBe('deposit_in')
    expect(big.entry.amount).toBe(15_000)
    expect(Number.isNaN(big.entry.amount)).toBe(false)

    const back = refundDeposit(big.account, 200)
    expect(back.account.status).toBe('refunded')
    expect(back.account.held).toBe(0)
    expect(back.entry.kind).toBe('deposit_out')
    expect(back.entry.amount).toBe(-15_000)
    expect(big.entry.amount + back.entry.amount).toBe(0)
    expect(refundDeposit(back.account, 201).entry.amount).toBe(0)

    const kept = forfeitDeposit(big.account, 40)
    expect(kept.account.status).toBe('forfeited')
    expect(kept.entry.kind).toBe('deposit_forfeit')
    expect(kept.entry.amount).toBe(0)
    expect(kept.entry.retained).toBe(15_000)
    expect(kept.account.held).toBe(0)
    expect(big.entry.amount + kept.entry.amount).toBe(15_000)

    const standard = collectDeposit({ contractId: 'c2', tier: 'standard', seasonRevenue: season, day: 3 })
    expect(standard.account.held).toBe(5_000)

    const broken = collectDeposit({ contractId: 'c3', tier: 'big', seasonRevenue: Number.NaN, day: Number.NaN })
    expect(broken.account.held).toBe(0)
    expect(Number.isNaN(broken.entry.amount)).toBe(false)
    expect(Number.isNaN(broken.entry.day)).toBe(false)
    expect(Number.isNaN(forfeitDeposit(broken.account, 1).entry.retained)).toBe(false)
  })
})

const FULL_TURN: TurnUsage = {
  tonnes: 79,
  pax: 160,
  parkingHours: 5,
  parkingDays: 1,
  fuelLitres: 10_000,
  cateringCarts: 2,
  bags: 128,
  cleaning: true,
  deice: true,
  pushback: true,
  gpu: true,
  lavWater: true,
  prm: true,
  cargoUnits: 3,
  helicopter: true,
  carParkShort: 2,
  carParkLong: 1,
  hotelNights: 2,
}

describe('fees', () => {
  it('defaults reproduce current catalog and contract revenue within 2%', () => {
    const fees = DEFAULT_FEE_SCHEDULE
    const offer = makeOffer({ id: 'm', airlineId: 'al', lines: [line('l', 'a320', 480)], services: [] })
    const kitchen = defaultConfig().kitchen.feePerMeal
    const fuel = defaultConfig().fuelFarm.throughputFeePerLitre

    expect(fees.landingPerTonne).toBe(offer.money.landingPerTonne)
    expect(fees.paxFee).toBe(offer.money.perPax)
    expect(fees.landingPerTonne).toBe(8)
    expect(fees.paxFee).toBe(12)
    expect(fees.cleaning).toBe(CLEANING_FEE)
    expect(fees.deice).toBe(DEICE_FEE)
    expect(fees.cargoPerUnit).toBe(CARGO_INTAKE_FEE)
    expect(fees.helicopterLanding).toBe(HELO_LANDING)
    expect(fees.carParkShort).toBe(PARK_SHORT_FEE)
    expect(fees.carParkLong).toBe(PARK_LONG_FEE)
    expect(fees.hotelNight).toBe(HOTEL_NIGHT_FEE)
    expect(fees.aircraftParkingPerDay).toBe(GA_PARK_DAY_RATE)
    expect(fees.fuelMarkupPerLitre).toBeCloseTo(fuel)
    expect(fees.cateringPerCart).toBe(kitchen * 30)
    expect(fees.parkingFreeHours).toBe(2)

    const legacy =
      79 * 8 +
      160 * 12 +
      Math.max(0, 5 - 2) * 45 +
      1 * GA_PARK_DAY_RATE +
      10_000 * fuel +
      2 * (kitchen * 30) +
      128 * 8 +
      CLEANING_FEE +
      DEICE_FEE +
      350 +
      180 +
      120 +
      75 +
      3 * CARGO_INTAKE_FEE +
      HELO_LANDING +
      2 * PARK_SHORT_FEE +
      1 * PARK_LONG_FEE +
      2 * HOTEL_NIGHT_FEE
    const quoted = priceTurn(FULL_TURN, fees, { channel: 'contract', tier: 'standard', discount: 1 })
    expect(legacy).toBeGreaterThan(0)
    expect(Math.abs(quoted - Math.round(legacy)) / Math.round(legacy)).toBeLessThanOrEqual(0.02)

    const parked = priceTurn({ parkingHours: 2 }, fees)
    const parkedOver = priceTurn({ parkingHours: 3 }, fees)
    expect(parked).toBe(0)
    expect(parkedOver).toBe(45)
  })

  it('contracts pay fee × deposit multiplier × discount; walk-ins pay list price', () => {
    const usage: TurnUsage = { tonnes: 78, pax: 100, cleaning: true, deice: true }
    const list = priceTurn(usage, DEFAULT_FEE_SCHEDULE, { channel: 'contract', tier: 'standard', discount: 1 })
    const big = priceTurn(usage, DEFAULT_FEE_SCHEDULE, { channel: 'contract', tier: 'big', discount: 1 })
    const discounted = priceTurn(usage, DEFAULT_FEE_SCHEDULE, { channel: 'contract', tier: 'standard', discount: 0.8 })
    const bigDiscount = priceTurn(usage, DEFAULT_FEE_SCHEDULE, { channel: 'contract', tier: 'big', discount: 0.5 })
    expect(big).toBe(Math.round(list * 0.9))
    expect(discounted).toBe(Math.round(list * 0.8))
    expect(bigDiscount).toBe(Math.round(list * 0.9 * 0.5))

    const walk = priceTurn(usage, DEFAULT_FEE_SCHEDULE, { channel: 'walkin', tier: 'big', discount: 0.5 })
    expect(walk).toBe(list)
    expect(priceFactors({ channel: 'walkin', tier: 'none', discount: 0.2 })).toEqual({
      landing: 1,
      pax: 1,
      service: 1,
    })

    const services = priceTurn({ cleaning: true, tonnes: 10, pax: 10 }, DEFAULT_FEE_SCHEDULE, {
      channel: 'contract',
      tier: 'none',
      discount: 1,
    })
    const standardServices = priceTurn({ cleaning: true, tonnes: 10, pax: 10 }, DEFAULT_FEE_SCHEDULE, {
      channel: 'contract',
      tier: 'standard',
      discount: 1,
    })
    expect(services - standardServices).toBe(Math.round(CLEANING_FEE * 0.15))
    expect(priceFactors({ channel: 'contract', tier: 'small' }).service).toBeCloseTo(1.15)
    expect(priceFactors({ channel: 'contract', tier: 'none' }).landing).toBe(1)
  })

  it('raises walk-in demand below default and cuts demand and Standing above 1.3×', () => {
    const cheap = elasticity(0.5)
    const list = elasticity(1)
    const edge = elasticity(1.3)
    const hot = elasticity(1.31)
    const steep = elasticity(2)
    expect(cheap.demand).toBeGreaterThan(list.demand)
    expect(list.demand).toBe(1)
    expect(list.standingDelta).toBe(0)
    expect(edge.demand).toBe(1)
    expect(edge.standingDelta).toBe(0)
    expect(hot.demand).toBeLessThan(1)
    expect(hot.standingDelta).toBeLessThan(0)
    expect(steep.demand).toBeLessThan(hot.demand)
    expect(steep.standingDelta).toBeLessThan(hot.standingDelta)
    for (const point of [cheap, list, edge, hot, steep, elasticity(Number.NaN)]) {
      expect(Number.isFinite(point.demand)).toBe(true)
      expect(Number.isFinite(point.standingDelta)).toBe(true)
    }

    const raised = { ...DEFAULT_FEE_SCHEDULE }
    const cut = { ...DEFAULT_FEE_SCHEDULE }
    for (const key of ELASTICITY_KEYS) {
      raised[key] = DEFAULT_FEE_SCHEDULE[key] * 1.6
      cut[key] = DEFAULT_FEE_SCHEDULE[key] * 0.7
    }
    expect(feePriceIndex(raised)).toBeGreaterThan(1.3)
    expect(scheduleElasticity(raised).demand).toBeLessThan(1)
    expect(scheduleElasticity(raised).standingDelta).toBeLessThan(0)
    expect(scheduleElasticity(cut).demand).toBeGreaterThan(1)
  })
})
