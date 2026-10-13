import type { ShowTag } from './showup.ts'
import { sanitizeCount } from './facts.ts'
import { moodSpendHook } from './hooks.ts'
import { createPaxRng, sanitizeSeed, type PaxRng } from './rng.ts'
import { sampleSegment, segmentShares } from './segments.ts'
import { leadToSimSec, sampleLeadMin } from './timing.ts'
import type { PassengerProfile, PaxSegment, ShowUpFacts } from './types.ts'

/** Fare persona the hall already prices. Arrival time stays on `leadGameMin`. */
export function walletTagFor(segment: PaxSegment): ShowTag {
  if (segment === 'road_warrior') return 'business'
  if (segment === 'lounge_lover') return 'premium'
  return 'family'
}

/** One passenger: segment, show-up lead, and the mood/spend hook. */
export function samplePassenger(rng: PaxRng, facts: ShowUpFacts = {}): PassengerProfile {
  const shares = segmentShares(facts)
  const segment = sampleSegment(rng, shares)
  const intl = facts.intl === true
  const leadGameMin = sampleLeadMin(segment, rng, intl)
  const hook = moodSpendHook(segment, facts)
  return {
    ...hook,
    leadGameMin,
    leadSimSec: leadToSimSec(leadGameMin),
    walletTag: walletTagFor(segment),
  }
}

/**
 * A departure wave. `count` that is NaN, negative, or zero yields an empty
 * list. The draw is fully determined by `seed`.
 */
export function samplePassengers(count: number, seed: number, facts: ShowUpFacts = {}): PassengerProfile[] {
  const n = sanitizeCount(count)
  if (n === 0) return []
  const rng = createPaxRng(sanitizeSeed(seed))
  const out: PassengerProfile[] = []
  for (let i = 0; i < n; i++) out.push(samplePassenger(rng, facts))
  return out
}
