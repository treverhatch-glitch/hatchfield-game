/**
 * Route offers by airline type, plus unlocks by airport size and reputation.
 * Pure functions over the roster. `rosterOffersToContractOffers` bridges an
 * offer into the legacy ContractOffer the existing offer UI already shows.
 */
import { simRandom } from '../game/simRng.ts'
import { meetsRequirements } from './logic.ts'
import { rosterAsAirlines, ROSTER, rosterAirline, rosterByType, type AirlineType, type RosterAirline } from './roster.ts'
import {
  CHARTER_OFFSEASON_MULTIPLIER,
  CHARTER_PEAKS,
  MEDEVAC_AIRLINE_IDS,
  MEDEVAC_PRIORITY,
  OFFER_DAILY_PROBABILITY,
  OFFER_LIFETIME_DAYS,
  OFFER_PROFILES,
  PENALTY_FEE_FACTOR,
  PENALTY_FINE_FACTOR,
  UNLOCK_GATES,
} from './rosterConfig.ts'
import type { Airline, AirportCapabilities, ContractOffer, ContractTerms } from './types.ts'
import { detPow } from '../game/detMath.ts'

export interface RosterAirport extends AirportCapabilities {
  /** Airport size, 1 (strip) to 5 (international hub). */
  size: number
  /** 0 to 100. */
  reputation: number
  hasHelipad: boolean
  hasCargoApron: boolean
}

export interface RouteOffer {
  id: string
  airlineId: string
  type: AirlineType
  terms: ContractTerms
  /** Model ids this offer's flights use. */
  fleet: string[]
  turnaroundMinutes: number
  nightWindow?: [number, number]
  needsCargoApron: boolean
  needsHelipad: boolean
  needsPremiumFacilities: boolean
  /** 0 is medevac, top priority. */
  priority: number
  /** Charter slot multiplier that was applied when the offer was made. */
  seasonMultiplier: number
  expiresAtMinute: number
  penaltyTier: number
}

/** Size and reputation an airline needs before it will talk to you. */
export function unlockGate(airline: RosterAirline): { size: number; reputation: number } {
  const gate = UNLOCK_GATES[airline.type]
  const rank = rosterByType(airline.type).findIndex((a) => a.id === airline.id)
  return { size: gate.size, reputation: Math.min(100, gate.reputation + gate.reputationStep * Math.max(0, rank)) }
}

export function isAirlineUnlocked(airline: RosterAirline, airport: Pick<RosterAirport, 'size' | 'reputation'>): boolean {
  const gate = unlockGate(airline)
  return airport.size >= gate.size && airport.reputation >= gate.reputation
}

export function unlockedRoster(airport: Pick<RosterAirport, 'size' | 'reputation'>): RosterAirline[] {
  return ROSTER.filter((a) => isAirlineUnlocked(a, airport))
}

/** Charter demand multiplier for a day of the year (1 to 366). */
export function charterSeasonMultiplier(dayOfYear: number): number {
  for (const peak of CHARTER_PEAKS) {
    const inside = peak.fromDay <= peak.toDay ? dayOfYear >= peak.fromDay && dayOfYear <= peak.toDay : dayOfYear >= peak.fromDay || dayOfYear <= peak.toDay
    if (inside) return peak.multiplier
  }
  return CHARTER_OFFSEASON_MULTIPLIER
}

/** Extra facility checks the per-type offers need on top of the legacy requirements. */
export function airportCanServe(airline: RosterAirline, airport: RosterAirport): boolean {
  const profile = OFFER_PROFILES[airline.type]
  if (profile.needsHelipad && !airport.hasHelipad) return false
  if (profile.needsCargoApron && !airport.hasCargoApron) return false
  if (profile.needsPremiumFacilities && !(airport.terminalRating >= 4 && airport.hasCateringService && airport.hasHeavyStands)) return false
  const legacy = rosterAsAirlinesById().get(airline.id)
  return legacy ? meetsRequirements(legacy, airport) : false
}

let legacyById: Map<string, Airline> | null = null
function rosterAsAirlinesById(): Map<string, Airline> {
  if (!legacyById) legacyById = new Map(rosterAsAirlines().map((a) => [a.id, a]))
  return legacyById
}

