import type { AircraftClass } from './types';

export const DEICE_TEMP_THRESHOLD_C = 3;

export const DEICE_MINUTES_PER_CLASS: Record<AircraftClass, number> = {
  small: 6,
  regional: 8,
  narrowbody: 10,
  widebody: 14,
  jumbo: 18,
};

export const GLYCOL_LITRES_PER_CLASS: Record<AircraftClass, number> = {
  small: 150,
  regional: 250,
  narrowbody: 400,
  widebody: 800,
  jumbo: 1200,
};

export const GLYCOL_PRICE_PER_LITRE = 4;

export const GLYCOL_ORDER_LEAD_TIME_MINUTES = 120;
export const GLYCOL_ORDER_LEAD_TIME = GLYCOL_ORDER_LEAD_TIME_MINUTES;

export const DEICE_FEE = 1400;

export const CLASS_HIERARCHY: Record<AircraftClass, number> = {
  small: 1,
  regional: 2,
  narrowbody: 3,
  widebody: 4,
  jumbo: 5,
};

export const VISIBILITY_THRESHOLDS = {
  CAT3_LIMIT: 200,
  LOW_LIMIT: 400,
  MID_LIMIT: 800,
} as const;

export const RUNWAY_RATE_FACTORS = {
  CAT3: 0.25,
  LOW: 0.45,
  MID: 0.70,
  NORMAL: 1.0,
} as const;
