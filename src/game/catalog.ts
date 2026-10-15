import { CONNECTIVITY_CATALOG } from '../connectivity/catalog.ts'
import { HUB_UPGRADES } from '../hub/index.ts'
import type { LandPlotConfig } from '../land/types.ts'
import {
  HANGAR_OFFERS,
  LINK_OFFERS,
  RESEARCH_COSTS,
  STAND_OFFERS,
} from '../scale/data'
import { unlockLevel } from '../progression/unlocks.ts'
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
  ParkTerm,
  ResearchId,
  RoomDef,
  StandAccess,
  StandClass,
  Tile,
  Tool,
} from './types'
import { MRO_COST, MRO_UPKEEP_PER_DAY, NIGHT_HUB_COST, NIGHT_HUB_UPKEEP_PER_DAY } from '../tier3/config.ts'

/**
 * Operating cash left after the city plot and the starter kit on a standard game.
 * High enough that payroll does not look like a bankruptcy before the first landing,
 * and low enough that a regional runway still cannot be bought in place of the kit.
 */
export const OPENING_RESERVE = 25_000

/** Cash in hand before you buy the plot. Standard is plot + kit + reserve. */
export const START_CASH = { easy: 220_000, standard: 168_000 } as const

export const LAND: Record<'city' | 'factory', LandSite> = {
  city: {
    id: 'city',
    name: 'Riverside City plot',
    blurb: 'Expensive land against the skyline. Passengers show up easier. Cargo is secondary.',
    cost: 95_000,
    paxMult: 1.35,
    cargoMult: 0.7,
  },
  factory: {
    id: 'factory',
    name: 'Kiln Industrial plot',
    blurb: 'Cheaper acres by the sheds. Cargo carriers love it. Passengers take more convincing.',
    cost: 62_000,
    paxMult: 0.75,
    cargoMult: 1.4,
  },
}

export const SHORT_RUNWAY_COST = 22000
export const SHORT_RUNWAY_LEN = 10
export const SHORT_RUNWAY_WID = 2
export const RUNWAY_PREFAB_COST = 38000
export const RUNWAY_PREFAB_LEN = 14
export const RUNWAY_PREFAB_WID = 2
/**
 * Obstacle-free cells beside a runway edge (across the strip) and past each
 * threshold (along the strip). Buildings and stands may not sit here.
 * Taxiways may cross the zone so two strips can still be linked.
 * One cell is 22 m, so 2 cells is about a 44 m shoulder.
 */
export const RUNWAY_CLEARANCE_SIDE = 2
export const RUNWAY_CLEARANCE_END = 2
export const HEAVY_RUNWAY_COST = 72000
export const HEAVY_RUNWAY_LEN = 20
export const HEAVY_RUNWAY_WID = 3
export const HELIPAD_COST = 9000
/** Flat fee when a chopper sits the pad (medevac / executive). */
export const HELO_LANDING = 2400
export const PREMADE_TERMINAL_COST = 52000
/** Manhattan cells — stand within this of a hall origin counts as jetway-linked. */
export const JETWAY_RANGE = 8
/** Manhattan cells — stand within this of a hangar counts as military ramp. */
export const MIL_RAMP_RANGE = 10
export const TAXI_COST = 700
export const STAND_S_COST = 4800
export const STAND_COST = 6200
export const STAND_L_COST = 9800
/** Jetway-equipped stands cost this multiplier over the remote bay. */
export const STAND_JETWAY_MULT = 1.85
/** Apron depot that runs terminal buses to remote stands. */
export const TERMBUS_COST = 12_500
export const TERMINAL_COST = 14800
export const SNACK_COST = 3600
export const BAGS_COST = 4800
/** Cheap paint for check-in → makeup → bay bag belts. */
export const BELT_COST = 900
export const FUEL_COST = 5600
/** Galley production for the ground fleet. Field level 2. */
export const KITCHEN_COST = 7200
/** Stages fuel, galley, bag, and bus trucks. Field level 2. A second depot adds another fleet. */
export const DEPOT_COST = 9800
export const FIRE_COST = 12000
export const POLICE_COST = 11000
export const CARGO_COST = 16000
/** City-edge vehicle screen — cargo trucks / contractors. */
export const GUARD_COST = 9_500
/** Fee when a city cargo truck clears the shed (intake picture). */
export const CARGO_INTAKE_FEE = 420
/** Soft warehouse capacity at one cargo shed (units). */
export const CARGO_WAREHOUSE_CAP = 140
/** Cargo volume letter — fee band + cool between asks. */
export const CARGO_VOLUME_FEE_MIN = 4_200
export const CARGO_VOLUME_FEE_MAX = 9_500
export const CARGO_VOLUME_COOL = 70
export const CARGO_VOLUME_FAIL_FINE = 600
export const ROAD_COST = 450
export const TOWER_COST = 18000
export const HANGAR_COST = 14000
export const DEICE_PAD_COST = 11_500
/** Fee when glycol truck clears a jet. */
export const DEICE_FEE = 1400
export const CLEANING_FEE = 900
/** Deep-clean hall WC / security after budget wear. */
export const HALL_SCRUB_COST = 2800
export const BULLDOZE_REFUND = 0.4
/** @deprecated Prefer LOAN_PRODUCTS bridge — kept for older UI strings. */
export const LOAN_PRINCIPAL = 45_000
export const LOAN_FEE = 2_800
/**
 * Each loan tick pays interest (max of the product floor and rate × balance) plus one
 * equal principal installment, so the balance reaches zero after `termDays` game days.
 * Only unpaid interest capitalizes (capped ~2.1×); a missed installment simply stays owed.
 * Interest-only at a $1,250 floor every 55s (~$4.1k a game day on a $47.8k bridge) never
 * shrank the balance and outran a starter field's margin (#192).
 */
/** Debt floor for fines and bills: `charge()` never takes cash below this. */
export const CASH_DEBT_FLOOR = -25_000
/**
 * A short payroll day trims the MX and security sliders by this step, but never below the
 * floor. Security under 35% marks the field exposed (threats every few seconds), so the
 * automatic cut stops above that line; going lower is the player's choice.
 */
export const PAYROLL_SHORT_SLIDER_STEP = 10
export const PAYROLL_SHORT_SLIDER_FLOOR = 50
/**
 * While security incidents are still climbing, a short payroll day will not
 * cut the security slider below this. The 50% floor kept producing threat
 * fines that cost more than the wages saved.
 */
export const SECURITY_INCIDENT_SLIDER_FLOOR = 70
/** Private-field threat fines. A hard miss and a soft miss. */
export const SECURITY_HARD_FINE = 1_500
export const SECURITY_SOFT_FINE = 800
/**
 * Listed field. Higher than the private fine, so the tape hurts, but not
 * twelve times higher. One hard headline must not be the month's profit.
 */
export const SECURITY_PUBLIC_HARD_FINE = 3_000
export const SECURITY_PUBLIC_SOFT_FINE = 1_600
/**
 * Crash write-off. The formula used to clear $30k, then a $12k cap still let
 * a handful of crashes erase a careless field by themselves.
 */
export const CRASH_FINE_CAP = 4_000
/**
 * Seconds of slip that cost a carrier the full per-delay Standing nick. A held slot is
 * retried every few seconds while pavement is busy; each retry nudges later slots by a
 * second or two, and charging the full nick for each nudge drained Standing ~10× faster
 * than the actual delay (#192). The nick now scales with seconds actually added.
 */
export const DELAY_HEAT_REF_SEC = 15

/** Multiple bank products — bigger loans cost more fees and need field level. */
export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 'micro',
    label: 'Micro strip',
    blurb: 'Starter cash for pavement. High rate, short leash.',
    principal: 25_000,
    fee: 1_400,
    rate: 0.004,
    interestFloor: 110,
    every: 42,
    termDays: 15,
    minFieldLevel: 1,
    minRep: 0,
  },
  {
    id: 'bridge',
    label: 'Bridge loan',
    blurb: 'Classic growth wire. Balanced fee and rate.',
    principal: 45_000,
    fee: 2_800,
    rate: 0.003,
    interestFloor: 150,
    every: 55,
    termDays: 25,
    minFieldLevel: 1,
    minRep: 0,
  },
  {
    id: 'expansion',
    label: 'Expansion',
    blurb: 'Second hall / jetway money. Needs Field Lv2.',
    principal: 90_000,
    fee: 7_500,
    rate: 0.0025,
    interestFloor: 250,
    every: 70,
    termDays: 40,
    minFieldLevel: 2,
    minRep: 35,
  },
  {
    id: 'hub',
    label: 'Hub facility',
    blurb: 'Major capex. Needs Field Lv3 + reputation.',
    principal: 180_000,
    fee: 18_000,
    rate: 0.002,
    interestFloor: 400,
    every: 85,
    termDays: 60,
    minFieldLevel: 3,
    minRep: 55,
  },
  {
    id: 'sovereign',
    label: 'Sovereign bond',
    blurb: 'Endgame mega wire. Needs Field Lv4. Huge fee.',
    principal: 320_000,
    fee: 42_000,
    rate: 0.0015,
    interestFloor: 550,
    every: 100,
    termDays: 90,
    minFieldLevel: 4,
    minRep: 70,
  },
]

/** Field level 1–10. Index matches the level; index 0 is unused. */
export const MAX_FIELD_LEVEL = 10
export type FieldLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/**
 * XP to reach each field level.
 * FL1–5 stay 0 / 90 / 220 / 420 / 700. FL6–10 follow.
 * Levels 6 and 7 also open hub links (transfer bus, people mover).
 */
