import type { Airline } from './types.ts';

export const DEFAULT_AIRLINES: Airline[] = [
  {
    id: 'air_regional_1',
    name: 'Puddle Jumper Airlines',
    tier: 'regional',
    fleet: ['crj700', 'e175', 'atr72'],
    baseSatisfaction: 70,
    requirements: {
      minRunwayLengthMeters: 1500, // ~5000 ft, typical for regional jets (FAA AC 150/5325-4B)
      requiresSmallStands: true,
      requiresMediumStands: false,
      requiresHeavyStands: false,
      minTerminalRating: 1,
      requiresFuel: false,
      requiresCatering: false,
      requiresMaintenance: false,
      requiresHeavyVehicles: false,
      minOnTimePercentage: 60,
      minTotalFlightsHandled: 0
    }
  },
  {
    id: 'air_lowcost_1',
    name: 'SkyCheap',
    tier: 'low-cost',
    fleet: ['a320neo', 'b738', 'a321'],
    baseSatisfaction: 60,
    requirements: {
      minRunwayLengthMeters: 2000, // ~6500 ft, typical for fully loaded narrowbodies
      requiresSmallStands: false,
      requiresMediumStands: true,
      requiresHeavyStands: false,
      minTerminalRating: 2,
      requiresFuel: true,
      requiresCatering: false,
      requiresMaintenance: false,
      requiresHeavyVehicles: false,
      minOnTimePercentage: 75,
      minTotalFlightsHandled: 50
    }
  },
  {
    id: 'air_fullservice_1',
    name: 'Prestige Air',
    tier: 'full-service',
    fleet: ['a320neo', 'b738', 'a321', 'b789', 'a359'],
    baseSatisfaction: 80,
    requirements: {
      minRunwayLengthMeters: 2500, // ~8200 ft, needed for widebodies on medium haul
      requiresSmallStands: false,
      requiresMediumStands: true,
      requiresHeavyStands: false,
      minTerminalRating: 4,
      requiresFuel: true,
      requiresCatering: true,
      requiresMaintenance: false,
      requiresHeavyVehicles: false,
      minOnTimePercentage: 85,
      minTotalFlightsHandled: 200
    }
  },
  {
    id: 'air_flag_1',
    name: 'National Airways',
    tier: 'flag-carrier',
    fleet: ['b789', 'a359', 'a380'],
    baseSatisfaction: 90,
    requirements: {
      minRunwayLengthMeters: 3000, // ~10000 ft, typical for long-haul widebodies at MTOW
      requiresSmallStands: false,
      requiresMediumStands: true,
      requiresHeavyStands: true,
      minTerminalRating: 5,
      requiresFuel: true,
      requiresCatering: true,
      requiresMaintenance: true,
      requiresHeavyVehicles: true,
      minOnTimePercentage: 90,
      minTotalFlightsHandled: 500
    }
  },
  {
    id: 'air_cargo_1',
    name: 'HeavyLift Cargo',
    tier: 'cargo',
    fleet: ['b752f', 'b763f', 'b748f', 'an124'],
    baseSatisfaction: 50,
    requirements: {
      minRunwayLengthMeters: 3000, // ~10000 ft, freighters are often heavy
      requiresSmallStands: false,
      requiresMediumStands: false,
      requiresHeavyStands: true,
      minTerminalRating: 1, // Cargo doesn't care about passenger terminal
      requiresFuel: true,
      requiresCatering: false,
      requiresMaintenance: true,
      requiresHeavyVehicles: true,
      minOnTimePercentage: 70,
      minTotalFlightsHandled: 100
    }
  }
];
