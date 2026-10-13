import { describe, expect, it } from 'vitest'
import { blankTerms } from './valuation.ts'
import { commercialDepositTier, liveDailyMargin, negotiatedLineFactor, type LiveTurnQuote } from './liveFees.ts'

const quote: LiveTurnQuote = {
  landing: 7_400,
  paxFee: 12,
  bags: 1_800,
  fuel: 2_400,
  catering: 2_100,
  parking: 380,
  pax: 80,
  turnsPerDay: 4,
  handlingPerDay: 2_590,
}

describe('live negotiated fees', () => {
  it('maps deposit tiers onto the commercial hold', () => {
    expect(commercialDepositTier('high')).toBe('big')
    expect(commercialDepositTier('standard')).toBe('standard')
    expect(commercialDepositTier('none')).toBe('none')
  })

  it('applies a fee percent and the fuel and parking freebies on that line only', () => {
    const terms = blankTerms()
    terms.feePct.landing = 25
    terms.feePct.fuel = -10
    terms.freebies.fuelDiscountPct = 15
    terms.freebies.parkingHours = 8
    expect(negotiatedLineFactor(terms, 'landing')).toBeCloseTo(1.25)
    expect(negotiatedLineFactor(terms, 'pax')).toBeCloseTo(1)
    expect(negotiatedLineFactor(terms, 'fuel')).toBeCloseTo(0.9 * 0.85)
    expect(negotiatedLineFactor(terms, 'parking')).toBe(0)
  })

  it('raises the projected margin when the live landing price rises', () => {
    const terms = blankTerms()
    terms.deposit = 'standard'
    const cheap = liveDailyMargin(quote, terms, 14, 1)
    const hot = liveDailyMargin({ ...quote, landing: quote.landing * 2 }, terms, 14, 1)
    expect(hot).toBeGreaterThan(cheap)
    expect(Number.isFinite(hot)).toBe(true)
  })

  it('is identical for the same quote and terms', () => {
    const terms = blankTerms()
    terms.feePct.landing = 10
    terms.deposit = 'high'
    terms.termMonths = 24
    expect(liveDailyMargin(quote, terms, 14, 1)).toBe(liveDailyMargin(quote, terms, 14, 1))
  })
})
