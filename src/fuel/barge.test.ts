import { describe, expect, it } from 'vitest'
import { BARGE, bargeCut, bargeLeadMinutes, bargeParcelLitres, cellOnWater, cellPlotId, siteHasWater } from './barge.ts'

describe('barge berth', () => {
  it('gives the river to the city plot and a 6-hour rail-day parcel', () => {
    expect(siteHasWater('city')).toBe(true)
    expect(siteHasWater('factory')).toBe(false)
    expect(siteHasWater(null)).toBe(false)
    expect(bargeLeadMinutes()).toBe(360)
    expect(bargeParcelLitres(280_000)).toBe(280_000 * BARGE.dayHours)
    expect(cellPlotId(0, 0)).toBe('0,0')
    expect(cellPlotId(8, 0)).toBe('1,0')
    expect(cellOnWater(0, 0, 'city')).toBe(true)
    expect(cellOnWater(0, 1, 'city')).toBe(false)
    expect(cellOnWater(0, 0, 'factory')).toBe(false)
    expect(bargeCut(true)).toBe(-0.004)
    expect(bargeCut(false)).toBe(0)
  })
})
