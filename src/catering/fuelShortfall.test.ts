import { describe, expect, it } from 'vitest'
import { fuelShortfall } from './fuelOutage.ts'

describe('fuelShortfall', () => {
  it('clears every flight when the farm has enough fuel', () => {
    const demands = [
      { flightId: 'B', litres: 5000, departAt: 20 },
      { flightId: 'A', litres: 5000, departAt: 10 },
    ]
    expect(fuelShortfall(10_000, demands)).toEqual({ shortLitres: 0, groundedIds: [] })
  })

  it('reserves in departure order and counts the full litres of flights that do not clear', () => {
    const demands = [
      { flightId: 'B', litres: 5000, departAt: 20 },
      { flightId: 'A', litres: 5000, departAt: 10 },
    ]
    expect(fuelShortfall(6000, demands)).toEqual({ shortLitres: 5000, groundedIds: ['B'] })
    expect(demands.map((d) => d.flightId)).toEqual(['B', 'A'])
    // A miss does not consume the remainder: a later flight that fits still clears.
    expect(
      fuelShortfall(1000, [
        { flightId: 'late', litres: 800, departAt: 30 },
        { flightId: 'early', litres: 5000, departAt: 10 },
      ]),
    ).toEqual({ shortLitres: 5000, groundedIds: ['early'] })
  })

  it('grounds every flight when the farm is empty', () => {
    expect(
      fuelShortfall(0, [
        { flightId: 'B', litres: 4000, departAt: 20 },
        { flightId: 'A', litres: 2500, departAt: 10 },
      ]),
    ).toEqual({ shortLitres: 6500, groundedIds: ['A', 'B'] })
  })

  it('treats NaN and negative inputs as zero litres', () => {
    const demands = [
      { flightId: 'B', litres: 2000, departAt: 20 },
      { flightId: 'A', litres: 1000, departAt: 10 },
    ]
    expect(fuelShortfall(Number.NaN, demands)).toEqual({ shortLitres: 3000, groundedIds: ['A', 'B'] })
    expect(fuelShortfall(-40, demands)).toEqual({ shortLitres: 3000, groundedIds: ['A', 'B'] })
    expect(fuelShortfall(5000, [{ flightId: 'N', litres: Number.NaN, departAt: 1 }])).toEqual({ shortLitres: 0, groundedIds: [] })
    // A negative demand is zero litres, so it must not top up the farm for a later flight.
    expect(
      fuelShortfall(100, [
        { flightId: 'neg', litres: -5000, departAt: 1 },
        { flightId: 'real', litres: 200, departAt: 2 },
      ]),
    ).toEqual({ shortLitres: 200, groundedIds: ['real'] })
  })
})
