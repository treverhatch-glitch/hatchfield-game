import { ARFF_CATEGORIES, getCategoryConfig } from './data.ts';

export interface ArffAirframe {
  lengthM: number;
  widthM: number;
}

export interface ArffResources {
  vehicles?: number;
  agents?: number;
  waterLiters?: number;
  category?: number;
}

export interface ArffMissingCover {
  vehicles: number;
  agents: number;
  waterLiters: number;
  category: number;
  isCovered: boolean;
}

/**
 * Calculates the required ICAO ARFF category for a single aircraft airframe
 * based on its overall length and maximum fuselage width.
 */
export function categoryForAirframe(airframe: ArffAirframe): number {
  const { lengthM, widthM } = airframe;

  let lengthCat = 10;
  if (lengthM < 9) lengthCat = 1;
  else if (lengthM < 12) lengthCat = 2;
  else if (lengthM < 18) lengthCat = 3;
  else if (lengthM < 24) lengthCat = 4;
  else if (lengthM < 28) lengthCat = 5;
  else if (lengthM < 39) lengthCat = 6;
  else if (lengthM < 49) lengthCat = 7;
  else if (lengthM < 61) lengthCat = 8;
  else if (lengthM < 76) lengthCat = 9;
  else lengthCat = 10;

  const config = getCategoryConfig(lengthCat);
  if (config && widthM > config.maxWidthM) {
    return Math.min(10, lengthCat + 1);
  }

  return lengthCat;
}

/**
 * Calculates the required ARFF category for a list of operating aircraft
 * based on the largest (highest category) aircraft in the set.
 * Returns 0 if airframes list is empty.
 */
export function requiredCategory(airframes: ArffAirframe[]): number {
  if (!airframes || airframes.length === 0) {
    return 0;
  }
  let maxCat = 0;
  for (const airframe of airframes) {
    const cat = categoryForAirframe(airframe);
    if (cat > maxCat) {
      maxCat = cat;
    }
  }
  return maxCat;
}

/**
 * Determines whether a 1-category remission is allowed under ICAO Annex 14.
 * Remission is allowed if aircraft in the highest category operate under
 * 700 movements in the busiest 3 consecutive months.
 */
export function remissionAllowed(movementsOfTopCat: number): boolean {
  return movementsOfTopCat < 700;
}

/**
 * Calculates the effective required category after applying remission if allowed.
 */
export function effectiveCategory(requiredCat: number, movementsOfTopCat: number): number {
  if (requiredCat <= 0) return 0;
  if (remissionAllowed(movementsOfTopCat)) {
    return Math.max(1, requiredCat - 1);
  }
  return requiredCat;
}

/**
 * Compares current airport ARFF resources or category against required category `cat`,
 * returning the missing equipment, staff, water capacity, and category level.
 */
export function missingCover(have: ArffResources | number, cat: number): ArffMissingCover {
  if (cat <= 0) {
    return { vehicles: 0, agents: 0, waterLiters: 0, category: 0, isCovered: true };
  }

  const reqConfig = getCategoryConfig(cat);
  const reqVehicles = reqConfig?.vehicles ?? 0;
  const reqAgents = reqConfig?.agents ?? 0;
  const reqWater = reqConfig?.waterLiters ?? 0;

  let availVehicles = 0;
  let availAgents = 0;
  let availWater = 0;
  let availCat = 0;

  if (typeof have === 'number') {
    availCat = Math.max(0, Math.floor(have));
    const haveConfig = getCategoryConfig(availCat);
    if (haveConfig) {
      availVehicles = haveConfig.vehicles;
      availAgents = haveConfig.agents;
      availWater = haveConfig.waterLiters;
    }
  } else if (have && typeof have === 'object') {
    if (typeof have.category === 'number' && have.category > 0) {
      availCat = have.category;
      const catConfig = getCategoryConfig(have.category);
      availVehicles = have.vehicles ?? catConfig?.vehicles ?? 0;
      availAgents = have.agents ?? catConfig?.agents ?? 0;
      availWater = have.waterLiters ?? catConfig?.waterLiters ?? 0;
    } else {
      availVehicles = have.vehicles ?? 0;
      availAgents = have.agents ?? 0;
      availWater = have.waterLiters ?? 0;

      // Infer available category based on provided resources
      for (let c = 10; c >= 1; c--) {
        const cfg = ARFF_CATEGORIES[c];
        if (cfg && availVehicles >= cfg.vehicles && availAgents >= cfg.agents && availWater >= cfg.waterLiters) {
          availCat = c;
          break;
        }
      }
    }
  }

  const missingVehicles = Math.max(0, reqVehicles - availVehicles);
  const missingAgents = Math.max(0, reqAgents - availAgents);
  const missingWater = Math.max(0, reqWater - availWater);
  const missingCategory = Math.max(0, cat - availCat);

  const isCovered = missingVehicles === 0 && missingAgents === 0 && missingWater === 0;

  return {
    vehicles: missingVehicles,
    agents: missingAgents,
    waterLiters: missingWater,
    category: missingCategory,
    isCovered,
  };
}
