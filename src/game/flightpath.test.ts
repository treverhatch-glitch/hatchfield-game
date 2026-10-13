import { describe, expect, it } from 'vitest'
import { hasLeftMap, inboundApproach } from './flightpath.ts'
import { bagUnitsForAirframe, cargoUnitsForAirframe, fuelDwellSeconds, paxForAirframe } from './airframes.ts'
import { AIRFRAMES } from './airframes.ts'

describe('approach and departure', () => {
  it('starts the approach off the runway end', () => {
    const route = [
      { c: 8, r: 24 },
      { c: 9, r: 24 },
      { c: 12, r: 21 },
    ]
    const path = inboundApproach(route, 14)
    expect(path[0].c).toBeLessThan(0)
    expect(path[0].r).toBeCloseTo(24)
    expect(path[path.length - 1]).toEqual(route[route.length - 1])
    expect(path).toContainEqual(route[0])
  })

  it('keeps a departing jet until it clears the map', () => {
    expect(hasLeftMap(10, 20, 32)).toBe(false)
    expect(hasLeftMap(-9, 20, 32)).toBe(true)
    expect(hasLeftMap(41, 10, 32)).toBe(true)
  })
})

describe('airframe loads', () => {
  it('scales passengers, bags, cargo, and fuel with the type', () => {
    const regional = AIRFRAMES.atr72
    const narrow = AIRFRAMES.b738
    const heavy = AIRFRAMES.b748f
    expect(regional.seats).toBeGreaterThan(60)
    expect(narrow.seats).toBeGreaterThan(regional.seats)
    expect(paxForAirframe(narrow, () => 0.5)).toBeGreaterThan(paxForAirframe(regional, () => 0.5))
    expect(bagUnitsForAirframe(narrow, 400)).toBe(narrow.bagVolume)
    expect(bagUnitsForAirframe(heavy, 40)).toBe(0)
    expect(cargoUnitsForAirframe(heavy, () => 0)).toBeGreaterThan(cargoUnitsForAirframe(AIRFRAMES.b752f, () => 0))
    expect(fuelDwellSeconds(narrow)).toBeGreaterThan(fuelDwellSeconds(regional))
    expect(fuelDwellSeconds(heavy)).toBeGreaterThan(fuelDwellSeconds(narrow))
  })
})