import type { PlantTier, PowerPlantSpec } from './data';
import { POWER_PLANTS, SUBSTATION_HEADROOM_BOOST } from './data';

export type PlantInputItem =
  | PlantTier
  | number
  | { tier?: PlantTier | number; capacityMW?: number; dailyUpkeep?: number }
  | PowerPlantSpec;

export type PlantInput =
  | PlantInputItem
  | readonly PlantInputItem[]
  | Record<number | string, number>
  | null
  | undefined;

export function getPlantSpecs(plants: PlantInput): PowerPlantSpec[] {
  if (plants == null) {
    return [];
  }

  if (Array.isArray(plants)) {
    const specs: PowerPlantSpec[] = [];
    for (const item of plants) {
      if (typeof item === 'number') {
        const spec = POWER_PLANTS[item as PlantTier];
        if (spec) {
          specs.push(spec);
        } else if (item > 0) {
          specs.push({ tier: 1, capacityMW: item, cost: 0, dailyUpkeep: 0 });
        }
      } else if (typeof item === 'object' && item !== null) {
        if ('tier' in item && item.tier != null && item.tier in POWER_PLANTS) {
          specs.push(POWER_PLANTS[item.tier as PlantTier]);
        } else {
          specs.push({
            tier: (item as PowerPlantSpec).tier ?? 1,
            capacityMW: (item as PowerPlantSpec).capacityMW ?? 0,
            cost: (item as PowerPlantSpec).cost ?? 0,
            dailyUpkeep: (item as PowerPlantSpec).dailyUpkeep ?? 0,
          });
        }
      }
    }
    return specs;
  }

  if (typeof plants === 'number') {
    const spec = POWER_PLANTS[plants as PlantTier];
    return spec ? [spec] : [];
  }

  if (typeof plants === 'object') {
    if ('tier' in plants || 'capacityMW' in plants || 'dailyUpkeep' in plants) {
      return getPlantSpecs([plants as PlantInputItem]);
    }
    const specs: PowerPlantSpec[] = [];
    for (const [key, val] of Object.entries(plants)) {
      const tierNum = Number(key) as PlantTier;
      const count = typeof val === 'number' ? Math.max(0, val) : 0;
      const spec = POWER_PLANTS[tierNum];
      if (spec) {
        for (let i = 0; i < count; i++) {
          specs.push(spec);
        }
      }
    }
    return specs;
  }

  return [];
}

export function siteCapacityMW(
  plants?: PlantInput,
  substations: number | boolean | readonly unknown[] | null = 0,
): number {
  const specs = getPlantSpecs(plants);
  const baseMW = specs.reduce((sum, p) => sum + p.capacityMW, 0);

  let subCount = 0;
  if (typeof substations === 'number') {
    subCount = Math.max(0, substations);
  } else if (typeof substations === 'boolean') {
    subCount = substations ? 1 : 0;
  } else if (Array.isArray(substations)) {
    subCount = substations.length;
  }

  const boost = 1 + subCount * SUBSTATION_HEADROOM_BOOST;
  return baseMW * boost;
}

export function dailyUpkeep(plants?: PlantInput): number {
  const specs = getPlantSpecs(plants);
  return specs.reduce((sum, p) => sum + p.dailyUpkeep, 0);
}

export function brownoutFactor(loadMW: number, capMW: number): number {
  if (Number.isNaN(loadMW) || Number.isNaN(capMW)) {
    return 1;
  }

  const safeCap = Math.max(0, capMW);
  const safeLoad = Math.max(0, loadMW);

  if (safeCap === 0) {
    return safeLoad > 0 ? 0.5 : 1;
  }

  const ratio = safeLoad / safeCap;

  if (ratio <= 0.9) {
    return 1;
  }
  if (ratio >= 1.2) {
    return 0.5;
  }

  const factor = 1 - ((ratio - 0.9) / 0.3) * 0.5;
  return Math.max(0.5, Math.min(1, factor));
}
