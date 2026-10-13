import {
  type AircraftClass,
  NOISE_POINTS_BY_CLASS,
  NIGHT_START_HOUR,
  NIGHT_END_HOUR,
  NIGHT_MULTIPLIER,
  BASE_CURFEW_FINE_PER_MOVEMENT,
  DAILY_NOISE_ALLOWANCE,
  APPROVAL_LOSS_PER_POINT,
  MAX_DAILY_APPROVAL_LOSS,
} from './data';

export type { AircraftClass };

export interface Movement {
  cls: AircraftClass;
  hour: number;
}

export interface DailyNoiseReport {
  points: number;
  nightMovements: number;
  fines: number;
  approvalDelta: number;
}

export function isNight(hour: number): boolean {
  if (!Number.isFinite(hour)) {
    return false;
  }
  const h = ((hour % 24) + 24) % 24;
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

export function movementNoise(m: Movement): number {
  if (!m || typeof m.cls !== 'string') {
    return 0;
  }
  const basePoints = NOISE_POINTS_BY_CLASS[m.cls] ?? 0;
  const night = isNight(m.hour);
  const points = night ? basePoints * NIGHT_MULTIPLIER : basePoints;
  return Number.isFinite(points) ? points : 0;
}

export function dailyNoiseReport(
  movements: Movement[],
  curfew: boolean
): DailyNoiseReport {
  if (!Array.isArray(movements) || movements.length === 0) {
    return {
      points: 0,
      nightMovements: 0,
      fines: 0,
      approvalDelta: 0,
    };
  }

  let points = 0;
  let nightMovements = 0;
  let fines = 0;

  for (const m of movements) {
    if (!m) continue;
    const noise = movementNoise(m);
    points += noise;

    if (isNight(m.hour)) {
      nightMovements += 1;
      if (curfew) {
        const basePoints = NOISE_POINTS_BY_CLASS[m.cls] ?? 0;
        const classFactor = Math.max(1, basePoints / 4);
        const fine = BASE_CURFEW_FINE_PER_MOVEMENT * classFactor;
        if (Number.isFinite(fine)) {
          fines += fine;
        }
      }
    }
  }

  const excessPoints = Math.max(0, points - DAILY_NOISE_ALLOWANCE);
  const rawLoss = excessPoints * APPROVAL_LOSS_PER_POINT;
  const cappedLoss = Math.min(MAX_DAILY_APPROVAL_LOSS, rawLoss);
  const approvalDelta = Number.isFinite(cappedLoss) ? -cappedLoss : 0;

  return {
    points: Number.isFinite(points) ? points : 0,
    nightMovements,
    fines: Number.isFinite(fines) ? fines : 0,
    approvalDelta: Object.is(approvalDelta, -0) ? 0 : approvalDelta,
  };
}
