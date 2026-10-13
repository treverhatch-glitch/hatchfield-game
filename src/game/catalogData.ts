import costsJson from '../data/costs.json' with { type: 'json' }
import airlinesJson from '../data/airlines.json' with { type: 'json' }
import buildingsJson from '../data/buildings.json' with { type: 'json' }
import terminalJson from '../data/terminal.json' with { type: 'json' }
import type {
  Airline,
  AirlinePersona,
  AirlineRewardId,
  AirlineTier,
  BudgetKey,
  BuildDef,
  CaterContract,
  FuelContract,
  LandSite,
  LoanProduct,
  ResearchId,
  RoomDef,
  Tool,
} from './types.ts'
import type { FieldTaskKind } from './types.ts'

export interface ResearchNode {
  id: ResearchId
  name: string
  cost: number
  blurb: string
  requires?: ResearchId
}

export interface FieldTaskDef {
  kind: FieldTaskKind
  title: string
  blurb: string
  bonus: number
  personas?: AirlinePersona[]
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`catalog ${label} must be a finite number`)
  }
  return value
}

function table(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`catalog ${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`catalog ${label} must be a non-empty list`)
  }
  return value
}

function triple(value: readonly number[], label: string): readonly [number, number, number] {
  if (value.length !== 3) throw new Error(`catalog ${label} must have 3 entries`)
  return [value[0], value[1], value[2]]
}

function sextuple(
  value: readonly number[],
  label: string,
): readonly [number, number, number, number, number, number] {
  if (value.length !== 6) throw new Error(`catalog ${label} must have 6 entries`)
  return [value[0], value[1], value[2], value[3], value[4], value[5]]
}

export interface CatalogParts {
  costs: typeof costsJson
  airlines: typeof airlinesJson
  buildings: typeof buildingsJson
  terminal: typeof terminalJson
}

export interface CatalogInput {
  costs: unknown
  airlines: unknown
  buildings: unknown
  terminal: unknown
}

/** Checks the JSON shape, then returns the four files unchanged. */
export function loadCatalog(parts: CatalogInput = {
  costs: costsJson,
  airlines: airlinesJson,
  buildings: buildingsJson,
  terminal: terminalJson,
}): CatalogParts {
  const costs = table(parts.costs, 'costs')
  const start = table(costs.START_CASH, 'START_CASH')
  finite(start.easy, 'START_CASH.easy')
  finite(start.standard, 'START_CASH.standard')
  const land = table(costs.LAND, 'LAND')
  finite(table(land.city, 'LAND.city').cost, 'LAND.city.cost')
  finite(table(land.factory, 'LAND.factory').cost, 'LAND.factory.cost')
  const xp = list(costs.FIELD_LEVEL_XP, 'FIELD_LEVEL_XP')
  if (xp.length !== 6) throw new Error('catalog FIELD_LEVEL_XP must have 6 entries')
  for (const n of xp) finite(n, 'FIELD_LEVEL_XP')
  const airlines = table(table(parts.airlines, 'airlines').AIRLINES, 'AIRLINES')
  if (!airlines.northline) throw new Error('catalog AIRLINES is missing northline')
  const buildings = table(parts.buildings, 'buildings')
  list(buildings.BUILDINGS, 'BUILDINGS')
  const terminal = table(parts.terminal, 'terminal')
  list(terminal.ROOMS, 'ROOMS')
  list(terminal.RESEARCH_NODES, 'RESEARCH_NODES')
  list(terminal.LOAN_PRODUCTS, 'LOAN_PRODUCTS')
  list(terminal.FIELD_TASK_DEFS, 'FIELD_TASK_DEFS')
  table(terminal.FUEL, 'FUEL')
  table(terminal.CATER, 'CATER')
  return parts as CatalogParts
}

const loaded = loadCatalog()
const costs = loaded.costs
const airlines = loaded.airlines
const buildings = loaded.buildings
const terminal = loaded.terminal


const parkExpense = costs.PARK_EXPENSE
const hotelClassExpense = costs.HOTEL_CLASS_EXPENSE

export const ABANDON_ACC_SECONDS = costs.ABANDON_ACC_SECONDS
export const ABANDON_FINE = costs.ABANDON_FINE
export const AIR_AMBULANCE_FEE = costs.AIR_AMBULANCE_FEE
export const BAGS_COST = costs.BAGS_COST
export const BAG_DROP_PAY = costs.BAG_DROP_PAY
export const BELT_COST = costs.BELT_COST
export const BUDGET_BASE = costs.BUDGET_BASE as Record<BudgetKey, number>
export const BUDGET_BLURB = costs.BUDGET_BLURB as Record<BudgetKey, string>
export const BUDGET_LABEL = costs.BUDGET_LABEL as Record<BudgetKey, string>
export const BULLDOZE_REFUND = costs.BULLDOZE_REFUND
export const BUS_CURB_COST = costs.BUS_CURB_COST
export const BUS_EXPENSE = costs.BUS_EXPENSE
export const BUS_FARE = costs.BUS_FARE
export const CARGO_COST = costs.CARGO_COST
export const CARGO_INTAKE_FEE = costs.CARGO_INTAKE_FEE
export const CARGO_STANDING_LABEL = costs.CARGO_STANDING_LABEL
export const CARGO_VOLUME_COOL = costs.CARGO_VOLUME_COOL
export const CARGO_VOLUME_FAIL_FINE = costs.CARGO_VOLUME_FAIL_FINE
export const CARGO_VOLUME_FEE_MAX = costs.CARGO_VOLUME_FEE_MAX
export const CARGO_VOLUME_FEE_MIN = costs.CARGO_VOLUME_FEE_MIN
export const CARGO_WAREHOUSE_CAP = costs.CARGO_WAREHOUSE_CAP
export const CARPARK_LONG_COST = costs.CARPARK_LONG_COST
export const CARPARK_LONG_INCOME = costs.CARPARK_LONG_INCOME
export const CARPARK_META_EXPENSE_LONG = costs.CARPARK_META_EXPENSE_LONG
export const CARPARK_META_EXPENSE_SHORT = costs.CARPARK_META_EXPENSE_SHORT
export const CARPARK_SHORT_COST = costs.CARPARK_SHORT_COST
export const CARPARK_SHORT_INCOME = costs.CARPARK_SHORT_INCOME
export const CLEANING_FEE = costs.CLEANING_FEE
export const DEFAULT_BUDGETS = costs.DEFAULT_BUDGETS as Record<BudgetKey, number>
export const DEICE_FEE = costs.DEICE_FEE
export const DEICE_PAD_COST = costs.DEICE_PAD_COST
export const DEPOT_COST = costs.DEPOT_COST
export const DESK_STAFF_HIRE = costs.DESK_STAFF_HIRE
export const DESK_STAFF_WAGE = costs.DESK_STAFF_WAGE
export const DIVERT_FEE_MAX = costs.DIVERT_FEE_MAX
export const DIVERT_FEE_MIN = costs.DIVERT_FEE_MIN
export const EMERGENCY_FAIL_FINE = costs.EMERGENCY_FAIL_FINE
export const EMERGENCY_REFUSE_FINE = costs.EMERGENCY_REFUSE_FINE
export const FIELD_LEVEL_XP = sextuple(costs.FIELD_LEVEL_XP, 'FIELD_LEVEL_XP')
export const FIELD_TASK_COOL = costs.FIELD_TASK_COOL
export const FIELD_TASK_DEADLINE = costs.FIELD_TASK_DEADLINE
export const FIELD_TASK_FAIL_FINE = costs.FIELD_TASK_FAIL_FINE
export const FIELD_TASK_HEAT_FAIL = costs.FIELD_TASK_HEAT_FAIL
export const FIELD_TASK_HEAT_OK = costs.FIELD_TASK_HEAT_OK
export const FIRE_COST = costs.FIRE_COST
export const FUEL_COST = costs.FUEL_COST
export const GA_LEAVE_WINDOW = costs.GA_LEAVE_WINDOW
export const GA_OVERSTAY_FINE = costs.GA_OVERSTAY_FINE
export const GA_PARK_DAY_RATE = costs.GA_PARK_DAY_RATE
export const GA_PARK_FEE_MAX = costs.GA_PARK_FEE_MAX
export const GA_PARK_FEE_MIN = costs.GA_PARK_FEE_MIN
export const GA_PARK_RATE_COOL = costs.GA_PARK_RATE_COOL
export const GA_PARK_STAY_MAX = costs.GA_PARK_STAY_MAX
export const GA_PARK_STAY_MIN = costs.GA_PARK_STAY_MIN
export const GUARD_COST = costs.GUARD_COST
export const HALL_AMENITY_EXPENSE = costs.HALL_AMENITY_EXPENSE as Partial<Record<'dayhotel' | 'spa' | 'pool' | 'golf' | 'waterfall' | 'gaming' | 'lounge' | 'souvenir' | 'food', number>>
export const HALL_SCRUB_COST = costs.HALL_SCRUB_COST
export const HANGAR_COST = costs.HANGAR_COST
export const HEAT_ABANDON_THRESHOLD = costs.HEAT_ABANDON_THRESHOLD
export const HEAT_BAN_THRESHOLD = costs.HEAT_BAN_THRESHOLD
export const HEAT_REWARD_THRESHOLD = costs.HEAT_REWARD_THRESHOLD
export const HEAT_WARN_THRESHOLD = costs.HEAT_WARN_THRESHOLD
export const HEAVY_RUNWAY_COST = costs.HEAVY_RUNWAY_COST
export const HEAVY_RUNWAY_LEN = costs.HEAVY_RUNWAY_LEN
export const HEAVY_RUNWAY_WID = costs.HEAVY_RUNWAY_WID
export const HELIPAD_COST = costs.HELIPAD_COST
export const HELO_LANDING = costs.HELO_LANDING
export const HOTEL_BIZ_COST = costs.HOTEL_BIZ_COST
export const HOTEL_CLASS_EXPENSE = costs.HOTEL_CLASS_EXPENSE as Record<'inn' | 'business' | 'resort', number>
export const HOTEL_CLASS_FEE = costs.HOTEL_CLASS_FEE as Record<'inn' | 'business' | 'resort', number>
export const HOTEL_CLASS_INCOME = hotelClassExpense as Record<'inn' | 'business' | 'resort', number>
export const HOTEL_COST = costs.HOTEL_COST
export const HOTEL_COST_L2 = costs.HOTEL_COST_L2
export const HOTEL_INCOME = triple(costs.HOTEL_INCOME, 'HOTEL_INCOME')
export const HOTEL_INN_COST = costs.HOTEL_INN_COST
export const HOTEL_META_EXPENSE = triple(costs.HOTEL_META_EXPENSE, 'HOTEL_META_EXPENSE')
export const HOTEL_NIGHT_FEE = costs.HOTEL_NIGHT_FEE
export const HOTEL_RESORT_COST = costs.HOTEL_RESORT_COST
export const HOTEL_TILE_COST = costs.HOTEL_BIZ_COST
export const HOTEL_TILE_INCOME = costs.HOTEL_TILE_INCOME
export const HUB_BAN_THRESHOLD = costs.HUB_BAN_THRESHOLD
export const HUB_FEE_MAX = costs.HUB_FEE_MAX
export const HUB_FEE_MIN = costs.HUB_FEE_MIN
export const HUB_HEAT_NEED = costs.HUB_HEAT_NEED
export const HUB_LAYOVER_WINS = costs.HUB_LAYOVER_WINS
export const IPO_FOUNDER_SHARES = costs.IPO_FOUNDER_SHARES
export const IPO_LISTING_FEE = costs.IPO_LISTING_FEE
export const IPO_MIN_CASH = costs.IPO_MIN_CASH
export const IPO_MIN_FLIGHTS = costs.IPO_MIN_FLIGHTS
export const IPO_MIN_REP = costs.IPO_MIN_REP
export const IPO_SHARES = costs.IPO_SHARES
export const JANITOR_HIRE = costs.JANITOR_HIRE
export const JANITOR_WAGE = costs.JANITOR_WAGE
export const JETWAY_RANGE = costs.JETWAY_RANGE
export const KITCHEN_COST = costs.KITCHEN_COST
export const LAND = costs.LAND as Record<'city' | 'factory', LandSite>
export const LAYOVER_BAN_FINE = costs.LAYOVER_BAN_FINE
export const LAYOVER_BAN_SECONDS = costs.LAYOVER_BAN_SECONDS
export const LAYOVER_FEE_MAX = costs.LAYOVER_FEE_MAX
export const LAYOVER_FEE_MIN = costs.LAYOVER_FEE_MIN
export const LOADS_PER_BUY = costs.LOADS_PER_BUY
export const LOAN_FEE = costs.LOAN_FEE
export const LOAN_INTEREST = costs.LOAN_INTEREST
export const LOAN_INTEREST_EVERY = costs.LOAN_INTEREST_EVERY
export const LOAN_PRINCIPAL = costs.LOAN_PRINCIPAL
export const MECHANIC_HIRE = costs.MECHANIC_HIRE
export const MECHANIC_WAGE = costs.MECHANIC_WAGE
export const MIL_AGREE_COST = costs.MIL_AGREE_COST
export const MIL_LANDING = costs.MIL_LANDING
export const MIL_RAMP_RANGE = costs.MIL_RAMP_RANGE
export const MIN_RUNWAY = costs.MIN_RUNWAY
export const PARCEL_COST = costs.PARCEL_COST
export const PARK_EXPENSE = costs.PARK_EXPENSE as Record<'park_s' | 'park_l' | 'park_g' | 'park_u', { short: number; long: number }>
export const PARK_G_COST = costs.PARK_G_COST
export const PARK_INCOME = parkExpense as Record<'park_s' | 'park_l' | 'park_g' | 'park_u', { short: number; long: number }>
export const PARK_LONG_FEE = costs.PARK_LONG_FEE
export const PARK_L_COST = costs.PARK_L_COST
export const PARK_SHORT_FEE = costs.PARK_SHORT_FEE
export const PARK_S_COST = costs.PARK_S_COST
export const PARK_USE_FEE = costs.PARK_USE_FEE as Record<'park_s' | 'park_l' | 'park_g' | 'park_u', { short: number; long: number }>
export const PARK_U_COST = costs.PARK_U_COST
export const POLICE_COST = costs.POLICE_COST
export const PREMADE_TERMINAL_COST = costs.PREMADE_TERMINAL_COST
export const RAIL_CITY_COST = costs.RAIL_CITY_COST
export const RAIL_EXPENSE = costs.RAIL_EXPENSE
export const RAIL_FARE = costs.RAIL_FARE
export const RAIL_STATION_COST = costs.RAIL_STATION_COST
export const RESEARCHER_HIRE = costs.RESEARCHER_HIRE
export const RESEARCHER_WAGE = costs.RESEARCHER_WAGE
export const ROAD_COST = costs.ROAD_COST
export const RP_PER_50_PAX = costs.RP_PER_50_PAX
export const RP_PER_FLIGHT = costs.RP_PER_FLIGHT
export const RP_RATE_BARE = costs.RP_RATE_BARE
export const RP_RATE_BOARD = costs.RP_RATE_BOARD
export const RP_RATE_DESK = costs.RP_RATE_DESK
export const RP_RATE_MACHINE = costs.RP_RATE_MACHINE
export const RUNWAY_PREFAB_COST = costs.RUNWAY_PREFAB_COST
export const RUNWAY_PREFAB_LEN = costs.RUNWAY_PREFAB_LEN
export const RUNWAY_PREFAB_WID = costs.RUNWAY_PREFAB_WID
export const SHORT_RUNWAY_COST = costs.SHORT_RUNWAY_COST
export const SHORT_RUNWAY_LEN = costs.SHORT_RUNWAY_LEN
export const SHORT_RUNWAY_WID = costs.SHORT_RUNWAY_WID
export const SNACK_COST = costs.SNACK_COST
export const STANDING_LABEL = costs.STANDING_LABEL
export const STAND_COST = costs.STAND_COST
export const STAND_JETWAY_MULT = costs.STAND_JETWAY_MULT
export const STAND_L_COST = costs.STAND_L_COST
export const STAND_S_COST = costs.STAND_S_COST
export const STARTER_KIT_COST = costs.STARTER_KIT_COST
export const START_CASH = costs.START_CASH as { readonly easy: number; readonly standard: number }
export const TANKER_FEE = costs.TANKER_FEE
export const TANKER_MX_FEE = costs.TANKER_MX_FEE
export const TAXI_COST = costs.TAXI_COST
export const TERMBUS_COST = costs.TERMBUS_COST
export const TERMINAL_COST = costs.TERMINAL_COST
export const THREAT_SCRAMBLE_COST = costs.THREAT_SCRAMBLE_COST
export const TOWER_COST = costs.TOWER_COST
export const AIRLINES = airlines.AIRLINES as Record<string, Airline>
export const AIRLINE_TIER_META = airlines.AIRLINE_TIER_META as Record<AirlineTier, { label: string; short: string; blurb: string; fleet: string; scope: string }>
export const PERSONA_LABEL = airlines.PERSONA_LABEL as Record<AirlinePersona, string>
export const REWARD_LABEL = airlines.REWARD_LABEL as Record<AirlineRewardId, string>
export const REWARD_DETAIL = airlines.REWARD_DETAIL as Record<AirlineRewardId, string>
export const BUILDINGS = buildings.BUILDINGS as BuildDef[]
export const ROOMS = terminal.ROOMS as RoomDef[]
export const RESEARCH_NODES = terminal.RESEARCH_NODES as ResearchNode[]
export const FIELD_TASK_DEFS = terminal.FIELD_TASK_DEFS as FieldTaskDef[]
export const LOAN_PRODUCTS = terminal.LOAN_PRODUCTS as LoanProduct[]
export const FUEL = terminal.FUEL as Record<'apex' | 'kiln', FuelContract>
export const CATER = terminal.CATER as Record<'skybite' | 'galleyprime', CaterContract>
export const TOOL_LABEL = terminal.TOOL_LABEL as Record<Tool, string>
