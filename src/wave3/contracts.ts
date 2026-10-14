import type { Airline, ContractTerms } from '../airlines/types.ts'
import { CONTRACT_TIERS, type ContractTier } from './config.ts'
import { fleetIdsFor, fleetLabel } from './fleet.ts'
import { contractTierFor, feeFactorFor, readRelation } from './relations.ts'
import type { CeoCard, ContractShape, RelationsState } from './types.ts'
import { ceoFor } from './ceo.ts'

export interface ShapedContract {
  tier: ContractTier
  label: string
  terms: ContractTerms
  airframes: readonly string[]
  fleetLabel: string
  ceo: CeoCard
  line: string
}

function tierRow(tier: ContractTier): (typeof CONTRACT_TIERS)[number] {
  return CONTRACT_TIERS.find((row) => row.tier === tier) ?? CONTRACT_TIERS[0]
}

/**
 * Better fees at higher relationship tiers, and a one-time timetable grant.
 * The apron writes `extraSlots` when the day review sees the new tier.
 * Tier 1 adds none. The airframe list is copied, never extended.
 */
export function applyTierToTerms(terms: ContractTerms, tier: ContractTier): ContractTerms {
  const row = tierRow(tier)
  if (row.tier === 1) return terms
  return {
    slotsPerWeek: terms.slotsPerWeek + row.extraSlots,
    feePerPassenger: Math.round(terms.feePerPassenger * row.feeMult),
    feePerLanding: Math.round(terms.feePerLanding * row.feeMult),
    penaltyPerCancellation: Math.round(terms.penaltyPerCancellation * row.penaltyMult),
    penaltyPerDelayMinute: Math.round(terms.penaltyPerDelayMinute * row.penaltyMult),
  }
}

export function shapeAirlineOffer(
  airline: Pick<Airline, 'id' | 'name' | 'fleet'>,
  terms: ContractTerms,
  relations?: RelationsState,
): ShapedContract {
  const score = relations ? readRelation(relations, airline.id).score : 0
  const spec = contractTierFor(score)
  const airframes = fleetIdsFor(airline.id, airline.fleet)
  const ceo = ceoFor(airline.id)
  const metal = fleetLabel(airframes)
  return {
    tier: spec.tier,
    label: spec.label,
    terms: applyTierToTerms(terms, spec.tier),
    airframes,
    fleetLabel: metal,
    ceo,
    line: `${ceo.name} (${ceo.traits.join(' · ')}) offers a ${spec.label} contract on ${metal}. The fleet does not change with the tier.`,
  }
}

export function contractShape(airlineId: string, fleet: readonly string[] | undefined, relations: RelationsState): ContractShape {
  const spec = contractTierFor(readRelation(relations, airlineId).score)
  return {
    tier: spec.tier,
    label: spec.label,
    feeMult: spec.feeMult,
    extraSlots: spec.extraSlots,
    airframes: fleetIdsFor(airlineId, fleet),
  }
}

export function landingOffer(published: number, relations: RelationsState, airlineId: string): number {
  const factor = feeFactorFor(relations, airlineId)
  if (factor === 1) return published
  return Math.round(published * factor)
}
