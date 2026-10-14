import { AIRFRAMES } from '../game/airframes.ts'
import { CONTRACT_FLEET } from '../game/catalog.ts'
import { rosterFleet } from '../game/rosterAirlines.ts'

/**
 * Mainline narrowbodies a commuter fleet must never be offered or flown.
 * Harbor and other fleets that list these ids may still use them.
 */
export const MAINLINE_NARROWBODIES = ['b738', 'a321', 'b737', 'a320', 'a320neo'] as const

/** Catalog, roster, then an explicit list. Empty means the caller has no named fleet. */
export function fleetIdsFor(airlineId: string, listed?: readonly string[]): string[] {
  const named = listed && listed.length ? listed : (CONTRACT_FLEET[airlineId] ?? rosterFleet(airlineId))
  if (!named) return []
  const out: string[] = []
  for (const id of named) {
    if (!AIRFRAMES[id]) continue
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** A listed fleet is closed. Higher contract tiers do not add metal. */
export function metalAllowed(fleet: readonly string[], airframeId: string): boolean {
  if (!fleet.length) return true
  return fleet.includes(airframeId)
}

export function fleetLabel(fleet: readonly string[]): string {
  if (!fleet.length) return 'Their own metal'
  return fleet.map((id) => AIRFRAMES[id]?.name ?? id).join(', ')
}

/** Commuter check used by the Bushline rule: none of the forbidden narrowbodies. */
export function fleetHasMainlineNarrowbody(fleet: readonly string[]): boolean {
  return fleet.some((id) => (MAINLINE_NARROWBODIES as readonly string[]).includes(id))
}
