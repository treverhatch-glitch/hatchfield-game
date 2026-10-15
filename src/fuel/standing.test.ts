import { describe, expect, it } from 'vitest'
import { SPOT_OFFER } from './offerData.ts'
import {
  clampStanding,
  leadSupplier,
  nextFuelIndex,
  rackSpotPerLitre,
  standingDifferential,
  SUPPLIER_STANDING,
  termPerLitre,
} from './standing.ts'

describe('supplier standing', () => {
  it('moves the differential by a tenth of a cent per 20 standing, inside the floor and the cap', () => {
    expect(standingDifferential(0)).toBe(0)
    expect(standingDifferential(19)).toBe(0)
    expect(standingDifferential(20)).toBeCloseTo(-0.001, 5)
    expect(standingDifferential(40)).toBeCloseTo(-0.002, 5)
    expect(standingDifferential(80)).toBeCloseTo(SUPPLIER_STANDING.floor, 5)
    expect(standingDifferential(400)).toBeCloseTo(SUPPLIER_STANDING.floor, 5)
    expect(standingDifferential(-20)).toBeCloseTo(0.001, 5)
    expect(standingDifferential(-120)).toBeCloseTo(SUPPLIER_STANDING.cap, 5)
    expect(standingDifferential(-400)).toBeCloseTo(SUPPLIER_STANDING.cap, 5)
    expect(clampStanding(400)).toBe(80)
    expect(clampStanding(-400)).toBe(-120)
  })

  it('swings the spot price and leaves the term differential alone', () => {
    expect(rackSpotPerLitre(0, 0)).toBeCloseTo(SPOT_OFFER.perLitre, 5)
    expect(rackSpotPerLitre(0.1, 0)).toBeCloseTo(0.033, 5)
    expect(rackSpotPerLitre(-0.1, 0)).toBeCloseTo(0.027, 5)
    expect(rackSpotPerLitre(0.1, 40)).toBeCloseTo(0.031, 5)
    expect(termPerLitre(0.02, 40)).toBeCloseTo(0.018, 5)
    expect(termPerLitre(0.02, 0)).toBeCloseTo(0.02, 5)
    expect(nextFuelIndex(0)).toBeCloseTo(0.02, 5)
    expect(nextFuelIndex(0.1)).toBeCloseTo(-0.1, 5)
  })

  it('calls the supplier with the highest standing first', () => {
    const roster = [
      { id: 'apex_local', name: 'Apex' },
      { id: 'kiln_regional', name: 'Kiln' },
    ]
    expect(leadSupplier({}, roster).id).toBe('apex_local')
    expect(leadSupplier({ apex_local: 0, kiln_regional: 20 }, roster).id).toBe('kiln_regional')
    expect(leadSupplier({ apex_local: 20, kiln_regional: 20 }, roster).id).toBe('apex_local')
  })
})
