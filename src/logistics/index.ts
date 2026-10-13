export * from './types'
export { needsFor, needsForAirframe, allNeeds, FUEL_DENSITY, UPLIFT_FRACTION, PAX_CARGO_FACTOR, FREIGHTER_CARGO_FACTOR } from './needs'
export { RoadGraph } from './roads'
export { LogisticsSim } from './engine'
export type { VehicleState, VehiclePhase, TurnaroundState, ServiceStatus, LogisticsListener, PaxState, BagState } from './engine'
export {
  defaultConfig,
  DEFAULT_VEHICLE_SPECS,
  DEFAULT_PAX,
  DEFAULT_HOLD,
  VEHICLE_CATALOG,
  A380_READY_FLEET,
  A380_STAND_UNLOCK,
  isUnlocked,
  unlockedVehicles,
  fleetCost,
  STARTER_FLEET_PURCHASE,
  a380ScenarioConfig,
  type VehicleUnlock,
} from './defaults'
export { createLogisticsAdapter } from './adapter'
export { Maintenance, MAINTENANCE_TIERS, defaultMaintenanceConfig } from './maintenance'
export type {
  CrewType,
  FacilityConfig,
  FacilityKind,
  FacilityState,
  FacilityStatus,
  MaintenanceConfig,
  MaintenanceMetrics,
  MaintenanceTier,
  TierSpec,
  WearState,
} from './maintenance'
export { SeededRng } from './rng'
export {
  applyFeatureEventEffect,
  featureEventWorldPatch,
  withoutDuplicateBreakdownEvents,
  FEATURE_FUEL_TRUCK_EVENT_ID,
} from './events-bridge'
export type { FeatureEventEffectLike } from './events-bridge'
export type { LogisticsAdapter, LogisticsHost, LogisticsSnapshot, SoundCue, TurnaroundResult } from './adapter'
