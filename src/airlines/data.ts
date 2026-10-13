import type { Airline } from './types.ts';

export const DEFAULT_AIRLINES: Airline[] = [
  {
    id: 'air_regional_1',
    name: 'Puddle Jumper Airlines',
    tier: 'regional',
    baseSatisfaction: 70,
    requirements: {
      minRunwayLengthMeters: 1200,
      requiresSmallStands: true,
      requiresMediumStands: false,
      requiresHeavyStands: false,
      minTerminalRating: 1,
      requiresFuel: false,
      requiresCatering: false,
      requiresMaintenance: false,
      minOnTimePercentage: 60,
      minTotalFlightsHandled: 0
    }
  },
  {
    id: 'air_lowcost_1',
    name: 'SkyCheap',
    tier: 'low-cost',
    baseSatisfaction: 60,
    requirements: {
      minRunwayLengthMeters: 2000,
      requiresSmallStands: false,
      requiresMediumStands: true,
      requiresHeavyStands: false,
      minTerminalRating: 2,
      requiresFuel: true,
      requiresCatering: false,
      requiresMaintenance: false,
      minOnTimePercentage: 75,
      minTotalFlightsHandled: 50
    }
  },
  {
    id: 'air_fullservice_1',
    name: 'Prestige Air',
    tier: 'full-service',
    baseSatisfaction: 80,
    requirements: {
      minRunwayLengthMeters: 2500,
      requiresSmallStands: false,
      requiresMediumStands: true,
      requiresHeavyStands: false,
      minTerminalRating: 4,
      requiresFuel: true,
      requiresCatering: true,
      requiresMaintenance: false,
      minOnTimePercentage: 85,
      minTotalFlightsHandled: 200
    }
  },
  {
    id: 'air_flag_1',
    name: 'National Airways',
    tier: 'flag-carrier',
    baseSatisfaction: 90,
    requirements: {
      minRunwayLengthMeters: 3000,
      requiresSmallStands: false,
      requiresMediumStands: true,
      requiresHeavyStands: true,
      minTerminalRating: 5,
      requiresFuel: true,
      requiresCatering: true,
      requiresMaintenance: true,
      minOnTimePercentage: 90,
      minTotalFlightsHandled: 500
    }
  },
  {
    id: 'air_cargo_1',
    name: 'HeavyLift Cargo',
    tier: 'cargo',
    baseSatisfaction: 50,
    requirements: {
      minRunwayLengthMeters: 3500,
      requiresSmallStands: false,
      requiresMediumStands: false,
      requiresHeavyStands: true,
      minTerminalRating: 1, // Cargo doesn't care about passenger terminal
      requiresFuel: true,
      requiresCatering: false,
      requiresMaintenance: true,
      minOnTimePercentage: 70,
      minTotalFlightsHandled: 100
    }
  }
];
