import { describe, expect, it } from 'vitest'
import {
  BAG_UNITS_PER_CART,
  CARTS_PER_HEAVY_TUG,
  CARTS_PER_TUG,
  planTugTrains,
} from './tugTrains'

describe('tug trains', () => {
  it('shortens the train when the flight is light', () => {
    expect(planTugTrains(BAG_UNITS_PER_CART, false, 2)).toEqual([{ carts: 1, runs: 1 }])
    expect(planTugTrains(BAG_UNITS_PER_CART * 3, false, 1)).toEqual([{ carts: 3, runs: 1 }])
  })

  it('sends a second tug when one is free and the load exceeds one train', () => {
    const carts = CARTS_PER_TUG + 2
    const trains = planTugTrains(carts * BAG_UNITS_PER_CART, false, 2)
    expect(trains).toHaveLength(2)
    expect(trains.every((train) => train.runs === 1)).toBe(true)
    expect(trains.reduce((n, train) => n + train.carts, 0)).toBe(carts)
    expect(trains.every((train) => train.carts <= CARTS_PER_TUG)).toBe(true)
  })

  it('repeats with the same tug when no second tug is free', () => {
    const carts = CARTS_PER_TUG + 2
    expect(planTugTrains(carts * BAG_UNITS_PER_CART, false, 1)).toEqual([
      { carts: CARTS_PER_TUG, runs: 2 },
    ])
  })

  it('gives a heavy tug a longer cap', () => {
    const units = CARTS_PER_HEAVY_TUG * BAG_UNITS_PER_CART
    expect(planTugTrains(units, true, 1)).toEqual([{ carts: CARTS_PER_HEAVY_TUG, runs: 1 }])
    expect(planTugTrains(units, false, 1)[0].runs).toBe(2)
  })
})
