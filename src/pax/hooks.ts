import { MOOD_SPEND } from './config.ts'
import { asSegment, cleanFacts } from './facts.ts'
import { clamp01, dollars } from './num.ts'
import type { MoodSpendHook, PaxSegment, ShowUpFacts } from './types.ts'

/**
 * Mood and spend for one segment. Road warriors want the fast-track lane and
 * a coffee. Lounge lovers arrive with time to spend, and a better lounge
 * raises both the bill and the mood bump. Normal passengers do neither.
 */
export function moodSpendHook(segment: PaxSegment, facts: ShowUpFacts = {}): MoodSpendHook {
  const who = asSegment(segment)
  const clean = cleanFacts(facts)
  if (who === 'road_warrior') return roadWarriorHook(clean.fastTrackAvailable)
  if (who === 'lounge_lover') return loungeLoverHook(clean.loungeQuality)
  return normalHook()
}

function roadWarriorHook(fastTrackAvailable: boolean): MoodSpendHook {
  const cfg = MOOD_SPEND.road_warrior
  return {
    segment: 'road_warrior',
    screening: fastTrackAvailable ? 'fast_track' : 'standard',
    amenity: 'cafe',
    spend: { lounge: dollars(cfg.lounge), amenity: dollars(cfg.cafe) },
    willingness: {
      lounge: clamp01(cfg.willingnessLounge),
      amenity: clamp01(cfg.willingnessCafe),
    },
    mood: {
      onArrival: cfg.onArrival,
      onFastTrack: cfg.onFastTrack,
      onStandardQueue: fastTrackAvailable ? cfg.onStandardQueueWhenLaneExists : cfg.onStandardQueue,
      onLoungeVisit: cfg.onLoungeVisit,
      onLoungeMiss: cfg.onLoungeMiss,
    },
  }
}

function loungeLoverHook(quality: number): MoodSpendHook {
  const cfg = MOOD_SPEND.lounge_lover
  const q = clamp01(quality)
  return {
    segment: 'lounge_lover',
    screening: 'standard',
    amenity: 'lounge',
    spend: {
      lounge: dollars(cfg.loungeBase + q * cfg.loungePerQuality),
      amenity: dollars(cfg.amenityBase + q * cfg.amenityPerQuality),
    },
    willingness: {
      lounge: clamp01(cfg.willingnessLoungeBase + q * cfg.willingnessLoungePerQuality),
      amenity: clamp01(cfg.willingnessAmenityBase + q * cfg.willingnessAmenityPerQuality),
    },
    mood: {
      onArrival: cfg.onArrival,
      onFastTrack: cfg.onFastTrack,
      onStandardQueue: cfg.onStandardQueue,
      onLoungeVisit: dollars(cfg.onLoungeVisitBase + q * cfg.onLoungeVisitPerQuality),
      onLoungeMiss: cfg.onLoungeMiss,
    },
  }
}

function normalHook(): MoodSpendHook {
  const cfg = MOOD_SPEND.normal
  return {
    segment: 'normal',
    screening: 'standard',
    amenity: 'none',
    spend: { lounge: 0, amenity: 0 },
    willingness: {
      lounge: clamp01(cfg.willingnessLounge),
      amenity: clamp01(cfg.willingnessAmenity),
    },
    mood: {
      onArrival: cfg.onArrival,
      onFastTrack: cfg.onFastTrack,
      onStandardQueue: cfg.onStandardQueue,
      onLoungeVisit: cfg.onLoungeVisit,
      onLoungeMiss: cfg.onLoungeMiss,
    },
  }
}
