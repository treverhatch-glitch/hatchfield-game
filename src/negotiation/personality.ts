import { AGENDA_WEIGHTS, NEGOTIATION, PERSONALITY_BASE, TRAIT_WEIGHTS } from './data.ts'
import type { AirlineProfile, Personality, TraitId } from './types.ts'
import { clamp } from './rng.ts'

function add(
  into: typeof PERSONALITY_BASE,
  extra: Partial<typeof PERSONALITY_BASE> | undefined,
): void {
  if (!extra) return
  if (extra.targetCost) into.targetCost += extra.targetCost
  if (extra.reservation) into.reservation += extra.reservation
  if (extra.patience) into.patience += extra.patience
  if (extra.greed) into.greed += extra.greed
  if (extra.bluff) into.bluff += extra.bluff
  if (extra.pride) into.pride += extra.pride
  if (extra.loyalty) into.loyalty += extra.loyalty
}

export function maxCountersFor(traits: readonly TraitId[]): number {
  if (traits.includes('hardball')) return NEGOTIATION.hardballMaxCounters
  if (traits.includes('patient')) return NEGOTIATION.patientMaxCounters
  return NEGOTIATION.defaultMaxCounters
}

export function derivePersonality(profile: AirlineProfile): Personality {
  const raw = { ...PERSONALITY_BASE }
  for (const trait of profile.traits) add(raw, TRAIT_WEIGHTS[trait])
  if (profile.agenda) add(raw, AGENDA_WEIGHTS[profile.agenda])
  const targetCost = clamp(raw.targetCost, 0.35, 1.25)
  const reservation = Math.max(targetCost + NEGOTIATION.minSpread, clamp(raw.reservation, 0.4, 1.4))
  return {
    targetCost,
    reservation,
    patience: clamp(raw.patience, 0, 1),
    greed: clamp(raw.greed, 0, 1),
    bluff: clamp(raw.bluff, 0, 1),
    pride: Math.max(0.2, raw.pride),
    loyalty: clamp(raw.loyalty, 0, 1),
    maxCounters: maxCountersFor(profile.traits),
  }
}
