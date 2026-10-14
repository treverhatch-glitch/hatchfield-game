/**
 * Staff shift roster module for calculating roster costs and coverage gaps.
 */

export const NIGHT_PREMIUM_RATE = 0.25;
export const OVERTIME_FACTOR_RATE = 0.10;
export const UNDERSTAFFED_THRESHOLD = 0.80;

export type ShiftType = 'early' | 'late' | 'night';
export const SHIFT_TYPES: readonly ShiftType[] = ['early', 'late', 'night'];

export interface RoleShiftConfig {
  role: string;
  perShift: [number, number, number];
  requiredPerShift?: [number, number, number];
  wagePerDay: number;
}

export interface CoverageGap {
  role: string;
  shift: ShiftType;
  shiftIndex: 0 | 1 | 2;
  required: number;
  actual: number;
  deficit: number;
  staffingRatio: number;
  isUnder80Percent: boolean;
}

/**
 * Calculates all coverage gaps across roles and shifts where actual staff < required staff.
 */
export function coverageGaps(roles?: readonly RoleShiftConfig[] | null): CoverageGap[] {
  if (!roles || !Array.isArray(roles)) {
    return [];
  }

  const gaps: CoverageGap[] = [];

  for (const config of roles) {
    if (!config || !config.role) continue;

    const perShift = config.perShift ?? [0, 0, 0];
    const requiredPerShift = config.requiredPerShift ?? perShift;

    for (let index = 0; index < 3; index++) {
      const shiftName = SHIFT_TYPES[index];
      const actual = Math.max(0, Number.isFinite(perShift[index]) ? perShift[index] : 0);
      const required = Math.max(0, Number.isFinite(requiredPerShift[index]) ? requiredPerShift[index] : 0);

      const ratio = required > 0 ? actual / required : 1.0;
      const deficit = Math.max(0, required - actual);
      const isUnder80Percent = required > 0 && ratio < UNDERSTAFFED_THRESHOLD;

      if (deficit > 0) {
        gaps.push({
          role: config.role,
          shift: shiftName,
          shiftIndex: index as 0 | 1 | 2,
          required,
          actual,
          deficit,
          staffingRatio: ratio,
          isUnder80Percent,
        });
      }
    }
  }

  return gaps;
}

/**
 * Calculates total roster cost including 25% night shift premium
 * and 10% overtime multiplier if any shift is under 80% staffed.
 */
export function rosterCost(roles?: readonly RoleShiftConfig[] | null): number {
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return 0;
  }

  let totalBaseCost = 0;
  let hasAnyUnderstaffedShift = false;

  for (const config of roles) {
    if (!config) continue;

    const wage = Math.max(0, Number.isFinite(config.wagePerDay) ? config.wagePerDay : 0);
    const perShift = config.perShift ?? [0, 0, 0];
    const requiredPerShift = config.requiredPerShift ?? perShift;

    for (let index = 0; index < 3; index++) {
      const actual = Math.max(0, Number.isFinite(perShift[index]) ? perShift[index] : 0);
      const required = Math.max(0, Number.isFinite(requiredPerShift[index]) ? requiredPerShift[index] : 0);

      const isNight = index === 2;
      const rateMultiplier = isNight ? 1 + NIGHT_PREMIUM_RATE : 1.0;
      const shiftCost = actual * wage * rateMultiplier;

      totalBaseCost += shiftCost;

      if (required > 0 && actual / required < UNDERSTAFFED_THRESHOLD) {
        hasAnyUnderstaffedShift = true;
      }
    }
  }

  if (hasAnyUnderstaffedShift) {
    totalBaseCost *= 1 + OVERTIME_FACTOR_RATE;
  }

  return Number.isFinite(totalBaseCost) ? Math.round(totalBaseCost * 100) / 100 : 0;
}
