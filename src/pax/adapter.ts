import { cleanFacts, sanitizeCount } from './facts.ts'
import { finite } from './num.ts'
import { samplePassenger } from './profile.ts'
import { createPaxRng, type PaxRng } from './rng.ts'
import { segmentShares } from './segments.ts'
import type { DepartureStamp, PassengerProfile, SegmentShares, ShowUpFacts } from './types.ts'

/**
 * Thin bridge for the hall sim. This module does not import the sim.
 *
 * When a slot is banked, call `sample` and `stampDeparture`:
 * - spawn with `walletTag` for the fare price ladder only
 * - release the body at `releaseAt` (sim-seconds)
 * - use `preferFastTrack` for the lane, not `walletTag` (a lounge lover
 *   is a premium wallet and still walks the standard lane)
 * - offer `amenity` at `spend`, then add the matching `mood` delta
 *
 * The entrance cap (three releases a second) still belongs to `planShowUp`.
 * These leads are the distribution; the sim can snap them onto that cap.
 */
export interface PaxShowUpAdapter {
  shares(): SegmentShares
  setFacts(facts: ShowUpFacts): void
  sampleOne(): PassengerProfile
  sample(count: number): PassengerProfile[]
  rngState(): number
}

export function createPaxShowUpAdapter(seed: number, facts: ShowUpFacts = {}): PaxShowUpAdapter {
  const rng: PaxRng = createPaxRng(seed)
  let current = cleanFacts(facts)
  const asFacts = (): ShowUpFacts => current
  return {
    shares: () => segmentShares(asFacts()),
    setFacts(next: ShowUpFacts) {
      current = cleanFacts(next)
    },
    sampleOne: () => samplePassenger(rng, asFacts()),
    sample(count: number) {
      const n = sanitizeCount(count)
      const out: PassengerProfile[] = []
      for (let i = 0; i < n; i++) out.push(samplePassenger(rng, asFacts()))
      return out
    },
    rngState: () => rng.state(),
  }
}

/**
 * Absolute release time. `stdSimSec` is scheduled departure on the sim clock.
 * A non-finite STD leaves `releaseAt` null instead of producing NaN.
 */
export function stampDeparture(profile: PassengerProfile, stdSimSec: number): DepartureStamp {
  const std = finite(stdSimSec, Number.NaN)
  const lead = finite(profile.leadSimSec, 0)
  const release = Number.isFinite(std) ? std - lead : Number.NaN
  return {
    segment: profile.segment,
    walletTag: profile.walletTag,
    preferFastTrack: profile.screening === 'fast_track',
    amenity: profile.amenity,
    releaseAt: Number.isFinite(release) ? release : null,
    leadGameMin: finite(profile.leadGameMin, 0),
    spend: {
      lounge: finite(profile.spend.lounge, 0),
      amenity: finite(profile.spend.amenity, 0),
    },
    willingness: {
      lounge: finite(profile.willingness.lounge, 0),
      amenity: finite(profile.willingness.amenity, 0),
    },
    mood: {
      onArrival: finite(profile.mood.onArrival, 0),
      onFastTrack: finite(profile.mood.onFastTrack, 0),
      onStandardQueue: finite(profile.mood.onStandardQueue, 0),
      onLoungeVisit: finite(profile.mood.onLoungeVisit, 0),
      onLoungeMiss: finite(profile.mood.onLoungeMiss, 0),
    },
  }
}
