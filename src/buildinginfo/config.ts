/**
 * Service points a clicked building reports.
 * Rates and staff counts live here. Logic only reads them.
 * Vehicle lists match the size ladder in src/scale (a jumbo tug is not a small tug).
 */

export type SizeTier = 'small' | 'wide' | 'jumbo'

export interface ServiceKit {
  id: string
  /** Short badge on the bottleneck icon. */
  badge: string
  /** Phrase after the colon: "Bay 2 idle: no tug". */
  missing: string
  vehicles: Record<SizeTier, readonly string[]>
}

export const SERVICE_KITS = {
  tug: {
    id: 'tug',
    badge: 'tug',
    missing: 'no tug',
    vehicles: {
      small: ['pushback_tug', 'heavy_tug'],
      wide: ['pushback_tug', 'heavy_tug'],
      jumbo: ['heavy_tug'],
    },
  },
  fuel: {
    id: 'fuel',
    badge: 'fuel',
    missing: 'no fuel truck',
    vehicles: {
      small: ['fuel_truck', 'heavy_fuel_truck', 'hydrant_dispenser'],
      wide: ['heavy_fuel_truck', 'hydrant_dispenser'],
      jumbo: ['hydrant_dispenser'],
    },
  },
  bags: {
    id: 'bags',
    badge: 'bags',
    missing: 'no baggage tug',
    vehicles: {
      small: ['baggage_tug', 'heavy_baggage_tug'],
      wide: ['heavy_baggage_tug'],
      jumbo: ['heavy_baggage_tug'],
    },
  },
  loader: {
    id: 'loader',
    badge: 'loader',
    missing: 'no belt loader',
    vehicles: {
      small: ['belt_loader', 'uld_loader', 'main_deck_loader'],
      wide: ['uld_loader', 'main_deck_loader'],
      jumbo: ['main_deck_loader'],
    },
  },
  catering: {
    id: 'catering',
    badge: 'catering',
    missing: 'no catering truck',
    vehicles: {
      small: ['catering_truck', 'highlift_catering'],
      wide: ['catering_truck', 'highlift_catering'],
      jumbo: ['highlift_catering'],
    },
  },
} as const satisfies Record<string, ServiceKit>

export type KitId = keyof typeof SERVICE_KITS

export interface BayPlan {
  kit: KitId | null
  /** Units per minute while this bay is actually in use. */
  rate: number
}

export interface BuildingPlan {
  /** Bodies the building needs before every bay can run. */
  staff: number
  /** Shown after the throughput figure. */
  unit: string
  /**
   * The building is the service. With staff and kit in place it counts as
   * working even when nobody is queued.
   */
  alwaysOn: boolean
  bays: readonly BayPlan[]
}

const service = (kit: KitId, rate: number): BayPlan => ({ kit, rate })
const open = (rate: number): BayPlan => ({ kit: null, rate })

/** Stand points, in panel order. Bay 2 is the tug so a missing tug reads "Bay 2 idle: no tug". */
const STAND_BAYS: readonly BayPlan[] = [
  service('fuel', 1),
  service('tug', 1),
  service('bags', 1),
  service('loader', 1),
  service('catering', 1),
]

const STAND_PLAN: BuildingPlan = { staff: 1, unit: 'services', alwaysOn: false, bays: STAND_BAYS }

export const BUILDING_PLANS: Record<string, BuildingPlan> = {
  stand: STAND_PLAN,
  fuel: { staff: 1, unit: 'L/min', alwaysOn: false, bays: [service('fuel', 1000), service('fuel', 1000)] },
  kitchen: { staff: 1, unit: 'meals/min', alwaysOn: false, bays: [service('catering', 40)] },
  bags: { staff: 1, unit: 'bags/min', alwaysOn: false, bays: [service('bags', 20), service('bags', 20)] },
  depot: { staff: 1, unit: 'services', alwaysOn: false, bays: [service('tug', 1), service('fuel', 1), service('loader', 1)] },
  cargo: { staff: 1, unit: 'loads/min', alwaysOn: false, bays: [service('loader', 40)] },
  deice: { staff: 1, unit: 'services', alwaysOn: false, bays: [open(1), open(1)] },
  hangar: { staff: 2, unit: 'services', alwaysOn: false, bays: [open(1), open(1)] },
  mro: { staff: 8, unit: 'checks/min', alwaysOn: false, bays: [open(1), open(1), open(1), open(1)] },
  terminal: { staff: 2, unit: 'pax/min', alwaysOn: false, bays: [open(12), open(8)] },
  checkin: { staff: 1, unit: 'pax/min', alwaysOn: false, bays: [open(12)] },
  security: { staff: 1, unit: 'pax/min', alwaysOn: false, bays: [open(8)] },
  nighthub: { staff: 12, unit: 't/min', alwaysOn: false, bays: [open(1), open(1), open(1), open(1)] },
  late_hotel: { staff: 2, unit: 'rooms', alwaysOn: true, bays: [open(1)] },
  late_cargo: { staff: 2, unit: 't/min', alwaysOn: false, bays: [open(1), open(1)] },
  late_landmark: { staff: 2, unit: 'visitors', alwaysOn: true, bays: [open(1)] },
  late_rail: { staff: 1, unit: 'services', alwaysOn: true, bays: [open(1)] },
  saf: { staff: 1, unit: 'L/min', alwaysOn: true, bays: [open(1)] },
}

export const DEFAULT_PLAN: BuildingPlan = {
  staff: 0,
  unit: '/ min',
  alwaysOn: true,
  bays: [open(1)],
}

export function planFor(kind: string | undefined): BuildingPlan {
  if (kind && BUILDING_PLANS[kind]) return BUILDING_PLANS[kind]
  return DEFAULT_PLAN
}

export function fleetHas(fleet: Readonly<Record<string, number>>, types: readonly string[]): boolean {
  for (const type of types) {
    const n = fleet[type]
    if (typeof n === 'number' && n > 0) return true
  }
  return false
}
