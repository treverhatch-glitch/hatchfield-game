import { describe, expect, it } from 'vitest'
import { AIRFRAMES } from '../game/airframes'
import { type AirlineDef, validateAirline } from './airlineTypes'
import { FLAG_AIRLINES, LOWCOST_AIRLINES } from './airlines_flagLowcost'
import { REGIONAL_AIRLINES } from './airlines_regional'

describe('Airline Content Pack', () => {
  const allAirlines: AirlineDef[] = [
    ...REGIONAL_AIRLINES,
    ...FLAG_AIRLINES,
    ...LOWCOST_AIRLINES,
  ]

  it('has exactly 20 total airlines', () => {
    expect(allAirlines.length).toBe(20)
  })

  it('has correct breakdown by kind (8 regional, 6 flag, 6 lowcost)', () => {
    const regional = allAirlines.filter((a) => a.kind === 'regional')
    const flag = allAirlines.filter((a) => a.kind === 'flag')
    const lowcost = allAirlines.filter((a) => a.kind === 'lowcost')

    expect(regional.length).toBe(8)
    expect(flag.length).toBe(6)
    expect(lowcost.length).toBe(6)
  })

  it('every airline passes validateAirline against real AIRFRAMES keys', () => {
    const airframeIds = Object.keys(AIRFRAMES)
    for (const airline of allAirlines) {
      const errors = validateAirline(airline, airframeIds)
      expect(errors, `Errors for airline ${airline.id}: ${errors.join(', ')}`).toEqual([])
    }
  })

  it('has unique IDs and 2-letter uppercase IATA codes across all airlines', () => {
    const ids = new Set<string>()
    const iatas = new Set<string>()

    for (const a of allAirlines) {
      expect(ids.has(a.id), `Duplicate ID: ${a.id}`).toBe(false)
      ids.add(a.id)

      expect(iatas.has(a.iata), `Duplicate IATA code: ${a.iata}`).toBe(false)
      iatas.add(a.iata)
    }
  })

  it('ensures LCCs have feeTolerance <= 1.0 and deposit === "small"', () => {
    for (const lcc of LOWCOST_AIRLINES) {
      expect(lcc.feeTolerance).toBeLessThanOrEqual(1.0)
      expect(lcc.deposit).toBe('small')
    }
  })

  it('validateAirline identifies invalid fields', () => {
    const invalidAirline: AirlineDef = {
      id: '',
      name: '',
      iata: 'INVALID',
      kind: 'unknown' as any,
      tier: 10,
      fleet: ['non_existent_plane'],
      feeTolerance: 2.0,
      deposit: 'invalid_deposit' as any,
      leadDays: -1,
      minFL: -5,
      needs: 'not-an-array' as any,
      blurb: '',
    }

    const errors = validateAirline(invalidAirline, Object.keys(AIRFRAMES))
    expect(errors.length).toBeGreaterThan(0)
    expect(errors).toContain('id must be a non-empty string')
    expect(errors).toContain('name must be a non-empty string')
    expect(errors).toContain('iata must be a 2-letter uppercase string')
    expect(errors).toContain('kind must be "regional", "flag", or "lowcost"')
    expect(errors).toContain('tier must be an integer between 1 and 5')
    expect(errors).toContain('fleet contains unknown airframe id: "non_existent_plane"')
    expect(errors).toContain('feeTolerance must be a number between 0.8 and 1.4')
    expect(errors).toContain('deposit must be "big", "standard", or "small"')
    expect(errors).toContain('leadDays must be a non-negative number')
    expect(errors).toContain('minFL must be a non-negative number')
    expect(errors).toContain('needs must be an array of strings')
    expect(errors).toContain('blurb must be a non-empty string')
  })
})
