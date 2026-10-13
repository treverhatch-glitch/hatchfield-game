import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARKING_PRICES,
  DRIVING_SHARE,
  ELASTICITY_EXPONENT,
  LONG_STAY_AVG_DAYS,
  SHORT_STAY_SHARE,
} from './data.ts'
import { dailyParkingDemand, dailyRevenue, occupancy } from './carpark.ts'

describe('dailyParkingDemand', () => {
  it('calculates demand accurately at default prices', () => {
    const pax = 1000
    const demand = dailyParkingDemand(pax)

    const expectedDriving = pax * DRIVING_SHARE // 350
    const expectedShort = expectedDriving * SHORT_STAY_SHARE // 105
    const expectedLong = expectedDriving * (1 - SHORT_STAY_SHARE) * LONG_STAY_AVG_DAYS // 980

    expect(demand.short).toBeCloseTo(expectedShort, 5)
    expect(demand.long).toBeCloseTo(expectedLong, 5)
  })

  it('adjusts demand according to price elasticity exponent 0.6', () => {
    const pax = 1000
    const baseDemand = dailyParkingDemand(pax, DEFAULT_PARKING_PRICES)

    // Increase short stay price to $56 (2x default) -> demand should decrease
    const highPriceDemand = dailyParkingDemand(pax, { short: 56, long: 58 })
    const expectedHighShort = baseDemand.short * Math.pow(28 / 56, ELASTICITY_EXPONENT)
    expect(highPriceDemand.short).toBeCloseTo(expectedHighShort, 5)
    expect(highPriceDemand.short).toBeLessThan(baseDemand.short)

    // Decrease short stay price to $14 (0.5x default) -> demand should increase
    const lowPriceDemand = dailyParkingDemand(pax, { short: 14, long: 58 })
    const expectedLowShort = baseDemand.short * Math.pow(28 / 14, ELASTICITY_EXPONENT)
    expect(lowPriceDemand.short).toBeCloseTo(expectedLowShort, 5)
    expect(lowPriceDemand.short).toBeGreaterThan(baseDemand.short)

    // Long stay price increase to $116 (2x default)
    const highLongDemand = dailyParkingDemand(pax, { short: 28, long: 116 })
    const expectedHighLong = baseDemand.long * Math.pow(58 / 116, ELASTICITY_EXPONENT)
    expect(highLongDemand.long).toBeCloseTo(expectedHighLong, 5)
  })

  it('handles edge cases (zero pax, negative pax, non-positive prices)', () => {
    expect(dailyParkingDemand(0)).toEqual({ short: 0, long: 0 })
    expect(dailyParkingDemand(-100)).toEqual({ short: 0, long: 0 })

    const zeroPrice = dailyParkingDemand(1000, { short: 0, long: -10 })
    expect(zeroPrice.short).toBe(0)
    expect(zeroPrice.long).toBe(0)
  })
})

describe('occupancy', () => {
  it('handles single numeric demand and spaces', () => {
    // Under capacity
    const under = occupancy(80, 100)
    expect(under.rate).toBeCloseTo(0.8)
    expect(under.occupied).toBe(80)
    expect(under.overflow).toBe(0)

    // At capacity
    const exact = occupancy(100, 100)
    expect(exact.rate).toBe(1.0)
    expect(exact.occupied).toBe(100)
    expect(exact.overflow).toBe(0)

    // Over capacity - rate capped at 1.0, overflow counted
    const over = occupancy(150, 100)
    expect(over.rate).toBe(1.0)
    expect(over.occupied).toBe(100)
    expect(over.overflow).toBe(50)

    // Zero spaces
    const zeroSpaces = occupancy(50, 0)
    expect(zeroSpaces.rate).toBe(0)
    expect(zeroSpaces.occupied).toBe(0)
    expect(zeroSpaces.overflow).toBe(50)
  })

  it('handles breakdown for short and long stay lots', () => {
    const demand = { short: 120, long: 80 }
    const spaces = { short: 100, long: 100 }

    const res = occupancy(demand, spaces)

    // Short stay is over capacity
    expect(res.short.rate).toBe(1.0)
    expect(res.short.occupied).toBe(100)
    expect(res.short.overflow).toBe(20)

    // Long stay is under capacity
    expect(res.long.rate).toBeCloseTo(0.8)
    expect(res.long.occupied).toBe(80)
    expect(res.long.overflow).toBe(0)

    // Combined stats
    expect(res.occupied).toBe(180)
    expect(res.overflow).toBe(20)
    expect(res.rate).toBeCloseTo(200 / 200) // total demand 200, total spaces 200 -> 1.0
  })
})

describe('dailyRevenue', () => {
  it('calculates numeric revenue where overflow is lost', () => {
    // Under capacity: 80 occupied @ $28 = $2240
    expect(dailyRevenue(80, 100, 28)).toBe(2240)

    // Over capacity: 100 occupied @ $28 = $2800 (50 overflow lost)
    expect(dailyRevenue(150, 100, 28)).toBe(2800)
  })

  it('calculates breakdown revenue from ParkingDemand and ParkingSpaces', () => {
    const demand = { short: 120, long: 80 }
    const spaces = { short: 100, long: 100 }
    const prices = { short: 28, long: 58 }

    const rev = dailyRevenue(demand, spaces, prices)

    // Short stay: 100 occupied @ $28 = $2800 (20 overflow lost)
    expect(rev.short).toBe(2800)
    // Long stay: 80 occupied @ $58 = $4640
    expect(rev.long).toBe(4640)
    // Total revenue
    expect(rev.total).toBe(7440)
  })

  it('calculates daily revenue directly from departing pax count', () => {
    const pax = 1000
    // Demand at default prices: short = 105, long = 980
    // Spaces: short = 200, long = 500
    const spaces = { short: 200, long: 500 }
    const rev = dailyRevenue(pax, spaces)

    // Short stay: 105 occupied @ $28 = $2940
    expect(rev.short).toBeCloseTo(105 * 28, 5)
    // Long stay: 500 occupied @ $58 = $29000 (480 overflow lost)
    expect(rev.long).toBe(500 * 58)
    expect(rev.total).toBeCloseTo(105 * 28 + 29000, 5)
  })

  it('handles zero prices and negative inputs gracefully', () => {
    expect(dailyRevenue(100, 100, 0)).toBe(0)
    expect(dailyRevenue(-50, 100, 28)).toBe(0)
  })
})
