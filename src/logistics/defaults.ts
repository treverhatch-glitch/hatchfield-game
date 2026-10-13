import type { HoldConfig, LogisticsConfig, PaxConfig, VehicleSpec, VehicleType } from './types'

export const DEFAULT_VEHICLE_SPECS: Record<VehicleType, VehicleSpec> = {
  fuel_truck: { speedKmh: 25, upkeepPerDay: 180, capacity: 20000, loadMinutes: 8 },
  catering_truck: { speedKmh: 25, upkeepPerDay: 120, capacity: 400, loadMinutes: 6 },
  /** Tug with a cart / dolly train: bags, or ULDs and bulk cargo by weight. */
  baggage_tug: { speedKmh: 20, upkeepPerDay: 60, capacity: 120, cargoCapacityKg: 6000, loadMinutes: 3, dropMinutes: 2 },
  pushback_tug: { speedKmh: 15, upkeepPerDay: 90, capacity: 0, loadMinutes: 0 },
  gpu: { speedKmh: 15, upkeepPerDay: 40, capacity: 0, loadMinutes: 0 },
  pax_bus: { speedKmh: 25, upkeepPerDay: 150, capacity: 60, loadMinutes: 0, dropMinutes: 1 },
  belt_loader: { speedKmh: 15, upkeepPerDay: 50, capacity: 0, loadMinutes: 0 },
  uld_loader: { speedKmh: 12, upkeepPerDay: 110, capacity: 0, loadMinutes: 0 },
  /** Heavy refueller, e.g. 70,000 L semi-trailer with a faster pump. */
  heavy_fuel_truck: { speedKmh: 20, upkeepPerDay: 320, capacity: 70000, loadMinutes: 15, pumpLpm: 1600 },
  /** Hydrant dispenser cart: no tank, couples to the hydrant pit. */
  hydrant_dispenser: { speedKmh: 25, upkeepPerDay: 140, capacity: 0, loadMinutes: 0 },
  /** High-lift catering truck: reaches the A380 upper deck (~8 m sill). */
  highlift_catering: { speedKmh: 20, upkeepPerDay: 200, capacity: 600, loadMinutes: 8 },
  /** Main-deck ULD loader (e.g. 14 t / 30 t class): faster container handling. */
  main_deck_loader: { speedKmh: 10, upkeepPerDay: 220, capacity: 0, loadMinutes: 0, rateMult: 1.6 },
  /** Tug with a longer cart / dolly train. */
  heavy_baggage_tug: { speedKmh: 20, upkeepPerDay: 90, capacity: 200, cargoCapacityKg: 12000, loadMinutes: 4, dropMinutes: 3 },
  /** Towbarless heavy tug rated for A380 / 747-8F / An-124 (~600 t). */
  heavy_tug: { speedKmh: 12, upkeepPerDay: 260, capacity: 0, loadMinutes: 0 },
}

export interface VehicleUnlock {
  /** Field Level and tech tier needed to buy one. */
  fieldLevel: number
  techTier: 1 | 2 | 3
  cost: number
  label: string
}

/** Progression: basic kit first, heavy-aircraft kit later. Upkeep lives in DEFAULT_VEHICLE_SPECS. */
export const VEHICLE_CATALOG: Record<VehicleType, VehicleUnlock> = {
  gpu: { fieldLevel: 1, techTier: 1, cost: 15000, label: 'Ground power unit' },
  pushback_tug: { fieldLevel: 1, techTier: 1, cost: 60000, label: 'Towbar pushback tug' },
  baggage_tug: { fieldLevel: 1, techTier: 1, cost: 25000, label: 'Baggage tug + carts' },
  belt_loader: { fieldLevel: 1, techTier: 1, cost: 30000, label: 'Belt loader' },
  fuel_truck: { fieldLevel: 1, techTier: 1, cost: 120000, label: 'Fuel truck (20,000 L)' },
  catering_truck: { fieldLevel: 1, techTier: 1, cost: 90000, label: 'Catering truck' },
  pax_bus: { fieldLevel: 2, techTier: 1, cost: 180000, label: 'Apron bus' },
  uld_loader: { fieldLevel: 3, techTier: 2, cost: 150000, label: 'ULD container loader' },
  heavy_baggage_tug: { fieldLevel: 3, techTier: 2, cost: 45000, label: 'Heavy tug + long cart train' },
  hydrant_dispenser: { fieldLevel: 4, techTier: 2, cost: 200000, label: 'Hydrant dispenser cart' },
  heavy_fuel_truck: { fieldLevel: 4, techTier: 2, cost: 280000, label: 'Heavy refueller (70,000 L)' },
  highlift_catering: { fieldLevel: 5, techTier: 3, cost: 220000, label: 'High-lift catering truck (A380)' },
  main_deck_loader: { fieldLevel: 5, techTier: 3, cost: 320000, label: 'Main-deck ULD loader' },
  heavy_tug: { fieldLevel: 6, techTier: 3, cost: 900000, label: 'Heavy towbarless tug (A380 / 747-8F / An-124)' },
}