export const FIELD_LEVEL_XP = [0, 0, 90, 220, 420, 700, 1100, 1600, 2300, 3200, 4500] as const

/** XP between prestige stars after FL10. P1 is FL10 + one step. */
export const PRESTIGE_STAR_XP = 2_000
export const PRESTIGE_STARS = 5

export function fieldLevelOf(xp: number): FieldLevel {
  let level: FieldLevel = 1
  const safe = Math.max(0, xp)
  for (let i = 2; i <= MAX_FIELD_LEVEL; i++) {
    if (safe >= FIELD_LEVEL_XP[i]!) level = i as FieldLevel
  }
  return level
}

/** @deprecated name — use fieldLevelOf. */
export function fieldLevelFromXp(xp: number): FieldLevel {
  return fieldLevelOf(xp)
}

export function prestigeStarsOf(xp: number): number {
  const floor = FIELD_LEVEL_XP[MAX_FIELD_LEVEL]
  if (xp < floor) return 0
  return Math.min(PRESTIGE_STARS, Math.floor((xp - floor) / PRESTIGE_STAR_XP))
}

export function prestigeThreshold(star: number): number {
  return FIELD_LEVEL_XP[MAX_FIELD_LEVEL] + star * PRESTIGE_STAR_XP
}

export interface FieldProgress {
  level: FieldLevel
  stars: number
  xp: number
  /** XP required for the next level or the next star. */
  need: number
  pct: number
  /** "Lv 7" or "Lv 10 · P2". */
  label: string
  /** "Lv 8" or "P3" or "max". */
  nextLabel: string
}

export function fieldProgress(xp: number): FieldProgress {
  const level = fieldLevelOf(xp)
  const stars = prestigeStarsOf(xp)
  const safeXp = Math.max(0, xp)
  if (level < MAX_FIELD_LEVEL) {
    const floor = FIELD_LEVEL_XP[level]
    const need = FIELD_LEVEL_XP[level + 1]!
    const pct = need <= floor ? 1 : Math.min(1, (safeXp - floor) / (need - floor))
    return {
      level,
      stars: 0,
      xp: safeXp,
      need,
      pct,
      label: `Lv ${level}`,
      nextLabel: `Lv ${level + 1}`,
    }
  }
  if (stars >= PRESTIGE_STARS) {
    const need = prestigeThreshold(PRESTIGE_STARS)
    return {
      level,
      stars,
      xp: safeXp,
      need,
      pct: 1,
      label: `Lv ${MAX_FIELD_LEVEL} · P${stars}`,
      nextLabel: 'max',
    }
  }
  const floor = prestigeThreshold(stars)
  const need = prestigeThreshold(stars + 1)
  const pct = need <= floor ? 1 : Math.min(1, (safeXp - floor) / (need - floor))
  return {
    level,
    stars,
    xp: safeXp,
    need,
    pct,
    label: stars > 0 ? `Lv ${MAX_FIELD_LEVEL} · P${stars}` : `Lv ${MAX_FIELD_LEVEL}`,
    nextLabel: `P${stars + 1}`,
  }
}

/** Same rungs as FIELD_LEVEL_XP through FL9. Hotel needs 7, SAF blending 8, rail link 9. */
export const LATE_FIELD_XP = [0, 0, 90, 220, 420, 700, 1_100, 1_600, 2_300, 3_200, 4_500] as const


/** Field level used by late buildings. Levels 1–5 match `fieldLevelFromXp`. */
export function lateFieldLevelFromXp(xp: number): number {
  const safe = Number.isFinite(xp) && xp > 0 ? xp : 0
  let level = 1
  for (let i = 2; i < LATE_FIELD_XP.length; i++) {
    if (safe >= LATE_FIELD_XP[i]!) level = i
  }
  return level
}

export const AIRLINE_TIER_META: Record<
  AirlineTier,
  { label: string; short: string; blurb: string; fleet: string; scope: string }
> = {
  1: {
    label: 'Commuter / Local',
    short: 'T1',
    blurb: 'Bush taxis & island hoppers. Low overhead, intimate ops.',
    fleet: 'Code A/B — Cessna / Twin Otter / Islander (5–19 seats)',
    scope: 'Hops under ~100 mi · unpaved / local fields',
  },
  2: {
    label: 'Regional',
    short: 'T2',
    blurb: 'Feeder schedules into larger cities. Early timetable skill.',
    fleet: 'Code B/C — ATR 72 / CRJ / ERJ (30–100 seats)',
    scope: 'Short-haul 100–500 mi · codeshare feeders',
  },
  3: {
    label: 'National / Mid-size',
    short: 'T3',
    blurb: 'Narrowbody domestic / near-intl. Brand identity matters.',
    fleet: 'Code C — A320 / 737 family (130–200 seats)',
    scope: 'Coast-to-coast or continental city pairs',
  },
  4: {
    label: 'Major / Flag',
    short: 'T4',
    blurb: 'Hub-and-spoke, alliances, premium cabins.',
    fleet: 'Code D/E — 767 / 777 / A330 / A350 (200–400+)',
    scope: 'Transcontinental + international hubs',
  },
  5: {
    label: 'Mega-global',
    short: 'T5',
    blurb: 'Ultra-widebody / heavy cargo titans. Endgame mastery.',
    fleet: 'Code F — A380 / 747-8 / 777X / heavy freighters',
    scope: 'Intercontinental mega-hubs · global logistics',
  },
}

export const PARCEL_COST = 28_000

/**
 * Expansion plots (Cities: Skylines tile buy) and the daily sinks that sit on them.
 * The starter plot is granted by the city/factory purchase. Further plots must
 * touch land you own, and field level caps how many you may hold.
 */
export const LAND_PLOT = {
  cols: 4,
  rows: 4,
  starterCol: 1,
  starterRow: 1,
  ownedCapByLevel: [0, 1, 3, 6, 10, 16],
  basePrice: PARCEL_COST,
  distancePremium: 0.35,
  ownedPremium: 0.12,
  zoneMult: {
    core: 1.25,
    apron: 1,
    approach: 0.9,
    industrial: 0.72,
    fringe: 0.8,
  },
  dailyUpkeep: 180,
  propertyTaxRate: 0.0004,
  insuranceRate: 0.00012,
  insurancePerIncident: 0.08,
  insuranceIncidentCap: 6,
  utilityPerPower: 7,
  utilityPerWater: 4,
  operatingLicence: [0, 0, 240, 520, 980, 1_600],
  arffLicence: 110,
  intlLicence: 740,
  maintenanceContract: 1_250,
  contractRepair: 1.2,
  contractRepairRate: 0.15,
} satisfies LandPlotConfig

/** Power and water load per stamped tile. Utilities scale with the total. */
export const TILE_UTILITY: Partial<Record<Tile, { power?: number; water?: number }>> = {
  terminal: { power: 4, water: 1 },
  fuel: { power: 2 },
  tower: { power: 3 },
  hangar: { power: 2 },
  cargo: { power: 2 },
  snack: { power: 1, water: 1 },
  bags: { power: 2 },
  hotel: { power: 2, water: 3 },
  fire: { power: 1, water: 2 },
  deice: { power: 1, water: 1 },
  police: { power: 1 },
  guard: { power: 1 },
  mover: { power: 3 },
  xferbus: { power: 1 },
  skywalk: { power: 1 },
}

export const RAIL_CITY_COST = 22_000
/**
 * Starter kit must be buyable after city land on standard (150k − 95k = 55k).
 * Loan is for growth + second carriers, not the first stamp.
 */
export const STARTER_KIT_COST = 48_000
export const HOTEL_COST = 28_000
export const HOTEL_COST_L2 = 48_000
export const CARPARK_SHORT_COST = 11_000
export const CARPARK_LONG_COST = 16_500
/**
 * Legacy meta hotel/carpark "sticker" tables — kept for save migration / audits.
 * Live economy: passenger fees pay; buildings charge fixed expenses (see *_EXPENSE).
 */
export const HOTEL_INCOME = [0, 0, 0] as const
export const CARPARK_SHORT_INCOME = 0
export const CARPARK_LONG_INCOME = 0
/** Outside hotel stamps — three grades on the apron landside. */
export const HOTEL_INN_COST = 18_000
export const HOTEL_BIZ_COST = 28_000
export const HOTEL_RESORT_COST = 42_000
/** @deprecated use HOTEL_INN_COST — kept for meta wing buy copy */
export const HOTEL_TILE_COST = HOTEL_BIZ_COST
export const PARK_S_COST = 8_500
export const PARK_L_COST = 14_000
export const PARK_G_COST = 22_000
export const PARK_U_COST = 18_000
/**
 * One game day is 180s. The old payroll tick was ~30s, so a daily bill is
 * six ticks. These tick rates are the legacy numbers; the live constants
 * below are already $/day.
 */
export const PAYROLL_TICKS_PER_DAY = 6

export function dailyUpkeep(perTick: number): number {
  return Math.round(perTick * PAYROLL_TICKS_PER_DAY)
}

/** Legacy per-tick operating rates. Daily upkeep is dailyUpkeep(tick). */
export const UPKEEP_PER_TICK = {
  park: {
    park_s: { short: 160, long: 210 },
    park_l: { short: 280, long: 360 },
    park_g: { short: 420, long: 560 },
    park_u: { short: 340, long: 450 },
  },
  hotel: { inn: 280, business: 480, resort: 780 },
  hotelMeta: [0, 360, 620],
  carparkShort: 180,
  carparkLong: 240,
  bus: 160,
  curbLane: 90,
  taxiRank: 120,
  rail: 260,
  hall: {
    dayhotel: 240,
    spa: 200,
    pool: 280,
    golf: 170,
    waterfall: 150,
    gaming: 130,
    lounge: 200 / 6,
    souvenir: 20,
    food: 160 / 6,
  },
} as const

