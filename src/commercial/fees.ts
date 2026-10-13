import {
  CARGO_INTAKE_FEE,
  CLEANING_FEE,
  DEICE_FEE,
  GA_PARK_DAY_RATE,
  HELO_LANDING,
  HOTEL_NIGHT_FEE,
  PARK_LONG_FEE,
  PARK_SHORT_FEE,
} from '../game/catalog.ts'
import {
  type DepositTier,
  landingFeeMultiplier,
  serviceFeeMultiplier,
} from './deposits.ts'
import { finite, nonNegative } from './num.ts'

/**
 * Player-editable fee schedule.
 * Defaults are the live catalog / contract / logistics constants:
 * landing 8 per tonne and pax 12 match contract offers,
 * cleaning, de-ice, cargo, helicopter, car park, and hotel match catalog.ts,
 * fuel markup matches the logistics throughput fee (0.012 / L),
 * a catering cart is 30 meals at the kitchen fee per meal.
 * The first two parking hours are free.
 */

/** Meals on one catering cart. Kitchen feePerMeal × this = the cart price. */
export const CATERING_MEALS_PER_CART = 30
/** Logistics kitchen fee per meal (defaults.ts feePerMeal). */
export const KITCHEN_FEE_PER_MEAL = 6
/** Logistics fuel-farm throughput fee, dollars per litre. */
export const FUEL_MARKUP_PER_LITRE = 0.012

/** Tunables with no single catalog constant. Kept here so logic does not hard-code them. */
export const PARKING_PER_HOUR = 45
export const BAGS_PER_BAG = 8
export const PUSHBACK_FEE = 350
export const GPU_FEE = 180
export const LAV_WATER_FEE = 120
export const PRM_FEE = 75
export const PARKING_FREE_HOURS = 2

export interface FeeSchedule {
  landingPerTonne: number
  paxFee: number
  aircraftParkingPerHour: number
  aircraftParkingPerDay: number
  /** First N hours of aircraft parking are free. */
  parkingFreeHours: number
  fuelMarkupPerLitre: number
  cateringPerCart: number
  bagsPerBag: number
  cleaning: number
  deice: number
  pushback: number
  gpu: number
  lavWater: number
  prm: number
  cargoPerUnit: number
  helicopterLanding: number
  carParkShort: number
  carParkLong: number
  hotelNight: number
}

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  landingPerTonne: 8,
  paxFee: 12,
  aircraftParkingPerHour: PARKING_PER_HOUR,
  aircraftParkingPerDay: GA_PARK_DAY_RATE,
  parkingFreeHours: PARKING_FREE_HOURS,
  fuelMarkupPerLitre: FUEL_MARKUP_PER_LITRE,
  cateringPerCart: KITCHEN_FEE_PER_MEAL * CATERING_MEALS_PER_CART,
  bagsPerBag: BAGS_PER_BAG,
  cleaning: CLEANING_FEE,
  deice: DEICE_FEE,
  pushback: PUSHBACK_FEE,
  gpu: GPU_FEE,
  lavWater: LAV_WATER_FEE,
  prm: PRM_FEE,
  cargoPerUnit: CARGO_INTAKE_FEE,
  helicopterLanding: HELO_LANDING,
  carParkShort: PARK_SHORT_FEE,
  carParkLong: PARK_LONG_FEE,
  hotelNight: HOTEL_NIGHT_FEE,
}

export interface FeeField {
  key: keyof FeeSchedule
  label: string
  unit: string
  step: number
  min: number
  max: number
}

