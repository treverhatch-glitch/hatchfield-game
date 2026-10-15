import type { ResearchId } from '../game/types'
import { BARGE } from '../fuel/barge.ts'
import { PIPELINE } from '../fuel/pipeline.ts'
import type { VehicleType } from '../logistics/types'
import type { BagSystemId, PaxUnit, SizeTier } from './types'

export const TIER_RANK: Record<SizeTier, number> = { small: 0, wide: 1, jumbo: 2 }

/** One real second is eight game minutes (one game hour ≈ 7.5 seconds). */
export const GAME_MINUTES_PER_SECOND = 8

export interface TierDemand {
  id: SizeTier
  label: string
  fieldLevel: number
  research: ResearchId | null
  /** Example metal, used by the advisor. */
  example: string
  /** Passengers that must clear check-in and security for one turn. */
  paxPerMin: number
  bagsPerMin: number
  /** Usable uplift the tank and the contract must cover, litres. */
  fuelLitres: number
  /**
   * Jet-bridge doors the turn requires.
   * Small metal walks or rides a bus. A bridge is faster, not a gate.
   */
  bridges: number
  /** Carts in the train. A small tug is not a substitute for a heavy one. */
  bagCarts: number
  /** Bulk supply the jumbo tier will not accept from road tankers. */
  supply: 'road' | 'rail'
  /** Hydrant pits, not just a bigger truck. */
  hydrant: boolean
}

export const SIZE_TIERS: Record<SizeTier, TierDemand> = {
  small: {
    id: 'small',
    label: 'Small',
    fieldLevel: 1,
    research: null,
    example: 'b738',
    paxPerMin: 14,
    bagsPerMin: 12,
    fuelLitres: 16_000,
    bridges: 0,
    bagCarts: 2,
    supply: 'road',
    hydrant: false,
  },
  wide: {
    id: 'wide',
    label: 'Widebody',
    fieldLevel: 4,
    research: 'widebody_ops',
    example: 'b789',
    paxPerMin: 28,
    bagsPerMin: 36,
    fuelLitres: 120_000,
    bridges: 2,
    bagCarts: 6,
    supply: 'road',
    hydrant: false,
  },
  jumbo: {
    id: 'jumbo',
    label: 'Jumbo',
    fieldLevel: 5,
    research: 'heavy_pack',
    example: 'a380',
    paxPerMin: 48,
    bagsPerMin: 70,
    fuelLitres: 190_000,
    bridges: 3,
    bagCarts: 12,
    supply: 'rail',
    hydrant: true,
  },
}

/** 787 / 777 / A350 class, plus the mid freighter. */
export const WIDE_AIRFRAMES = ['b789', 'a359', 'b77w', 'b763f', 'c17'] as const

/** A380 class and the other code-F heavies. */
export const JUMBO_AIRFRAMES = ['a380', 'an124', 'b748f', 'c5'] as const

/**
 * Largest aircraft a vehicle may serve.
 * A higher tier still serves everything below it.
 * GPU and apron buses are not part of the size ladder.
 */
export const VEHICLE_TIER: Record<VehicleType, SizeTier> = {
  fuel_truck: 'small',
  baggage_tug: 'small',
  belt_loader: 'small',
  gpu: 'small',
  pax_bus: 'small',
  pushback_tug: 'wide',
  catering_truck: 'wide',
  heavy_fuel_truck: 'wide',
  uld_loader: 'wide',
  heavy_baggage_tug: 'jumbo',
  hydrant_dispenser: 'jumbo',
  highlift_catering: 'jumbo',
  main_deck_loader: 'jumbo',
  heavy_tug: 'jumbo',
  lavatory_truck: 'small',
  water_truck: 'small',
}

/** Vehicles that do not have to match the aircraft tier. */
export const TIER_FREE: VehicleType[] = ['gpu', 'pax_bus', 'lavatory_truck', 'water_truck']

export const CARTS_PER_VEHICLE: Partial<Record<VehicleType, number>> = {
  baggage_tug: 2,
  heavy_baggage_tug: 6,
}

export interface VehicleOffer {
  type: VehicleType
  tier: SizeTier
  fieldLevel: number
  research: ResearchId | null
  role: string
}

