/**
 * Maintenance & generic equipment wear module.
 */

export const DEFAULT_WEAR_RATE_PER_USE_DAY = 0.005;

/**
 * Base wear rate per unit of daily use for various generic equipment kinds.
 */
export const EQUIPMENT_WEAR_RATES: Record<string, number> = {
  baggage_belt: 0.005,
  jetway: 0.004,
  tug: 0.006,
  fuel_truck: 0.005,
  deice_rig: 0.008,
  generator: 0.003,
  catering_truck: 0.005,
  sweeper: 0.007,
  default: DEFAULT_WEAR_RATE_PER_USE_DAY,
};

/**
 * Calculates new wear level (0.0 to 1.0) after a period of usage.
 */
export function wearAfter(
  daysInput: number,
  usePerDayInput: number,
  kindInput?: string | null,
  initialWearInput: number = 0,
): number {
  const days = Math.max(0, Number.isFinite(daysInput) ? daysInput : 0);
  const usePerDay = Math.max(0, Number.isFinite(usePerDayInput) ? usePerDayInput : 0);
  const initialWear = Math.min(1.0, Math.max(0, Number.isFinite(initialWearInput) ? initialWearInput : 0));

  const kindKey = kindInput && typeof kindInput === 'string' ? kindInput : 'default';
  const rate = EQUIPMENT_WEAR_RATES[kindKey] ?? EQUIPMENT_WEAR_RATES.default;

  const accumulated = initialWear + days * usePerDay * rate;
  return Math.min(1.0, Math.max(0, Number.isFinite(accumulated) ? accumulated : 0));
}

/**
 * Calculates daily breakdown probability based on current wear.
 * Returns 0 below 0.6 wear, rising linearly to 0.25 per day at 1.0 wear.
 */
export function breakdownChance(wearInput: number): number {
  if (!Number.isFinite(wearInput)) {
    return 0;
  }

  const wear = Math.min(1.0, Math.max(0, wearInput));

  if (wear < 0.6) {
    return 0;
  }

  const chance = ((wear - 0.6) / 0.4) * 0.25;
  return Math.min(0.25, Math.max(0, chance));
}

/**
 * Calculates repair cost for equipment given its base replacement/repair cost and current wear.
 */
export function repairCost(baseCostInput: number, wearInput: number): number {
  const baseCost = Math.max(0, Number.isFinite(baseCostInput) ? baseCostInput : 0);
  const wear = Math.min(1.0, Math.max(0, Number.isFinite(wearInput) ? wearInput : 0));

  const cost = baseCost * wear;
  return Number.isFinite(cost) ? Math.round(cost * 100) / 100 : 0;
}