/** Slider metadata for the Fees side panel. Max sits above 1.3× so elasticity can show. */
export const FEE_FIELDS: readonly FeeField[] = [
  { key: 'landingPerTonne', label: 'Landing', unit: 'per tonne', step: 0.5, min: 0, max: 24 },
  { key: 'paxFee', label: 'Passenger', unit: 'per pax', step: 0.5, min: 0, max: 36 },
  { key: 'aircraftParkingPerHour', label: 'Aircraft parking', unit: 'per hour', step: 1, min: 0, max: 180 },
  { key: 'aircraftParkingPerDay', label: 'Aircraft parking', unit: 'per day', step: 5, min: 0, max: 1200 },
  { key: 'parkingFreeHours', label: 'Free parking', unit: 'hours', step: 1, min: 0, max: 8 },
  { key: 'fuelMarkupPerLitre', label: 'Fuel markup', unit: 'per litre', step: 0.001, min: 0, max: 0.05 },
  { key: 'cateringPerCart', label: 'Catering', unit: 'per cart', step: 5, min: 0, max: 600 },
  { key: 'bagsPerBag', label: 'Bags', unit: 'per bag', step: 0.5, min: 0, max: 30 },
  { key: 'cleaning', label: 'Cleaning', unit: 'per turn', step: 10, min: 0, max: 2700 },
  { key: 'deice', label: 'De-icing', unit: 'per turn', step: 10, min: 0, max: 4200 },
  { key: 'pushback', label: 'Pushback', unit: 'per turn', step: 5, min: 0, max: 1200 },
  { key: 'gpu', label: 'GPU', unit: 'per turn', step: 5, min: 0, max: 600 },
  { key: 'lavWater', label: 'Lav / water', unit: 'per turn', step: 5, min: 0, max: 400 },
  { key: 'prm', label: 'PRM', unit: 'per turn', step: 5, min: 0, max: 250 },
  { key: 'cargoPerUnit', label: 'Cargo', unit: 'per unit', step: 10, min: 0, max: 1500 },
  { key: 'helicopterLanding', label: 'Helicopter landing', unit: 'per landing', step: 20, min: 0, max: 7200 },
  { key: 'carParkShort', label: 'Car park short', unit: 'per stay', step: 1, min: 0, max: 100 },
  { key: 'carParkLong', label: 'Car park long', unit: 'per stay', step: 1, min: 0, max: 180 },
  { key: 'hotelNight', label: 'Hotel', unit: 'per night', step: 1, min: 0, max: 300 },
]

export function editFee(fees: FeeSchedule, key: keyof FeeSchedule, value: number): FeeSchedule {
  const next = Number.isFinite(value) ? Math.max(0, value) : fees[key]
  return { ...fees, [key]: next }
}

export interface TurnUsage {
  tonnes?: number
  pax?: number
  parkingHours?: number
  parkingDays?: number
  fuelLitres?: number
  cateringCarts?: number
  bags?: number
  cleaning?: boolean
  deice?: boolean
  pushback?: boolean
  gpu?: boolean
  lavWater?: boolean
  prm?: boolean
  cargoUnits?: number
  helicopter?: boolean
  carParkShort?: number
  carParkLong?: number
  hotelNights?: number
}

export type ChargeChannel = 'contract' | 'walkin'

export interface PriceContext {
  channel: ChargeChannel
  tier?: DepositTier
  /**
   * Extra multiplier on contract charges (1 = no discount).
   * Walk-in traffic ignores this and the deposit tier.
   */
  discount?: number
}

export interface PriceFactors {
  landing: number
  pax: number
  service: number
}

/** Contract charges are fee × deposit multiplier × discount. Walk-ins pay list price. */
export function priceFactors(ctx: PriceContext): PriceFactors {
  if (ctx.channel === 'walkin') return { landing: 1, pax: 1, service: 1 }
  const tier = ctx.tier ?? 'standard'
  const rawDiscount = ctx.discount === undefined ? 1 : ctx.discount
  const discount = Number.isFinite(rawDiscount) ? Math.max(0, rawDiscount) : 1
  return {
    landing: landingFeeMultiplier(tier) * discount,
    pax: landingFeeMultiplier(tier) * discount,
    service: serviceFeeMultiplier(tier) * discount,
  }
}

export interface FeeLine {
  id: string
  group: 'landing' | 'pax' | 'service' | 'landside'
  amount: number
}

function billableParkingHours(hours: number, freeHours: number): number {
  return Math.max(0, nonNegative(hours) - nonNegative(freeHours))
}