export const VEHICLE_OFFERS: VehicleOffer[] = [
  { type: 'heavy_fuel_truck', tier: 'wide', fieldLevel: 4, research: 'widebody_ops', role: 'Fuel' },
  { type: 'uld_loader', tier: 'wide', fieldLevel: 4, research: 'widebody_ops', role: 'Loader' },
  { type: 'heavy_baggage_tug', tier: 'jumbo', fieldLevel: 4, research: 'widebody_ops', role: 'Bags' },
  { type: 'hydrant_dispenser', tier: 'jumbo', fieldLevel: 5, research: 'hydrant_fuel', role: 'Fuel' },
  { type: 'highlift_catering', tier: 'jumbo', fieldLevel: 5, research: 'heavy_pack', role: 'Catering' },
  { type: 'main_deck_loader', tier: 'jumbo', fieldLevel: 5, research: 'heavy_pack', role: 'Loader' },
  { type: 'heavy_tug', tier: 'jumbo', fieldLevel: 5, research: 'heavy_pack', role: 'Tug' },
]

/**
 * Trucks the first fuel farm implies, before a depot exists.
 * Keeps the opening narrowbody turn on the small pillar.
 */
export const SMALL_SERVICE_KIT: Partial<Record<VehicleType, number>> = {
  fuel_truck: 1,
  catering_truck: 1,
  baggage_tug: 1,
  pushback_tug: 1,
  gpu: 1,
  belt_loader: 1,
}

/** What one vehicle depot grants before the player buys heavy kit. */
export const DEPOT_GRANT: Partial<Record<VehicleType, number>> = {
  fuel_truck: 2,
  catering_truck: 2,
  baggage_tug: 3,
  pushback_tug: 2,
  gpu: 2,
  pax_bus: 2,
  belt_loader: 2,
  lavatory_truck: 1,
  water_truck: 1,
}

export interface FuelContractDef {
  id: string
  name: string
  tier: SizeTier
  fieldLevel: number
  research: ResearchId | null
  sign: number
  /** Dollars per litre, paid when a delivery is accepted. */
  wholesalePerLitre: number
  /** Litres in one road tanker. */
  tankerLitres: number
  /** Game minutes from order to the farm gate. */
  leadMinutes: number
  /** Litres per game hour once the rail chain is connected. */
  railLitresPerHour: number
  upkeepPerDay: number
}

export const FUEL_CONTRACTS: FuelContractDef[] = [
  {
    id: 'apex_local',
    name: 'Apex Local',
    tier: 'small',
    fieldLevel: 1,
    research: null,
    sign: 3_500,
    wholesalePerLitre: 0.02,
    tankerLitres: 36_000,
    leadMinutes: 90,
    railLitresPerHour: 40_000,
    upkeepPerDay: 80,
  },
  {
    id: 'kiln_regional',
    name: 'Kiln Regional',
    tier: 'small',
    fieldLevel: 2,
    research: null,
    sign: 8_000,
    wholesalePerLitre: 0.017,
    tankerLitres: 72_000,
    leadMinutes: 80,
    railLitresPerHour: 70_000,
    upkeepPerDay: 140,
  },
  {
    id: 'trunk_wide',
    name: 'Trunk Widebody',
    tier: 'wide',
    fieldLevel: 4,
    research: 'widebody_ops',
    sign: 22_000,
    wholesalePerLitre: 0.015,
    tankerLitres: 160_000,
    leadMinutes: 70,
    railLitresPerHour: 140_000,
    upkeepPerDay: 320,
  },
  {
    id: 'mega_jumbo',
    name: 'Mega Jumbo',
    tier: 'jumbo',
    fieldLevel: 5,
    research: 'heavy_pack',
    sign: 48_000,
    wholesalePerLitre: 0.012,
    tankerLitres: 420_000,
    leadMinutes: 60,
    railLitresPerHour: 280_000,
    upkeepPerDay: 640,
  },
]

export interface TankTierDef {
  tier: 1 | 2 | 3
  capacityLitres: number
  cost: number
  upkeepPerDay: number
  fieldLevel: number
  research: ResearchId | null
}

export const TANK_TIERS: TankTierDef[] = [
  { tier: 1, capacityLitres: 80_000, cost: 0, upkeepPerDay: 180, fieldLevel: 1, research: null },
  {
    tier: 2,
    capacityLitres: 480_000,
    cost: 52_000,
    upkeepPerDay: 640,
    fieldLevel: 4,
    research: 'tank_farm_ii',
  },
  {
    tier: 3,
    capacityLitres: 1_600_000,
    cost: 140_000,
    upkeepPerDay: 1_500,
    fieldLevel: 5,
    research: 'tank_farm_iii',
  },
]

