import type { AirlineTier, ContractTerms } from '../airlines/index.ts';
import type { Band, DiplomacyConfig, DiplomacyTier, Grade, Interest, MetricKey } from './types.ts';

export const MONTH_DAYS = 30;

export function defaultConfig(): DiplomacyConfig {
  return {
    seasonDays: 90,
    yearDays: 360,
    slotRule80: false,
    maxLogEvents: 300,
    maxExitsPerYear: 2
  };
}

export const STANDING_MIN = -100;
export const STANDING_MAX = 100;
export const PERFORMANCE_MIN = -40;
export const PERFORMANCE_MAX = 40;
export const PERFORMANCE_HALF_LIFE_DAYS = 30;
export const TRAIT_BIAS_LIMIT = 10;
export const HYSTERESIS = 5;
export const VISIBLE_MODIFIER_LINES = 6;

export const GRADE_POINTS: Record<Grade, number> = { A: 40, B: 20, C: 0, D: -20, F: -40 };

export const BAND_ORDER: Band[] = ['hostile', 'cold', 'neutral', 'warm', 'partner'];

/** Lower edge of each band. A band is lost only HYSTERESIS points past its edge. */
export const BAND_FLOOR: Record<Band, number> = {
  hostile: STANDING_MIN,
  cold: -60,
  neutral: -20,
  warm: 20,
  partner: 60
};

export const BAND_CHIPS: Record<Band, { color: string; icon: string; word: string }> = {
  hostile: { color: '#c0392b', icon: 'flame', word: 'Hostile' },
  cold: { color: '#4a90d9', icon: 'snowflake', word: 'Cold' },
  neutral: { color: '#8a8f98', icon: 'minus', word: 'Neutral' },
  warm: { color: '#e0a526', icon: 'sun', word: 'Warm' },
  partner: { color: '#2e9e5b', icon: 'handshake', word: 'Partner' }
};

export const TIER_UNLOCK_FIELD_LEVEL: Record<DiplomacyTier, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 };

export const TIER_BASE_TYPE: Record<DiplomacyTier, AirlineTier> = {
  1: 'regional',
  2: 'low-cost',
  3: 'full-service',
  4: 'flag-carrier',
  5: 'flag-carrier'
};

/** Money scale for diplomatic actions; everything is a multiple of this. */
export const TIER_COST: Record<DiplomacyTier, number> = {
  1: 1500,
  2: 3000,
  3: 7500,
  4: 18000,
  5: 45000
};

export const TIER_CONTRACT_TERMS: Record<DiplomacyTier, ContractTerms> = {
  1: { slotsPerWeek: 14, feePerPassenger: 5, feePerLanding: 150, penaltyPerCancellation: 500, penaltyPerDelayMinute: 5 },
  2: { slotsPerWeek: 28, feePerPassenger: 9, feePerLanding: 400, penaltyPerCancellation: 1500, penaltyPerDelayMinute: 15 },
  3: { slotsPerWeek: 21, feePerPassenger: 14, feePerLanding: 1000, penaltyPerCancellation: 3000, penaltyPerDelayMinute: 30 },
  4: { slotsPerWeek: 14, feePerPassenger: 18, feePerLanding: 2000, penaltyPerCancellation: 5000, penaltyPerDelayMinute: 50 },
  5: { slotsPerWeek: 14, feePerPassenger: 22, feePerLanding: 2800, penaltyPerCancellation: 8000, penaltyPerDelayMinute: 75 }
};

export const CARGO_TERMS: ContractTerms = {
  slotsPerWeek: 7,
  feePerPassenger: 0,
  feePerLanding: 3500,
  penaltyPerCancellation: 4000,
  penaltyPerDelayMinute: 40
};

export const MODIFIER_DEFAULTS = {
  signed_rival: { value: -10, months: 12 },
  signed_ally: { value: 5, months: 12 },
  demand_met: { value: 15, months: 18 },
  demand_timeout: { value: -10, months: 12 },
  demand_declined: { value: -4, months: 3 },
  endeavor_accepted: { value: 5, months: 12 },
  endeavor_supported: { value: 12, months: 12 },
  incident: { value: -20, months: 24 },
  perk_rival: { value: -6, months: 12 },
  slot_rival: { value: -12, months: 12 },
  hub_rival: { value: -15, months: 12 },
  promise_kept: { value: 10, months: 18 },
  promise_broken: { value: -15, months: 18 },
  partner_left: { value: -8, months: 12 },
  vouch: { value: 5, months: 12 },
  mediation: { value: 5, months: 12 },
  incentive: { value: 4, months: 12 },
  counter_rejected: { value: -4, months: 3 },
  letter_ignored: { value: -2, months: 3 }
} as const;

export const FEE_RISE_PER_PCT = -3;
export const FEE_CUT_PER_PCT = 1;
export const FEE_CUT_CAP = 8;

/** Diminishing returns for same-kind modifiers: 2nd x0.5, 3rd and beyond x0.25. */
export const STACK_FACTORS = [1, 0.5, 0.25];

export const ERA_CARRY_FRACTION = 0.3;
export const ERA_CARRY_MONTHS = 24;

export const FAVOUR_CAP = 3;
export const FAVOUR_EXPIRY_DAYS = 5 * 360;

export const PROPOSAL_EXPIRY_DAYS = 14;
export const COLD_WARNING_DAYS = 30;
export const HOSTILE_TO_NOTICE_DAYS = 30;
export const EXIT_NOTICE_DAYS = 45;
/** Cancelling in the final 30 days of a term is a normal notice period: no fee, no credit or Favour loss. */
export const NOTICE_WINDOW_DAYS = 30;
export const CAPACITY_CUT_FACTOR = 0.7;
export const REENTRY_MIN_DAYS = 2 * 360;
export const EARLY_SAFETY_DAYS = 2 * 360;

export const DEMAND_CHECK_DAYS = 30;
export const DEMAND_GLOBAL_COOLDOWN_DAYS = 60;
export const MAX_OPEN_DEMANDS = 3;
export const DEMAND_PRESSURE_THRESHOLD = 0.15;
export const INTEREST_WEIGHTS: [number, number, number] = [0.5, 0.3, 0.2];

export const MAJOR_SHARE_PCT = 20;
export const MINOR_SHARE_PCT = 5;

export const SPAT_REPUTATION_PER_MONTH = -2;
export const SPAT_FADE_DAYS = 120;

export const NEWCOMER_MIN_DAYS = 30;
export const NEWCOMER_MAX_DAYS = 90;
export const TIER_FLOOR_PROSPECTS = 2;

export const SLOT_USE_THRESHOLD = 0.8;

export const INTEREST_GAP: Record<Interest, { metric: MetricKey; gap: (v: number) => number }> = {
  cost: { metric: 'feeIndex', gap: (v) => clamp01((v - 1) / 0.5) },
  punctuality: { metric: 'onTimePct', gap: (v) => clamp01((90 - v) / 30) },
  premium: { metric: 'loungeSeats', gap: (v) => clamp01(1 - v / 60) },
  capacity: { metric: 'standUtilization', gap: (v) => clamp01((v - 0.6) / 0.4) },
  green: { metric: 'solarCoveragePct', gap: (v) => clamp01(1 - v / 50) },
  family: { metric: 'familyAmenities', gap: (v) => clamp01(1 - v / 3) },
  prestige: { metric: 'prestigeItems', gap: (v) => clamp01(1 - v / 3) },
  cargo: { metric: 'cargoFacilities', gap: (v) => clamp01(1 - v / 3) }
};

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
