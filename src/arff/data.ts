export interface ArffCategoryConfig {
  /** ICAO Rescue and Fire Fighting category (1 to 10). */
  category: number;
  /** Maximum overall aircraft length in meters for this category (exclusive upper bound, e.g. 9 for < 9m). */
  maxLengthM: number;
  /** Maximum fuselage width in meters for this category before category step-up rule applies. */
  maxWidthM: number;
  /** Minimum required rescue & firefighting vehicles. */
  vehicles: number;
  /** Minimum required agents / personnel. */
  agents: number;
  /** Minimum total water capacity in liters (for Level B/C foam). */
  waterLiters: number;
}

/**
 * ICAO Annex 14 Chapter 9 RFF category table (Categories 1 - 10).
 */
export const ARFF_CATEGORIES: Record<number, ArffCategoryConfig> = {
  1: { category: 1, maxLengthM: 9, maxWidthM: 2, vehicles: 1, agents: 2, waterLiters: 350 },
  2: { category: 2, maxLengthM: 12, maxWidthM: 2, vehicles: 1, agents: 2, waterLiters: 1000 },
  3: { category: 3, maxLengthM: 18, maxWidthM: 3, vehicles: 1, agents: 2, waterLiters: 1800 },
  4: { category: 4, maxLengthM: 24, maxWidthM: 4, vehicles: 1, agents: 3, waterLiters: 2400 },
  5: { category: 5, maxLengthM: 28, maxWidthM: 4, vehicles: 1, agents: 4, waterLiters: 5400 },
  6: { category: 6, maxLengthM: 39, maxWidthM: 5, vehicles: 2, agents: 6, waterLiters: 7900 },
  7: { category: 7, maxLengthM: 49, maxWidthM: 5, vehicles: 2, agents: 6, waterLiters: 12100 },
  8: { category: 8, maxLengthM: 61, maxWidthM: 7, vehicles: 3, agents: 9, waterLiters: 18200 },
  9: { category: 9, maxLengthM: 76, maxWidthM: 7, vehicles: 3, agents: 9, waterLiters: 24300 },
  10: { category: 10, maxLengthM: Infinity, maxWidthM: 8, vehicles: 3, agents: 12, waterLiters: 32300 },
};

export function getCategoryConfig(cat: number): ArffCategoryConfig | undefined {
  return ARFF_CATEGORIES[cat];
}
