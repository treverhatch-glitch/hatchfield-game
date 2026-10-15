/**
 * A stand fuels by hydrant only when that stand has a pit and a dispenser
 * is on the fleet. Research alone does not flip the draw.
 * Pit price and daily upkeep stay on the progression stamp.
 */

export const HYDRANT_CARD = {
  hydrant: 'Hydrant',
  bowser: 'Bowser',
  short: 'Into-plane short. Add a dispenser, or send your own bowser.',
} as const

export function standDrawsHydrant(
  standKey: string | null,
  pits: Readonly<Record<string, true>>,
  dispensers: number,
): boolean {
  if (!standKey || dispensers <= 0) return false
  return pits[standKey] === true
}

/** Stand ids the ramp may treat as hydrant. Empty while no dispenser is owned. */
export function liveHydrantStands(
  pits: Readonly<Record<string, true>>,
  dispensers: number,
): string[] {
  if (dispensers <= 0) return []
  return Object.keys(pits)
}
