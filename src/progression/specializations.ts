/**
 * Specialization paths. Points arrive at Field Levels 6, 8, and 10.
 * Paths mix: the first capstone is list price, each later path's capstone
 * costs more, and each path after the first adds site-wide upkeep.
 */

export const SPEC_POINT_LEVELS = [6, 8, 10] as const

/** Added to a capstone's price when its path was not the first one chosen. */
export const EXTRA_PATH_CAPSTONE_PREMIUM = 0.5

/** Site-wide upkeep added for each path after the first. */
export const EXTRA_PATH_UPKEEP = 0.1

export type SpecPath = 'hub' | 'low-cost' | 'cargo' | 'luxury'

export interface SpecPathDef {
  id: SpecPath
  label: string
  blurb: string
  /** Buildable id whose price takes the mix premium. */
  capstoneId: string
}

export const SPEC_PATHS: readonly SpecPathDef[] = [
  {
    id: 'hub',
    label: 'Hub',
    blurb: 'Transfer banks and a satellite pier.',
    capstoneId: 'satellite',
  },
  {
    id: 'low-cost',
    label: 'Low-cost',
    blurb: 'Fast turns on a second pier.',
    capstoneId: 'pier_ii',
  },
  {
    id: 'cargo',
    label: 'Cargo',
    blurb: 'Night sort with a tilt-tray.',
    capstoneId: 'tilt_tray',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    blurb: 'A landmark and a quieter landside.',
    capstoneId: 'prestige_landmark',
  },
]

const PATH_IDS = new Set<string>(SPEC_PATHS.map((p) => p.id))

export function isSpecPath(id: string): id is SpecPath {
  return PATH_IDS.has(id)
}

export function specPath(id: string): SpecPathDef | undefined {
  return SPEC_PATHS.find((p) => p.id === id)
}

/** Points earned at this field level (0–3). */
export function specPointsForLevel(level: number): number {
  return SPEC_POINT_LEVELS.filter((lv) => level >= lv).length
}

/**
 * Capstone cash. The first chosen path pays `base`. Each path chosen after
 * that pays base × (1 + EXTRA_PATH_CAPSTONE_PREMIUM). An unchosen path stays
 * at `base` until it is selected.
 */
export function capstoneCost(base: number, paths: readonly string[], capstoneId: string): number {
  const path = SPEC_PATHS.find((p) => p.capstoneId === capstoneId)
  if (!path) return Math.round(base)
  const index = paths.indexOf(path.id)
  if (index <= 0) return Math.round(base)
  return Math.round(base * (1 + EXTRA_PATH_CAPSTONE_PREMIUM))
}

/** 1 path = 1. Each path after the first adds EXTRA_PATH_UPKEEP. */
export function siteUpkeepMultiplier(pathCount: number): number {
  const extra = Math.max(0, pathCount - 1)
  return 1 + extra * EXTRA_PATH_UPKEEP
}
