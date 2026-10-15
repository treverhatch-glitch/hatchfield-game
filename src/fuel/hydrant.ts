/**
 * A stand fuels by hydrant only when that stand has a pit and a dispenser
 * is on the fleet. Research alone does not flip the draw.
 * The pit map is the only store. Stamp, bulldoze, legacy load, and a stand
 * attachment all write it through writeHydrantPit. The attachment charges
 * its own price, then calls Game.setHydrantPit. Fuel never reads a fitting.
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

/**
 * The only mutation of the pit map. Returns whether the map changed.
 * Fuel draw reads this map and nothing else.
 */
export function writeHydrantPit(
  pits: Record<string, true>,
  key: string,
  on: boolean,
): boolean {
  const has = pits[key] === true
  if (on === has) return false
  if (on) pits[key] = true
  else delete pits[key]
  return true
}

/** Stand ids the ramp may treat as hydrant. Empty while no dispenser is owned. */
export function liveHydrantStands(
  pits: Readonly<Record<string, true>>,
  dispensers: number,
): string[] {
  if (dispensers <= 0) return []
  return Object.keys(pits)
}
