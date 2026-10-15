/** Suitcases riding the apron belts. The bag ledger stays aggregate; these are the picture. */
export const BELT_BAGS = {
  /** Bags shared across every belt run, split by run length. */
  count: 8,
  /** Belt speed, cells per wall-clock second. */
  cellsPerSec: 1.2,
  /** Suitcase box, metres: length, height, depth. */
  sizeM: [0.7, 0.5, 0.35] as const,
} as const
