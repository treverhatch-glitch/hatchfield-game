import type { LogisticsSim } from './engine'

/**
 * Bridge to src/features/events (EventScheduler / EVENT_DEFS) without importing it.
 * Shapes are structural copies of the fields we use, so either module can change
 * independently. Nothing in src/features is touched.
 */
export interface FeatureEventEffectLike {
  cash?: number
  fuelTrucksDisabled?: number
  durationMin?: number
  turnaroundDelayMin?: number
}

/** The id the features module uses for its random fuel-truck failure. */
export const FEATURE_FUEL_TRUCK_EVENT_ID = 'fuel-truck-breakdown'

/**
 * Apply a resolved features event to the logistics sim. `fuelTrucksDisabled`
 * really breaks that many trucks (worst condition first). They come back after
 * `durationMin` without needing a crew, matching the event card's choice.
 * Cash and turnaround delay stay with the caller, as before.
 * Returns the ids of the vehicles taken out.
 */
export function applyFeatureEventEffect(sim: LogisticsSim, effect: FeatureEventEffectLike): string[] {
  const n = effect.fuelTrucksDisabled ?? 0
  if (n <= 0) return []
  return sim.forceBreakdown('fuel_truck', n, effect.durationMin)
}

/**
 * Feed the features scheduler real numbers: only working fuel trucks count, so a
 * fleet that's already broken down doesn't roll another random failure.
 */
export function featureEventWorldPatch(sim: LogisticsSim): { fuelTrucks: number } {
  return { fuelTrucks: sim.workingVehicles('fuel_truck') }
}

/**
 * With maintenance on, breakdowns come from wear. Drop the features module's own
 * random fuel-truck event so the two don't double up: pass its defs through this
 * before constructing EventScheduler.
 */
export function withoutDuplicateBreakdownEvents<T extends { id: string }>(defs: T[], maintenanceOn: boolean): T[] {
  return maintenanceOn ? defs.filter((d) => d.id !== FEATURE_FUEL_TRUCK_EVENT_ID) : defs
}
