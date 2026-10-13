/**
 * Typed balance config for the terminal economy simulator.
 * Hall items mirror docs/TERMINAL_ITEMS.md (suggested numbers). They are NOT yet in
 * src/game/catalog.ts (Slice B is adding them), so they are mirrored here. When the
 * real catalog lands, swap ITEMS for an adapter over it.
 * Airframes mirror src/game/airframes.ts (seats / bagVolume) for pax types.
 */

export type Stage = 'checkin' | 'security' | 'bags' | 'gates' | 'retail' | 'comfort'

export interface HallItem {
  id: string
  name: string
  stage: Stage
  /** Field Level (1-5) needed to unlock. Balance suggestion. */
  unlockLevel: number
  cost: number
  upkeep: number // $/day
  servers: number
  serviceSec: number // 0 for non-service items
  /** Retail: $ per customer served. */
  spend?: number
  /** Comfort/happiness points added (stacking with diminishing returns). */
  happiness?: number
  /** Condition lost per day (0..1). Busier items wear faster: scaled by utilisation. */
  wearPerDay: number
  /** Only serves pax with hold bags (bag drop) or without (kiosk). */
  paxFilter?: 'bagged' | 'unbagged'
  /** Fixed daily capacity override (pax/day) for non-queue items like seats. */
  dailyCap?: number
}

export const ITEMS: HallItem[] = [
  { id: 'checkin_bag', name: 'Check-in desk w/ bag belt', stage: 'checkin', unlockLevel: 1, cost: 6000, upkeep: 70, servers: 1, serviceSec: 60, wearPerDay: 0.004 },
  { id: 'kiosk', name: 'Self check-in kiosk', stage: 'checkin', unlockLevel: 2, cost: 4000, upkeep: 15, servers: 1, serviceSec: 25, wearPerDay: 0.008, paxFilter: 'unbagged' },
  { id: 'bag_drop', name: 'Automatic bag drop', stage: 'checkin', unlockLevel: 2, cost: 7000, upkeep: 25, servers: 1, serviceSec: 30, wearPerDay: 0.008, paxFilter: 'bagged' },
  { id: 'sec_small', name: 'Small security lane', stage: 'security', unlockLevel: 1, cost: 8000, upkeep: 80, servers: 1, serviceSec: 45, wearPerDay: 0.005 },
  { id: 'sec_medium', name: 'Medium security lane', stage: 'security', unlockLevel: 3, cost: 18000, upkeep: 200, servers: 2, serviceSec: 30, wearPerDay: 0.005 },
  { id: 'sec_large', name: 'Large security lane', stage: 'security', unlockLevel: 4, cost: 30000, upkeep: 260, servers: 3, serviceSec: 20, wearPerDay: 0.005 },
  { id: 'bag_scanner', name: 'Hold-bag scanner', stage: 'bags', unlockLevel: 2, cost: 12000, upkeep: 50, servers: 1, serviceSec: 6, wearPerDay: 0.006, paxFilter: 'bagged' },
  { id: 'bag_hall', name: 'Bag hall', stage: 'bags', unlockLevel: 3, cost: 15000, upkeep: 80, servers: 2, serviceSec: 20, wearPerDay: 0.004, paxFilter: 'bagged' },
  { id: 'boarding', name: 'Boarding desk', stage: 'gates', unlockLevel: 1, cost: 3000, upkeep: 40, servers: 1, serviceSec: 8, wearPerDay: 0.003 },
  { id: 'seats', name: 'Seat row (4)', stage: 'comfort', unlockLevel: 1, cost: 600, upkeep: 2, servers: 0, serviceSec: 0, happiness: 1.5, wearPerDay: 0.01 },
  { id: 'toilet', name: 'Toilet block', stage: 'comfort', unlockLevel: 1, cost: 5000, upkeep: 30, servers: 6, serviceSec: 60, happiness: 6, wearPerDay: 0.012 },
  { id: 'fids', name: 'Flight info screen', stage: 'comfort', unlockLevel: 2, cost: 800, upkeep: 5, servers: 0, serviceSec: 0, happiness: 2, wearPerDay: 0.003 },
  { id: 'info_desk', name: 'Information desk', stage: 'comfort', unlockLevel: 2, cost: 3000, upkeep: 40, servers: 1, serviceSec: 20, happiness: 3, wearPerDay: 0.003 },
  { id: 'lounge', name: 'Airline lounge', stage: 'comfort', unlockLevel: 4, cost: 40000, upkeep: 200, servers: 0, serviceSec: 0, happiness: 10, wearPerDay: 0.004 },
  { id: 'cafe', name: 'Café kiosk', stage: 'retail', unlockLevel: 1, cost: 4000, upkeep: 30, servers: 1, serviceSec: 30, spend: 6, happiness: 1.5, wearPerDay: 0.006 },
  { id: 'fast_food', name: 'Fast food', stage: 'retail', unlockLevel: 2, cost: 8000, upkeep: 60, servers: 2, serviceSec: 45, spend: 10, happiness: 2, wearPerDay: 0.006 },
  { id: 'newsagent', name: 'Newsagent', stage: 'retail', unlockLevel: 2, cost: 6000, upkeep: 40, servers: 6, serviceSec: 60, spend: 8, wearPerDay: 0.005 },
  { id: 'restaurant', name: 'Restaurant', stage: 'retail', unlockLevel: 3, cost: 15000, upkeep: 90, servers: 12, serviceSec: 300, spend: 18, happiness: 3, wearPerDay: 0.005 },
  { id: 'duty_free', name: 'Duty-free', stage: 'retail', unlockLevel: 4, cost: 20000, upkeep: 100, servers: 15, serviceSec: 120, spend: 35, wearPerDay: 0.004 },
  { id: 'vending', name: 'Vending machine', stage: 'retail', unlockLevel: 1, cost: 800, upkeep: 3, servers: 1, serviceSec: 10, spend: 2, wearPerDay: 0.01 },
]

