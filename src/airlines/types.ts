export type AirlineTier = 'regional' | 'low-cost' | 'full-service' | 'flag-carrier' | 'cargo';

export interface AirportCapabilities {
  runwayLengthMeters: number;
  hasSmallStands: boolean;
  hasMediumStands: boolean;
  hasHeavyStands: boolean;
  terminalRating: number; // 1 to 5
  hasFuelService: boolean;
  hasCateringService: boolean;
  hasMaintenanceService: boolean;
  hasHeavyVehicles: boolean; // From logistics (e.g., heavy pushback, large loaders)
  onTimePercentage: number; // 0 to 100
  totalFlightsHandled: number; // for progression unlocks
}

export interface AirlineRequirements {
  minRunwayLengthMeters: number;
  requiresSmallStands: boolean;
  requiresMediumStands: boolean;
  requiresHeavyStands: boolean;
  minTerminalRating: number;
  requiresFuel: boolean;
  requiresCatering: boolean;
  requiresMaintenance: boolean;
  requiresHeavyVehicles: boolean;
  minOnTimePercentage: number;
  minTotalFlightsHandled: number;
}

export interface Airline {
  id: string;
  name: string;
  tier: AirlineTier;
  fleet: string[]; // Airframe IDs from src/game/airframes.ts
  requirements: AirlineRequirements;
  baseSatisfaction: number;
}

export interface ContractTerms {
  slotsPerWeek: number;
  feePerPassenger: number;
  feePerLanding: number;
  penaltyPerCancellation: number;
  penaltyPerDelay: number;
}

export interface ContractOffer {
  id: string;
  airlineId: string;
  terms: ContractTerms;
  expiresAtHour: number; // hour in game time when the offer expires
  penaltyTier: number; // 0 = normal, 1 = worse, 2 = even worse
}

export interface ActiveContract {
  id: string;
  airlineId: string;
  terms: ContractTerms;
  signedAtHour: number;
  satisfaction: number; // 0 to 100
  penaltyTier: number;
}

export interface AirlineState {
  availableAirlines: Airline[];
  unlockedAirlines: string[]; // airline IDs that have been unlocked
  contractOffers: ContractOffer[];
  activeContracts: ActiveContract[];
  cooldowns: Record<string, number>; // airlineId -> hour when cooldown ends
  penaltyTiers: Record<string, number>; // airlineId -> current penalty tier (re-entry worse terms)
  elapsedHours: number;
}
