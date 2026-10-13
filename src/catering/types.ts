/**
 * Catering + airside retail supply chain (owner decisions Oct 13):
 * - Catering is a fully visible process: truck drives to stand, crew climbs out,
 *   scissor lift raises to the door, used carts come off, fresh carts go in,
 *   lift lowers, crew re-boards, truck leaves.
 * - Galley stock is tracked per flight.
 * - Airside shops hold stock that depletes and is restocked by supply runs.
 * - Out of stock => thought bubble, mild happiness drop, lost sale, pax walks away.
 * - Bottlenecks only come from player choices (fleet size, kitchen capacity,
 *   reorder thresholds). Nothing here silently tops up stock.
 */

export type MealItem = 'hot_meal' | 'snack_box' | 'drinks'
export const MEAL_ITEMS: readonly MealItem[] = ['hot_meal', 'snack_box', 'drinks']

export type ShopSku = 'burger' | 'coffee' | 'sandwich' | 'water' | 'magazine' | 'souvenir'
export const SHOP_SKUS: readonly ShopSku[] = ['burger', 'coffee', 'sandwich', 'water', 'magazine', 'souvenir']

/** Visible phases of a catering truck job, in order. Renderer animates each. */
export type CateringPhase =
  | 'loading_at_kitchen'
  | 'driving_to_stand'
  | 'parking'
  | 'crew_exit'
  | 'lift_raise'
  | 'carts_out'
  | 'carts_in'
  | 'lift_lower'
  | 'crew_board'
  | 'driving_to_kitchen'
  | 'unloading_at_kitchen'

export const CATERING_PHASES: readonly CateringPhase[] = [
  'loading_at_kitchen',
  'driving_to_stand',
  'parking',
  'crew_exit',
  'lift_raise',
  'carts_out',
  'carts_in',
  'lift_lower',
  'crew_board',
  'driving_to_kitchen',
  'unloading_at_kitchen',
]

/** Visible phases of a shop supply run (landside dock -> airside shop). */
export type SupplyPhase = 'loading_at_depot' | 'driving_to_dock' | 'security_screening' | 'trolley_to_shop' | 'shelving' | 'returning'
export const SUPPLY_PHASES: readonly SupplyPhase[] = [
  'loading_at_depot',
  'driving_to_dock',
  'security_screening',
  'trolley_to_shop',
  'shelving',
  'returning',
]

export type Basket = Record<MealItem, number>

export interface FlightCateringOrder {
  flightId: string
  standId: string
  seats: number
  bookedPax: number
  /** Long-haul flights get hot meals; short-haul snacks only. */
  longHaul: boolean
  /** Sim minute the truck must be done by (departure minus buffer). */
  dueBy: number
}

export interface GalleyState {
  flightId: string
  standId: string
  required: Basket
  loaded: Basket
  /** Used carts still on board from inbound sector (removed during 'carts_out'). */
  usedCartsOnBoard: number
  /** Carts needed for the outbound load. */
  cartsRequired: number
  status: 'waiting' | 'assigned' | 'servicing' | 'complete' | 'short'
  truckId?: string
}

export interface CrewMember {
  id: string
  role: 'driver' | 'helper'
  /** Where the crew member is: in cab, on ground, on lift platform, in galley. */
  at: 'cab' | 'ground' | 'lift' | 'galley'
}

export interface CateringTruck {
  id: string
  crew: CrewMember[]
  phase: CateringPhase | 'idle'
  phaseEndsAt: number
  /** 0..1 lift platform height, for the renderer. */
  liftHeight: number
  /** Fresh carts on the box body. */
  freshCarts: number
  /** Used carts on the box body. */
  usedCarts: number
  cargo: Basket
  job?: string
}

export interface SupplyRunner {
  id: string
  crew: CrewMember[]
  phase: SupplyPhase | 'idle'
  phaseEndsAt: number
  shopId?: string
  load: Partial<Record<ShopSku, number>>
}

export interface ShopConfig {
  id: string
  name: string
  skus: ShopSku[]
  capacityPerSku: number
  /** Player-set: reorder when a SKU falls to this level. 0 disables auto reorder. */
  reorderAt: number
}

export interface ShopState extends ShopConfig {
  stock: Record<ShopSku, number>
  pendingRun: boolean
  salesToday: number
  lostSalesToday: number
}

export interface CateringConfig {
  trucks: number
  supplyRunners: number
  /** Meals the flight kitchen produces per sim minute. Player upgrade. */
  kitchenMealsPerMinute: number
  kitchenCapacity: number
  kitchenInitial: Basket
  /** Landside supply depot stock per SKU (refilled by deliveries, not magic). */
  depotInitialPerSku: number
  depotRestockPerDay: number
  cartsPerPaxDivisor: number
  durations: Record<CateringPhase, number>
  supplyDurations: Record<SupplyPhase, number>
  /** Happiness hit for an out-of-stock wish (mild). */
  outOfStockHappiness: number
  prices: Record<ShopSku, number>
}

export type CateringEvent =
  | { type: 'catering_phase'; time: number; truckId: string; flightId: string; standId: string; phase: CateringPhase; crew: CrewMember[]; liftHeight: number }
  | { type: 'catering_done'; time: number; flightId: string; standId: string; loaded: Basket; short: boolean }
  | { type: 'catering_late'; time: number; flightId: string; reason: 'no_truck' | 'no_meals' }
  | { type: 'supply_phase'; time: number; runnerId: string; shopId: string; phase: SupplyPhase }
  | { type: 'shop_restocked'; time: number; shopId: string; added: Partial<Record<ShopSku, number>> }
  | { type: 'shop_sale'; time: number; shopId: string; sku: ShopSku; paxId: string; amount: number }
  | { type: 'shop_out_of_stock'; time: number; shopId: string; sku: ShopSku; paxId: string; thought: string; happinessDelta: number; lostSale: number }
  | { type: 'pax_walk_away'; time: number; shopId: string; paxId: string }
  | { type: 'low_stock'; time: number; stock: 'meals' | 'depot'; level: number }

export type PurchaseResult =
  | { ok: true; amount: number }
  | { ok: false; thought: string; happinessDelta: number; walkAway: true; lostSale: number }