/** Line items at list price, before deposit and discount. */
export function listLines(usage: TurnUsage, fees: FeeSchedule = DEFAULT_FEE_SCHEDULE): FeeLine[] {
  const lines: FeeLine[] = []
  const push = (id: string, group: FeeLine['group'], amount: number) => {
    const value = finite(amount)
    if (value !== 0) lines.push({ id, group, amount: value })
  }
  push('landing', 'landing', nonNegative(usage.tonnes ?? 0) * nonNegative(fees.landingPerTonne))
  push('pax', 'pax', nonNegative(usage.pax ?? 0) * nonNegative(fees.paxFee))
  push(
    'parking_hour',
    'service',
    billableParkingHours(usage.parkingHours ?? 0, fees.parkingFreeHours) * nonNegative(fees.aircraftParkingPerHour),
  )
  push('parking_day', 'service', nonNegative(usage.parkingDays ?? 0) * nonNegative(fees.aircraftParkingPerDay))
  push('fuel', 'service', nonNegative(usage.fuelLitres ?? 0) * nonNegative(fees.fuelMarkupPerLitre))
  push('catering', 'service', nonNegative(usage.cateringCarts ?? 0) * nonNegative(fees.cateringPerCart))
  push('bags', 'service', nonNegative(usage.bags ?? 0) * nonNegative(fees.bagsPerBag))
  if (usage.cleaning) push('cleaning', 'service', nonNegative(fees.cleaning))
  if (usage.deice) push('deice', 'service', nonNegative(fees.deice))
  if (usage.pushback) push('pushback', 'service', nonNegative(fees.pushback))
  if (usage.gpu) push('gpu', 'service', nonNegative(fees.gpu))
  if (usage.lavWater) push('lav_water', 'service', nonNegative(fees.lavWater))
  if (usage.prm) push('prm', 'service', nonNegative(fees.prm))
  push('cargo', 'service', nonNegative(usage.cargoUnits ?? 0) * nonNegative(fees.cargoPerUnit))
  if (usage.helicopter) push('helicopter', 'landside', nonNegative(fees.helicopterLanding))
  push('car_short', 'landside', nonNegative(usage.carParkShort ?? 0) * nonNegative(fees.carParkShort))
  push('car_long', 'landside', nonNegative(usage.carParkLong ?? 0) * nonNegative(fees.carParkLong))
  push('hotel', 'landside', nonNegative(usage.hotelNights ?? 0) * nonNegative(fees.hotelNight))
  return lines
}

/** Integer cash for one turn. Landside (helo, car park, hotel) stays at list price. */
export function priceTurn(
  usage: TurnUsage,
  fees: FeeSchedule = DEFAULT_FEE_SCHEDULE,
  ctx: PriceContext = { channel: 'contract', tier: 'standard', discount: 1 },
): number {
  const factors = priceFactors(ctx)
  let total = 0
  for (const line of listLines(usage, fees)) {
    if (line.group === 'landing') total += line.amount * factors.landing
    else if (line.group === 'pax') total += line.amount * factors.pax
    else if (line.group === 'service') total += line.amount * factors.service
    else total += line.amount
  }
  return Math.round(finite(total))
}

/** Walk-in prices. The index is the mean of fee / default across these. */
export const ELASTICITY_KEYS = [
  'landingPerTonne',
  'paxFee',
  'carParkShort',
  'carParkLong',
  'hotelNight',
] as const satisfies readonly (keyof FeeSchedule)[]

export function feePriceIndex(
  fees: FeeSchedule,
  baseline: FeeSchedule = DEFAULT_FEE_SCHEDULE,
): number {
  let sum = 0
  let n = 0
  for (const key of ELASTICITY_KEYS) {
    const base = baseline[key]
    if (!(base > 0)) continue
    const value = Number.isFinite(fees[key]) ? fees[key] : base
    sum += value / base
    n += 1
  }
  if (!n) return 1
  const index = sum / n
  return Number.isFinite(index) ? index : 1
}

export interface Elasticity {
  priceIndex: number
  /** 1 at default prices. Above 1 when cheaper than default. Below 1 past 1.3×. */
  demand: number
  /** Standing points. Negative only once prices clear 1.3× default. */
  standingDelta: number
}

/**
 * Walk-in demand and Standing versus a price index (1 = default).
 * Below default, demand rises. From 1× through 1.3× nothing moves.
 * Above 1.3×, demand and Standing both fall.
 */
export function elasticity(priceIndex: number): Elasticity {
  const index = Number.isFinite(priceIndex) ? Math.max(0, priceIndex) : 1
  if (index < 1) {
    return { priceIndex: index, demand: 1 + (1 - index) * 0.8, standingDelta: 0 }
  }
  if (index <= 1.3) {
    return { priceIndex: index, demand: 1, standingDelta: 0 }
  }
  const over = index - 1.3
  return {
    priceIndex: index,
    demand: Math.max(0.2, 1 - over * 0.75),
    standingDelta: -Math.round(over * 80) / 10,
  }
}

export function scheduleElasticity(
  fees: FeeSchedule,
  baseline: FeeSchedule = DEFAULT_FEE_SCHEDULE,
): Elasticity {
  return elasticity(feePriceIndex(fees, baseline))
}
