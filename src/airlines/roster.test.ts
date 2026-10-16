import { describe, expect, it } from 'vitest'
import palettes from '../../public/art/refs/airlines/palettes.json'
import { MODEL_SPECS } from '../render/aircraft/specs'
import { AIRLINE_TYPES, ROSTER, rosterAirline, rosterAsAirlines, rosterByType } from './roster.ts'
import { DEFAULT_AIRLINES } from './data.ts'

const HEX = /^#[0-9a-f]{6}$/i

describe('roster', () => {
  it('has 46 airlines: 5 base, 40 from the palette file, and Siam Breeze', () => {
    expect(ROSTER).toHaveLength(46)
    expect(Object.keys(palettes.airlines)).toHaveLength(40)
    for (const base of DEFAULT_AIRLINES) expect(rosterAirline(base.id)).toBeDefined()
    const siam = rosterAirline('siam_breeze')
    expect(siam?.name).toBe('Siam Breeze')
    expect(siam?.fleet).toEqual(['a320neo'])
    expect(siam?.primary).toBe('#1b8480')
    expect(siam?.secondary).toBe('#c6a35a')
  })

  it('has unique ids, names and three-letter codes', () => {
    expect(new Set(ROSTER.map((a) => a.id)).size).toBe(46)
    expect(new Set(ROSTER.map((a) => a.name)).size).toBe(46)
    expect(new Set(ROSTER.map((a) => a.code)).size).toBe(46)
    for (const a of ROSTER) expect(a.code).toMatch(/^[A-Z]{3}$/)
  })

  it('covers every airline type', () => {
    for (const type of AIRLINE_TYPES) expect(rosterByType(type).length).toBeGreaterThan(0)
  })

  it('uses valid colours, sampled ones matching palettes.json', () => {
    for (const a of ROSTER) {
      expect(a.primary).toMatch(HEX)
      expect(a.secondary).toMatch(HEX)
      expect(a.accent).toMatch(HEX)
    }
    for (const [id, pal] of Object.entries(palettes.airlines)) {
      const a = rosterAirline(id)!
      expect([a.primary, a.secondary, a.accent]).toEqual([pal.primary, pal.secondary, pal.accent])
      expect(a.name).toBe(pal.name)
    }
  })

  it('maps every fleet type to an existing model', () => {
    for (const a of ROSTER) {
      expect(a.fleet.length).toBeGreaterThan(0)
      for (const model of a.fleet) expect(MODEL_SPECS[model], `${a.id} flies ${model}`).toBeDefined()
    }
  })

  it('keeps fleets plausible for the type', () => {
    for (const a of rosterByType('heli')) for (const m of a.fleet) expect(MODEL_SPECS[m].family).toBe('helo')
    for (const a of rosterByType('cargo')) for (const m of a.fleet) expect(['b752f', 'b763f', 'b748f', 'an124']).toContain(m)
    for (const a of rosterByType('flag')) expect(a.fleet.some((m) => ['b789', 'a359', 'b77w', 'a380'].includes(m))).toBe(true)
    for (const a of rosterByType('regional')) for (const m of a.fleet) expect(MODEL_SPECS[m].lengthM).toBeLessThan(40)
  })

  it('converts to legacy Airline rows with the same ids', () => {
    const rows = rosterAsAirlines()
    expect(rows.map((r) => r.id)).toEqual(ROSTER.map((a) => a.id))
    for (const row of rows) expect(row.requirements.minTotalFlightsHandled).toBeGreaterThanOrEqual(0)
  })
})
