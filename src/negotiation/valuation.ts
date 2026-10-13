import { INTEREST_FIT, NEGOTIATION, SERVICE_IDS } from './data.ts'
import type {
  AirlineProfile,
  CapacityLight,
  Freebies,
  NegotiationContext,
  OfferTerms,
  Personality,
  PostedFees,
  ServiceId,
} from './types.ts'
import { clamp } from './rng.ts'

export function emptyFreebies(): Freebies {
  return {
    parkingHours: 0,
    fuelDiscountPct: 0,
    priorityGates: false,
    contactGates: false,
    loungeAccess: false,
    marketingFund: 0,
    waivedLeadTime: false,
  }
}

export function blankTerms(): OfferTerms {
  const feePct = {} as Record<ServiceId, number>
  for (const id of SERVICE_IDS) feePct[id] = 0
  return { feePct, freebies: emptyFreebies(), termMonths: 12, deposit: 'none' }
}

export function termsAtRatio(ratio: number): OfferTerms {
  const terms = blankTerms()
  const pct = (ratio - 1) * 100
  for (const id of SERVICE_IDS) terms.feePct[id] = pct
  return terms
}

export function cloneTerms(terms: OfferTerms): OfferTerms {
  return {
    feePct: { ...terms.feePct },
    freebies: { ...terms.freebies },
    termMonths: terms.termMonths,
    deposit: terms.deposit,
  }
}

/** Posted tariff turned into one cost-per-seat number at the configured load factor. */
export function postedCostPerSeat(profile: AirlineProfile): number {
  const load = NEGOTIATION.economics.loadFactor
  const seats = Math.max(1, profile.seats)
  const p = profile.posted
  return (
    p.landing / seats +
    p.pax * load +
    p.bags * load +
    p.fuel +
    p.catering * load +
    p.parking / seats
  )
}

function lineFactor(posted: PostedFees, terms: OfferTerms, id: ServiceId): number {
  const pct = terms.feePct[id] ?? 0
  let factor = 1 + pct / 100
  if (id === 'fuel') factor *= 1 - clamp(terms.freebies.fuelDiscountPct, 0, 80) / 100
  if (id === 'parking' && terms.freebies.parkingHours > 0) {
    const forgiven = clamp(terms.freebies.parkingHours / 8, 0, 1)
    factor *= 1 - forgiven
  }
  if (posted[id] <= 0) return 0
  return Math.max(0, factor)
}

/** Fees after freebies and the deposit load, as a fraction of the posted cost per seat. */
export function costRatio(profile: AirlineProfile, terms: OfferTerms): number {
  const load = NEGOTIATION.economics.loadFactor
  const seats = Math.max(1, profile.seats)
  const posted = postedCostPerSeat(profile)
  if (posted <= 0) return 1
  const p = profile.posted
  const paid =
    (p.landing / seats) * lineFactor(p, terms, 'landing') +
    p.pax * load * lineFactor(p, terms, 'pax') +
    p.bags * load * lineFactor(p, terms, 'bags') +
    p.fuel * lineFactor(p, terms, 'fuel') +
    p.catering * load * lineFactor(p, terms, 'catering') +
    (p.parking / seats) * lineFactor(p, terms, 'parking')
  const deposit = NEGOTIATION.deposits.find((d) => d.id === terms.deposit)?.costRatio ?? 0
  const marketing =
    terms.freebies.marketingFund > 0
      ? terms.freebies.marketingFund / Math.max(30, terms.termMonths * 30) / Math.max(1, dailyPax(profile)) / posted
      : 0
  return Math.max(0, paid / posted + deposit - marketing)
}

export function dailyPax(profile: AirlineProfile): number {
  return profile.seats * NEGOTIATION.economics.loadFactor * profile.flightsPerDay
}

/**
 * What the airline feels it is paying, after capacity, rating, Standing, and interests.
 * Red capacity raises the number (the offer is worth less). A higher rating lowers it.
 */