/** Prefab terminal ($52k PREMADE_TERMINAL_COST in catalog.ts): what you start with. */
export const PREFAB: string[] = ['checkin_bag', 'sec_small', 'boarding', 'seats', 'toilet', 'cafe']

export interface PaxAirframe { id: string; seats: number; bagVolume: number; level: number }
/** From src/game/airframes.ts; level = airline tier that flies it (AIRLINE_TIER_META). */
export const AIRFRAMES: PaxAirframe[] = [
  { id: 'atr72', seats: 72, bagVolume: 46, level: 2 },
  { id: 'crj700', seats: 70, bagVolume: 50, level: 2 },
  { id: 'e175', seats: 78, bagVolume: 58, level: 2 },
  { id: 'a320neo', seats: 180, bagVolume: 130, level: 3 },
  { id: 'b738', seats: 189, bagVolume: 145, level: 3 },
  { id: 'a321', seats: 220, bagVolume: 165, level: 3 },
  { id: 'b789', seats: 296, bagVolume: 240, level: 4 },
  { id: 'a359', seats: 325, bagVolume: 270, level: 4 },
  { id: 'a380', seats: 525, bagVolume: 400, level: 5 },
]

/** FIELD_LEVEL_XP in catalog.ts. */
export const FIELD_LEVEL_XP = [0, 0, 90, 220, 420, 700] as const

export interface SimParams {
  days: number
  startCash: number
  /** Departing pax/day demand on day 0. */
  baseDemand: number
  /** Organic demand growth per day at neutral happiness. */
  growth: number
  opsHours: number
  /** Peak-hour factor: capacity is sized against the peak, not the average. */
  peakFactor: number
  paxFee: number // $ airport earns per departing pax
  /** Fraction of served pax who visit retail when there is no queue squeeze. */
  retailCapture: number
  xpPer1000Pax: number
  repairAt: number // condition threshold that triggers a repair
  repairCostFrac: number
  /** Cash kept in reserve by the 'balanced' strategy. */
  reserve: number
  /** Max departing pax/day per Field Level: airline tiers cap how much traffic can exist. */
  levelDemandCap: number[]
}

export const DEFAULT_PARAMS: SimParams = {
  days: 240,
  startCash: 150_000 - 52_000,
  baseDemand: 350,
  growth: 0.012,
  opsHours: 16,
  peakFactor: 1.6,
  paxFee: 14,
  retailCapture: 0.55,
  xpPer1000Pax: 3,
  repairAt: 0.6,
  repairCostFrac: 0.25,
  reserve: 15_000,
  levelDemandCap: [0, 700, 1200, 2200, 3800, 6000],
}