/**
 * Fixed operating expense per game day — billed whether used or not.
 * Empty landside bleeds; passenger fees must cover this to stay green.
 */
export const PARK_EXPENSE: Record<
  'park_s' | 'park_l' | 'park_g' | 'park_u',
  { short: number; long: number }
> = {
  park_s: {
    short: dailyUpkeep(UPKEEP_PER_TICK.park.park_s.short),
    long: dailyUpkeep(UPKEEP_PER_TICK.park.park_s.long),
  },
  park_l: {
    short: dailyUpkeep(UPKEEP_PER_TICK.park.park_l.short),
    long: dailyUpkeep(UPKEEP_PER_TICK.park.park_l.long),
  },
  park_g: {
    short: dailyUpkeep(UPKEEP_PER_TICK.park.park_g.short),
    long: dailyUpkeep(UPKEEP_PER_TICK.park.park_g.long),
  },
  park_u: {
    short: dailyUpkeep(UPKEEP_PER_TICK.park.park_u.short),
    long: dailyUpkeep(UPKEEP_PER_TICK.park.park_u.long),
  },
}
/** @deprecated — parks no longer print sticker income; use PARK_EXPENSE + guest fees. */
export const PARK_INCOME = PARK_EXPENSE
export const HOTEL_CLASS_EXPENSE: Record<'inn' | 'business' | 'resort', number> = {
  inn: dailyUpkeep(UPKEEP_PER_TICK.hotel.inn),
  business: dailyUpkeep(UPKEEP_PER_TICK.hotel.business),
  resort: dailyUpkeep(UPKEEP_PER_TICK.hotel.resort),
}
/** @deprecated — hotels no longer print sticker income; use HOTEL_CLASS_EXPENSE. */
export const HOTEL_CLASS_INCOME = HOTEL_CLASS_EXPENSE
export const HOTEL_META_EXPENSE = [
  dailyUpkeep(UPKEEP_PER_TICK.hotelMeta[0]),
  dailyUpkeep(UPKEEP_PER_TICK.hotelMeta[1]),
  dailyUpkeep(UPKEEP_PER_TICK.hotelMeta[2]),
] as const
export const CARPARK_META_EXPENSE_SHORT = dailyUpkeep(UPKEEP_PER_TICK.carparkShort)
export const CARPARK_META_EXPENSE_LONG = dailyUpkeep(UPKEEP_PER_TICK.carparkLong)
export const BUS_EXPENSE = dailyUpkeep(UPKEEP_PER_TICK.bus)
export const CURB_LANE_EXPENSE = dailyUpkeep(UPKEEP_PER_TICK.curbLane)
export const TAXI_RANK_EXPENSE = dailyUpkeep(UPKEEP_PER_TICK.taxiRank)
export const RAIL_EXPENSE = dailyUpkeep(UPKEEP_PER_TICK.rail)
export const HOTEL_TILE_INCOME = 0
/** Hall amenity upkeep per game day when furnished — idle spas and pools still cost. */
export const HALL_AMENITY_EXPENSE: Partial<
  Record<
    'dayhotel' | 'spa' | 'pool' | 'golf' | 'waterfall' | 'gaming' | 'lounge' | 'souvenir' | 'food',
    number
  >
> = {
  dayhotel: dailyUpkeep(UPKEEP_PER_TICK.hall.dayhotel),
  spa: dailyUpkeep(UPKEEP_PER_TICK.hall.spa),
  pool: dailyUpkeep(UPKEEP_PER_TICK.hall.pool),
  golf: dailyUpkeep(UPKEEP_PER_TICK.hall.golf),
  waterfall: dailyUpkeep(UPKEEP_PER_TICK.hall.waterfall),
  gaming: dailyUpkeep(UPKEEP_PER_TICK.hall.gaming),
  lounge: dailyUpkeep(UPKEEP_PER_TICK.hall.lounge),
  souvenir: dailyUpkeep(UPKEEP_PER_TICK.hall.souvenir),
  food: dailyUpkeep(UPKEEP_PER_TICK.hall.food),
}

/** $/day shown on the apron tray. Short-term rate for parks. */
export function buildingUpkeepPerDay(tool: string): number {
  switch (tool) {
    case 'hotel_inn':
      return HOTEL_CLASS_EXPENSE.inn
    case 'hotel_biz':
      return HOTEL_CLASS_EXPENSE.business
    case 'hotel_resort':
      return HOTEL_CLASS_EXPENSE.resort
    case 'park_s':
      return PARK_EXPENSE.park_s.short
    case 'park_l':
      return PARK_EXPENSE.park_l.short
    case 'park_g':
      return PARK_EXPENSE.park_g.short
    case 'park_u':
      return PARK_EXPENSE.park_u.short
    case 'bus':
      return BUS_EXPENSE
    case 'curb_lane':
      return CURB_LANE_EXPENSE
    case 'taxi_rank':
      return TAXI_RANK_EXPENSE
    case 'rail':
      return RAIL_EXPENSE
    case 'mro':
      return MRO_UPKEEP_PER_DAY
    case 'nighthub':
      return NIGHT_HUB_UPKEEP_PER_DAY
    default:
      return 0
  }
}
/** Landside curb — city buses drop departing pax. */
export const BUS_CURB_COST = 8_500
/** Extra drop-off lane. Adds curb stalls and a lane of flow. */
export const CURB_LANE_COST = 4_500
/** Taxi queue off the passenger curb. Adds curb stalls. */
export const TAXI_RANK_COST = 6_500
/** Rail station beside the city rail stub — needs City rail investment first. */
export const RAIL_STATION_COST = 16_000
/** Per-passenger fees when a guest actually uses the infra. */
export const PARK_USE_FEE: Record<
  'park_s' | 'park_l' | 'park_g' | 'park_u',
  { short: number; long: number }
> = {
  park_s: { short: 24, long: 42 },
  park_l: { short: 36, long: 62 },
  park_g: { short: 48, long: 88 },
  park_u: { short: 40, long: 74 },
}
/** Fallback flat park fees (meta carpark buys with no stamped lot). */
export const PARK_SHORT_FEE = 28
export const PARK_LONG_FEE = 58
export const HOTEL_CLASS_FEE: Record<'inn' | 'business' | 'resort', number> = {
  inn: 72,
  business: 110,
  resort: 175,
}
/** Fallback when only meta hotel wings exist. */
export const HOTEL_NIGHT_FEE = 95
export const BUS_FARE = 12
export const RAIL_FARE = 22
export const JANITOR_HIRE = 3200
export const JANITOR_WAGE = 260
export const RESEARCHER_HIRE = 4800
export const RESEARCHER_WAGE = 340
export const DESK_STAFF_HIRE = 3600
export const DESK_STAFF_WAGE = 280
/** Soft RP/sec per working researcher when lab gear is present. */
export const RP_RATE_DESK = 0.09
export const RP_RATE_BOARD = 0.05
export const RP_RATE_MACHINE = 0.12
/** Bare researcher with no lab furniture — almost nothing. */
export const RP_RATE_BARE = 0.015
/**
 * Legacy desk rates. The Growth tree does not read these. Its trickle, room
 * rates, and flight lumps live in src/research/config.ts.
 */
export const RP_RATE_OPS = 0.05
/**
 * Airframes the carrier card actually sells. Spawn draws from this list so the
 * planner and the airline card name the same metal.
 */
export const CONTRACT_FLEET: Partial<Record<string, readonly string[]>> = {
  bushline: ['bn2', 'dhc6'],
  northline: ['atr72', 'crj700', 'e175'],
  harbor: ['a320neo', 'b738'],
  summit: ['b789', 'a359'],
  crown: ['a380', 'b77w'],
}
/** Cash + reputation needed before Wall Street will list you. */
export const IPO_MIN_CASH = 40_000
export const IPO_MIN_REP = 55
export const IPO_MIN_FLIGHTS = 3
export const IPO_SHARES = 1000
/** Founder keeps this many shares after IPO; rest float on the market. */
export const IPO_FOUNDER_SHARES = 550
export const IPO_LISTING_FEE = 12_000
export const MIN_RUNWAY = 6
export const BAG_DROP_PAY = 180
export const LOADS_PER_BUY = 4
/** Hire one apron mechanic (line + pavement crew). */
export const MECHANIC_HIRE = 4500
/** Wage paid each payroll tick per mechanic at 100% maintenance budget. */
export const MECHANIC_WAGE = 380
/** Base ops payroll charged ~every 30 sim-seconds at 100% for each line. */
export const BUDGET_BASE: Record<BudgetKey, number> = {
  maintenance: 580,
  security: 720,
  cleaning: 540,
  fire: 780,
  ambulance: 620,
}
export const BUDGET_LABEL: Record<BudgetKey, string> = {
  maintenance: 'Maintenance',
  security: 'Security staff',
  cleaning: 'Cleaning staff',
  fire: 'Fire crews',
  ambulance: 'Ambulances',
}
export const BUDGET_BLURB: Record<BudgetKey, string> = {
  maintenance:
    'Mechanics + pavement. Low = runway decay, higher crash odds in weather.',
  security: 'Screeners and patrols. Low = more threats slip through.',
  cleaning: 'Hall janitors. Low = WC/security wear piles up faster.',
  fire: 'ARFF readiness. Low = apron fires and crash fines get brutal.',
  ambulance: 'Medics on call. Low = crash injuries cost more; medevac cools off.',
}
/** Default full funding. */
export const DEFAULT_BUDGETS: Record<BudgetKey, number> = {
  maintenance: 100,
  security: 100,
  cleaning: 100,
  fire: 100,
  ambulance: 100,
}
/** One-time fee to host a Guard / military transit agreement (Boise-style). */
export const MIL_AGREE_COST = 18_000
export const MIL_LANDING = 7800
export const AIR_AMBULANCE_FEE = 3200
export const THREAT_SCRAMBLE_COST = 2200
/** Up-front fee band for layover hub deals. */
export const LAYOVER_FEE_MIN = 6000
export const LAYOVER_FEE_MAX = 14000
export const LAYOVER_BAN_SECONDS = 90
export const LAYOVER_BAN_FINE = 8000
/**
 * Internal airline relation score 0–100 (code: heat*).
 * Player-facing name: **Standing** — how happy the carrier is with your field.
 */