/** Third jet bridge (A380 upper deck) for a stand. */
export const A380_STAND_UNLOCK = { fieldLevel: 6, techTier: 3 as const, cost: 2500000, upkeepPerDay: 600 }

export function isUnlocked(type: VehicleType, fieldLevel: number, techTier: number): boolean {
  const u = VEHICLE_CATALOG[type]
  return fieldLevel >= u.fieldLevel && techTier >= u.techTier
}

export function unlockedVehicles(fieldLevel: number, techTier: number): VehicleType[] {
  return (Object.keys(VEHICLE_CATALOG) as VehicleType[]).filter((t) => isUnlocked(t, fieldLevel, techTier))
}

/** Purchase price and daily upkeep of a fleet. */
export function fleetCost(fleet: Partial<Record<VehicleType, number>>): { purchase: number; upkeepPerDay: number } {
  let purchase = 0
  let upkeepPerDay = 0
  for (const [k, n] of Object.entries(fleet) as [VehicleType, number | undefined][]) {
    purchase += (n ?? 0) * VEHICLE_CATALOG[k].cost
    upkeepPerDay += (n ?? 0) * DEFAULT_VEHICLE_SPECS[k].upkeepPerDay
  }
  return { purchase, upkeepPerDay }
}

/** Starter-airport fleet plus the heavy-aircraft kit an A380 operation needs. */
export const A380_READY_FLEET: Partial<Record<VehicleType, number>> = {
  fuel_truck: 2,
  catering_truck: 2,
  baggage_tug: 6,
  pushback_tug: 2,
  gpu: 3,
  pax_bus: 3,
  belt_loader: 3,
  uld_loader: 2,
  heavy_fuel_truck: 2,
  hydrant_dispenser: 2,
  highlift_catering: 2,
  main_deck_loader: 2,
  heavy_baggage_tug: 4,
  heavy_tug: 1,
}

export const DEFAULT_PAX: PaxConfig = {
  loadFactor: 0.8,
  deplanePerDoor: { bridge: 18, stairs: 12 },
  boardPerDoor: { bridge: 12, stairs: 9 },
  doors: { bridge: { S: 1, M: 1, L: 2 }, stairs: { S: 1, M: 2, L: 2 } },
  groups: { S: 2, M: 4, L: 5 },
  groupGapMinutes: 3,
  gateCloseMinutes: { S: 8, M: 10, L: 15 },
  doorCloseMinutes: 2,
  noShowRate: 0.02,
  lateRate: 0.04,
  lateArrivalBeforeClose: 3,
  fuelWithPaxOnBoard: false,
  busGateLoadPerMin: 30,
}

export const DEFAULT_HOLD: HoldConfig = {
  bulk: { bagsPerMin: 20, kgPerMin: 400 },
  uld: { bagsPerMin: 45, kgPerMin: 2000 },
  offloadBaseMinutes: 3,
  offloadPerBagMinutes: 1.5,
  lateBagRate: 0.03,
  lateBagsBeforeClose: 8,
}

/**
 * Small starter airport: depot, fuel farm and kitchen on a service road
 * that runs past four stands. Stands 1-2 have jet bridges (1 also hydrant pits), 3-4 airstairs, remote-1 is a bus stand.
 */
