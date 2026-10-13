/** Pure cargo-domain contracts. Time is measured in game minutes and mass in metric tonnes. */

export type CargoKind = 'general' | 'express' | 'perishable' | 'oversize'
export type HandlingUnitKind = 'loose' | 'ake' | 'pmc' | 'oversize_piece'
export type FlightCargoMode = 'belly' | 'freighter'
export type CargoDirection = 'export' | 'import'

export type CargoStage =
  | 'truck_dock'
  | 'customs'
  | 'screening'
  | 'warehouse'
  | 'build_up'
  | 'ready'

export const CARGO_STAGES: readonly CargoStage[] = [
  'truck_dock',
  'customs',
  'screening',
  'warehouse',
  'build_up',
  'ready',
]

export interface HandlingUnitSpec {
  kind: HandlingUnitKind
  label: string
  tareTonnes: number
  maxGrossTonnes: number
  /** Playable average payload; volume usually binds before structural mass. */
  nominalPayloadTonnes: number
  mainDeckOnly: boolean
}

export interface CargoFacilityConfig {
  id: CargoStage
  label: string
  inputCapacityTonnes: number
  outputCapacityTonnes: number
  rateTonnesPerMin: number
  staffRequired: number
  staffAssigned: number
}

export interface LandsideTruckConfig {
  count: number
  payloadTonnes: number
  inboundTravelMinutes: number
  roundTripMinutes: number
  unloadTonnesPerMin: number
}

export interface CargoTerminalConfig {
  facilities: CargoFacilityConfig[]
  trucks: LandsideTruckConfig
  /** How often bottleneck samples are emitted to the host. */
  advisorSampleMinutes: number
}

export type CargoContractStatus = 'active' | 'fulfilled' | 'failed'

export interface CargoContractInput {
  id: string
  kind: CargoKind
  tonnes: number
  /** Absolute game-minute deadline. */
  deadline: number
  revenuePerTonne?: number
  penaltyPerTonne?: number
  unitKind?: HandlingUnitKind
  /** Oversize defaults to freighter-only; other cargo defaults to either mode. */
  allowedModes?: readonly FlightCargoMode[]
}

export interface CargoContract {
  id: string
  kind: CargoKind
  tonnes: number
  deliveredTonnes: number
  shippedTonnes: number
  /** Freight returned to the shipper after a missed deadline. */
  returnedTonnes: number
  deadline: number
  revenuePerTonne: number
  penaltyPerTonne: number
  unitKind: HandlingUnitKind
  allowedModes: readonly FlightCargoMode[]
  status: CargoContractStatus
  penaltyPaid: number
  revenueEarned: number
}

export type LandsideTruckStatus = 'inbound' | 'queued' | 'unloading' | 'departed'

export interface LandsideTruck {
  id: string
  contractId: string
  tonnes: number
  remainingTonnes: number
  arrivesAt: number
  status: LandsideTruckStatus
}

export interface CargoFlight {
  id: string
  airframeId: string
  mode: FlightCargoMode
  capacityTonnes: number
  supportedUnits: readonly HandlingUnitKind[]
  /**
   * Optional planning hint only. Logistics remains authoritative and can use
   * its slower standard ULD-loader fallback when this is false.
   */
  mainDeckLoaderAvailable?: boolean
}

export interface CargoFlightLoad {
  flightId: string
  tonnes: number
  units: number
  /** Logistics equipment request; its dispatcher decides availability/fallback. */
  requiredLoader: 'uld_loader' | 'main_deck_loader' | null
  assignments: {
    contractId: string
    kind: CargoKind
    unitKind: HandlingUnitKind
    tonnes: number
    units: number
  }[]
  rejected: { contractId: string; reason: string }[]
}

export type BottleneckSeverity = 'low' | 'medium' | 'high'

export interface CargoBottleneck {
  id: string
  stage: CargoStage
  severity: BottleneckSeverity
  reason: 'understaffed' | 'input_full' | 'output_blocked' | 'saturated'
  queueTonnes: number
  capacityTonnes: number
  utilization: number
  /** Stable action strings can be translated directly into advisor cards. */
  fixes: {
    build: string
    upgrade: string
    staff: string
  }
}

export interface CargoFacilitySnapshot {
  id: CargoStage
  label: string
  queuedTonnes: number
  capacityTonnes: number
  outputCapacityTonnes: number
  rateTonnesPerMin: number
  effectiveRateTonnesPerMin: number
  staffing: number
  utilization: number
  processedTonnes: number
  blockedMinutes: number
}

export interface CargoSnapshot {
  time: number
  facilities: CargoFacilitySnapshot[]
  contracts: CargoContract[]
  trucks: LandsideTruck[]
  reservedTonnes: number
  revenue: number
  penalties: number
  bottlenecks: CargoBottleneck[]
}

export type CargoEvent =
  | { type: 'money'; amount: number; category: 'cargo_revenue' | 'cargo_penalty'; contractId: string }
  | { type: 'truck_status'; truckId: string; status: LandsideTruckStatus }
  | { type: 'contract_status'; contractId: string; status: CargoContractStatus }
  | { type: 'flow'; stage: CargoStage; direction: 'in' | 'out'; tonnes: number }
  | { type: 'bottlenecks'; bottlenecks: CargoBottleneck[] }

export type CargoListener = (event: CargoEvent) => void
