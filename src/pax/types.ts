import type { ShowTag } from './showup.ts'

export const PAX_SEGMENTS = ['road_warrior', 'lounge_lover', 'normal'] as const

export type PaxSegment = (typeof PAX_SEGMENTS)[number]

export type ScreeningChoice = 'fast_track' | 'standard'

/** What the sim should offer after security. `none` means no amenity pitch. */
export type AmenityBias = 'lounge' | 'cafe' | 'none'

/**
 * Facts the sim already knows. Every field is optional; missing and non-finite
 * numbers collapse to a neutral airport (no lounge, no fast-track, domestic).
 */
export interface ShowUpFacts {
  /** 0 = no lounge, 1 = a flagship lounge. */
  loungeQuality?: number
  /** True when a fast-track or premium screening lane is open. */
  fastTrackAvailable?: boolean
  /** Wide-body / international clock. Passengers show a little earlier. */
  intl?: boolean
  /** 0..1. How business-heavy this bank is. Raises the road-warrior share. */
  businessMix?: number
}

export interface CleanFacts {
  loungeQuality: number
  fastTrackAvailable: boolean
  intl: boolean
  businessMix: number
}

export interface SegmentShares {
  roadWarrior: number
  loungeLover: number
  normal: number
}

export interface LeadWindow {
  segment: PaxSegment
  /** Mean game-minutes before STD. */
  meanLeadMin: number
  sdMin: number
  minLeadMin: number
  maxLeadMin: number
}

export interface MoodDeltas {
  /** On arrival, before any queue. */
  onArrival: number
  /** They used the fast-track / premium lane. */
  onFastTrack: number
  /** They used the standard lane. */
  onStandardQueue: number
  /** They sat in a lounge. Scales with quality for lounge lovers. */
  onLoungeVisit: number
  /** They wanted a lounge and the hall has none. */
  onLoungeMiss: number
}

export interface SpendHook {
  /** Dollars. Zero means the guest will not open that till. */
  lounge: number
  amenity: number
}

export interface Willingness {
  /** 0..1 chance they pay if the till is at or under the listed price. */
  lounge: number
  amenity: number
}

/** Mood and spend the sim can apply later. No world mutation. */
export interface MoodSpendHook {
  segment: PaxSegment
  screening: ScreeningChoice
  amenity: AmenityBias
  spend: SpendHook
  willingness: Willingness
  mood: MoodDeltas
}

/**
 * One departing passenger. `leadGameMin` is the show-up clock. `walletTag`
 * is only the fare persona the hall already prices — it does not pick the
 * arrival time (premium's old 120-minute lead does not apply here).
 */
export interface PassengerProfile extends MoodSpendHook {
  leadGameMin: number
  /** Sim-seconds before STD. Same 8 game-minute clock as `planShowUp`. */
  leadSimSec: number
  walletTag: ShowTag
}

/** Absolute release the hall can stamp once it knows STD in sim-seconds. */
export interface DepartureStamp {
  segment: PaxSegment
  walletTag: ShowTag
  preferFastTrack: boolean
  amenity: AmenityBias
  /** Absolute sim-second the body may enter. Null when STD was not finite. */
  releaseAt: number | null
  leadGameMin: number
  spend: SpendHook
  willingness: Willingness
  mood: MoodDeltas
}