export const HYDRANT_UPKEEP_PER_DAY = 420

export interface BagSystemDef {
  id: BagSystemId
  name: string
  tier: SizeTier
  fieldLevel: number
  research: ResearchId | null
  cost: number
  upkeepPerDay: number
  bagsPerMin: number
  /** Early-bag storage, bag units. Only the automated system has a real store. */
  earlyStore: number
}

export const BAG_SYSTEMS: Record<BagSystemId, BagSystemDef> = {
  carts: {
    id: 'carts',
    name: 'Manual carts',
    tier: 'small',
    fieldLevel: 1,
    research: null,
    cost: 0,
    upkeepPerDay: 40,
    bagsPerMin: 14,
    earlyStore: 0,
  },
  sorter: {
    id: 'sorter',
    name: 'Belts and sorter',
    tier: 'wide',
    fieldLevel: 3,
    research: 'bag_sorter',
    cost: 24_000,
    upkeepPerDay: 280,
    bagsPerMin: 42,
    earlyStore: 80,
  },
  bhs: {
    id: 'bhs',
    name: 'Automated baggage system',
    tier: 'jumbo',
    fieldLevel: 5,
    research: 'bag_bhs',
    cost: 86_000,
    upkeepPerDay: 900,
    bagsPerMin: 120,
    earlyStore: 900,
  },
}

export const BAG_ORDER: BagSystemId[] = ['carts', 'sorter', 'bhs']

export interface PaxUnitDef {
  id: PaxUnit
  name: string
  fieldLevel: number
  research: ResearchId | null
  cost: number
  upkeepPerDay: number
  /** Check-in or security passengers per minute. Bag drop is bags per minute. */
  perMin: number
  channel: 'checkin' | 'security' | 'bags'
}

export const PAX_UNITS: Record<PaxUnit, PaxUnitDef> = {
  desk: {
    id: 'desk',
    name: 'Check-in desk',
    fieldLevel: 1,
    research: null,
    cost: 2_400,
    upkeepPerDay: 35,
    perMin: 8,
    channel: 'checkin',
  },
  kiosk: {
    id: 'kiosk',
    name: 'Self-service kiosk',
    fieldLevel: 2,
    research: 'self_service',
    cost: 1_800,
    upkeepPerDay: 12,
    perMin: 6,
    channel: 'checkin',
  },
  bagdrop: {
    id: 'bagdrop',
    name: 'Bag drop',
    fieldLevel: 2,
    research: 'self_service',
    cost: 2_200,
    upkeepPerDay: 18,
    perMin: 8,
    channel: 'bags',
  },
  scanner: {
    id: 'scanner',
    name: 'Scanner lane',
    fieldLevel: 3,
    research: 'ct_lanes',
    cost: 6_400,
    upkeepPerDay: 55,
    perMin: 18,
    channel: 'security',
  },
  egate: {
    id: 'egate',
    name: 'E-gate',
    fieldLevel: 5,
    research: 'egates',
    cost: 9_000,
    upkeepPerDay: 40,
    perMin: 28,
    channel: 'security',
  },
}

/** Walking speed, metres per second, before a moving walkway. */
export const WALK_METRES_PER_SEC = 1.4

export const MOVE_SPEED: Record<'walk' | 'travelator' | 'skywalk' | 'mover', number> = {
  walk: 1,
  travelator: 1.65,
  skywalk: 1.15,
  mover: 2.6,
}

/** Pathfinding cost. Lower means passengers prefer the tile. */
export const MOVE_STEP_COST: Record<'travelator' | 'skywalk' | 'mover', number> = {
  travelator: 0.6,
  skywalk: 0.85,
  mover: 0.35,
}

export interface BuildOffer {
  id: string
  name: string
  tier: SizeTier
  fieldLevel: number
  research: ResearchId | null
  cost: number
  upkeepPerDay: number
  bridges: number
}

export const STAND_OFFERS: Record<'small' | 'wide' | 'jumbo', BuildOffer> = {
  small: {
    id: 'stand',
    name: 'Medium stand',
    tier: 'small',
    fieldLevel: 1,
    research: null,
    cost: 6_200,
    upkeepPerDay: 40,
    bridges: 1,
  },
  wide: {
    id: 'stand_w',
    name: 'Wide stand',
    tier: 'wide',
    fieldLevel: 4,
    research: 'widebody_ops',
    cost: 16_000,
    upkeepPerDay: 90,
    bridges: 2,
  },
  jumbo: {
    id: 'stand_l',
    name: 'Jumbo stand',
    tier: 'jumbo',
    fieldLevel: 5,
    research: 'heavy_pack',
    cost: 28_000,
    upkeepPerDay: 160,
    bridges: 3,
  },
}

