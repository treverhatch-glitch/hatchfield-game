import { SORTER_SPECS, type SorterTier } from './data';

export interface SorterPlanResult {
  tier: SorterTier;
  capacity: number;
  bagsPerHr: number;
  utilisation: number;
  mishandleRate: number;
  mishandledPerHr: number;
  upgradeSuggested: boolean;
  nextTier?: SorterTier;
}

const NEXT_TIER: Record<SorterTier, SorterTier | undefined> = {
  manual: 'tilt-tray',
  'tilt-tray': 'ics',
  ics: undefined,
};

/**
 * Calculates BHS baggage sorter performance metrics and upgrade recommendations.
 *
 * @param tier BHS sorter tier ('manual', 'tilt-tray', or 'ics')
 * @param bagsPerHr Total hourly baggage volume
 */
export function sorterPlan(
  tier: SorterTier,
  bagsPerHr: number
): SorterPlanResult {
  const safeBags = Number.isFinite(bagsPerHr) ? Math.max(0, bagsPerHr) : 0;
  const spec = SORTER_SPECS[tier] ?? SORTER_SPECS.manual;

  const capacity = spec.bagsPerHr;
  const mishandleRate = spec.mishandleRate;
  const utilisation = capacity > 0 ? safeBags / capacity : safeBags > 0 ? 1 : 0;
  const mishandledPerHr = safeBags * mishandleRate;

  const nextTier = NEXT_TIER[tier];
  const upgradeSuggested = utilisation >= 0.85 && nextTier !== undefined;

  return {
    tier,
    capacity,
    bagsPerHr: safeBags,
    utilisation: Number.isFinite(utilisation) ? utilisation : 0,
    mishandleRate,
    mishandledPerHr: Number.isFinite(mishandledPerHr) ? mishandledPerHr : 0,
    upgradeSuggested,
    ...(nextTier ? { nextTier } : {}),
  };
}
