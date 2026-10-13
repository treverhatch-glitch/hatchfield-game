import type { LogisticsConfig, VehicleSpec, VehicleType } from './types'

export const DEFAULT_VEHICLE_SPECS: Record<VehicleType, VehicleSpec> = {
  fuel_truck: { speedKmh: 25, upkeepPerDay: 180, capacity: 20000, loadMinutes: 8 },
  catering_truck: { speedKmh: 25, upkeepPerDay: 120, capacity: 400, loadMinutes: 6 },
  baggage_tug: { speedKmh: 20, upkeepPerDay: 60, capacity: 0, loadMinutes: 0 },
  pushback_tug: { speedKmh: 15, upkeepPerDay: 90, capacity: 0, loadMinutes: 0 },
  gpu: { speedKmh: 15, upkeepPerDay: 40, capacity: 0, loadMinutes: 0 },
}

/**
 * Small starter airport: depot, fuel farm and kitchen on a service road
 * that runs past four stands. Stand 1 has hydrant pits.
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
    ],
    depotNode: 'depot',
    stands: [
      { id: 'stand-1', node: 's1', hydrant: true },
      { id: 'stand-2', node: 's2', hydrant: false },
      { id: 'stand-3', node: 's3', hydrant: false },
      { id: 'stand-4', node: 's4', hydrant: false },
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
    vehicles: { fuel_truck: 2, catering_truck: 2, baggage_tug: 3, pushback_tug: 2, gpu: 3 },
    vehicleSpecs: DEFAULT_VEHICLE_SPECS,
    truckPumpLpm: 1000,
    hydrantPumpLpm: 2500,
    ...overrides,
  }
}
