import type {
  Airline,
  AirlinePersona,
  BudgetKey,
  BuildDef,
  CaterContract,
  FuelContract,
  LandSite,
  RoomDef,
  Tool,
} from './types'

/** Cash in hand before you buy the plot. */
export const START_CASH = { easy: 220_000, standard: 150_000 } as const

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
export const HEAVY_RUNWAY_COST = 72000
export const HEAVY_RUNWAY_LEN = 20
export const HEAVY_RUNWAY_WID = 3
export const HELIPAD_COST = 9000
/** Flat fee when a chopper sits the pad (medevac / executive). */
export const HELO_LANDING = 2400
export const PREMADE_TERMINAL_COST = 52000
export const TAXI_COST = 700
export const STAND_COST = 6200
export const TERMINAL_COST = 14800
export const SNACK_COST = 3600
export const BAGS_COST = 4800
export const FUEL_COST = 5600
export const FIRE_COST = 12000
export const POLICE_COST = 11000
export const CARGO_COST = 16000
export const ROAD_COST = 450
export const TOWER_COST = 18000
export const HANGAR_COST = 14000
export const CLEANING_FEE = 900
/** Deep-clean hall WC / security after budget wear. */
export const HALL_SCRUB_COST = 2800
export const BULLDOZE_REFUND = 0.4
export const LOAN_PRINCIPAL = 40_000
export const LOAN_FEE = 2_500
/** Interest charged every ~60 sim-seconds while a loan is open. */
export const LOAN_INTEREST = 900
export const PARCEL_COST = 28_000
export const RAIL_CITY_COST = 22_000
export const STARTER_KIT_COST = 98_000
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
  maintenance: 520,
  security: 640,
  cleaning: 480,
  fire: 700,
  ambulance: 560,
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
/** Heat 0–100; at/below this while on layover → ban. */
export const HEAT_BAN_THRESHOLD = 28
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
  northline: {
    id: 'northline',
    name: 'Northline',
    color: '#2f6f9a',
    stripe: '#e8eef5',
    kind: 'pax',
    persona: 'budget',
    landing: 5200,
    catering: 1600,
    bags: 1100,
    paxMin: 48,
    paxMax: 72,
    minRep: 0,
    req: { ...baseReq, police: false, snack: false, security: 1 },
    blurb: 'Budget regionals. Runway, stand, fuel, fire, hall security, bags, road.',
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
    blurb: 'Business schedules. Two stands, police, tower, catering + snack, security ×2.',
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
    blurb: 'Luxury widebodies. Heavy strip, three stands, tower, serious security.',
    likesLayovers: false,
    heatSensitivity: 1.45,
  },
  umazon: {
    id: 'umazon',
    name: 'Umazon Air Cargo',
    color: '#c97816',
    stripe: '#222',
    kind: 'cargo',
    persona: 'cargo_night',
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
    blurb: 'Night freighters. Cargo shed, fuel, fire, police, road — no hall.',
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
    blurb: 'Brown-box freighter. First cargo contract most fields can earn.',
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
    blurb: 'Priority freighters. Heavy strip, two stands, police, tower, cargo apron.',
    likesLayovers: false,
    heatSensitivity: 0.85,
  },
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
      ? 'Procedural budget hopper. Easy to please — until the hall fails a layover.'
      : 'Procedural business regional. Wants a tidy hall and a second stand.',
    likesLayovers: true,
    heatSensitivity: budget ? 1 : 1.2,
    procedural: true,
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
    tool: 'stand',
    tile: 'stand',
    name: 'Stand',
    cost: STAND_COST,
    blurb: 'Parking bay. Jets only pay after they park here.',
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
    blurb: 'Outside sort — carts must reach it.',
  },
  {
    tool: 'fuel',
    tile: 'fuel',
    name: 'Fuel farm',
    cost: FUEL_COST,
    blurb: 'Beside pavement. Sign a carrier and buy loads.',
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
    blurb: 'For Umazon, UPPS, and EXFED freighters.',
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
    name: 'Maintenance hangar',
    cost: HANGAR_COST,
    blurb: 'Overnight checks. Raises reputation when stands are busy.',
  },
  {
    tool: 'helipad',
    tile: 'helipad',
    name: 'Helipad',
    cost: HELIPAD_COST,
    blurb: 'Medevac and executive choppers land here. Needs fire coverage nearby in spirit.',
  },
]

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
  { id: 'golf', name: 'Indoor golf', cost: 9200, blurb: 'Premium desire sink. HatchTag fantasy — calm energy.' },
  {
    id: 'waterfall',
    name: 'Waterfall court',
    cost: 11000,
    blurb: 'Spectacle amenity. Premium pax linger and tip.',
  },
  { id: 'gaming', name: 'Gaming den', cost: 8600, blurb: 'Budget + premium kill time before boarding.' },
]

export const TOOL_LABEL: Record<Tool, string> = {
  pan: 'Look',
  runway_short: 'Short strip',
  runway: 'Runway',
  runway_heavy: 'Heavy strip',
  helipad: 'Helipad',
  taxi: 'Taxiway',
  stand: 'Stand',
  terminal: 'Shell',
  premade: 'Premade hall',
  snack: 'Snack',
  bags: 'Bags',
  fuel: 'Fuel',
  fire: 'Fire',
  police: 'Police',
  cargo: 'Cargo',
  road: 'Road',
  tower: 'Tower',
  hangar: 'Hangar',
  clear: 'Clear',
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
