export { createPaxShowUpAdapter, stampDeparture } from './adapter.ts'
export type { PaxShowUpAdapter } from './adapter.ts'
export {
  MAX_WAVE,
  MOOD_SPEND,
  PAX_SEGMENT_CONFIG,
  SHOWUP_WINDOWS,
} from './config.ts'
export type { SegmentConfig, WindowSpec } from './config.ts'
export { asSegment, cleanFacts, cleanSegmentConfig, sanitizeCount } from './facts.ts'
export { moodSpendHook } from './hooks.ts'
export { samplePassenger, samplePassengers, walletTagFor } from './profile.ts'
export { createPaxRng, sampleStandardNormal, sanitizeSeed } from './rng.ts'
export type { PaxRng } from './rng.ts'
export { loungeLoverShare, sampleSegment, segmentShares } from './segments.ts'
export { leadToSimSec, leadWindow, sampleLeadMin } from './timing.ts'
export type {
  AmenityBias,
  CleanFacts,
  DepartureStamp,
  LeadWindow,
  MoodDeltas,
  MoodSpendHook,
  PassengerProfile,
  PaxSegment,
  ScreeningChoice,
  SegmentShares,
  ShowUpFacts,
  SpendHook,
  Willingness,
} from './types.ts'
export { PAX_SEGMENTS } from './types.ts'
