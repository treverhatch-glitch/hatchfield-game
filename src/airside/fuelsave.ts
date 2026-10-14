import type { AircraftClass } from './data';
import { GPU_SAVINGS_KG } from './data';

export interface GpuSavingsResult {
  totalFuelSavedKg: number;
  totalCostSaved: number;
  savingsByClass: Record<string, { turns: number; fuelSavedKg: number; costSaved: number }>;
}

export type TurnsByClass = Partial<Record<AircraftClass | string, number>>;

export function gpuSavings(
  turnsByClass: TurnsByClass = {},
  fuelPricePerKg: number = 0
): GpuSavingsResult {
  const safePrice = typeof fuelPricePerKg === 'number' && !Number.isNaN(fuelPricePerKg) && fuelPricePerKg >= 0
    ? fuelPricePerKg
    : 0;

  let totalFuelSavedKg = 0;
  const savingsByClass: Record<string, { turns: number; fuelSavedKg: number; costSaved: number }> = {};

  for (const [cls, turns] of Object.entries(turnsByClass)) {
    const safeTurns = typeof turns === 'number' && !Number.isNaN(turns) && turns >= 0 ? turns : 0;
    const lowerCls = cls.toLowerCase() as AircraftClass;
    const kgPerTurn = GPU_SAVINGS_KG[lowerCls] ?? 0;

    const fuelSavedKg = safeTurns * kgPerTurn;
    const costSaved = fuelSavedKg * safePrice;

    totalFuelSavedKg += fuelSavedKg;

    savingsByClass[cls] = {
      turns: safeTurns,
      fuelSavedKg,
      costSaved,
    };
  }

  const totalCostSaved = totalFuelSavedKg * safePrice;

  return {
    totalFuelSavedKg: Number.isNaN(totalFuelSavedKg) ? 0 : totalFuelSavedKg,
    totalCostSaved: Number.isNaN(totalCostSaved) ? 0 : totalCostSaved,
    savingsByClass,
  };
}
