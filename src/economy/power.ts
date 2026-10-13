import type { PowerLoad, PowerPlantTier, PowerSnapshot } from './types'

export const POWER_PLANT_CAPACITY: Readonly<Record<PowerPlantTier, number>> = {
  1: 250,
  2: 650,
  3: 1_400,
}

/**
 * Power is deliberately one site-wide capacity number. Brown-outs slow powered
 * services in proportion to supply, with a floor so failures create delays.
 */
export function calculatePower(
  tier: PowerPlantTier,
  loads: readonly PowerLoad[],
  capacityMultiplier = 1,
  demandMultiplier = 1,
  batteryCapacity = 0,
): PowerSnapshot {
  const baseCapacity = POWER_PLANT_CAPACITY[tier]
  const capacity = Math.max(0, baseCapacity * capacityMultiplier + batteryCapacity)
  const demand = loads.reduce((sum, load) => sum + Math.max(0, load.demand), 0) * Math.max(0, demandMultiplier)
  const supplied = Math.min(capacity, demand)
  const brownout = demand > capacity
  return {
    tier,
    capacity,
    demand,
    supplied,
    brownout,
    throughputMultiplier: brownout && demand > 0 ? Math.max(0.2, capacity / demand) : 1,
  }
}
