import type { FacilityKind, FacilityStatus, MaintenanceConfig, CrewType } from './maintenance'

/** Shared types for the ground-logistics module. All times are in sim minutes. */

export type VehicleType =
  | 'fuel_truck'
  | 'catering_truck'
  | 'baggage_tug'
  | 'pushback_tug'
  | 'gpu'
  | 'pax_bus'
  | 'belt_loader'
  | 'uld_loader'
  | 'heavy_fuel_truck'
  | 'hydrant_dispenser'
  | 'highlift_catering'
  | 'main_deck_loader'
  | 'heavy_baggage_tug'
  | 'heavy_tug'

export const VEHICLE_TYPES: readonly VehicleType[] = [
  'fuel_truck',
  'catering_truck',
  'baggage_tug',
  'pushback_tug',
  'gpu',
  'pax_bus',
  'belt_loader',
  'uld_loader',
  'heavy_fuel_truck',
  'hydrant_dispenser',
  'highlift_catering',
  'main_deck_loader',
  'heavy_baggage_tug',
  'heavy_tug',
]

/** Turnaround phases / services. */
export type ServiceKind =
  | 'deplane'
  | 'bag_unload'
  | 'cargo_unload'
  | 'loader'
  | 'fuel'
  | 'catering'
  | 'cleaning'
  | 'gpu'
  | 'boarding'
  | 'bag_load'
  | 'cargo_load'
  | 'bag_offload'
  | 'door_close'
  | 'pushback'

export type SizeClass = 'S' | 'M' | 'L'

/** inbound = arrives and stays, outbound = first departure, turn = both (through flight). */
export type FlightKind = 'inbound' | 'outbound' | 'turn'

/** How passengers reach the aircraft. */
export type StandAccess = 'bridge' | 'stairs' | 'remote'

export interface RoadNode {
  id: string
  x: number
  y: number
}

export interface RoadEdge {
  a: string
  b: string
  /** Optional explicit length in metres; defaults to the straight-line distance. */
  length?: number
}

export interface StandConfig {
  id: string
  /** Road node the stand's service point sits on. */
  node: string
  /** Hydrant pits under the stand: fuel goes straight from the farm, no truck. */
  hydrant: boolean
  /** Jet bridge, airstairs at a contact stand, or a remote stand served by bus. Default 'stairs'. */
  access?: StandAccess
  /** Jet bridges on a bridge stand (3 = A380-capable incl. upper deck). Default: pax.doors.bridge for the size. */
  bridges?: number
}

export interface FuelFarmConfig {
  node: string
  capacityLitres: number
  initialLitres: number
  /** Below this the farm raises a low-stock alert. */
  lowStockLitres: number
  /** What the airport pays the supplier per litre. */
  purchasePricePerLitre: number
  /** Airport throughput fee per litre. The airline pays the fuel plus this fee. */
  throughputFeePerLitre: number
  /** Litres one tanker-truck delivery brings. */
  tankerLitres: number
  /** Minutes from order to delivery. */
  deliveryLeadMinutes: number
  /** Automatically order one tanker when stock drops below the low mark and none is inbound. */
  autoReorder: boolean
}

export interface KitchenConfig {
  node: string
  capacityMeals: number
  initialMeals: number
  mealsPerHour: number
  lowStockMeals: number
  costPerMeal: number
  feePerMeal: number
}

export interface VehicleSpec {
  /** km/h on service roads. */
  speedKmh: number
  /** Upkeep per in-game day. */
  upkeepPerDay: number
  /** Litres (fuel truck), meals (catering), pax (bus), bags (tug + carts); 0 otherwise. */
  capacity: number
  /** Cargo kg a tug's cart/dolly train carries (tugs only). */
  cargoCapacityKg?: number
  /** Minutes to fill up at the farm, kitchen or bag make-up / cargo area. */
  loadMinutes: number
  /** Minutes to unload at a drop-off (bag claim, cargo area, terminal). */
  dropMinutes?: number
  /** Litres per minute through this vehicle's hose (fuel trucks). Default truckPumpLpm. */
  pumpLpm?: number
  /** Work-rate multiplier at the aircraft (loaders). Default 1. */
  rateMult?: number
}