function termsFor(type: AirlineType, penaltyTier: number, seasonMultiplier: number): ContractTerms {
  const base = OFFER_PROFILES[type].terms
  const fee = detPow(PENALTY_FEE_FACTOR, penaltyTier)
  const fine = detPow(PENALTY_FINE_FACTOR, penaltyTier)
  return {
    slotsPerWeek: Math.max(1, Math.round(base.slotsPerWeek * seasonMultiplier)),
    feePerPassenger: Math.round(base.feePerPassenger * fee),
    feePerLanding: Math.round(base.feePerLanding * fee),
    penaltyPerCancellation: Math.round(base.penaltyPerCancellation * fine),
    penaltyPerDelayMinute: Math.round(base.penaltyPerDelayMinute * fine),
  }
}

/** Builds the offer one airline would make right now. No dice are rolled here. */
export function buildRouteOffer(
  airline: RosterAirline,
  nowMinutes: number,
  opts: { dayOfYear?: number; penaltyTier?: number; idSuffix?: string } = {},
): RouteOffer {
  const profile = OFFER_PROFILES[airline.type]
  const penaltyTier = opts.penaltyTier ?? 0
  const seasonMultiplier = airline.type === 'charter' ? charterSeasonMultiplier(opts.dayOfYear ?? 1) : 1
  const medevac = MEDEVAC_AIRLINE_IDS.includes(airline.id)
  return {
    id: `route_${airline.id}_${opts.idSuffix ?? Math.floor(nowMinutes)}`,
    airlineId: airline.id,
    type: airline.type,
    terms: termsFor(airline.type, penaltyTier, seasonMultiplier),
    fleet: [...airline.fleet],
    turnaroundMinutes: profile.turnaroundMinutes,
    nightWindow: profile.nightWindow,
    needsCargoApron: profile.needsCargoApron,
    needsHelipad: profile.needsHelipad,
    needsPremiumFacilities: profile.needsPremiumFacilities,
    priority: medevac ? MEDEVAC_PRIORITY : profile.priority,
    seasonMultiplier,
    expiresAtMinute: nowMinutes + OFFER_LIFETIME_DAYS * 1440,
    penaltyTier,
  }
}

export interface GenerateRouteOffersInput {
  airport: RosterAirport
  nowMinutes: number
  dtMinutes: number
  dayOfYear: number
  /** Airlines that already hold a contract or an open offer, or are on cooldown. */
  busyAirlineIds?: ReadonlySet<string>
  penaltyTiers?: Record<string, number>
  rng?: () => number
}

/** Rolls offers for every unlocked airline the airport can serve. Medevac airlines are served first. */
export function generateRouteOffers(input: GenerateRouteOffersInput): RouteOffer[] {
  const { airport, nowMinutes, dtMinutes, dayOfYear } = input
  if (dtMinutes <= 0) return []
  const rng = input.rng ?? simRandom
  const prob = 1 - detPow(1 - OFFER_DAILY_PROBABILITY, dtMinutes / 1440)
  const offers: RouteOffer[] = []
  for (const airline of unlockedRoster(airport)) {
    if (input.busyAirlineIds?.has(airline.id)) continue
    if (!airportCanServe(airline, airport)) continue
    if (rng() >= prob) continue
    offers.push(buildRouteOffer(airline, nowMinutes, { dayOfYear, penaltyTier: input.penaltyTiers?.[airline.id] ?? 0 }))
  }
  return offers.sort((a, b) => a.priority - b.priority)
}

/** Bridge to the legacy offer shape so the existing contract UI can list and sign it. */
export function routeOfferToContractOffer(offer: RouteOffer): ContractOffer {
  return {
    id: offer.id,
    airlineId: offer.airlineId,
    terms: offer.terms,
    expiresAtMinute: offer.expiresAtMinute,
    penaltyTier: offer.penaltyTier,
  }
}

/** One-line summary for the offer card. */
export function describeRouteOffer(offer: RouteOffer): string {
  const airline = rosterAirline(offer.airlineId)
  const bits = [`${airline?.name ?? offer.airlineId} (${offer.type})`, `${offer.terms.slotsPerWeek} slots/wk`, `${offer.turnaroundMinutes} min turn`]
  if (offer.nightWindow) bits.push(`night ${offer.nightWindow[0]}:00-${offer.nightWindow[1]}:00`)
  if (offer.needsCargoApron) bits.push('cargo apron')
  if (offer.needsHelipad) bits.push('helipad')
  if (offer.needsPremiumFacilities) bits.push('premium facilities')
  if (offer.priority === MEDEVAC_PRIORITY) bits.push('medevac priority')
  return bits.join(' · ')
}
