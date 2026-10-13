/** Shared types for the ground-logistics module. All times are in sim minutes. */

export type VehicleType = 'fuel_truck' | 'catering_truck' | 'baggage_tug' | 'pushback_tug' | 'gpu'

export const VEHICLE_TYPES: readonly VehicleType[] = [
  'fuel_truck',
  'catering_truck',
  'baggage_tug',
  'pushback_tug',
  'gpu',
]

export type ServiceKind = 'fuel' | 'catering' | 'baggage' | 'gpu' | 'pushback'

export type SizeClass = 'S' | 'M' | 'L'

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
}

export interface FuelFarmConfig {
  node: string
  capacityLitres: number
  initialLitres: number
  /** Below this the farm raises a low-stock alert. */
  lowStockLitres: number
  /** What the airport pays the supplier per litre. */
  purchasePricePerLitre: number
  /** Fraction added on top of purchase price when selling to airlines (0.15 = 15%). */
  markup: number
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
  /** Litres for fuel trucks, meals for catering trucks, 0 otherwise. */
  capacity: number
  /** Minutes to fill up at the farm or kitchen. */
  loadMinutes: number
}

export interface LogisticsConfig {
  nodes: RoadNode[]
  edges: RoadEdge[]
  /** Where vehicles park at the start. */
  depotNode: string
  stands: StandConfig[]
  fuelFarm: FuelFarmConfig
  kitchen: KitchenConfig
  vehicles: Partial<Record<VehicleType, number>>
  vehicleSpecs: Record<VehicleType, VehicleSpec>
  /** Litres per minute through a truck hose. */
  truckPumpLpm: number
  /** Litres per minute through a hydrant dispenser. */
  hydrantPumpLpm: number
}

export interface TurnaroundNeeds {
  airframeId: string
  sizeClass: SizeClass
  fuelLitres: number
  meals: number
  /** Service minutes per non-fuel service (fuel time comes from the pump rate). */
  cateringMinutes: number
  baggageMinutes: number
  gpuMinutes: number
  pushbackMinutes: number
  services: ServiceKind[]
}

export type DelayCause = 'no_vehicle' | 'no_fuel' | 'no_meals'

export type LogisticsEvent =
  | { type: 'truck_arrive'; time: number; vehicleId: string; vehicle: VehicleType; standId: string }
  | { type: 'refuel_start'; time: number; standId: string; litres: number; method: 'truck' | 'hydrant'; vehicleId?: string }
  | { type: 'refuel_stop'; time: number; standId: string; litres: number; method: 'truck' | 'hydrant'; vehicleId?: string }
  | { type: 'service_done'; time: number; standId: string; service: ServiceKind }
  | { type: 'low_stock'; time: number; stock: 'fuel' | 'meals'; level: number }
  | { type: 'delivery_ordered'; time: number; litres: number; eta: number }
  | { type: 'delivery_arrived'; time: number; litres: number; vehicleId: string }
  | { type: 'turnaround_complete'; time: number; standId: string; turnaroundId: string; delayMinutes: number; causes: DelayCause[] }
  | { type: 'money'; time: number; amount: number; category: MoneyCategory }

export type MoneyCategory = 'fuel_sales' | 'catering_fees' | 'fuel_purchase' | 'meal_production' | 'vehicle_upkeep'

export interface Ledger {
  fuelSales: number
  cateringFees: number
  fuelPurchase: number
  mealProduction: number
  vehicleUpkeep: number
}
