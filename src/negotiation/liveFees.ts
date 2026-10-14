import {
  landingFeeMultiplier,
  serviceFeeMultiplier,
  type DepositTier as CommercialDeposit,
} from '../commercial/deposits.ts'
import { NEGOTIATION } from './data.ts'
import { clamp } from './rng.ts'
import type { OfferTerms, ServiceId } from './types.ts'
import { termDailyRate } from './valuation.ts'

/** One negotiated month, in game days. The live deposit is held for termMonths of these. */
export const TERM_DAYS = 30

/**
 * Negotiation tiers mapped onto the commercial hold.
 * High is the big hold (15%, fees −10%). Standard is 5% and list fees.
 * None takes no cash and adds 15% to service fees.
 */
export function commercialDepositTier(tier: OfferTerms['deposit']): CommercialDeposit {
  if (tier === 'high') return 'big'
  if (tier === 'none') return 'none'
  return 'standard'
}

/** Multiplier for one signed line, including the fuel-discount and free-parking freebies. */
export function negotiatedLineFactor(terms: OfferTerms, service: ServiceId): number {
  const pct = terms.feePct[service]
  let factor = 1 + (Number.isFinite(pct) ? pct : 0) / 100
  if (service === 'fuel') factor *= 1 - clamp(terms.freebies.fuelDiscountPct, 0, 80) / 100
  if (service === 'parking' && terms.freebies.parkingHours > 0) {
    factor *= 1 - clamp(terms.freebies.parkingHours / 8, 0, 1)
  }
  if (!Number.isFinite(factor)) return 1
  return Math.max(0, factor)
}

/** One turn at the live fee card, before the negotiated percent and the deposit tier. */
export interface LiveTurnQuote {
  landing: number
  paxFee: number
  bags: number
  fuel: number
  catering: number
  parking: number
  pax: number
  turnsPerDay: number
  handlingPerDay: number
}

export function quoteUnit(quote: LiveTurnQuote, service: ServiceId): number {
  if (service === 'landing') return finite(quote.landing)
  if (service === 'pax') return finite(quote.paxFee)
  if (service === 'bags') return finite(quote.bags)
  if (service === 'fuel') return finite(quote.fuel)
  if (service === 'catering') return finite(quote.catering)
  return finite(quote.parking)
}

/** Cash one turnaround actually bills once the deal is signed. */
export function liveTurnRevenue(quote: LiveTurnQuote, terms: OfferTerms): number {
  const tier = commercialDepositTier(terms.deposit)
  const landingMult = landingFeeMultiplier(tier)
  const serviceMult = serviceFeeMultiplier(tier)
  const pax = Math.max(0, finite(quote.pax))
  const line = (service: ServiceId, amount: number, mult: number) =>
    Math.max(0, finite(amount)) * negotiatedLineFactor(terms, service) * mult
  return (
    line('landing', quote.landing, landingMult) +
    line('pax', pax * finite(quote.paxFee), landingMult) +
    line('bags', quote.bags, serviceMult) +
    line('fuel', quote.fuel, serviceMult) +
    line('catering', quote.catering, serviceMult) +
    line('parking', quote.parking, serviceMult)
  )
}

/**
 * Projected airport margin per day from the live fee card and the open ask.
 * The deposit is a hold, not income. Retail spend is the only uncertain input.
 */
export function liveDailyMargin(
  quote: LiveTurnQuote,
  terms: OfferTerms,
  spendPerPax: number,
  trafficFactor = 1,
): number {
  const turns = Math.max(0, finite(quote.turnsPerDay))
  const pax = Math.max(0, finite(quote.pax)) * turns
  const fees = liveTurnRevenue(quote, terms) * turns * termDailyRate(terms.termMonths)
  const retail = Math.max(0, finite(spendPerPax)) * pax * NEGOTIATION.economics.retailTake
  const marketing = terms.freebies.marketingFund / Math.max(TERM_DAYS, terms.termMonths * TERM_DAYS)
  const walkIn = NEGOTIATION.economics.walkInPerDay * (Number.isFinite(trafficFactor) ? trafficFactor : 1)
  const margin = fees + retail + walkIn - finite(quote.handlingPerDay) - marketing - NEGOTIATION.economics.overheadPerDay
  return Number.isFinite(margin) ? margin : 0
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}