/**
 * Door clearance for each hangar tier. Span and tail are the design aircraft
 * (A320, A350-900, A380). The lot is the cell count the mesh is built across.
 */
export const HANGAR_DESIGN: Record<SizeTier, { spanM: number; tailM: number; lot: number }> = {
  small: { spanM: 35.8, tailM: 11.8, lot: 3 },
  wide: { spanM: 64.8, tailM: 17.1, lot: 4 },
  jumbo: { spanM: 79.8, tailM: 24.1, lot: 5 },
}

/** Metres of clearance each side of the span, and above the tail. */
export const HANGAR_SIDE_CLEAR_M = 1
export const HANGAR_HEAD_CLEAR_M = 1

export const HANGAR_OFFERS: Record<SizeTier, BuildOffer> = {
  small: {
    id: 'hangar',
    name: 'Line hangar',
    tier: 'small',
    fieldLevel: 1,
    research: null,
    cost: 14_000,
    upkeepPerDay: 260,
    bridges: 0,
  },
  wide: {
    id: 'hangar_w',
    name: 'Widebody hangar',
    tier: 'wide',
    fieldLevel: 4,
    research: 'widebody_ops',
    cost: 46_000,
    upkeepPerDay: 720,
    bridges: 0,
  },
  jumbo: {
    id: 'hangar_j',
    name: 'Jumbo hangar',
    tier: 'jumbo',
    fieldLevel: 5,
    research: 'heavy_pack',
    cost: 110_000,
    upkeepPerDay: 1_600,
    bridges: 0,
  },
}

export const LINK_OFFERS = {
  fuel_rail: {
    name: 'Fuel rail',
    fieldLevel: 5,
    research: 'rail_fuel' as ResearchId,
    cost: 1_400,
    upkeepPerDay: 35,
  },
  oil: {
    name: 'Oil transfer station',
    fieldLevel: 5,
    research: 'rail_fuel' as ResearchId,
    cost: 64_000,
    upkeepPerDay: 480,
  },
  fuel_pipe: {
    name: 'Fuel pipeline',
    fieldLevel: 5,
    research: 'pipeline_fuel' as ResearchId,
    cost: 0,
    upkeepPerDay: PIPELINE.tileUpkeepPerDay,
  },
  manifold: {
    name: 'Receipt manifold',
    fieldLevel: 5,
    research: 'pipeline_fuel' as ResearchId,
    cost: 0,
    upkeepPerDay: PIPELINE.manifoldUpkeepPerDay,
  },
  berth: {
    name: 'Barge berth',
    fieldLevel: 5,
    research: 'rail_fuel' as ResearchId,
    cost: BARGE.berthCost,
    upkeepPerDay: BARGE.berthUpkeepPerDay,
  },
  travelator: {
    name: 'Travelator',
    fieldLevel: 3,
    research: 'travelator' as ResearchId,
    cost: 3_500,
    upkeepPerDay: 25,
    tier: 'wide' as SizeTier,
  },
  skywalk: {
    name: 'Skywalk',
    fieldLevel: 4,
    research: 'skywalk' as ResearchId,
    cost: 8_000,
    upkeepPerDay: 60,
    tier: 'wide' as SizeTier,
  },
  mover: {
    name: 'People mover',
    fieldLevel: 5,
    research: 'people_mover' as ResearchId,
    cost: 22_000,
    upkeepPerDay: 180,
    tier: 'jumbo' as SizeTier,
  },
}

export const RESEARCH_COSTS = {
  widebody_ops: 48,
  hydrant_fuel: 36,
  rail_fuel: 44,
  tank_farm_ii: 30,
  tank_farm_iii: 46,
  bag_sorter: 32,
  bag_bhs: 58,
  self_service: 22,
  ct_lanes: 28,
  egates: 40,
  travelator: 26,
  skywalk: 34,
  people_mover: 52,
} as const

/** Bridges a stand rating provides when the stand is a jetway. */
export const BRIDGES_FOR: Record<SizeTier, number> = { small: 1, wide: 2, jumbo: 3 }

/** Litres already on the farm for each legacy bowser load. */
export const LITRES_PER_LEGACY_LOAD = 20_000
