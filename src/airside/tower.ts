import type { TowerTier } from './data';
import { TOWER_BASE_CAPACITY, TOWER_III_UPGRADE, TOWER_TIER_MAP } from './data';

export function normalizeTowerTier(tier: TowerTier | string | number): number {
  const key = String(tier);
  return TOWER_TIER_MAP[key] ?? 1;
}

export function towerTierFor(movementsPerHr: number): number {
  if (typeof movementsPerHr !== 'number' || Number.isNaN(movementsPerHr) || movementsPerHr <= 0) {
    return 1;
  }

  if (movementsPerHr <= TOWER_BASE_CAPACITY[1]) {
    return 1;
  }
  if (movementsPerHr <= TOWER_BASE_CAPACITY[2]) {
    return 2;
  }
  return 3;
}

export interface TowerUpgradeAdvice {
  currentTier: number;
  recommendedTier: number;
  needsUpgrade: boolean;
  currentCapacity: number;
  recommendedCapacity: number;
  utilization: number;
  reason: string;
}

export function towerUpgradeAdvice(
  currentTierInput: TowerTier | string | number,
  currentMovementsPerHr: number
): TowerUpgradeAdvice {
  const currentTier = normalizeTowerTier(currentTierInput);
  const safeMovements = typeof currentMovementsPerHr === 'number' && !Number.isNaN(currentMovementsPerHr)
    ? Math.max(0, currentMovementsPerHr)
    : 0;

  const currentCapacity = TOWER_BASE_CAPACITY[currentTier] ?? 30;
  const recommendedTier = towerTierFor(safeMovements);
  const recommendedCapacity = TOWER_BASE_CAPACITY[recommendedTier] ?? 50;

  const needsUpgrade = currentTier < recommendedTier;
  const utilization = currentCapacity > 0 ? safeMovements / currentCapacity : 0;

  let reason = 'Tower capacity is adequate for current traffic.';
  if (needsUpgrade) {
    reason = `Movements (${safeMovements}/hr) exceed Tower Tier ${currentTier} capacity (${currentCapacity}/hr). Upgrade to Tier ${recommendedTier} recommended.`;
  } else if (utilization > 0.9) {
    reason = `Tower Tier ${currentTier} operating near maximum capacity (${Math.round(utilization * 100)}%). Consider upgrading soon.`;
  }

  return {
    currentTier,
    recommendedTier,
    needsUpgrade,
    currentCapacity,
    recommendedCapacity,
    utilization,
    reason,
  };
}

export interface TowerIIIUpgradeGate {
  towerPlaced: boolean;
  fieldLevel: number;
  hasApproachControl: boolean;
  alreadyBuilt: boolean;
}

export function canBuildTowerIII(gate: TowerIIIUpgradeGate): { ok: boolean; why: string } {
  if (!gate.towerPlaced) return { ok: false, why: 'Click a placed control tower.' };
  if (gate.alreadyBuilt) {
    return { ok: false, why: 'Tower III is already operating at this airport.' };
  }
  if (gate.fieldLevel < TOWER_III_UPGRADE.minFieldLevel) {
    return {
      ok: false,
      why: `Needs Field level ${TOWER_III_UPGRADE.minFieldLevel}.`,
    };
  }
  if (!gate.hasApproachControl) {
    return { ok: false, why: 'Commission ATC approach first.' };
  }
  return { ok: true, why: 'Ready to build.' };
}
