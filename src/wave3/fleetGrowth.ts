import { sizeTierOf } from '../scale/logic.ts'
import { CONTRACT_TIERS } from './config.ts'

/**
 * Airline size and relationship growth before a listed type may spawn.
 * The contract fleet itself stays closed. A small carrier never draws wide
 * or jumbo metal. A jumbo such as the A380 stays in the list, and only
 * leaves the ground once the relationship reaches Bigger aircraft, and only
 * when the carrier also has a smaller type to fly until then.
 */
export const SMALL_AIRLINE_TIER = 2

/** Relationship tier whose unlock is "Bigger aircraft". */
export const JUMBO_RELATION_TIER =
  CONTRACT_TIERS.find((row) => row.unlock === 'Bigger aircraft')?.tier ?? 4

export function filterSpawnFleet<T extends { id: string }>(
  fleet: readonly T[],
  airlineTier: number,
  relationTier: number,
): T[] {
  const smallCarrier = airlineTier <= SMALL_AIRLINE_TIER
  let pool = fleet.filter((af) => {
    if (!smallCarrier) return true
    const size = sizeTierOf(af.id)
    return size !== 'wide' && size !== 'jumbo'
  })
  const grown = relationTier >= JUMBO_RELATION_TIER
  const hasSmaller = pool.some((af) => sizeTierOf(af.id) !== 'jumbo')
  if (!grown && hasSmaller) pool = pool.filter((af) => sizeTierOf(af.id) !== 'jumbo')
  return pool
}
