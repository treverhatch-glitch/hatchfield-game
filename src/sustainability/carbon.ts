import type { AircraftClass } from './data';
import {
  GROUND_OPS_KG_PER_DAY_PER_MW,
  KG_CO2_PER_LTO,
  OFFSET_COST_PER_TONNE,
  SAF_CUT_FACTOR,
} from './data';

export type MovementInput =
  | Partial<Record<AircraftClass, number>>
  | { class: AircraftClass; count: number }[]
  | AircraftClass[];

export interface DailyEmissionsParams {
  movements: MovementInput;
  powerMW: number;
  safBlend: number;
  solarMW: number;
}

export interface DailyEmissionsResult {
  flightKg: number;
  groundKg: number;
  totalKg: number;
  totalTonnes: number;
}

export interface NetZeroProgressResult {
  net: number;
  isNetZero: boolean;
  totalEmissions: number;
  offsets: number;
  [Symbol.iterator](): Iterator<number | boolean>;
}

function cleanPrecision(val: number): number {
  return Math.round(val * 1e6) / 1e6;
}

/**
  Calculates daily carbon emissions (kg and tonnes) for flight movements and airside ground ops.
  SAF cuts flight CO2 by safBlend x 0.8.
  Solar power offsets ground ops power demand before applying the ground ops CO2 factor.
 */
export function dailyEmissions(params: DailyEmissionsParams): DailyEmissionsResult {
  const { movements, powerMW, safBlend, solarMW } = params;

  let rawFlightKg = 0;

  if (Array.isArray(movements)) {
    for (const item of movements) {
      if (typeof item === 'string') {
        const classRate = KG_CO2_PER_LTO[item as AircraftClass] ?? 0;
        rawFlightKg += classRate;
      } else if (item && typeof item === 'object') {
        const classRate = KG_CO2_PER_LTO[item.class] ?? 0;
        rawFlightKg += classRate * (item.count ?? 0);
      }
    }
  } else if (movements && typeof movements === 'object') {
    for (const [cls, count] of Object.entries(movements)) {
      const classRate = KG_CO2_PER_LTO[cls as AircraftClass] ?? 0;
      if (typeof count === 'number') {
        rawFlightKg += classRate * count;
      }
    }
  }

  const rawBlendFrac = safBlend > 1 ? safBlend / 100 : safBlend;
  const blendFrac = Math.min(1, Math.max(0, rawBlendFrac));
  const flightCut = blendFrac * SAF_CUT_FACTOR;
  const flightKg = cleanPrecision(rawFlightKg * (1 - flightCut));

  const netPowerMW = Math.max(0, powerMW - solarMW);
  const groundKg = cleanPrecision(netPowerMW * GROUND_OPS_KG_PER_DAY_PER_MW);

  const totalKg = cleanPrecision(flightKg + groundKg);
  const totalTonnes = cleanPrecision(totalKg / 1000);

  return {
    flightKg,
    groundKg,
    totalKg,
    totalTonnes,
  };
}

export type HistoryEntry =
  | number
  | { totalTonnes?: number; totalKg?: number };

/**
  Tracks cumulative net-zero progress given an emissions history and total purchased offsets (in tonnes).
  Returns net CO2 (in tonnes) and whether the airport has achieved net-zero (net <= 0).
  Supports both object destructuring `{ net, isNetZero }` and array destructuring `[net, isNetZero]`.
 */
export function netZeroProgress(
  history: HistoryEntry[],
  offsetsT: number
): NetZeroProgressResult {
  let totalEmissionsTonnes = 0;

  for (const entry of history) {
    if (typeof entry === 'number') {
      totalEmissionsTonnes += entry;
    } else if (entry && typeof entry === 'object') {
      if (typeof entry.totalTonnes === 'number') {
        totalEmissionsTonnes += entry.totalTonnes;
      } else if (typeof entry.totalKg === 'number') {
        totalEmissionsTonnes += entry.totalKg / 1000;
      }
    }
  }

  totalEmissionsTonnes = cleanPrecision(totalEmissionsTonnes);
  const net = cleanPrecision(totalEmissionsTonnes - offsetsT);
  const isNetZero = net <= 0;

  return {
    net,
    isNetZero,
    totalEmissions: totalEmissionsTonnes,
    offsets: offsetsT,
    *[Symbol.iterator]() {
      yield net;
      yield isNetZero;
    },
  };
}

/**
  Calculates dollar cost for buying t tonnes of carbon offsets ($25/t).
 */
export function offsetCost(t: number): number {
  return cleanPrecision(Math.max(0, t) * OFFSET_COST_PER_TONNE);
}
