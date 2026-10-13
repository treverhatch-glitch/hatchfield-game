import { SHOWUP_LEAD_GAME_MIN } from './showup.ts'

/**
 * Tunables for who shows up, when, and what they spend.
 * Leads are game minutes before scheduled departure (STD). A larger lead
 * means the passenger is in the hall earlier. One sim-second is eight game
 * minutes, the same clock as `planShowUp`.
 */

export const PAX_SEGMENT_CONFIG = {
  /** Share of a bank that commutes when the lounge is irrelevant. */
  baseRoadWarrior: 0.2,
  /** Share that came for the lounge when lounge quality is 0. */
  baseLoungeLover: 0.08,
  /**
   * Added to the lounge-lover share at quality 1. Taken from the normal
   * share, so a better lounge changes who flies, not the flight's headcount.
   */
  loungeQualityGain: 0.22,
  /** Added to the road-warrior share when the bank is entirely business. */
  businessMixGain: 0.18,
  /** The residual share never drops below this, even with both levers pegged. */
  minNormal: 0.05,
} as const

export interface SegmentConfig {
  baseRoadWarrior: number
  baseLoungeLover: number
  loungeQualityGain: number
  businessMixGain: number
  minNormal: number
}

/**
 * Truncated-normal windows, in game minutes before STD.
 * Road warriors are late and disjoint from lounge lovers: a road warrior's
 * latest draw is still earlier than a lounge lover's earliest draw.
 * International flights add `intlExtra` (passport), then the outer cap from
 * the hall planner cuts anything earlier than STD minus that lead.
 */
export const SHOWUP_WINDOWS = {
  road_warrior: { mean: 72, sd: 14, min: 40, max: 105, intlExtra: 18 },
  normal: { mean: 145, sd: 26, min: 75, max: 200, intlExtra: 25 },
  lounge_lover: { mean: 198, sd: 16, min: 165, max: SHOWUP_LEAD_GAME_MIN, intlExtra: 12 },
} as const

export interface WindowSpec {
  mean: number
  sd: number
  min: number
  max: number
  intlExtra: number
}

/** Mood deltas match the hall happiness steps (small integers). Spend is dollars. */
export const MOOD_SPEND = {
  road_warrior: {
    cafe: 16,
    lounge: 0,
    willingnessCafe: 0.85,
    willingnessLounge: 0.12,
    onArrival: -1,
    onFastTrack: 8,
    onStandardQueue: -2,
    /** Harsher when a fast-track lane exists and they were not put on it. */
    onStandardQueueWhenLaneExists: -6,
    onLoungeVisit: 1,
    onLoungeMiss: 0,
  },
  lounge_lover: {
    loungeBase: 42,
    loungePerQuality: 36,
    amenityBase: 12,
    amenityPerQuality: 18,
    willingnessLoungeBase: 0.7,
    willingnessLoungePerQuality: 0.25,
    willingnessAmenityBase: 0.55,
    willingnessAmenityPerQuality: 0.2,
    onArrival: 2,
    onFastTrack: 1,
    onStandardQueue: 0,
    onLoungeVisitBase: 8,
    onLoungeVisitPerQuality: 10,
    onLoungeMiss: -7,
  },
  normal: {
    onArrival: 0,
    onFastTrack: 2,
    onStandardQueue: -1,
    onLoungeVisit: 3,
    onLoungeMiss: 0,
    willingnessLounge: 0.2,
    willingnessAmenity: 0.35,
  },
} as const

/** Safety cap for one pure call. A flight wave is far smaller than this. */
export const MAX_WAVE = 2000