export interface PaxConfig {
  /** Default load factor when the caller doesn't give pax counts. */
  loadFactor: number
  /** Passengers per minute per door. */
  deplanePerDoor: { bridge: number; stairs: number }
  boardPerDoor: { bridge: number; stairs: number }
  /** Doors in use by size class. Remote stands use stairs. */
  doors: { bridge: Record<SizeClass, number>; stairs: Record<SizeClass, number> }
  /** Boarding groups by size class and minutes between group calls. */
  groups: Record<SizeClass, number>
  groupGapMinutes: number
  /** Gate closes this many minutes before readyBy (scheduled pushback complete). */
  gateCloseMinutes: Record<SizeClass, number>
  doorCloseMinutes: number
  /** Fallback model (used when the terminal sim doesn't feed gate arrivals). */
  noShowRate: number
  lateRate: number
  /** Late batch arrives this many minutes before gate close. */
  lateArrivalBeforeClose: number
  /** Fuelling with passengers on board / boarding (needs fire cover). Off by default. */
  fuelWithPaxOnBoard: boolean
  /** Pax per minute boarding a bus at the gate. */
  busGateLoadPerMin: number
}

export interface HoldConfig {
  /** Belt loader (bulk, narrowbody/regional) and ULD container loader (widebody) rates. */
  bulk: { bagsPerMin: number; kgPerMin: number }
  uld: { bagsPerMin: number; kgPerMin: number }
  /** Pulling a no-show's bag: search time plus per bag. */
  offloadBaseMinutes: number
  offloadPerBagMinutes: number
  /** Fallback: share of outbound bags that reach make-up late. */
  lateBagRate: number
  lateBagsBeforeClose: number
}

export interface LogisticsConfig {
  nodes: RoadNode[]
  edges: RoadEdge[]
  /** Where vehicles park at the start. */
  depotNode: string
  /** Terminal kerb: bag claim drop-off and bus gate. */
  terminalNode: string
  /** Bag sort / make-up area. */
  makeupNode: string
  /** Cargo shed. */
  cargoNode: string
  stands: StandConfig[]
  fuelFarm: FuelFarmConfig
  kitchen: KitchenConfig
  vehicles: Partial<Record<VehicleType, number>>
  vehicleSpecs: Record<VehicleType, VehicleSpec>
  /** Litres per minute through a truck hose. */
  truckPumpLpm: number
  /** Litres per minute through a hydrant dispenser. */
  hydrantPumpLpm: number
  pax: PaxConfig
  hold: HoldConfig
  /** Wear, breakdowns, servicing and facility upkeep. Omit to switch maintenance off. */
  maintenance?: MaintenanceConfig
  /**
   * When set, a vehicle below the aircraft's size tier is not dispatched.
   * The turnaround waits for a matching truck instead of crawling along on a small one.
   */
  strictSizeTiers?: boolean
  /**
   * Apron traffic (reservation + avoidance, see traffic.ts). Vehicles keep a real
   * footprint, park in reserved slots, yield and wait instead of overlapping.
   * Off by default so the timing tests keep their closed-form drive times.
   */
  traffic?: boolean | Partial<import('./traffic').TrafficConfig>
}

export interface TurnaroundNeeds {
  airframeId: string
  sizeClass: SizeClass
  seats: number
  carriesPax: boolean
  bagsPerPax: number
  /** Cargo kg per sector at the default hold factor. */
  cargoKg: number
  loader: 'belt_loader' | 'uld_loader' | 'main_deck_loader' | null
  fuelLitres: number
  meals: number
  cateringMinutes: number
  cleaningMinutes: number
  gpuMinutes: number
  pushbackMinutes: number
  /** A380 / 747-8F / An-124 / C-5: heavy towbarless tug, big loaders. */
  superHeavy: boolean
  /** Upper-deck catering door (A380): needs a high-lift truck. */
  upperDeck: boolean
  /** Simultaneous fuel points (two wings on L-size types). */
  fuelPoints: number
  /** Most bridges the type can use. */
  maxBridgeDoors: number
  /** Services for a full 'turn'. */
  services: ServiceKind[]
}

