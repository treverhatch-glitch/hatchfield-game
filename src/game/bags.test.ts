import { describe, expect, it } from 'vitest'
import { bagUnitsForTag, bagWorkDuration, describeBagStage, estimateFlightBagUnits } from './bags.ts'

describe('bags', () => {
  it('weights premium bags heavier than budget', () => {
    expect(bagUnitsForTag('premium')).toBe(2.4)
    expect(bagUnitsForTag('family')).toBe(1.7)
    expect(bagUnitsForTag('business')).toBe(1.35)
    expect(bagUnitsForTag('budget')).toBe(0.65)
  })

  it('estimates a positive bag load for a full budget flight', () => {
    expect(estimateFlightBagUnits('budget', 0)).toBe(0)
    const units = estimateFlightBagUnits('budget', 72)
    expect(units).toBeGreaterThanOrEqual(1)
    expect(estimateFlightBagUnits('luxury', 72)).toBeGreaterThan(units)
  })

  it('clamps handling time the same way the sim did', () => {
    expect(bagWorkDuration(0, 'deposit')).toBeCloseTo(0.7)
    expect(bagWorkDuration(10_000, 'deposit')).toBeCloseTo(3.2)
    expect(bagWorkDuration(0, 'sort')).toBeCloseTo(1.1)
    expect(bagWorkDuration(10_000, 'sort')).toBeCloseTo(4.5)
    expect(bagWorkDuration(0, 'ramp')).toBeCloseTo(1.8)
    expect(bagWorkDuration(10_000, 'ramp')).toBeCloseTo(5.5)
    expect(bagWorkDuration(40, 'ramp')).toBeCloseTo(1.8 + 40 * 0.022)
  })

  it('labels claim stages for the HUD', () => {
    expect(describeBagStage('on_claim', 2, 0, 30)).toBe('Bags: on claim 2')
    expect(describeBagStage('hold_screen', null, 4, 12)).toBe('Bags: screening hold bags')
    expect(describeBagStage('pax_deposit', null, 4, 12)).toBe('Bags: check-in deposit (4/12)')
    expect(describeBagStage('complete', 1, 0, 1)).toBe('Bags: complete')
    expect(describeBagStage(undefined, 0, 0, 0)).toBe('')
  })
})
