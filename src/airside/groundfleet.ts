import type { AircraftClass } from './data';
import { FLEET_SPARE_FACTOR } from './data';

export interface GroundFleetRequirement {
  lightTugs: number;
  mediumTugs: number;
  heavyTugs: number;
  towbarlessTugs: number;
  highLiftCatering: number;
  gpuUnits: number;
  totalUnits: number;
}

export type TurnsPerHrByClass = Partial<Record<AircraftClass | string, number>>;

function sanitizeCount(count?: number): number {
  if (typeof count !== 'number' || Number.isNaN(count) || count < 0) {
    return 0;
  }
  return count;
}

/**
 * Calculates ground fleet sizing based on turns per hour by aircraft class,
 * applying a 15% spare factor and rounding up.
 *
 * Requirements by class:
 * - Small & Regional: light tug
 * - Narrowbody: medium tug, GPU/PCA
 * - Widebody: heavy tug, high-lift catering, GPU/PCA
 * - Jumbo: heavy tug AND towbarless tug, high-lift catering, GPU/PCA
 * - Super: heavy tug AND towbarless tug, high-lift catering, GPU/PCA
 */
export function requiredFleet(
  turnsPerHrByClass: TurnsPerHrByClass = {},
  spareFactor: number = FLEET_SPARE_FACTOR
): GroundFleetRequirement {
  const safeFactor = typeof spareFactor === 'number' && !Number.isNaN(spareFactor) && spareFactor >= 0
    ? spareFactor
    : FLEET_SPARE_FACTOR;

  let rawLightTugs = 0;
  let rawMediumTugs = 0;
  let rawHeavyTugs = 0;
  let rawTowbarlessTugs = 0;
  let rawHighLiftCatering = 0;
  let rawGpuUnits = 0;

  for (const [cls, turns] of Object.entries(turnsPerHrByClass)) {
    const safeTurns = sanitizeCount(turns);
    if (safeTurns === 0) continue;

    const lowerCls = cls.toLowerCase();

    switch (lowerCls) {
      case 'small':
      case 'regional':
        rawLightTugs += safeTurns;
        break;

      case 'narrowbody':
        rawMediumTugs += safeTurns;
        rawGpuUnits += safeTurns;
        break;

      case 'widebody':
        rawHeavyTugs += safeTurns;
        rawHighLiftCatering += safeTurns;
        rawGpuUnits += safeTurns;
        break;

      case 'jumbo':
      case 'super':
      case 'a380':
        rawHeavyTugs += safeTurns;
        rawTowbarlessTugs += safeTurns;
        rawHighLiftCatering += safeTurns;
        rawGpuUnits += safeTurns;
        break;

      default:
        // Default unhandled fallback if unknown class
        rawMediumTugs += safeTurns;
        break;
    }
  }

  const applySpareAndRound = (rawCount: number): number => {
    if (rawCount <= 0) return 0;
    const countWithSpare = rawCount * (1 + safeFactor);
    return Math.ceil(countWithSpare);
  };

  const lightTugs = applySpareAndRound(rawLightTugs);
  const mediumTugs = applySpareAndRound(rawMediumTugs);
  const heavyTugs = applySpareAndRound(rawHeavyTugs);
  const towbarlessTugs = applySpareAndRound(rawTowbarlessTugs);
  const highLiftCatering = applySpareAndRound(rawHighLiftCatering);
  const gpuUnits = applySpareAndRound(rawGpuUnits);

  const totalUnits = lightTugs + mediumTugs + heavyTugs + towbarlessTugs + highLiftCatering + gpuUnits;

  return {
    lightTugs,
    mediumTugs,
    heavyTugs,
    towbarlessTugs,
    highLiftCatering,
    gpuUnits,
    totalUnits,
  };
}
