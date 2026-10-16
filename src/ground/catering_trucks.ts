export type PaxClass = 'regional' | 'narrowbody' | 'widebody' | 'super'

export interface CateringTruckDef {
  id: string
  name: string
  /** Max aircraft class this truck can service */
  maxClass: PaxClass
  /** Whether a high-lift body is required for this class */
  highLift: boolean
  /** Carts / half-carts capacity */
  cartCapacity: number
  /** Purchase cost USD */
  cost: number
  /** Upkeep per game day */
  upkeepPerDay: number
}

export interface CateringDemand {
  airframeClass: PaxClass
  seats: number
  /** Full-service vs buy-on-board intensity 0–1 */
  serviceLevel: number
}

export const CATERING_TRUCKS: CateringTruckDef[] = [
  {
    id: 'trk_cat_van',
    name: 'Catering Van',
    maxClass: 'regional',
    highLift: false,
    cartCapacity: 4,
    cost: 35000,
    upkeepPerDay: 50
  },
  {
    id: 'trk_cat_light',
    name: 'Light Catering Truck',
    maxClass: 'narrowbody',
    highLift: false,
    cartCapacity: 10,
    cost: 55000,
    upkeepPerDay: 80
  },
  {
    id: 'trk_cat_medium',
    name: 'Medium Catering Truck',
    maxClass: 'narrowbody',
    highLift: false,
    cartCapacity: 18,
    cost: 75000,
    upkeepPerDay: 120
  },
  {
    id: 'trk_cat_hl_standard',
    name: 'High-Lift Catering Truck',
    maxClass: 'widebody',
    highLift: true,
    cartCapacity: 24,
    cost: 150000,
    upkeepPerDay: 250
  },
  {
    id: 'trk_cat_hl_heavy',
    name: 'Heavy High-Lift Truck',
    maxClass: 'super',
    highLift: true,
    cartCapacity: 32,
    cost: 210000,
    upkeepPerDay: 350
  },
  {
    id: 'trk_cat_hl_super',
    name: 'Super High-Lift Truck',
    maxClass: 'super',
    highLift: true,
    cartCapacity: 48,
    cost: 280000,
    upkeepPerDay: 500
  }
]

export function classRank(c: PaxClass): number {
  switch (c) {
    case 'regional': return 1
    case 'narrowbody': return 2
    case 'widebody': return 3
    case 'super': return 4
    default: return 0
  }
}

export function requiresHighLift(c: PaxClass): boolean {
  return classRank(c) >= 3 // widebody and super
}

export function cartsNeeded(d: CateringDemand): number {
  if (d.seats <= 0) return 0;
  const raw = d.seats * (0.4 + 0.8 * d.serviceLevel) / 30;
  return Math.max(1, Math.ceil(raw));
}

export function canServe(truck: CateringTruckDef, d: CateringDemand): boolean {
  if (classRank(truck.maxClass) < classRank(d.airframeClass)) return false;
  if (requiresHighLift(d.airframeClass) && !truck.highLift) return false;
  if (truck.cartCapacity < cartsNeeded(d)) return false;
  return true;
}

export function fleetCoverage(
  trucks: CateringTruckDef[],
  demands: CateringDemand[]
): { ok: boolean; shortfall: number } {
  let shortfall = 0;
  const available = [...trucks];
  
  for (const demand of demands) {
    // find a truck that can serve this demand, preferably with lowest capacity that works
    available.sort((a, b) => a.cartCapacity - b.cartCapacity);
    const index = available.findIndex(t => canServe(t, demand));
    if (index >= 0) {
      available.splice(index, 1);
    } else {
      shortfall++;
    }
  }

  return { ok: shortfall === 0, shortfall };
}

export function validateCateringTrucks(list: CateringTruckDef[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const truck of list) {
    if (!truck.id) {
      errors.push(`Missing id on truck ${truck.name}`);
    } else if (ids.has(truck.id)) {
      errors.push(`Duplicate id: ${truck.id}`);
    } else {
      ids.add(truck.id);
    }

    if (truck.cartCapacity <= 0) errors.push(`${truck.id} has invalid cart capacity`);
    if (truck.cost < 0) errors.push(`${truck.id} has invalid cost`);
    if (truck.upkeepPerDay < 0) errors.push(`${truck.id} has invalid upkeep`);
  }

  return errors;
}
