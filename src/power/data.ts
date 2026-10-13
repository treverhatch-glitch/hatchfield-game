export type PlantTier = 1 | 2 | 3;

export interface PowerPlantSpec {
  tier: PlantTier;
  capacityMW: number;
  cost: number;
  dailyUpkeep: number;
}

export const POWER_PLANTS: Record<PlantTier, PowerPlantSpec> = {
  1: { tier: 1, capacityMW: 4, cost: 40_000, dailyUpkeep: 600 },
  2: { tier: 2, capacityMW: 12, cost: 120_000, dailyUpkeep: 1_500 },
  3: { tier: 3, capacityMW: 30, cost: 280_000, dailyUpkeep: 3_200 },
};

export const SUBSTATION_HEADROOM_BOOST = 0.25;