export const HEAT_BAN_THRESHOLD = 28
/** Standing at/above this unlocks a one-time persona reward. */
export const HEAT_REWARD_THRESHOLD = 82
/** Standing at/below this fires a one-shot warning while signed. */
export const HEAT_WARN_THRESHOLD = 36
/** Sustained Standing at/below this → abandon (outside layover bans). */
export const HEAT_ABANDON_THRESHOLD = 20
/** Player-facing label for airlineHeat / heatOf. */
export const STANDING_LABEL = 'Standing'
/** Cargo path relation flavor (same meter, different words). */
export const CARGO_STANDING_LABEL = 'On-time'
/** Sim-seconds under abandon threshold before they walk. */
export const ABANDON_ACC_SECONDS = 26
export const ABANDON_FINE = 12_000
export const PERSONA_LABEL: Record<AirlinePersona, string> = {
  budget: 'Budget',
  business: 'Business',
  luxury: 'Luxury',
  cargo_night: 'Night cargo',
  military_gov: 'Gov / military',
}

const baseReq = {
  stands: 1,
  fuelContract: true,
  fuelFarm: true,
  fire: true,
  police: false,
  terminal: true,
  security: 1,
  bags: true,
  snack: false,
  catering: false,
  cargo: false,
  road: true,
  tower: false,
  heavyRunway: false,
}

export const AIRLINES: Record<string, Airline> = {
  bushline: {
    id: 'bushline',
    name: 'Bushline Local',
    color: '#6b8f3a',
    stripe: '#f4f1e0',
    kind: 'pax',
    persona: 'budget',
    tier: 1,
    bizModel: 'charter',
    fleetBlurb: 'Twin Otter / Islander · 9–19 seats',
    landing: 2800,
    catering: 0,
    bags: 400,
    paxMin: 9,
    paxMax: 19,
    minRep: 0,
    req: {
      stands: 1,
      fuelContract: false,
      fuelFarm: true,
      fire: true,
      police: false,
      terminal: false,
      security: 0,
      bags: false,
      snack: false,
      catering: false,
      cargo: false,
      road: true,
      tower: false,
      heavyRunway: false,
    },
    blurb: 'T1 commuter. Short strip + fuel farm + fire + road. No hall required.',
    likesLayovers: false,
    heatSensitivity: 0.75,
  },
  northline: {
    id: 'northline',
    name: 'Northline',
    color: '#2f6f9a',
    stripe: '#e8eef5',
    kind: 'pax',
    persona: 'budget',
    tier: 2,
    bizModel: 'lcc',
    fleetBlurb: 'ATR 72 / CRJ / E175 · 48–72 seats',
    landing: 5200,
    catering: 1600,
    bags: 1100,
    paxMin: 48,
    paxMax: 72,
    minRep: 0,
    req: { ...baseReq, police: false, snack: false, security: 1 },
    blurb: 'T2 regional LCC. Runway, stand, fuel, fire, hall security, bags, road.',
    likesLayovers: true,
    heatSensitivity: 0.9,
  },
  harbor: {
    id: 'harbor',
    name: 'Harbor Air',
    color: '#1f6b57',
    stripe: '#f3d27a',
    kind: 'pax',
    persona: 'business',
    tier: 3,
    bizModel: 'full_service',
    fleetBlurb: 'A320 / 737 family · 130–180 seats',
    landing: 7400,
    catering: 2100,
    bags: 1800,
    paxMin: 64,
    paxMax: 96,
    minRep: 45,
    req: {
      ...baseReq,
      stands: 2,
      police: true,
      snack: true,
      catering: true,
      security: 2,
      tower: true,
    },
    blurb: 'T3 national. Two stands, police, tower, catering + snack, security ×2.',
    likesLayovers: true,
    heatSensitivity: 1.1,
  },
  summit: {
    id: 'summit',
    name: 'Summit Premier',
    color: '#5c3d8a',
    stripe: '#f0e6ff',
    kind: 'pax',
    persona: 'luxury',
    tier: 4,
    bizModel: 'full_service',
    fleetBlurb: '787 / A350 · premium cabins',
    landing: 11000,
    catering: 3200,
    bags: 2400,
    paxMin: 80,
    paxMax: 120,
    minRep: 70,
    req: {
      ...baseReq,
      stands: 3,
      police: true,
      snack: true,
      catering: true,
      security: 3,
      tower: true,
      heavyRunway: true,
    },
    blurb: 'T4 flag carrier. Heavy strip, three stands, tower, serious security.',
    likesLayovers: false,
    heatSensitivity: 1.45,
  },
  crown: {
    id: 'crown',
    name: 'Crown Pacific',
    color: '#0a3d5c',
    stripe: '#e7c56a',
    kind: 'pax',
    persona: 'luxury',
    tier: 5,
    bizModel: 'full_service',
    fleetBlurb: 'A380 / 777X · mega-hub flagships',
    landing: 16000,
    catering: 4800,
    bags: 3200,
    paxMin: 220,
    paxMax: 380,
    minRep: 85,
    req: {
      ...baseReq,
      stands: 4,
      police: true,
      snack: true,
      catering: true,
      security: 3,
      tower: true,
      heavyRunway: true,
    },
    blurb: 'T5 mega-global. Field Lv5, heavy strip, four stands, fortress security.',
    likesLayovers: false,
    heatSensitivity: 1.55,
  },
  umazon: {
    id: 'umazon',
    name: 'Umazon Air Cargo',
    color: '#c97816',
    stripe: '#222',
    kind: 'cargo',
    persona: 'cargo_night',
    tier: 3,
    bizModel: 'cargo',
    fleetBlurb: '757F / 767F night bank',
    landing: 9000,
    catering: 0,
    bags: 0,
    paxMin: 0,
    paxMax: 0,
    minRep: 40,
    req: {
      stands: 1,
      fuelContract: true,
      fuelFarm: true,
      fire: true,
      police: true,
      terminal: false,
      security: 0,
      bags: false,
      snack: false,
      catering: false,
      cargo: true,
      road: true,
      tower: false,
      heavyRunway: false,
    },
    blurb: 'T3 cargo. Night freighters — shed, fuel, fire, police, road.',
    likesLayovers: false,
    heatSensitivity: 0.7,
  },
  upps: {
    id: 'upps',
    name: 'UPPS Freight',
    color: '#3d5c2e',
    stripe: '#c9a227',
    kind: 'cargo',
    persona: 'cargo_night',
    tier: 2,
    bizModel: 'cargo',
    fleetBlurb: '757F brown-box feeder',
    landing: 7800,
    catering: 0,
    bags: 0,
    paxMin: 0,
    paxMax: 0,
    minRep: 20,
    req: {
      stands: 1,
      fuelContract: true,
      fuelFarm: true,
      fire: true,
      police: false,
      terminal: false,
      security: 0,
      bags: false,
      snack: false,
      catering: false,
      cargo: true,
      road: true,
      tower: false,
      heavyRunway: false,
    },
    blurb: 'T2 cargo feeder. First freight contract most fields can earn.',
    likesLayovers: false,
    heatSensitivity: 0.65,
  },
  exfed: {
    id: 'exfed',
    name: 'EXFED Express',
    color: '#6b1d1d',
    stripe: '#f0c040',
    kind: 'cargo',
    persona: 'cargo_night',
    tier: 5,
    bizModel: 'cargo',
    fleetBlurb: '747-8F / heavy express',
    landing: 10500,
    catering: 0,
    bags: 0,
    paxMin: 0,
    paxMax: 0,
    minRep: 55,
    req: {
      stands: 2,
      fuelContract: true,
      fuelFarm: true,
      fire: true,
      police: true,
      terminal: false,
      security: 0,
      bags: false,
      snack: false,
      catering: false,
      cargo: true,
      road: true,
      tower: true,
      heavyRunway: true,
    },
    blurb: 'T5 cargo titan. Heavy strip, two stands, police, tower.',
    likesLayovers: false,
    heatSensitivity: 0.85,
  },
}

export function bizModelBlurb(m: Airline['bizModel']): string {
  switch (m) {
    case 'charter':
      return 'Charter'
    case 'lcc':
      return 'LCC'
    case 'full_service':
      return 'Full-service'
    case 'cargo':
      return 'Cargo'
  }
}

