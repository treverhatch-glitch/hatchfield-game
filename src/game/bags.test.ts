import { describe, expect, it } from 'vitest'
import { bagUnitsForTag, bagWorkDuration, describeBagStage, estimateFlightBagUnits } from './bags.ts'

describe('bags', () => {
  it('weights premium bags heavier than budget', () => {
    expect(bagUnitsForTag('premium')).toBe(2.4)
    expect(bagUnitsForTag('family')).toBe(1.7)
    expect(bagUnitsForTag('business')).toBe(1.35)
    expect(bagUnitsForTag('budget')).toBe(0.65)
    expect(bagUnitsForTag('unknown' as any)).toBe(0.65)
  })

  it('estimates a positive bag load for a full budget flight', () => {
    expect(estimateFlightBagUnits('budget', 0)).toBe(0)
    const units = estimateFlightBagUnits('budget', 72)
    expect(units).toBeGreaterThanOrEqual(1)
    expect(estimateFlightBagUnits('luxury', 72)).toBeGreaterThan(units)
  })

  it('handles zero, negative, NaN, non-finite, and large counts in estimateFlightBagUnits', () => {
    expect(estimateFlightBagUnits('budget', 0)).toBe(0)
    expect(estimateFlightBagUnits('budget', -10)).toBe(0)
    expect(estimateFlightBagUnits('budget', NaN)).toBe(0)
    expect(estimateFlightBagUnits('budget', Infinity)).toBe(0)
    expect(estimateFlightBagUnits('budget', -Infinity)).toBe(0)

    expect(estimateFlightBagUnits('business', 150)).toBeGreaterThan(0)
    expect(estimateFlightBagUnits('cargo_night', 100)).toBeGreaterThan(0)
    expect(estimateFlightBagUnits('military_gov', 100)).toBeGreaterThan(0)

    const large = estimateFlightBagUnits('luxury', 1_000_000)
    expect(Number.isFinite(large)).toBe(true)
    expect(large).toBeGreaterThan(100_000)
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

  it('handles negative, NaN, and extreme inputs safely in bagWorkDuration without producing NaN', () => {
    expect(bagWorkDuration(-50, 'deposit')).toBeCloseTo(0.7)
    expect(bagWorkDuration(NaN, 'deposit')).toBeCloseTo(0.7)
    expect(bagWorkDuration(Infinity, 'deposit')).toBeCloseTo(0.7)

    expect(bagWorkDuration(-50, 'sort')).toBeCloseTo(1.1)
    expect(bagWorkDuration(NaN, 'sort')).toBeCloseTo(1.1)

    expect(bagWorkDuration(-50, 'ramp')).toBeCloseTo(1.8)
    expect(bagWorkDuration(NaN, 'ramp')).toBeCloseTo(1.8)

    expect(bagWorkDuration(1_000_000, 'ramp')).toBeCloseTo(5.5)
  })

  it('labels claim stages for the HUD', () => {
    expect(describeBagStage('on_claim', 2, 0, 30)).toBe('Bags: on claim 2')
    expect(describeBagStage('hold_screen', null, 4, 12)).toBe('Bags: screening hold bags')
    expect(describeBagStage('pax_deposit', null, 4, 12)).toBe('Bags: check-in deposit (4/12)')
    expect(describeBagStage('complete', 1, 0, 1)).toBe('Bags: complete')
    expect(describeBagStage(undefined, 0, 0, 0)).toBe('')
  })

  it('covers every bag stage branch and edge case in describeBagStage', () => {
    // Stage branches with missing or valid claim lanes
    expect(describeBagStage('pax_deposit', 1, 0, 0)).toBe('Bags: check-in deposit (0/0)')
    expect(describeBagStage('pax_deposit', undefined, undefined, undefined)).toBe('Bags: check-in deposit (0/?)')
    expect(describeBagStage('pax_deposit', undefined, -5, NaN)).toBe('Bags: check-in deposit (0/?)')
    expect(describeBagStage('pax_deposit', undefined, 10, 500_000)).toBe('Bags: check-in deposit (10/500000)')

    expect(describeBagStage('hold_screen', 2, 5, 10)).toBe('Bags: screening hold bags')
    expect(describeBagStage('outbound_sort', 2, 5, 10)).toBe('Bags: sorting outbound')
    expect(describeBagStage('load_aircraft', 2, 5, 10)).toBe('Bags: loading aircraft')

    expect(describeBagStage('inflight', 3, 0, 10)).toBe('Bags: on board · claim 3')
    expect(describeBagStage('inflight', null, 0, 10)).toBe('Bags: on board')

    expect(describeBagStage('unload_aircraft', 4, 0, 10)).toBe('Bags: unloading · claim 4')
    expect(describeBagStage('unload_aircraft', undefined, 0, 10)).toBe('Bags: unloading')

    expect(describeBagStage('inbound_sort', 5, 0, 10)).toBe('Bags: processing → claim 5')
    expect(describeBagStage('inbound_sort', null, 0, 10)).toBe('Bags: processing → claim ?')
    expect(describeBagStage('inbound_sort', 0, 0, 10)).toBe('Bags: processing → claim ?')
    expect(describeBagStage('inbound_sort', NaN, 0, 10)).toBe('Bags: processing → claim ?')

    expect(describeBagStage('deliver_claim', 6, 0, 10)).toBe('Bags: delivering to claim 6')
    expect(describeBagStage('deliver_claim', -1, 0, 10)).toBe('Bags: delivering to claim ?')

    expect(describeBagStage('on_claim', 7, 0, 10)).toBe('Bags: on claim 7')
    expect(describeBagStage('on_claim', null, 0, 10)).toBe('Bags: on claim ?')

    expect(describeBagStage('complete', 1, 0, 10)).toBe('Bags: complete')

    expect(describeBagStage('idle', 2, 0, 10)).toBe('Bags · claim 2')
    expect(describeBagStage('idle', null, 0, 10)).toBe('')
    expect(describeBagStage(undefined, 2, 0, 10)).toBe('Bags · claim 2')
    expect(describeBagStage(undefined, undefined, 0, 10)).toBe('')
  })
})
