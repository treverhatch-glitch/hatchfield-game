import type { PowerPlantTier } from './types.ts'

/**
 * Site power is one capacity number. Tier I is the city feed.
 * Tier II covers a second MRO hangar plus the night hub.
 * Tier III covers a jumbo campus on top of that.
 */
export interface PowerPlantOffer {
  tier: PowerPlantTier
  name: string
  /** Cash to build this tier from the one below. Tier I is already on the field. */
  cost: number
  upkeepPerDay: number
  minFieldLevel: number
}

export const POWER_PLANTS: readonly PowerPlantOffer[] = [
  { tier: 1, name: 'Power plant I', cost: 0, upkeepPerDay: 0, minFieldLevel: 1 },
  { tier: 2, name: 'Power plant II', cost: 64_000, upkeepPerDay: 3_200, minFieldLevel: 4 },
  { tier: 3, name: 'Power plant III', cost: 128_000, upkeepPerDay: 7_400, minFieldLevel: 5 },
]

export function powerPlantOffer(tier: PowerPlantTier): PowerPlantOffer {
  return POWER_PLANTS[tier - 1] ?? POWER_PLANTS[0]
}

export function nextPowerTier(tier: PowerPlantTier): PowerPlantTier | null {
  if (tier >= 3) return null
  return (tier + 1) as PowerPlantTier
}

export function canUpgradePower(
  tier: PowerPlantTier,
  fieldLevel: number,
): { ok: boolean; why: string; cost: number; next: PowerPlantTier | null } {
  const next = nextPowerTier(tier)
  if (!next) return { ok: false, why: 'Power plant is already Tier III.', cost: 0, next: null }
  const offer = powerPlantOffer(next)
  if (fieldLevel < offer.minFieldLevel) {
    return { ok: false, why: `${offer.name} needs Field level ${offer.minFieldLevel}.`, cost: offer.cost, next }
  }
  return { ok: true, why: '', cost: offer.cost, next }
}