export interface TurnaroundOptions {
  kind?: FlightKind
  loadFactor?: number
  arrivingPax?: number
  departingPax?: number
  inboundBags?: number
  outboundBags?: number
  inboundCargoKg?: number
  outboundCargoKg?: number
  /** Terminal sim will call paxArrivedAtGate; disables the fallback arrival model. */
  gateFeed?: boolean
  /** Terminal sim will call bagsReadyAtMakeup; disables the fallback bag model. */
  bagFeed?: boolean
  /** Catering module owns the galley truck. Logistics waits, then marks the service done. */
  deferCatering?: boolean
  /** Flight that owns a reserved loader, so the dispatcher can still use that truck here. */
  flightId?: string
}

export type DelayCause =
  | 'no_vehicle'
  | 'no_fuel'
  | 'no_meals'
  | 'no_loader'
  | 'no_bridge'
  | 'boarding_slow'
  | 'late_pax'
  | 'late_bags'
  | 'bag_offload'
  | 'vehicle_breakdown'
  | 'undersized_vehicle'

export type LogisticsEvent =
  | { type: 'truck_arrive'; time: number; vehicleId: string; vehicle: VehicleType; standId: string }
  | { type: 'refuel_start'; time: number; standId: string; litres: number; method: 'truck' | 'hydrant'; vehicleId?: string }
  | { type: 'refuel_stop'; time: number; standId: string; litres: number; method: 'truck' | 'hydrant'; vehicleId?: string }
  | { type: 'service_start'; time: number; standId: string; service: ServiceKind }
  | { type: 'service_done'; time: number; standId: string; service: ServiceKind }
  | { type: 'pax_deplaned'; time: number; standId: string; count: number }
  | { type: 'bags_to_claim'; time: number; standId: string; count: number }
  | { type: 'cargo_to_area'; time: number; standId: string; kg: number }
  | { type: 'gate_closed'; time: number; standId: string; boarded: number; atGate: number }
  | { type: 'pax_offloaded'; time: number; standId: string; count: number; bags: number }
  | { type: 'bags_left_behind'; time: number; standId: string; count: number }
  | { type: 'low_stock'; time: number; stock: 'fuel' | 'meals'; level: number }
  | { type: 'delivery_ordered'; time: number; litres: number; eta: number }
  | { type: 'delivery_arrived'; time: number; litres: number; vehicleId: string }
  | { type: 'turnaround_complete'; time: number; standId: string; turnaroundId: string; delayMinutes: number; causes: DelayCause[] }
  | { type: 'money'; time: number; amount: number; category: MoneyCategory }
  | { type: 'vehicle_breakdown'; time: number; vehicleId: string; vehicle: VehicleType; node: string; condition: number; reason: 'wear' | 'event' }
  | { type: 'vehicle_repaired'; time: number; vehicleId: string; vehicle: VehicleType; inPlace: boolean }
  | { type: 'vehicle_serviced'; time: number; vehicleId: string; vehicle: VehicleType; repair: boolean }
  | { type: 'crew_dispatched'; time: number; crewId: string; crew: CrewType; job: 'repair' | 'tow' | 'facility' | 'inspect'; target: string }
  | { type: 'tow_start'; time: number; crewId: string; vehicleId: string }
  | { type: 'facility_status'; time: number; facilityId: string; kind: FacilityKind; status: FacilityStatus; condition: number }
  | { type: 'facility_repaired'; time: number; facilityId: string; cost: number }
  | { type: 'runway_fod'; time: number; runwayId: string }
  | { type: 'runway_closed'; time: number; runwayId: string; reason: 'fod' | 'inspection' }
  | { type: 'runway_reopened'; time: number; runwayId: string }
  | { type: 'safety_incident'; time: number; what: string; ratingHit: number }
  | { type: 'pax_mood_hit'; time: number; facilityId: string; amount: number }

export type MoneyCategory =
  | 'fuel_sales'
  | 'catering_fees'
  | 'fuel_purchase'
  | 'meal_production'
  | 'vehicle_upkeep'
  | 'maintenance_preventive'
  | 'maintenance_repair'
  | 'maintenance_upkeep'

export interface Ledger {
  fuelSales: number
  cateringFees: number
  fuelPurchase: number
  mealProduction: number
  vehicleUpkeep: number
  maintenancePreventive: number
  maintenanceRepair: number
  maintenanceUpkeep: number
}
