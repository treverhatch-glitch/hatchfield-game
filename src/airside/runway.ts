import type { AircraftClass, RunwayMode, TowerTier } from './data';
import {
  TOWER_BASE_CAPACITY,
  TOWER_TIER_MAP,
  RUNWAY_MODE_MULTIPLIERS,
  WAKE_MULTIPLIERS,
} from './data';

export interface RunwayCapacityOptions {
  runways?: number;
  mode?: RunwayMode | string;
  tower?: TowerTier | string | number;
  fleetMix?: Partial<Record<AircraftClass | string, number>>;
}

export function getWakeMultiplier(leader: AircraftClass | string, follower: AircraftClass | string): number {
  const l = leader.toLowerCase();
  const f = follower.toLowerCase();

  // Super (A380) leading any non-super
  if (l === 'super' || l === 'a380') {
    if (f !== 'super' && f !== 'a380') {
      return WAKE_MULTIPLIERS.SUPER_LEAD_NON_SUPER;
    }
  }

  // Heavy (heavy, widebody, jumbo) leading Light (light, small, regional)
  const isHeavy = l === 'heavy' || l === 'widebody' || l === 'jumbo';
  const isLight = f === 'light' || f === 'small' || f === 'regional';

  if (isHeavy && isLight) {
    return WAKE_MULTIPLIERS.HEAVY_LEAD_LIGHT;
  }

  return WAKE_MULTIPLIERS.DEFAULT;
}

export function calculateAverageWakePenalty(fleetMix?: Partial<Record<AircraftClass | string, number>>): number {
  if (!fleetMix) {
    return 1.0;
  }

  const entries = Object.entries(fleetMix).filter(([, count]) => typeof count === 'number' && !Number.isNaN(count) && count > 0);
  if (entries.length === 0) {
    return 1.0;
  }

  const total = entries.reduce((sum, [, count]) => sum + (count as number), 0);
  if (total <= 0 || Number.isNaN(total)) {
    return 1.0;
  }

  const shares = entries.map(([cls, count]) => ({
    cls,
    share: (count as number) / total,
  }));

  let weightedSum = 0;
  for (const leader of shares) {
    for (const follower of shares) {
      const mult = getWakeMultiplier(leader.cls, follower.cls);
      weightedSum += leader.share * follower.share * mult;
    }
  }

  return weightedSum > 0 && !Number.isNaN(weightedSum) ? weightedSum : 1.0;
}

export function runwayCapacity(options: RunwayCapacityOptions = {}): number {
  const runwaysCount = typeof options.runways === 'number' && !Number.isNaN(options.runways) ? options.runways : 1;
  const towerTierInput = options.tower ?? 1;
  const tierKey = String(towerTierInput);
  const tierNum = TOWER_TIER_MAP[tierKey] ?? 1;
  const baseCap = TOWER_BASE_CAPACITY[tierNum] ?? 30;

  const rawMode = options.mode ?? 'single';
  const modeKey = (runwaysCount > 1 && rawMode in RUNWAY_MODE_MULTIPLIERS) ? rawMode : 'single';
  const modeMultiplier = RUNWAY_MODE_MULTIPLIERS[modeKey as RunwayMode] ?? 1.0;

  const wakePenalty = calculateAverageWakePenalty(options.fleetMix);

  const rawCapacity = (baseCap * modeMultiplier) / wakePenalty;

  if (Number.isNaN(rawCapacity) || !Number.isFinite(rawCapacity) || rawCapacity < 0) {
    return 0;
  }

  return rawCapacity;
}
