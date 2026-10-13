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
  minOnTimePercentage: number;
  minTotalFlightsHandled: number;
}

export interface Airline {
  id: string;
  name: string;
  tier: AirlineTier;
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
  expiresAtDay: number; // day in game time when the offer expires
}

export interface ActiveContract {
  id: string;
  airlineId: string;
  terms: ContractTerms;
  signedAtDay: number;
  satisfaction: number; // 0 to 100
}

export interface AirlineState {
  availableAirlines: Airline[];
  unlockedAirlines: string[]; // airline IDs that have been unlocked
  contractOffers: ContractOffer[];
  activeContracts: ActiveContract[];
  currentDay: number;
}
