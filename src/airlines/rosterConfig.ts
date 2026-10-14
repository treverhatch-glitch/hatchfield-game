/** Tunable numbers for the roster: requirements, unlock gates and offer profiles per airline type. */
import type { AirlineRequirements, ContractTerms } from './types.ts'

type Type = 'budget' | 'flag' | 'regional' | 'cargo' | 'charter' | 'heli'

/** Requirements per type. The five base airlines keep their own in data.ts. */
export const TYPE_REQS: Record<Type, Partial<AirlineRequirements>> = {
  budget: { minRunwayLengthMeters: 2000, requiresMediumStands: true, minTerminalRating: 2, requiresFuel: true, minOnTimePercentage: 75 },
  flag: {
    minRunwayLengthMeters: 3000,
    requiresMediumStands: true,
    requiresHeavyStands: true,
    minTerminalRating: 4,
    requiresFuel: true,
    requiresCatering: true,
    requiresMaintenance: true,
    requiresHeavyVehicles: true,
    minOnTimePercentage: 85,
  },
  regional: { minRunwayLengthMeters: 1200, requiresSmallStands: true, minOnTimePercentage: 60 },
  cargo: {
    minRunwayLengthMeters: 3000,
    requiresHeavyStands: true,
    requiresFuel: true,
    requiresMaintenance: true,
    requiresHeavyVehicles: true,
    minOnTimePercentage: 70,
  },
  charter: { minRunwayLengthMeters: 2000, requiresMediumStands: true, minTerminalRating: 2, requiresFuel: true, minOnTimePercentage: 65 },
  heli: { minRunwayLengthMeters: 0, minOnTimePercentage: 50 },
}

export const TYPE_SATISFACTION: Record<Type, number> = { budget: 60, flag: 85, regional: 70, cargo: 50, charter: 60, heli: 75 }

/** Flights handled before the legacy unlock check lets the airline in. */
export const TYPE_UNLOCK_FLIGHTS: Record<Type, number> = { heli: 20, regional: 10, budget: 60, charter: 120, cargo: 150, flag: 400 }

/**
 * Unlock gate by airport size (1 to 5) and reputation (0 to 100). The first
 * airline of a type needs `base`; each next one in roster order adds `step`.
 */
export const UNLOCK_GATES: Record<Type, { size: number; reputation: number; reputationStep: number }> = {
  heli: { size: 1, reputation: 20, reputationStep: 4 },
  regional: { size: 1, reputation: 25, reputationStep: 4 },
  budget: { size: 2, reputation: 40, reputationStep: 3 },
  charter: { size: 3, reputation: 50, reputationStep: 4 },
  // The first freighter is a feeder a small field can earn (the old UPPS slot); heavies climb from there.
  cargo: { size: 1, reputation: 20, reputationStep: 7 },
  flag: { size: 4, reputation: 65, reputationStep: 3 },
}

export const MAX_REPUTATION = 100

/**
 * Live game: new contract letters come from the roster. The 8 catalog
 * carriers stay resolvable for existing contracts, saves and scenarios.
 */
export const ROSTER_LIVE = true

/** Airport size (1 to 5) the live game reports for roster unlocks: field level, capped. */
export const ROSTER_SIZE_CAP = 5

export interface OfferProfile {
  /** Movements (arrival plus departure pairs) per week. */
  slotsPerWeek: number
  /** Minimum turnaround the airline demands, minutes. */
  turnaroundMinutes: number
  terms: ContractTerms
  /** Size classes the airline's flights use. */
  sizeClasses: ('regional' | 'narrow' | 'wide' | 'super')[]
  needsCargoApron: boolean
  needsHelipad: boolean
  /** Terminal rating, catering and heavy stands the airline insists on. */
  needsPremiumFacilities: boolean
  /** Flights run only inside this hour window (inclusive start, exclusive end, wraps midnight). */
  nightWindow?: [number, number]
  /** Lower number is served first when stands are short. Medevac is 0. */
  priority: number
}

export const OFFER_PROFILES: Record<Type, OfferProfile> = {
  budget: {
    slotsPerWeek: 56,
    turnaroundMinutes: 25,
    terms: { slotsPerWeek: 56, feePerPassenger: 7, feePerLanding: 300, penaltyPerCancellation: 1500, penaltyPerDelayMinute: 20 },
    sizeClasses: ['narrow'],
    needsCargoApron: false,
    needsHelipad: false,
    needsPremiumFacilities: false,
    priority: 3,
  },
  flag: {
    slotsPerWeek: 7,
    turnaroundMinutes: 90,
    terms: { slotsPerWeek: 7, feePerPassenger: 18, feePerLanding: 2400, penaltyPerCancellation: 6000, penaltyPerDelayMinute: 55 },
    sizeClasses: ['wide', 'super'],
    needsCargoApron: false,
    needsHelipad: false,
    needsPremiumFacilities: true,
    priority: 2,
  },
  regional: {
    slotsPerWeek: 28,
    turnaroundMinutes: 30,
    terms: { slotsPerWeek: 28, feePerPassenger: 5, feePerLanding: 150, penaltyPerCancellation: 500, penaltyPerDelayMinute: 5 },
    sizeClasses: ['regional'],
    needsCargoApron: false,
    needsHelipad: false,
    needsPremiumFacilities: false,
    priority: 4,
  },
  cargo: {
    slotsPerWeek: 7,
    turnaroundMinutes: 120,
    terms: { slotsPerWeek: 7, feePerPassenger: 0, feePerLanding: 3500, penaltyPerCancellation: 4000, penaltyPerDelayMinute: 40 },
    sizeClasses: ['narrow', 'wide', 'super'],
    needsCargoApron: true,
    needsHelipad: false,
    needsPremiumFacilities: false,
    nightWindow: [22, 6],
    priority: 5,
  },
  charter: {
    slotsPerWeek: 14,
    turnaroundMinutes: 50,
    terms: { slotsPerWeek: 14, feePerPassenger: 12, feePerLanding: 700, penaltyPerCancellation: 2000, penaltyPerDelayMinute: 20 },
    sizeClasses: ['narrow', 'wide'],
    needsCargoApron: false,
    needsHelipad: false,
    needsPremiumFacilities: false,
    priority: 4,
  },
  heli: {
    slotsPerWeek: 14,
    turnaroundMinutes: 15,
    terms: { slotsPerWeek: 14, feePerPassenger: 40, feePerLanding: 2400, penaltyPerCancellation: 3000, penaltyPerDelayMinute: 60 },
    sizeClasses: ['regional'],
    needsCargoApron: false,
    needsHelipad: true,
    needsPremiumFacilities: false,
    priority: 1,
  },
}

/** Medevac outranks everything else for stands and pads. */
export const MEDEVAC_PRIORITY = 0
export const MEDEVAC_AIRLINE_IDS: readonly string[] = ['medevac_one', 'skyline_rescue']

/** Charter peaks, as day-of-year ranges (inclusive, may wrap the new year) with a slot multiplier. */
export const CHARTER_PEAKS: { fromDay: number; toDay: number; multiplier: number }[] = [
  { fromDay: 152, toDay: 243, multiplier: 2 },
  { fromDay: 350, toDay: 10, multiplier: 1.6 },
]
export const CHARTER_OFFSEASON_MULTIPLIER = 0.4

/** Each rejection or lapse costs fees; this matches the legacy engine. */
export const PENALTY_FEE_FACTOR = 0.85
export const PENALTY_FINE_FACTOR = 1.25

export const OFFER_LIFETIME_DAYS = 7
export const OFFER_DAILY_PROBABILITY = 0.2
