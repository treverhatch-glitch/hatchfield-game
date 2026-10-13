import { describe, expect, it } from 'vitest'
import {
  PEOPLE_MOVER_CONFIG,
  PEOPLE_MOVER_COST_PER_KM,
  PEOPLE_MOVER_DWELL_S,
  PEOPLE_MOVER_HEADWAY_S,
  PEOPLE_MOVER_SPEED_M_S,
  PEOPLE_MOVER_TRAIN_CAPACITY,
  PEOPLE_MOVER_UPKEEP_PER_KM_DAY,
  WALKWAY_CAPACITY_PAX_PER_M,
  WALKWAY_CONFIG,
  WALKWAY_COST_PER_10M,
  WALKWAY_SPEED_BONUS_M_S,
  WALKWAY_UPKEEP_PER_10M_DAY,
  WALK_SPEED_M_S,
} from './data'
import {
  constructionCost,
  dailyUpkeep,
  moverCost,
  moverHourlyCapacity,
  moverTransferTimeS,
  walkTimeS,
  walkwayCost,
} from './movers'

describe('movers data and constants', () => {
  it('defines correct walkway constants', () => {
    expect(WALK_SPEED_M_S).toBe(1.3)
    expect(WALKWAY_SPEED_BONUS_M_S).toBe(0.65)
    expect(WALKWAY_CAPACITY_PAX_PER_M).toBe(1.2)
    expect(WALKWAY_COST_PER_10M).toBe(900)
    expect(WALKWAY_UPKEEP_PER_10M_DAY).toBe(40)

    expect(WALKWAY_CONFIG).toEqual({
      baseWalkSpeedMS: 1.3,
      speedBonusMS: 0.65,
      capacityPaxPerM: 1.2,
      costPer10m: 900,
      upkeepPer10mDay: 40,
    })
  })

  it('defines correct people mover constants', () => {
    expect(PEOPLE_MOVER_HEADWAY_S).toBe(90)
    expect(PEOPLE_MOVER_TRAIN_CAPACITY).toBe(120)
    expect(PEOPLE_MOVER_DWELL_S).toBe(30)
    expect(PEOPLE_MOVER_SPEED_M_S).toBe(15)
    expect(PEOPLE_MOVER_COST_PER_KM).toBe(2_500_000)
    expect(PEOPLE_MOVER_UPKEEP_PER_KM_DAY).toBe(4_000)

    expect(PEOPLE_MOVER_CONFIG).toEqual({
      headwayS: 90,
      trainCapacity: 120,
      dwellTimeS: 30,
      speedMS: 15,
      costPerKm: 2_500_000,
      upkeepPerKmDay: 4_000,
    })
  })
})

describe('walkTimeS', () => {
  it('calculates walk time without walkway', () => {
    // 130m @ 1.3 m/s = 100s
    expect(walkTimeS(130, 0)).toBeCloseTo(100)
  })

  it('calculates walk time on a full walkway', () => {
    // 195m @ (1.3 + 0.65 = 1.95 m/s) = 100s
    expect(walkTimeS(195, 195)).toBeCloseTo(100)
  })

  it('calculates walk time with partial walkway coverage', () => {
    // 130m total, 65m walkway:
    // foot time: 65 / 1.3 = 50s
    // walkway time: 65 / 1.95 = 33.333s
    // total: 83.333s
    expect(walkTimeS(130, 65)).toBeCloseTo(83.3333, 3)
  })

  it('clamps walkway length to distance', () => {
    // walkway length 300m clamped to 195m total distance
    expect(walkTimeS(195, 300)).toBeCloseTo(100)
  })

  it('handles custom walking speed override', () => {
    // base speed 1.0 m/s, walkway speed 1.65 m/s
    // 100m total, 66m walkway:
    // foot: 34 / 1.0 = 34s
    // walkway: 66 / 1.65 = 40s
    // total = 74s
    expect(walkTimeS(100, 66, 1.0)).toBeCloseTo(74)
  })

  it('returns 0 for zero or negative distance or invalid speed', () => {
    expect(walkTimeS(0, 50)).toBe(0)
    expect(walkTimeS(-10, 50)).toBe(0)
    expect(walkTimeS(100, 50, 0)).toBe(0)
  })
})

describe('moverTransferTimeS', () => {
  it('calculates transfer time with default parameters', () => {
    // 1500m distance, 2 stops
    // avg wait: 90 / 2 = 45s
    // travel time: 1500 / 15 = 100s
    // dwell time: 2 * 30 = 60s
    // total = 45 + 100 + 60 = 205s
    expect(moverTransferTimeS(1500, 2)).toBe(205)
  })

  it('calculates transfer time with 0 distance and 0 stops', () => {
    // avg wait = 45s
    expect(moverTransferTimeS(0, 0)).toBe(45)
  })

  it('accepts parameter overrides', () => {
    // distance 2000m, 3 stops, speed 20 m/s, headway 60s, dwell 20s
    // wait: 60 / 2 = 30s
    // travel: 2000 / 20 = 100s
    // dwell: 3 * 20 = 60s
    // total = 30 + 100 + 60 = 190s
    expect(moverTransferTimeS(2000, 3, 20, 60, 20)).toBe(190)
  })

  it('handles negative stops gracefully', () => {
    expect(moverTransferTimeS(1500, -1)).toBe(145) // 45s wait + 100s travel
  })
})

describe('moverHourlyCapacity', () => {
  it('calculates default hourly capacity', () => {
    // 3600 / 90 * 120 = 40 trains/hr * 120 pax = 4800 pax/hr
    expect(moverHourlyCapacity()).toBe(4800)
  })

  it('calculates capacity with custom headway and train capacity', () => {
    // 3600 / 60 * 150 = 60 * 150 = 9000 pax/hr
    expect(moverHourlyCapacity(60, 150)).toBe(9000)
  })

  it('returns 0 for zero or negative headway or train capacity', () => {
    expect(moverHourlyCapacity(0, 120)).toBe(0)
    expect(moverHourlyCapacity(90, 0)).toBe(0)
    expect(moverHourlyCapacity(-10, 120)).toBe(0)
  })
})

describe('dailyUpkeep', () => {
  it('calculates walkway upkeep only', () => {
    // 100m walkway -> (100 / 10) * 40 = $400/day
    expect(dailyUpkeep(100, 0)).toBe(400)
  })

  it('calculates people mover upkeep only', () => {
    // 2.5 km mover -> 2.5 * 4000 = $10,000/day
    expect(dailyUpkeep(0, 2.5)).toBe(10000)
  })

  it('calculates combined daily upkeep', () => {

    // 250m walkway ($1,000) + 1.5 km mover ($6,000) = $7,000/day
    expect(dailyUpkeep(250, 1.5)).toBe(7000)
  })

  it('handles zero or negative lengths', () => {
    expect(dailyUpkeep(0, 0)).toBe(0)
    expect(dailyUpkeep(-50, -2)).toBe(0)
  })
})

describe('construction costs', () => {
  it('calculates walkway capital cost', () => {

    // 100m walkway @ $900 / 10m = $9,000
    expect(walkwayCost(100)).toBe(9000)
  })

  it('calculates mover capital cost', () => {

    // 2 km mover @ $2,500,000 / km = $5,000,000
    expect(moverCost(2)).toBe(5_000_000)
  })

  it('calculates total construction cost', () => {
    // 100m walkway ($9,000) + 2 km mover ($5,000,000) = $5,009,000
    expect(constructionCost(100, 2)).toBe(5_009_000)
  })
})
