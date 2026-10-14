import type { RelationsState } from '../wave3/types.ts'

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
  penaltyPerDelayMinute: number; // Changed from per delay to per minute late
}

export interface ContractOffer {
  id: string;
  airlineId: string;
  terms: ContractTerms;
  expiresAtMinute: number; // sim minute when the offer expires
  penaltyTier: number; // 0 = normal, 1 = worse, 2 = even worse
  /** Relationship contract tier. 1 keeps the published terms. */
  contractTier?: number;
  /** Airframe ids from this carrier's own fleet. Tiers do not add metal. */
  airframes?: string[];
}

export interface ActiveContract {
  id: string;
  airlineId: string;
  terms: ContractTerms;
  signedAtMinute: number;
  satisfaction: number; // 0 to 100
  penaltyTier: number;
}

export interface AirlineEvent {
  type: 'contract_offer' | 'contract_signed' | 'contract_terminated' | 'rating_up' | 'rating_down';
  time: number; // sim minutes
  airlineId: string;
  contractId?: string;
  details?: string;
}

export interface AirlineState {
  availableAirlines: Airline[];
  unlockedAirlines: string[]; // airline IDs that have been unlocked
  contractOffers: ContractOffer[];
  activeContracts: ActiveContract[];
  cooldowns: Record<string, number>; // airlineId -> sim minutes when cooldown ends
  penaltyTiers: Record<string, number>; // airlineId -> current penalty tier (re-entry worse terms)
  elapsedMinutes: number; // Changed from elapsedHours to sim minutes
  events: AirlineEvent[]; // Event emitter queue
  /** Relationship scores. Missing on older states — offers stay at tier 1. */
  relations?: RelationsState;
}
