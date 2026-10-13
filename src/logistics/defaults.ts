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