export function defaultConfig(overrides: Partial<LogisticsConfig> = {}): LogisticsConfig {
  return {
    nodes: [
      { id: 'depot', x: 0, y: 0 },
      { id: 'farm', x: -300, y: 0 },
      { id: 'kitchen', x: 0, y: -200 },
      { id: 'j1', x: 200, y: 0 },
      { id: 'j2', x: 400, y: 0 },
      { id: 's1', x: 200, y: 100 },
      { id: 's2', x: 400, y: 100 },
      { id: 's3', x: 600, y: 100 },
      { id: 's4', x: 800, y: 100 },
      { id: 'j3', x: 600, y: 0 },
      { id: 'j4', x: 800, y: 0 },
      { id: 'terminal', x: 300, y: -150 },
      { id: 'makeup', x: 450, y: -150 },
      { id: 'cargo', x: -150, y: -250 },
      { id: 's5', x: 1300, y: 300 },
      { id: 's6', x: 1000, y: 100 },
      { id: 'j5', x: 1000, y: 0 },
    ],
    edges: [
      { a: 'depot', b: 'farm' },
      { a: 'depot', b: 'kitchen' },
      { a: 'depot', b: 'j1' },
      { a: 'j1', b: 'j2' },
      { a: 'j2', b: 'j3' },
      { a: 'j3', b: 'j4' },
      { a: 'j1', b: 's1' },
      { a: 'j2', b: 's2' },
      { a: 'j3', b: 's3' },
      { a: 'j4', b: 's4' },
      { a: 'j1', b: 'terminal' },
      { a: 'terminal', b: 'makeup' },
      { a: 'makeup', b: 'j2' },
      { a: 'kitchen', b: 'cargo' },
      { a: 'j4', b: 's5' },
      { a: 'j4', b: 'j5' },
      { a: 'j5', b: 's6' },
    ],
    depotNode: 'depot',
    terminalNode: 'terminal',
    makeupNode: 'makeup',
    cargoNode: 'cargo',
    stands: [
      { id: 'stand-1', node: 's1', hydrant: true, access: 'bridge' },
      { id: 'stand-2', node: 's2', hydrant: false, access: 'bridge' },
      { id: 'stand-3', node: 's3', hydrant: false, access: 'stairs' },
      { id: 'stand-4', node: 's4', hydrant: false, access: 'stairs' },
      { id: 'remote-1', node: 's5', hydrant: false, access: 'remote' },
      { id: 'heavy-1', node: 's6', hydrant: true, access: 'bridge', bridges: 3 },
    ],
    fuelFarm: {
      node: 'farm',
      capacityLitres: 500000,
      initialLitres: 300000,
      lowStockLitres: 80000,
      purchasePricePerLitre: 0.7,
      markup: 0.15,
      tankerLitres: 36000,
      deliveryLeadMinutes: 120,
      autoReorder: false,
    },
    kitchen: {
      node: 'kitchen',
      capacityMeals: 3000,
      initialMeals: 1500,
      mealsPerHour: 300,
      lowStockMeals: 300,
      costPerMeal: 4,
      feePerMeal: 9,
    },
    vehicles: { fuel_truck: 2, catering_truck: 2, baggage_tug: 6, pushback_tug: 2, gpu: 3, pax_bus: 3, belt_loader: 3, uld_loader: 2 },
    vehicleSpecs: DEFAULT_VEHICLE_SPECS,
    truckPumpLpm: 1000,
    hydrantPumpLpm: 2500,
    pax: DEFAULT_PAX,
    hold: DEFAULT_HOLD,
    ...overrides,
  }
}

/**
 * A380 demo/test scenario on the 3-bridge hydrant stand `heavy-1`: the basic
 * starter fleet vs the A380-ready fleet. No-shows are set to zero so the only
 * difference is the kit (no-show bag offload is tested separately).
 */
export function a380ScenarioConfig(upgraded: boolean): LogisticsConfig {
  return defaultConfig({
    ...(upgraded ? { vehicles: A380_READY_FLEET } : {}),
    pax: { ...DEFAULT_PAX, noShowRate: 0 },
  })
}