const PROC_NAMES = [
  'CedarLink',
  'Prairie Hop',
  'Bay Circlet',
  'Mesa Runner',
  'Lakeline',
  'Copper State',
  'Fogbank Air',
  'Redrock Express',
]
const PROC_COLORS = ['#4a6fa5', '#6a8f4e', '#8a5a3a', '#5a4a7a', '#2a6a6a', '#7a4a4a']

/** Light procedural regional — variety on the phone without replacing majors. */
export function createProcAirline(usedNames: string[] = []): Airline {
  const taken = new Set(usedNames.map((n) => n.toLowerCase()))
  const free = PROC_NAMES.filter((n) => !taken.has(n.toLowerCase()))
  const name = free.length
    ? free[Math.floor(Math.random() * free.length)]
    : `${PROC_NAMES[Math.floor(Math.random() * PROC_NAMES.length)]} ${10 + Math.floor(Math.random() * 89)}`
  const color = PROC_COLORS[Math.floor(Math.random() * PROC_COLORS.length)]
  const budget = Math.random() < 0.65
  const id = `proc-${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    name,
    color,
    stripe: '#e8eef4',
    kind: 'pax',
    persona: budget ? 'budget' : 'business',
    tier: budget ? 1 : 2,
    bizModel: budget ? 'lcc' : 'full_service',
    fleetBlurb: budget ? 'Twin turboprop · 40–68 seats' : 'Small RJ · 55–90 seats',
    landing: budget ? 4800 : 6200,
    catering: budget ? 1200 : 1800,
    bags: budget ? 900 : 1400,
    paxMin: budget ? 40 : 55,
    paxMax: budget ? 68 : 90,
    minRep: budget ? 10 : 35,
    req: {
      ...baseReq,
      stands: budget ? 1 : 2,
      police: !budget,
      snack: !budget,
      catering: !budget,
      security: budget ? 1 : 2,
      tower: !budget,
    },
    blurb: budget
      ? 'T1/T2 procedural hopper. Easy to please — until the hall fails a layover.'
      : 'T2 procedural business regional. Wants a tidy hall and a second stand.',
    likesLayovers: true,
    heatSensitivity: budget ? 1 : 1.2,
    procedural: true,
  }
}

/** Backfill tier/biz fields on older saves / procs. */
export function normalizeAirline(a: Airline): Airline {
  if (a.tier && a.bizModel && a.fleetBlurb) return a
  const kindTier: AirlineTier =
    a.kind === 'cargo' ? 3 : a.persona === 'luxury' ? 4 : a.persona === 'business' ? 3 : 2
  return {
    ...a,
    tier: a.tier ?? (a.procedural ? 1 : kindTier),
    bizModel:
      a.bizModel ??
      (a.kind === 'cargo' ? 'cargo' : a.persona === 'budget' ? 'lcc' : 'full_service'),
    fleetBlurb: a.fleetBlurb ?? (a.kind === 'cargo' ? 'Freighter' : 'Regional metal'),
  }
}

export const FUEL: Record<'apex' | 'kiln', FuelContract> = {
  apex: {
    id: 'apex',
    name: 'Apex Fuel',
    sign: 3500,
    wholesale: 900,
    pump: 2400,
  },
  kiln: {
    id: 'kiln',
    name: 'Kiln Aviation',
    sign: 8000,
    wholesale: 1400,
    pump: 4200,
  },
}

/** Catering is its own vendor track — sign, then snack/kitchen trucks can bill airlines. */
export const CATER: Record<'skybite' | 'galleyprime', CaterContract> = {
  skybite: {
    id: 'skybite',
    name: 'SkyBite Catering',
    sign: 2800,
    payoutMult: 1,
    blurb: 'Starter galley. Unlocks catering trucks from your snack bar.',
  },
  galleyprime: {
    id: 'galleyprime',
    name: 'GalleyPrime',
    sign: 9000,
    payoutMult: 1.45,
    blurb: 'Premium trays. Harbor and Summit prefer this when they board.',
  },
}

export const BUILDINGS: BuildDef[] = [
  {
    tool: 'road',
    tile: 'road',
    name: 'Access road',
    cost: ROAD_COST,
    blurb: 'Link the field to the city edge. Airlines want a way in.',
  },
  {
    tool: 'taxi',
    tile: 'taxi',
    name: 'Taxiway',
    cost: TAXI_COST,
    blurb: 'Pavement jets and trucks follow.',
  },
  {
    tool: 'stand_s',
    tile: 'stand',
    name: 'Small stand',
    cost: STAND_S_COST,
    blurb: 'Small remote bay — walk or terminal-bus. Toggle Jetway for a pre-attached gate (pricier).',
  },
  {
    tool: 'stand',
    tile: 'stand',
    name: 'Medium stand',
    cost: STAND_COST,
    blurb: 'Medium remote bay. Jetway toggle attaches a hall gate for fast board/deboard.',
  },
  {
    tool: 'stand_w',
    tile: 'stand',
    name: STAND_OFFERS.wide.name,
    cost: STAND_OFFERS.wide.cost,
    minFieldLevel: 4,
    blurb: 'Widebody bay, two jet-bridge doors. Needs Field level 4 and Large stands.',
  },
  {
    tool: 'stand_l',
    tile: 'stand',
    name: 'Jumbo stand',
    cost: STAND_OFFERS.jumbo.cost,
    minFieldLevel: 5,
    blurb: 'Jumbo bay for the A380 class, three bridges. Needs Field level 5 and Large stands.',
  },
  {
    tool: 'stand_light',
    tile: 'stand',
    name: 'Light stand',
    cost: 2_800,
    blurb: 'Grass pad for bush planes and the trainer. Pave it from the stand card.',
  },
  {
    tool: 'stand_narrow',
    tile: 'stand',
    name: 'Narrow stand',
    cost: 4_400,
    blurb: 'Asphalt pad. Concrete is a click on the stand. A 737 wants that pour.',
  },
  {
    tool: 'stand_heavy',
    tile: 'stand',
    name: 'Heavy stand',
    cost: 9_000,
    blurb: 'Code D hardstand. The slab grows on the stand card. Needs Field level 3.',
  },
  {
    tool: 'term_bus',
    tile: 'termbus',
    name: 'Terminal bus depot',
    cost: TERMBUS_COST,
    blurb: 'Apron buses ferry remote-stand pax. Without this, remote stands walk the pavement (slow + traffic).',
  },
  {
    tool: 'people_mover',
    tile: 'mover',
    name: CONNECTIVITY_CATALOG.people_mover.name,
    cost: CONNECTIVITY_CATALOG.people_mover.cost,
    minFieldLevel: CONNECTIVITY_CATALOG.people_mover.fieldLevel,
    blurb: `${CONNECTIVITY_CATALOG.people_mover.blurb} ${CONNECTIVITY_CATALOG.people_mover.catch} $${CONNECTIVITY_CATALOG.people_mover.upkeepPerDay.toLocaleString('en-US')}/day.`,
  },
  {
    tool: 'xfer_bus',
    tile: 'xferbus',
    name: CONNECTIVITY_CATALOG.airside_transfer_bus_depot.name,
    cost: CONNECTIVITY_CATALOG.airside_transfer_bus_depot.cost,
    minFieldLevel: CONNECTIVITY_CATALOG.airside_transfer_bus_depot.fieldLevel,
    blurb: `${CONNECTIVITY_CATALOG.airside_transfer_bus_depot.blurb} ${CONNECTIVITY_CATALOG.airside_transfer_bus_depot.catch} $${CONNECTIVITY_CATALOG.airside_transfer_bus_depot.upkeepPerDay.toLocaleString('en-US')}/day.`,
  },
  {
    tool: 'hub_skywalk',
    tile: 'skywalk',
    name: CONNECTIVITY_CATALOG.skywalk.name,
    cost: CONNECTIVITY_CATALOG.skywalk.cost,
    minFieldLevel: CONNECTIVITY_CATALOG.skywalk.fieldLevel,
    blurb: `${CONNECTIVITY_CATALOG.skywalk.blurb} ${CONNECTIVITY_CATALOG.skywalk.catch} $${CONNECTIVITY_CATALOG.skywalk.upkeepPerDay.toLocaleString('en-US')}/day.`,
  },
  {
    tool: 'deice',
    tile: 'deice',
    name: 'De-ice pad',
    cost: DEICE_PAD_COST,
    blurb: 'Glycol pad beside taxi/strip. Storm holds clear when De-ice ops is researched.',
  },
  {
    tool: 'terminal',
    tile: 'terminal',
    name: 'Terminal shell',
    cost: TERMINAL_COST,
    blurb: 'Empty 2×2 hall. Furnish rooms yourself.',
  },
  {
    tool: 'snack',
    tile: 'snack',
    name: 'Snack bar',
    cost: SNACK_COST,
    blurb: 'Meals and catering.',
  },
  {
    tool: 'bags',
    tile: 'bags',
    name: 'Bag sort',
    cost: BAGS_COST,
    blurb: 'Makeup hub — paint Belt tiles to the hall and stands.',
  },
  {
    tool: 'belt',
    tile: 'belt',
    name: 'Bag belt',
    cost: BELT_COST,
    blurb: 'Link hall ↔ bag sort ↔ stand. Break the chain → late bags + Standing dips.',
  },
  {
    tool: 'fuel',
    tile: 'fuel',
    name: 'Fuel farm',
    cost: FUEL_COST,
    minFieldLevel: 1,
    blurb: 'Field level 1. Beside pavement. Sign a carrier and buy loads.',
  },
  {
    tool: 'kitchen',
    tile: 'kitchen',
    name: 'Catering kitchen',
    cost: KITCHEN_COST,
    minFieldLevel: 2,
    blurb: 'Field level 2. Cooks meals for the galley trucks. Place it beside a road.',
  },
  {
    tool: 'depot',
    tile: 'depot',
    name: 'Vehicle depot',
    cost: DEPOT_COST,
    minFieldLevel: 2,
    blurb: 'Field level 2. Fuel, galley, bag, and bus trucks stage here. A second depot adds another fleet.',
  },
  {
    tool: 'fire',
    tile: 'fire',
    name: 'Fire station',
    cost: FIRE_COST,
    blurb: 'ARFF cover. Airlines will not sign without it.',
  },
  {
    tool: 'police',
    tile: 'police',
    name: 'Police post',
    cost: POLICE_COST,
    blurb: 'Patrols and security. Cuts threat risk.',
  },
  {
    tool: 'cargo',
    tile: 'cargo',
    name: 'Cargo shed',
    cost: CARGO_COST,
    blurb: 'For Umazon, UPPS, and EXFED freighters. City trucks deliver here after the guard post.',
  },
  {
    tool: 'guard',
    tile: 'guard',
    name: 'Guard post',
    cost: GUARD_COST,
    blurb: 'Screens city cargo trucks on the access road. Missing post = queues, denied entry, On-time dips.',
  },
  {
    tool: 'tower',
    tile: 'tower',
    name: 'Control tower',
    cost: TOWER_COST,
    blurb: 'Clears traffic faster and unlocks busier airlines. Does not print money.',
  },
  {
    tool: 'hangar',
    tile: 'hangar',
    name: 'Line hangar',
    cost: HANGAR_COST,
    blurb: 'Narrowbody overnight checks. Raises reputation when stands are busy.',
  },
  {
    tool: 'hangar_w',
    tile: 'hangar',
    name: HANGAR_OFFERS.wide.name,
    cost: HANGAR_OFFERS.wide.cost,
    minFieldLevel: 4,
    blurb: 'Widebody bay. A 787-class jet will not take line maintenance in the small hangar.',
  },
  {
    tool: 'hangar_j',
    tile: 'hangar',
    name: HANGAR_OFFERS.jumbo.name,
    cost: HANGAR_OFFERS.jumbo.cost,
    minFieldLevel: 5,
    blurb: 'Jumbo bay. Required before an A380-class aircraft can take hangar maintenance.',
  },
  {
    tool: 'fuel_rail',
    tile: 'fuel_rail',
    name: LINK_OFFERS.fuel_rail.name,
    cost: LINK_OFFERS.fuel_rail.cost,
    minFieldLevel: 5,
    blurb: 'Paint a line from the map edge to the oil station. Research alone does not deliver fuel.',
  },
  {
    tool: 'oil',
    tile: 'oil',
    name: LINK_OFFERS.oil.name,
    cost: LINK_OFFERS.oil.cost,
    minFieldLevel: 5,
    blurb: 'Unloads the fuel train into the tank farm. Place it against the farm and the rail.',
  },
  {
    tool: 'fuel_pipe',
    tile: 'fuel_pipe',
    name: LINK_OFFERS.fuel_pipe.name,
    cost: LINK_OFFERS.fuel_pipe.cost,
    minFieldLevel: 5,
    blurb: 'Paint a pipe from the map edge to the receipt manifold. Research alone does not deliver fuel. $40/day per cell.',
  },
  {
    tool: 'manifold',
    tile: 'manifold',
    name: LINK_OFFERS.manifold.name,
    cost: LINK_OFFERS.manifold.cost,
    minFieldLevel: 5,
    blurb: 'Takes the pipeline into the tank farm. Place it on the pipe, beside the farm. $520/day.',
  },
  {
    tool: 'berth',
    tile: 'berth',
    name: LINK_OFFERS.berth.name,
    cost: LINK_OFFERS.berth.cost,
    minFieldLevel: 5,
    blurb: 'A barge berth on the river edge. One rail-day of fuel, six game hours out. Inland fields have no river.',
  },
  {
    tool: 'travelator',
    tile: 'travelator',
    name: LINK_OFFERS.travelator.name,
    cost: LINK_OFFERS.travelator.cost,
    minFieldLevel: 3,
    blurb: 'Moving walkway. Passengers on it move faster. Link the terminal to a widebody stand.',
  },
  {
    tool: 'skywalk',
    tile: 'skywalk',
    name: 'Pier skywalk',
    cost: LINK_OFFERS.skywalk.cost,
    minFieldLevel: 4,
    blurb: 'Bridge between the terminal and a pier. Widebody gates need this link.',
  },
  {
    tool: 'mover',
    tile: 'mover',
    name: 'Pier mover',
    cost: LINK_OFFERS.mover.cost,
    minFieldLevel: 5,
    blurb: 'Automated people-mover. Jumbo piers are too far to walk.',
  },
  {
    tool: 'mro',
    tile: 'mro',
    name: 'Maintenance hangar',
    cost: MRO_COST,
    minFieldLevel: 4,
    blurb: `Field level 4. Heavy checks for narrow, wide, and jumbo bays. Airlines pay, but the aircraft ties up its stand. Needs mechanics and power. $${MRO_UPKEEP_PER_DAY.toLocaleString('en-US')}/day.`,
  },
  {
    tool: 'nighthub',
    tile: 'nighthub',
    name: 'Cargo night hub',
    cost: NIGHT_HUB_COST,
    minFieldLevel: 4,
    blurb: `Field level 4. A night bank of freighters. High revenue, ground crew, and warehouse space. The city bills the noise. $${NIGHT_HUB_UPKEEP_PER_DAY.toLocaleString('en-US')}/day.`,
  },
  {
    tool: 'helipad',
    tile: 'helipad',
    name: 'Helipad',
    cost: HELIPAD_COST,
    blurb: 'Medevac and executive choppers land here. Needs fire coverage nearby in spirit.',
  },
  {
    tool: 'hotel_inn',
    tile: 'hotel',
    name: 'Airport inn',
    cost: HOTEL_INN_COST,
    blurb: 'Budget landside inn — pax night fees only. Idle beds still cost upkeep.',
  },
  {
    tool: 'hotel_biz',
    tile: 'hotel',
    name: 'Business hotel',
    cost: HOTEL_BIZ_COST,
    blurb: 'Mid-rise landside hotel — overnight fees from pax. Empty = expense bleed.',
  },
  {
    tool: 'hotel_resort',
    tile: 'hotel',
    name: 'Airport resort',
    cost: HOTEL_RESORT_COST,
    blurb: 'Premium resort tower — high night fees when full, heavy upkeep when empty.',
  },
  {
    tool: 'park_s',
    tile: 'park_s',
    name: 'Small lot',
    cost: PARK_S_COST,
    blurb: 'Surface lot + booth. Fees when pax park; Toggle Short/Long. Idle costs.',
  },
  {
    tool: 'park_l',
    tile: 'park_l',
    name: 'Large lot',
    cost: PARK_L_COST,
    blurb: 'Big lot + canopy. Passenger fees only — empty lots bleed upkeep.',
  },
  {
    tool: 'park_g',
    tile: 'park_g',
    name: 'Parking garage',
    cost: PARK_G_COST,
    blurb: 'Multi-level garage. Highest park fees + highest idle expense.',
  },
  {
    tool: 'park_u',
    tile: 'park_u',
    name: 'Underground park',
    cost: PARK_U_COST,
    blurb: 'Underground portal. Good fees when used; lights/pumps cost when idle.',
  },
  {
    tool: 'bus',
    tile: 'bus',
    name: 'Bus bay',
    cost: BUS_CURB_COST,
    blurb: 'City bus bay on a road edge. Adds curb stalls and takes coaches off the passenger curb.',
  },
  {
    tool: 'curb_lane',
    tile: 'curb_lane',
    name: 'Curb lane',
    cost: CURB_LANE_COST,
    blurb: 'A second drop-off lane beside the public road. Adds curb stalls and another lane of flow.',
  },
  {
    tool: 'taxi_rank',
    tile: 'taxi_rank',
    name: 'Taxi rank',
    cost: TAXI_RANK_COST,
    blurb: 'A marked rank for taxis on the road edge. Adds curb stalls for that queue.',
  },
  {
    tool: 'rail',
    tile: 'rail',
    name: 'Rail station',
    cost: RAIL_STATION_COST,
    blurb: 'Passenger rail hall on the city link. Needs City rail first. Business pax love it.',
  },
]

for (const building of BUILDINGS) {
  building.minFieldLevel = unlockLevel(building.tool)
  building.upkeepPerDay = buildingUpkeepPerDay(building.tool)
}

export const ROOMS: RoomDef[] = [
  { id: 'checkin', name: 'Check-in', cost: 2400, blurb: 'Departures start here.' },
  { id: 'security', name: 'Security', cost: 2800, blurb: 'Screening. Weak security invites threats.' },
  { id: 'gate', name: 'Gate hold', cost: 1800, blurb: 'Seats before boarding.' },
  { id: 'bagclaim', name: 'Bag claim', cost: 3200, blurb: 'Arrivals want this.' },
  { id: 'food', name: 'Hall food', cost: 2600, blurb: 'Indoor meals.' },
  { id: 'souvenir', name: 'Souvenirs', cost: 2200, blurb: 'Gift shop.' },
  { id: 'bagdrop', name: 'Bag drop', cost: 1800, blurb: 'Extra $180 with outside sort.' },
  { id: 'lounge', name: 'Airline lounge', cost: 4800, blurb: 'Keeps premium pax calm. Softens Summit.' },
  { id: 'bathroom', name: 'Restrooms', cost: 1600, blurb: 'Basic need. Missing toilets hurts reputation.' },
  { id: 'golf', name: 'Indoor golf', cost: 9200, blurb: 'Golf simulator bays. Premium desire sink — calm energy.' },
  {
    id: 'waterfall',
    name: 'Waterfall court',
    cost: 11000,
    blurb: 'Spectacle amenity. Premium pax linger and tip.',
  },
  { id: 'gaming', name: 'Gaming den', cost: 8600, blurb: 'Budget + premium kill time before boarding.' },
  {
    id: 'dayhotel',
    name: 'Airside day rooms',
    cost: 14_000,
    blurb:
      'Inside-terminal hotel — keep layover pax airside for max spend (nap → food → shop → spa).',
  },
  {
    id: 'spa',
    name: 'Massage spa',
    cost: 12_500,
    blurb: 'Massage chairs + calm booths. Premium energy sink — big tips when tense.',
  },
  {
    id: 'pool',
    name: 'Airside pool',
    cost: 16_000,
    blurb: 'Indoor swim court. Play + energy for transfers and luxury pax.',
  },
  {
    id: 'rdesk',
    name: 'Research desk',
    cost: 3600,
    blurb: 'Landside R&D desk. Banks research points on its own. Hired researchers walk here and raise the rate.',
  },
  {
    id: 'rboard',
    name: 'Chalkboard',
    cost: 2200,
    blurb: 'Chalkboard. Adds research points with or without staff. A researcher at the board raises the rate.',
  },
  {
    id: 'rmachine',
    name: 'Lab bench',
    cost: 5400,
    blurb: 'Lab bench. The strongest room rate, even when the lab is empty. Researchers boost it.',
  },
]

export const TOOL_LABEL: Record<Tool, string> = {
  pan: 'Select',
  runway_short: 'Short runway',
  runway: 'Runway',
  runway_heavy: 'Heavy runway',
  helipad: 'Helipad',
  taxi: 'Taxiway',
  stand_s: 'Small stand',
  stand: 'Medium stand',
  stand_w: 'Wide stand',
  stand_l: 'Jumbo stand',
  stand_light: 'Light stand',
  stand_narrow: 'Narrow stand',
  stand_heavy: 'Heavy stand',
  hangar_w: 'Wide hangar',
  hangar_j: 'Jumbo hangar',
  fuel_rail: 'Fuel rail',
  oil: 'Oil station',
  fuel_pipe: 'Fuel pipeline',
  manifold: 'Receipt manifold',
  berth: 'Barge berth',
  travelator: 'Travelator',
  skywalk: 'Pier skywalk',
  mover: 'Pier mover',
  terminal: 'Shell',
  premade: 'Premade hall',
  snack: 'Snack bar',
  bags: 'Bags',
  belt: 'Belt',
  fuel: 'Fuel',
  kitchen: 'Kitchen',
  depot: 'Depot',
  fire: 'Fire',
  police: 'Police',
  cargo: 'Cargo',
  guard: 'Guard',
  road: 'Road',
  tower: 'Tower',
  hangar: 'Hangar',
  mro: 'Maintenance hangar',
  nighthub: 'Night hub',
  hotel_inn: 'Inn',
  hotel_biz: 'Business hotel',
  hotel_resort: 'Resort',
  park_s: 'Small lot',
  park_l: 'Large lot',
  park_g: 'Parking garage',
  park_u: 'Underground park',
  deice: 'De-ice',
  bus: 'Bus bay',
  curb_lane: 'Curb lane',
  taxi_rank: 'Taxi rank',
  term_bus: 'Terminal bus',
  people_mover: 'People mover',
  xfer_bus: 'Transfer bus',
  hub_skywalk: 'Skywalk',
  rail: 'Rail',
  airport_hotel: 'Hotel',
  rail_link: 'Rail link',
  saf_blending: 'SAF',
  observation_tower: 'Observation tower',
  aviation_museum: 'Aviation museum',
  sky_garden: 'Sky garden',
  art_concourse: 'Art concourse',
  grand_arrivals_hall: 'Grand arrivals hall',
  quiet_hall: 'Quiet hall',
  cargo_hub_ii: 'Cargo hub II',
  cold_store: 'Cold store',
  clear: 'Bulldoze',
}

export function standAccessLabel(a: StandAccess): string {
  return a === 'jetway' ? 'Jetway gate' : 'Remote bay'
}

export function hotelClassLabel(c: 'inn' | 'business' | 'resort'): string {
  return c === 'inn' ? 'Inn' : c === 'resort' ? 'Resort' : 'Business hotel'
}

export function standClassLabel(c: StandClass): string {
  return c === 'S' ? 'Small stand' : c === 'L' ? 'Large stand' : 'Medium stand'
}

export function standClassRank(c: StandClass): number {
  return c === 'S' ? 1 : c === 'M' ? 2 : 3
}

export function parkTermLabel(t: ParkTerm): string {
  return t === 'short' ? 'Short-term' : 'Long-term'
}

export function money(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}

export function airlineList(): Airline[] {
  return Object.values(AIRLINES)
}

/** Premade majors only — procedural fillers live on Game.extraAirlines. */
export function premadeAirlineList(): Airline[] {
  return Object.values(AIRLINES)
}

export function personaBlurb(p: AirlinePersona): string {
  return PERSONA_LABEL[p]
}

export const REWARD_LABEL: Record<AirlineRewardId, string> = {
  brand_lounge: 'First-class lounge',
  budget_perk: 'Snack franchise',
  biz_priority: 'Priority slots',
  cargo_night: 'Night waiver',
}

export const REWARD_DETAIL: Record<AirlineRewardId, string> = {
  brand_lounge:
    'Luxury: branded first-class lounge — their premium pax tip hard and calm faster.',
  budget_perk:
    'Budget: snack franchise on the counter — their pax spend more on food every visit.',
  biz_priority:
    'Business: priority landing fees + denser bank slots and snappier boarding.',
  cargo_night:
    'Night cargo: freighter handling premium + extra RP on night departures.',
}

/** Persona → one-time high-heat perk. */
export function rewardForPersona(p: AirlinePersona): AirlineRewardId {
  switch (p) {
    case 'luxury':
      return 'brand_lounge'
    case 'budget':
      return 'budget_perk'
    case 'business':
      return 'biz_priority'
    case 'cargo_night':
      return 'cargo_night'
    case 'military_gov':
      return 'biz_priority'
  }
}

export function rewardBlurb(id: AirlineRewardId): string {
  return REWARD_LABEL[id]
}

export function rewardDetail(id: AirlineRewardId): string {
  return REWARD_DETAIL[id]
}

export interface ResearchNode {
  id: ResearchId
  name: string
  cost: number
  blurb: string
  /** Prior unlock required, if any. */
  requires?: ResearchId
  /** Hidden until the field reaches this level. */
  minFieldLevel?: 1 | 2 | 3 | 4 | 5
}

/** CEO-style R&D desk — points from turnarounds + pax. */
export const RESEARCH_NODES: ResearchNode[] = [
  {
    id: 'night_bank',
    name: 'Night bank',
    cost: 28,
    blurb: 'Night freighter premium + denser cargo slots. City carriers notice the noise.',
  },
  {
    id: 'deice',
    name: 'De-ice ops',
    cost: 34,
    blurb: 'Stamp glycol pads + dispatch de-ice trucks in storm/fog. Cuts crash risk.',
    requires: 'night_bank',
  },
  {
    id: 'stand_class',
    name: 'Stand classes',
    cost: 40,
    blurb: 'Opens the widebody stand research. S/M bays stay available.',
    requires: 'deice',
  },
  {
    id: 'widebody_ops',
    name: 'Widebody ops',
    cost: RESEARCH_COSTS.widebody_ops,
    blurb: '787, 777, and A350 turns. Needs the matching stand, trucks, and tank.',
    requires: 'stand_class',
    minFieldLevel: 4,
  },
  {
    id: 'heavy_pack',
    name: 'Heavy metal pack',
    cost: 55,
    blurb: 'Unlock the A380 class, jumbo stands, and the jumbo hangar once the widebody pillar is in.',
    requires: 'widebody_ops',
    minFieldLevel: 5,
  },
  {
    id: 'mil_ramp',
    name: 'Military ramp',
    cost: 42,
    blurb: 'C-5M Super Galaxy + dedicated Guard apron (hangar-side hardstands, not pax gates).',
    requires: 'heavy_pack',
  },
  {
    id: 'hydrant_fuel',
    name: 'Hydrant fuel system',
    cost: RESEARCH_COSTS.hydrant_fuel,
    blurb: 'Pits at the stand. Fuel comes from the farm, not a bowser. Required before a jumbo can be fuelled.',
    requires: 'widebody_ops',
    minFieldLevel: 4,
  },
  {
    id: 'rail_fuel',
    name: 'Fuel rail',
    cost: RESEARCH_COSTS.rail_fuel,
    blurb: 'Unlocks the fuel rail and the oil transfer station. Trains do not run until both are connected.',
    requires: 'hydrant_fuel',
    minFieldLevel: 5,
  },
  {
    id: 'tank_farm_ii',
    name: 'Tank farm II',
    cost: RESEARCH_COSTS.tank_farm_ii,
    blurb: 'Larger on-site jet fuel storage for widebody banks.',
    requires: 'widebody_ops',
    minFieldLevel: 4,
  },
  {
    id: 'tank_farm_iii',
    name: 'Tank farm III',
    cost: RESEARCH_COSTS.tank_farm_iii,
    blurb: 'Jumbo tank farm. Holds an A380-class uplift.',
    requires: 'tank_farm_ii',
    minFieldLevel: 5,
  },
  {
    id: 'bag_sorter',
    name: 'Belts and sorter',
    cost: RESEARCH_COSTS.bag_sorter,
    blurb: 'Replaces manual bag carts with belts and a sorter.',
    requires: 'stand_class',
    minFieldLevel: 3,
  },
  {
    id: 'bag_bhs',
    name: 'Automated baggage',
    cost: RESEARCH_COSTS.bag_bhs,
    blurb: 'Full baggage system with early-bag storage for jumbo banks.',
    requires: 'bag_sorter',
    minFieldLevel: 5,
  },
  {
    id: 'self_service',
    name: 'Kiosks and bag drop',
    cost: RESEARCH_COSTS.self_service,
    blurb: 'Self check-in and bag drop beside the desks.',
    minFieldLevel: 2,
  },
  {
    id: 'ct_lanes',
    name: 'Scanner lanes',
    cost: RESEARCH_COSTS.ct_lanes,
    blurb: 'Extra security lanes for a widebody bank.',
    requires: 'self_service',
    minFieldLevel: 3,
  },
  {
    id: 'egates',
    name: 'E-gates',
    cost: RESEARCH_COSTS.egates,
    blurb: 'Automated passport gates for a jumbo departure bank.',
    requires: 'ct_lanes',
    minFieldLevel: 5,
  },
  {
    id: 'travelator',
    name: 'Travelators',
    cost: RESEARCH_COSTS.travelator,
    blurb: 'Moving walkways. Passengers on them move faster.',
    requires: 'self_service',
    minFieldLevel: 3,
  },
  {
    id: 'skywalk',
    name: 'Skywalks',
    cost: RESEARCH_COSTS.skywalk,
    blurb: 'Bridges between the terminal and a pier.',
    requires: 'travelator',
    minFieldLevel: 4,
  },
  {
    id: 'people_mover',
    name: 'People mover',
    cost: RESEARCH_COSTS.people_mover,
    blurb: 'Automated trains between the terminal and a jumbo pier.',
    requires: 'skywalk',
    minFieldLevel: 5,
  },
  {
    id: 'mro_hangar',
    name: 'Hangar MRO',
    cost: 72,
    blurb: 'Third-party heavy checks. A wide hangar with bigger bays for widebody and jumbo aircraft.',
    requires: 'heavy_pack',
  },
  {
    id: 'cargo_night_hub',
    name: 'Cargo night hub',
    cost: 68,
    blurb: 'A late freighter wave after dark. High revenue, and the city charges for the noise.',
    requires: 'heavy_pack',
  },
  ...HUB_UPGRADES.map((node) => ({
    id: node.id,
    name: node.name,
    cost: node.rp,
    blurb: node.blurb,
    requires: node.requires,
  })),
]

/**
 * Flight research is a small operations trickle on the Growth tree.
 * The live amounts are FLIGHT_RP and FLIGHT_RP_PER_50_PAX in src/research/config.ts.
 */
export const RP_PER_FLIGHT = 0.35
/** Research points per 50 pax boarded/served on departure. */
export const RP_PER_50_PAX = 0.1

/** Weather divert accept fee band. */
export const DIVERT_FEE_MIN = 4500
export const DIVERT_FEE_MAX = 9000
/** Firefighting plane — quick refuel stop (fuel farm + ARFF). */
export const TANKER_FEE = 6800
/** Firefighting plane — refuel + hangar line MX. */
export const TANKER_MX_FEE = 9200
export const EMERGENCY_REFUSE_FINE = 800
/**
 * Unanswered emergency. Half a deliberate refuse. The news line stays
 * "Missed — no answer". An unanswered inbound card is $0; that cut already landed.
 */
export const EMERGENCY_TIMEOUT_FINE = EMERGENCY_REFUSE_FINE / 2
/**
 * Declining (or timing out) an emergency the field cannot host — no free stand, no hangar,
 * dry farm — costs the fee and this much reputation, not the refuse fine. The starter field
 * could not host ~2 in 3 of them and paid $2.5k, -4 rep and carrier Standing each (#192).
 */
export const EMERGENCY_UNABLE_REP = 1
/** Standing the diverting carrier loses when we could not host it. */
export const EMERGENCY_UNABLE_HEAT = 2
/** Failed host after accepting — worse than a clean refuse. */
export const EMERGENCY_FAIL_FINE = 4500
/** Hub tier — denser slots after successful layovers. */
export const HUB_FEE_MIN = 14_000
export const HUB_FEE_MAX = 22_000
export const HUB_LAYOVER_WINS = 1
export const HUB_HEAT_NEED = 75
/** Hub carriers ban slightly earlier during layover failures. */
export const HUB_BAN_THRESHOLD = 34
/** GA parking fee / stay band (independent metal — not a signed airline). */
export const GA_PARK_FEE_MIN = 2800
export const GA_PARK_FEE_MAX = 6500
/** Min park before the pilot requests departure. */
export const GA_PARK_STAY_MIN = 40
export const GA_PARK_STAY_MAX = 75
/**
 * Leave window after they request departure.
 * Sim day ≈ 180s = 24h ops → 20h ≈ 150s.
 */
export const GA_LEAVE_WINDOW = 150
export const GA_OVERSTAY_FINE = 5000
/** Soft day-rate while parked (charged on a cool). */
export const GA_PARK_DAY_RATE = 380
export const GA_PARK_RATE_COOL = 32

/** Contract letter countdown (s). The first letter gets longer so a new player can read it. */
export const CONTRACT_LETTER_DEADLINE = 36
export const FIRST_CONTRACT_LETTER_DEADLINE = 90

/** Airline field-task asks — clock + bonus / fail fine. */
export const FIELD_TASK_DEADLINE = 95
export const FIELD_TASK_COOL = 52
export const FIELD_TASK_FAIL_FINE = 500
export const FIELD_TASK_HEAT_OK = 4.5
export const FIELD_TASK_HEAT_FAIL = -5.5
/** Decline retires the ask now. A small Standing nick, no fine, the usual cooldown. */
export const FIELD_TASK_DECLINE_HEAT = -1
/**
 * Opening days (0 through this, exclusive) keep a quiet gap after an ask closes
 * so the letter tray holds about one ask at a time.
 */
export const FIELD_TASK_EARLY_DAYS = 8
/** Sim seconds of quiet after an ask closes during those opening days. */
export const FIELD_TASK_EARLY_QUIET = 160
/** A declined kind stays off the list this long, so the same letter does not return on the next cooldown. */
export const FIELD_TASK_DECLINE_KIND_SEC = 720

export type FieldTaskDef = {
  kind: import('./types').FieldTaskKind
  title: string
  blurb: string
  bonus: number
  /** Prefer for these personas when available. */
  personas?: import('./types').AirlinePersona[]
}

export const FIELD_TASK_DEFS: FieldTaskDef[] = [
  {
    kind: 'bathroom',
    title: 'Add restrooms',
    blurb: 'Furnish a WC in the hall — angry bladders cool Standing.',
    bonus: 4200,
  },
  {
    kind: 'food',
    title: 'Open food',
    blurb: 'Snack bar tile or hall food room so pax can eat.',
    bonus: 4500,
  },
  {
    kind: 'fire',
    title: 'ARFF cover',
    blurb: 'Stamp a fire station on the apron.',
    bonus: 4800,
  },
  {
    kind: 'desk',
    title: 'Staff a desk',
    blurb: 'Hire a desk agent so check-in / gate stay manned.',
    bonus: 3800,
  },
  {
    kind: 'police',
    title: 'Police post',
    blurb: 'Stamp police on the field — security alerts get softer.',
    bonus: 12_500,
    personas: ['business', 'luxury'],
  },
  {
    kind: 'hangar',
    title: 'Hangar bay',
    blurb: 'Stamp a hangar for overnight checks / line MX.',
    bonus: 6000,
    personas: ['cargo_night', 'military_gov', 'business'],
  },
  {
    kind: 'janitor',
    title: 'Hire a janitor',
    blurb: 'Hall wear piles up without a scrub crew.',
    bonus: 3600,
    personas: ['luxury', 'budget'],
  },
  {
    kind: 'cargo',
    title: 'Cargo shed',
    blurb: 'Stamp a cargo shed so freighters can bank properly.',
    bonus: 5500,
    personas: ['cargo_night'],
  },
  {
    kind: 'helipad',
    title: 'Helipad',
    blurb: 'Stamp a pad — medevac / exec choppers need somewhere to sit.',
    bonus: 5000,
    personas: ['military_gov', 'business'],
  },
  {
    kind: 'hotel',
    title: 'Landside hotel',
    blurb: 'Stamp an inn, business hotel, or resort near the road for overnight pax.',
    bonus: 7000,
    personas: ['luxury', 'business'],
  },
  {
    kind: 'park',
    title: 'Car park',
    blurb: 'Stamp a short or long car park (lot / garage / underground) on the landside grass.',
    bonus: 4800,
    personas: ['budget', 'business'],
  },
  {
    kind: 'desk_extra',
    title: 'Second desk body',
    blurb: 'Hire another desk agent — empty counters miss gates.',
    bonus: 4000,
    personas: ['business', 'luxury'],
  },
]
