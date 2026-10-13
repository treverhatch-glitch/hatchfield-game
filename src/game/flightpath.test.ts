import { describe, expect, it } from 'vitest'
import { hasLeftMap, inboundApproach, interpolateFlightPath, pointAlongPath, sampleFlightPath } from './flightpath.ts'
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

  it('handles inboundApproach edge cases gracefully without returning NaN', () => {
    expect(inboundApproach([])).toEqual([])
    expect(inboundApproach([{ c: 5, r: 10 }])).toEqual([{ c: 5, r: 10 }])

    // Zero-length segment
    const zeroLen = inboundApproach([{ c: 5, r: 5 }, { c: 5, r: 5 }], 10)
    for (const pt of zeroLen) {
      expect(Number.isNaN(pt.c)).toBe(false)
      expect(Number.isNaN(pt.r)).toBe(false)
    }

    // NaN input coordinates
    const nanPath = inboundApproach([{ c: NaN, r: 5 }, { c: 10, r: NaN }])
    for (const pt of nanPath) {
      expect(Number.isNaN(pt.c)).toBe(false)
      expect(Number.isNaN(pt.r)).toBe(false)
    }

    // Invalid cells
    const zeroCells = inboundApproach([{ c: 0, r: 0 }, { c: 10, r: 0 }], 0)
    expect(zeroCells).toEqual([{ c: 0, r: 0 }, { c: 10, r: 0 }])
  })

  it('handles hasLeftMap non-finite edge cases', () => {
    expect(hasLeftMap(NaN, 10, 32)).toBe(false)
    expect(hasLeftMap(10, NaN, 32)).toBe(false)
    expect(hasLeftMap(-8, 10, 32, 8)).toBe(false)
    expect(hasLeftMap(-8.1, 10, 32, 8)).toBe(true)
  })
})

describe('flight path sampling and interpolation', () => {
  const path = [
    { c: 0, r: 0 },
    { c: 10, r: 0 },
    { c: 10, r: 10 },
  ]

  it('samples t = 0 and t = 1 endpoints accurately', () => {
    const start = sampleFlightPath(path, 0)
    expect(start).toEqual({ c: 0, r: 0 })

    const end = sampleFlightPath(path, 1)
    expect(end).toEqual({ c: 10, r: 10 })

    const mid = sampleFlightPath(path, 0.5)
    expect(mid).toEqual({ c: 10, r: 0 })
  })

  it('clamps t outside 0..1 range', () => {
    expect(sampleFlightPath(path, -0.5)).toEqual({ c: 0, r: 0 })
    expect(sampleFlightPath(path, -100)).toEqual({ c: 0, r: 0 })
    expect(sampleFlightPath(path, -Infinity)).toEqual({ c: 0, r: 0 })

    expect(sampleFlightPath(path, 1.5)).toEqual({ c: 10, r: 10 })
    expect(sampleFlightPath(path, 100)).toEqual({ c: 10, r: 10 })
    expect(sampleFlightPath(path, Infinity)).toEqual({ c: 10, r: 10 })
  })

  it('handles zero-length paths without throwing or producing NaN', () => {
    // Empty array
    expect(sampleFlightPath([], 0.5)).toEqual({ c: 0, r: 0 })

    // Single point
    expect(sampleFlightPath([{ c: 7, r: 14 }], 0)).toEqual({ c: 7, r: 14 })
    expect(sampleFlightPath([{ c: 7, r: 14 }], 0.5)).toEqual({ c: 7, r: 14 })
    expect(sampleFlightPath([{ c: 7, r: 14 }], 1)).toEqual({ c: 7, r: 14 })

    // Zero-length path with duplicate points
    const dupes = [
      { c: 3, r: 3 },
      { c: 3, r: 3 },
      { c: 3, r: 3 },
    ]
    const p0 = sampleFlightPath(dupes, 0)
    const pMid = sampleFlightPath(dupes, 0.5)
    const p1 = sampleFlightPath(dupes, 1)

    expect(p0).toEqual({ c: 3, r: 3 })
    expect(pMid).toEqual({ c: 3, r: 3 })
    expect(p1).toEqual({ c: 3, r: 3 })
  })

  it('never outputs NaN for invalid or boundary inputs', () => {
    const resNaN = sampleFlightPath(path, NaN)
    expect(Number.isNaN(resNaN.c)).toBe(false)
    expect(Number.isNaN(resNaN.r)).toBe(false)

    const invalidCoordsPath = [
      { c: NaN, r: 0 },
      { c: 10, r: NaN },
    ]
    const resInvalid = sampleFlightPath(invalidCoordsPath, 0.5)
    expect(Number.isNaN(resInvalid.c)).toBe(false)
    expect(Number.isNaN(resInvalid.r)).toBe(false)
  })

  it('exports aliases pointAlongPath and interpolateFlightPath', () => {
    expect(pointAlongPath(path, 0)).toEqual({ c: 0, r: 0 })
    expect(interpolateFlightPath(path, 1)).toEqual({ c: 10, r: 10 })
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
