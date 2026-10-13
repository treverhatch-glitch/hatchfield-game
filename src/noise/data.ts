export type AircraftClass =
  | 'small'
  | 'regional'
  | 'narrowbody'
  | 'widebody'
  | 'jumbo'
  | 'military'
  | 'helicopter';

export const NOISE_POINTS_BY_CLASS: Record<AircraftClass, number> = {
  small: 1,
  regional: 2,
  narrowbody: 4,
  widebody: 7,
  jumbo: 10,
  military: 8,
  helicopter: 2,
};

export const NIGHT_START_HOUR = 23;
export const NIGHT_END_HOUR = 6;
export const NIGHT_MULTIPLIER = 3;

export const BASE_CURFEW_FINE_PER_MOVEMENT = 1200;

export const DAILY_NOISE_ALLOWANCE = 60;
export const APPROVAL_LOSS_PER_POINT = 0.05;
export const MAX_DAILY_APPROVAL_LOSS = 5;
