import { VISIBILITY_THRESHOLDS, RUNWAY_RATE_FACTORS } from './data';

export function runwayRateFactor(visibilityM?: number | null, hasCat3: boolean = false): number {
  if (typeof visibilityM !== 'number' || Number.isNaN(visibilityM)) {
    return RUNWAY_RATE_FACTORS.NORMAL;
  }

  if (visibilityM < VISIBILITY_THRESHOLDS.CAT3_LIMIT) {
    return hasCat3 ? RUNWAY_RATE_FACTORS.CAT3 : 0;
  }

  if (visibilityM < VISIBILITY_THRESHOLDS.LOW_LIMIT) {
    return RUNWAY_RATE_FACTORS.LOW;
  }

  if (visibilityM < VISIBILITY_THRESHOLDS.MID_LIMIT) {
    return RUNWAY_RATE_FACTORS.MID;
  }

  return RUNWAY_RATE_FACTORS.NORMAL;
}
