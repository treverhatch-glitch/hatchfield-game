export type AcClass = 'regional' | 'narrowbody' | 'widebody' | 'super';
export type StandSize = 'light' | 'narrow' | 'heavy';

export interface GpuUnitDef {
  id: string;
  name: string;
  /** Max aircraft class this mobile GPU can supply */
  maxClass: AcClass;
  hasPca: boolean;
  cost: number;
  upkeepPerDay: number;
}

export interface TurnaroundPowerNeed {
  acClass: AcClass;
  standSize: StandSize;
  /** Minutes of ground power needed before push */
  minutes: number;
  /** True when cabin air is also needed (hot/cold day) */
  wantPca: boolean;
  /** Stand already has fixed gpu_pca fitting and plant has spare capacity */
  fixedLive: boolean;
}

export const APU_BURN_RATES: Record<AcClass, number> = {
  regional: 0.08,
  narrowbody: 0.18,
  widebody: 0.35,
  super: 0.55
};

export const MOBILE_GPU_UNITS: GpuUnitDef[] = [
  { id: 'gpu_van', name: 'GPU Van', maxClass: 'regional', hasPca: false, cost: 50000, upkeepPerDay: 50 },
  { id: 'gpu_truck_narrow', name: 'Narrowbody GPU Truck', maxClass: 'narrowbody', hasPca: false, cost: 100000, upkeepPerDay: 100 },
  { id: 'gpu_truck_wide', name: 'Widebody GPU Truck', maxClass: 'super', hasPca: false, cost: 150000, upkeepPerDay: 150 },
  { id: 'gpu_pca_narrow', name: 'Narrowbody GPU+PCA', maxClass: 'narrowbody', hasPca: true, cost: 200000, upkeepPerDay: 200 },
  { id: 'gpu_pca_wide', name: 'Widebody GPU+PCA', maxClass: 'super', hasPca: true, cost: 300000, upkeepPerDay: 300 },
];

export function classRank(c: AcClass): number {
  switch (c) {
    case 'regional': return 1;
    case 'narrowbody': return 2;
    case 'widebody': return 3;
    case 'super': return 4;
    default: return 0;
  }
}

export function gpuMinutesForStand(size: StandSize): number {
  switch (size) {
    case 'light': return 20;
    case 'narrow': return 35;
    case 'heavy': return 60;
    default: return 0;
  }
}

export function canCover(unit: GpuUnitDef, need: TurnaroundPowerNeed): boolean {
  if (need.fixedLive) return true;
  if (classRank(unit.maxClass) < classRank(need.acClass)) return false;
  if (need.wantPca && !unit.hasPca) return false;
  return true;
}

export function apuTonnesSaved(need: TurnaroundPowerNeed, isCovered: boolean = need.fixedLive): number {
  if (!isCovered) return 0;
  return (need.minutes / 60) * APU_BURN_RATES[need.acClass];
}

export function fleetCoverage(units: GpuUnitDef[], needs: TurnaroundPowerNeed[]): { covered: number; shortfall: number } {
  let covered = 0;
  let shortfall = 0;
  const availableUnits = [...units];
  
  for (const need of needs) {
    if (need.fixedLive) {
      covered++;
      continue;
    }
    
    let bestUnitIdx = -1;
    let bestScore = Infinity;
    
    for (let i = 0; i < availableUnits.length; i++) {
      const u = availableUnits[i];
      if (canCover(u, need)) {
        const rankDiff = classRank(u.maxClass) - classRank(need.acClass);
        const pcaScore = (u.hasPca ? 1 : 0) - (need.wantPca ? 1 : 0);
        const score = rankDiff * 10 + pcaScore;
        if (score < bestScore) {
          bestScore = score;
          bestUnitIdx = i;
        }
      }
    }
    
    if (bestUnitIdx !== -1) {
      availableUnits.splice(bestUnitIdx, 1);
      covered++;
    } else {
      shortfall++;
    }
  }
  
  return { covered, shortfall };
}

interface GpuPcaCheck {
  id?: unknown
  cost?: unknown
  upkeepPerDay?: unknown
  maxClass?: unknown
  hasPca?: unknown
}

export function validateGpuPca(list: readonly object[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  
  for (let i = 0; i < list.length; i++) {
    const item = list[i] as GpuPcaCheck;
    if (!item.id || typeof item.id !== 'string') {
      errors.push(`Item at index ${i} is missing an id`);
    } else {
      if (ids.has(item.id)) {
        errors.push(`Duplicate id found: ${item.id}`);
      }
      ids.add(item.id);
    }
    
    if (typeof item.cost !== 'number' || item.cost < 0) {
      errors.push(`Item ${item.id} has invalid cost`);
    }
    if (typeof item.upkeepPerDay !== 'number' || item.upkeepPerDay < 0) {
      errors.push(`Item ${item.id} has invalid upkeepPerDay`);
    }
    
    const validClasses = ['regional', 'narrowbody', 'widebody', 'super'];
    if (typeof item.maxClass !== 'string' || !validClasses.includes(item.maxClass)) {
      errors.push(`Item ${item.id} has invalid maxClass: ${item.maxClass}`);
    }
    
    if (typeof item.hasPca !== 'boolean') {
      errors.push(`Item ${item.id} has invalid hasPca`);
    }
  }
  
  return errors;
}