export function effectiveRatio(
  profile: AirlineProfile,
  terms: OfferTerms,
  personality: Personality,
  context: NegotiationContext,
): number {
  let ratio = costRatio(profile, terms)
  ratio *= NEGOTIATION.capacityCost[context.capacity]
  const ratingShift = ((context.rating - 50) / 50) * NEGOTIATION.ratingSwing
  const standingShift = ((context.standing - 50) / 50) * NEGOTIATION.standingSwing * personality.loyalty
  ratio *= 1 - ratingShift - standingShift
  ratio -= interestRelief(profile, terms.freebies)
  const termRelief = ((terms.termMonths - 12) / 12) * 0.02 * personality.loyalty
  ratio -= termRelief
  return ratio
}

function interestRelief(profile: AirlineProfile, freebies: Freebies): number {
  let relief = 0
  for (const interest of profile.interests) {
    const fit = INTEREST_FIT[interest]
    if (freebies.priorityGates) relief += fit.priority
    if (freebies.contactGates) relief += fit.contact
    if (freebies.loungeAccess) relief += fit.lounge
    if (freebies.waivedLeadTime) relief += fit.lead
  }
  return relief
}

/** 0–1 size of the ask gap above the airline's target. Used for mood. */
export function askGap(effective: number, personality: Personality): number {
  const span = Math.max(NEGOTIATION.minSpread, personality.reservation - personality.targetCost)
  return clamp((effective - personality.targetCost) / span, 0, 1)
}

export function generosity(freebies: Freebies): number {
  const park = clamp(freebies.parkingHours / 8, 0, 1) * 0.2
  const fuel = clamp(freebies.fuelDiscountPct / 15, 0, 1) * 0.2
  const marketing = clamp(freebies.marketingFund / 40_000, 0, 1) * 0.25
  const flags =
    (freebies.priorityGates ? 0.1 : 0) +
    (freebies.contactGates ? 0.12 : 0) +
    (freebies.loungeAccess ? 0.08 : 0) +
    (freebies.waivedLeadTime ? 0.05 : 0)
  return clamp(park + fuel + marketing + flags, 0, 1)
}

export interface MarginBand {
  margin: number
  low: number
  high: number
  feeRevenue: number
  retail: number
  handling: number
}

/** Airport margin per day at a retail spend per passenger. */
export function marginAt(profile: AirlineProfile, terms: OfferTerms, spendPerPax: number, trafficFactor = 1): number {
  const ratio = costRatio(profile, terms)
  const pax = dailyPax(profile)
  const feeRevenue = postedCostPerSeat(profile) * ratio * pax
  const retail = Math.max(0, spendPerPax) * pax * NEGOTIATION.economics.retailTake
  const marketingDaily = terms.freebies.marketingFund / Math.max(30, terms.termMonths * 30)
  const walkIn = NEGOTIATION.economics.walkInPerDay * trafficFactor
  const overhead = NEGOTIATION.economics.overheadPerDay
  return feeRevenue + retail + walkIn - profile.handlingPerDay - marketingDaily - overhead
}

export function feeRevenue(profile: AirlineProfile, terms: OfferTerms): number {
  return postedCostPerSeat(profile) * costRatio(profile, terms) * dailyPax(profile)
}

/**
 * Retail spend per passenger that covers handling after fees.
 * Zero when the fee schedule already pays the handling cost.
 */
export function breakEvenSpend(profile: AirlineProfile, terms: OfferTerms): number {
  const pax = dailyPax(profile)
  const take = NEGOTIATION.economics.retailTake
  if (pax * take <= 0) return 0
  const fees = feeRevenue(profile, terms)
  const marketingDaily = terms.freebies.marketingFund / Math.max(30, terms.termMonths * 30)
  const gap = profile.handlingPerDay + marketingDaily - fees
  return Math.max(0, gap / (pax * take))
}

export function dollarsFor(posted: number, pct: number): number {
  return posted * (1 + pct / 100)
}

export function capacityLabel(light: CapacityLight): string {
  if (light === 'red') return 'Red'
  if (light === 'amber') return 'Amber'
  return 'Green'
}
