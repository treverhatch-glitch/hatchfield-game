export type AircraftClass = 'small' | 'regional' | 'narrowbody' | 'widebody' | 'jumbo' | 'super';

export type TowerTier = 1 | 2 | 3 | 'I' | 'II' | 'III';

export type DualRunwayMode = 'segregated' | 'mixed' | 'independent';
export type RunwayMode = 'single' | DualRunwayMode;

export type TugType = 'light' | 'medium' | 'heavy' | 'towbarless';

export const TOWER_BASE_CAPACITY: Record<number, number> = {
  1: 30,
  2: 40,
  3: 50,
};

export const TOWER_TIER_MAP: Record<string, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  'I': 1,
  'II': 2,
  'III': 3,
};

/** Late-game cab/approach-control fit bought from a placed control tower. */
export const TOWER_III_UPGRADE = {
  name: 'Tower III',
  minFieldLevel: 9,
  prerequisite: 'atc_approach',
  cost: 900_000,
  upkeepPerDay: 12_000,
  movementsPerHour: TOWER_BASE_CAPACITY[3],
  maxInboundBonus: 1,
  spawnIntervalSeconds: 7,
} as const;

export const DUAL_RUNWAY_MULTIPLIERS: Record<DualRunwayMode, number> = {
  segregated: 1.6,
  mixed: 1.85,
  independent: 2.0,
};

export const RUNWAY_MODE_MULTIPLIERS: Record<RunwayMode, number> = {
  single: 1.0,
  ...DUAL_RUNWAY_MULTIPLIERS,
};

/**
 * Wake separation multipliers when a heavier aircraft leads a lighter one.
 * - Heavy leading Light/Small/Regional: 1.25
 * - Super (A380) leading any non-super: 1.4
 */
export const WAKE_MULTIPLIERS = {
  HEAVY_LEAD_LIGHT: 1.25,
  SUPER_LEAD_NON_SUPER: 1.40,
  DEFAULT: 1.0,
} as const;

export const CLASS_NEEDS_HIGHLIFT: Record<AircraftClass, boolean> = {
  small: false,
  regional: false,
  narrowbody: false,
  widebody: true,
  jumbo: true,
  super: true,
};

export const GPU_SAVINGS_KG: Record<AircraftClass, number> = {
  small: 0,
  regional: 0,
  narrowbody: 120,
  widebody: 400,
  jumbo: 400,
  super: 400,
};

export const FLEET_SPARE_FACTOR = 0.15;
