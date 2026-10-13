import type {
  AirlineState,
  AirportCapabilities,
  ContractOffer,
  ActiveContract,
  Airline,
  ContractTerms
} from './types.ts';

/**
 * Checks which airlines can be unlocked based on the airport's progression.
 * Returns a new state with updated unlockedAirlines.
 */
export function checkUnlocks(state: AirlineState, airport: AirportCapabilities): AirlineState {
  const newUnlocked = new Set(state.unlockedAirlines);

  for (const airline of state.availableAirlines) {
    if (!newUnlocked.has(airline.id)) {
      if (airport.totalFlightsHandled >= airline.requirements.minTotalFlightsHandled) {
        newUnlocked.add(airline.id);
      }
    }
  }

  return {
    ...state,
    unlockedAirlines: Array.from(newUnlocked)
  };
}

/**
 * Checks if an airport meets the requirements for a specific airline.
 */
export function meetsRequirements(airline: Airline, airport: AirportCapabilities): boolean {
  const reqs = airline.requirements;

  if (airport.runwayLengthMeters < reqs.minRunwayLengthMeters) return false;
  if (reqs.requiresSmallStands && !airport.hasSmallStands) return false;
  if (reqs.requiresMediumStands && !airport.hasMediumStands) return false;
  if (reqs.requiresHeavyStands && !airport.hasHeavyStands) return false;
  if (airport.terminalRating < reqs.minTerminalRating) return false;
  if (reqs.requiresFuel && !airport.hasFuelService) return false;
  if (reqs.requiresCatering && !airport.hasCateringService) return false;
  if (reqs.requiresMaintenance && !airport.hasMaintenanceService) return false;
  if (reqs.requiresHeavyVehicles && !airport.hasHeavyVehicles) return false;
  if (airport.onTimePercentage < reqs.minOnTimePercentage) return false;

  return true;
}

/**
 * Generates contract terms based on the airline tier and penalty tier.
 * Penalty tier 0 = normal, 1 = worse (re-entry after termination/rejection), 2 = even worse.
 */
function generateTermsForTier(tier: string, penaltyTier: number): ContractTerms {
  // Base terms grounded in real-world references
  // Passenger fees: ~$4-20 depending on airport/airline type
  // Landing fees: ~$2-5 per 1000 lbs, simplified here per landing
  let base: ContractTerms;
  switch (tier) {
    case 'regional':
      base = {
        slotsPerWeek: 14,
        feePerPassenger: 5,
        feePerLanding: 150,
        penaltyPerCancellation: 500,
        penaltyPerDelay: 100
      };
      break;
    case 'low-cost':
      base = {
        slotsPerWeek: 28,
        feePerPassenger: 9, // LCCs negotiate lower pax fees
        feePerLanding: 400,
        penaltyPerCancellation: 1500,
        penaltyPerDelay: 300
      };
      break;
    case 'full-service':
      base = {
        slotsPerWeek: 21,
        feePerPassenger: 14,
        feePerLanding: 1000,
        penaltyPerCancellation: 3000,
        penaltyPerDelay: 800
      };
      break;
    case 'flag-carrier':
      base = {
        slotsPerWeek: 14,
        feePerPassenger: 18,
        feePerLanding: 2000,
        penaltyPerCancellation: 5000,
        penaltyPerDelay: 1500
      };
      break;
    case 'cargo':
      base = {
        slotsPerWeek: 7,
        feePerPassenger: 0, // Cargo has no passengers
        feePerLanding: 3500, // Higher landing fees for heavy freighters
        penaltyPerCancellation: 4000,
        penaltyPerDelay: 1000
      };
      break;
    default:
      base = {
        slotsPerWeek: 7,
        feePerPassenger: 10,
        feePerLanding: 200,
        penaltyPerCancellation: 1000,
        penaltyPerDelay: 200
      };
  }

  // Apply penalty tier (worse terms for the airport)
  // Each penalty tier reduces fees by 15% and increases penalties by 25%
  const feeMultiplier = Math.pow(0.85, penaltyTier);
  const penaltyMultiplier = Math.pow(1.25, penaltyTier);

  return {
    slotsPerWeek: base.slotsPerWeek,
    feePerPassenger: Math.round(base.feePerPassenger * feeMultiplier),
    feePerLanding: Math.round(base.feePerLanding * feeMultiplier),
    penaltyPerCancellation: Math.round(base.penaltyPerCancellation * penaltyMultiplier),
    penaltyPerDelay: Math.round(base.penaltyPerDelay * penaltyMultiplier)
  };
}

/**
 * Randomly generates contract offers for unlocked airlines that meet requirements.
 * Ensures we don't spam offers if one already exists for the airline.
 * Tick-agnostic: probability based on elapsed hours.
 */
export function generateContractOffers(state: AirlineState, airport: AirportCapabilities, hoursPassed: number): AirlineState {
  if (hoursPassed <= 0) return state;

  const newOffers: ContractOffer[] = [...state.contractOffers];
  const existingOfferAirlineIds = new Set(newOffers.map(o => o.airlineId));
  const activeContractAirlineIds = new Set(state.activeContracts.map(c => c.airlineId));

  // 20% chance per day (24 hours) -> calculate probability for hoursPassed
  // P(at least one event in t hours) = 1 - (1 - P_daily)^(t/24)
  const dailyProb = 0.20;
  const prob = 1 - Math.pow(1 - dailyProb, hoursPassed / 24);

  for (const airlineId of state.unlockedAirlines) {
    // Skip if we already have an offer or active contract
    if (existingOfferAirlineIds.has(airlineId) || activeContractAirlineIds.has(airlineId)) {
      continue;
    }

    // Skip if on cooldown
    if (state.cooldowns[airlineId] && state.elapsedHours < state.cooldowns[airlineId]) {
      continue;
    }

    const airline = state.availableAirlines.find(a => a.id === airlineId);
    if (!airline) continue;

    if (meetsRequirements(airline, airport)) {
      if (Math.random() < prob) {
        const penaltyTier = state.penaltyTiers[airlineId] || 0;
        newOffers.push({
          id: `offer_${Date.now()}_${airline.id}`,
          airlineId: airline.id,
          terms: generateTermsForTier(airline.tier, penaltyTier),
          expiresAtHour: state.elapsedHours + (7 * 24), // Expires in 7 days
          penaltyTier
        });
      }
    }
  }

  return {
    ...state,
    contractOffers: newOffers
  };
}

/**
 * Accepts a contract offer.
 */
export function acceptContractOffer(state: AirlineState, offerId: string): AirlineState {
  const offerIndex = state.contractOffers.findIndex(o => o.id === offerId);
  if (offerIndex === -1) return state;

  const offer = state.contractOffers[offerIndex];
  const airline = state.availableAirlines.find(a => a.id === offer.airlineId);

  const newContract: ActiveContract = {
    id: `contract_${offer.id}`,
    airlineId: offer.airlineId,
    terms: offer.terms,
    signedAtHour: state.elapsedHours,
    satisfaction: airline ? airline.baseSatisfaction : 50,
    penaltyTier: offer.penaltyTier
  };

  const newOffers = [...state.contractOffers];
  newOffers.splice(offerIndex, 1);

  return {
    ...state,
    contractOffers: newOffers,
    activeContracts: [...state.activeContracts, newContract]
  };
}

/**
 * Rejects a contract offer.
 * Triggers a 30-day cooldown and increases penalty tier.
 */
export function rejectContractOffer(state: AirlineState, offerId: string): AirlineState {
  const offer = state.contractOffers.find(o => o.id === offerId);
  if (!offer) return state;

  return {
    ...state,
    contractOffers: state.contractOffers.filter(o => o.id !== offerId),
    cooldowns: {
      ...state.cooldowns,
      [offer.airlineId]: state.elapsedHours + (30 * 24) // 30 days cooldown
    },
    penaltyTiers: {
      ...state.penaltyTiers,
      [offer.airlineId]: (state.penaltyTiers[offer.airlineId] || 0) + 1
    }
  };
}

/**
 * Removes expired contract offers.
 * Triggers a 30-day cooldown and increases penalty tier.
 */
export function expireOffers(state: AirlineState): AirlineState {
  const expiredOffers = state.contractOffers.filter(o => o.expiresAtHour <= state.elapsedHours);
  if (expiredOffers.length === 0) return state;

  const newCooldowns = { ...state.cooldowns };
  const newPenaltyTiers = { ...state.penaltyTiers };

  for (const offer of expiredOffers) {
    newCooldowns[offer.airlineId] = state.elapsedHours + (30 * 24);
    newPenaltyTiers[offer.airlineId] = (state.penaltyTiers[offer.airlineId] || 0) + 1;
  }

  return {
    ...state,
    contractOffers: state.contractOffers.filter(o => o.expiresAtHour > state.elapsedHours),
    cooldowns: newCooldowns,
    penaltyTiers: newPenaltyTiers
  };
}

export interface FlightEvent {
  contractId: string;
  type: 'success' | 'delay' | 'cancellation';
}

/**
 * Updates satisfaction based on flight events.
 * If satisfaction drops to 0, contract is terminated with a 30-day cooldown and worse terms.
 */
export function processFlightEvents(state: AirlineState, events: FlightEvent[]): AirlineState {
  const newCooldowns = { ...state.cooldowns };
  const newPenaltyTiers = { ...state.penaltyTiers };
  
  const newContracts = state.activeContracts.map(contract => {
    let newSatisfaction = contract.satisfaction;
    
    const contractEvents = events.filter(e => e.contractId === contract.id);
    for (const event of contractEvents) {
      if (event.type === 'success') {
        newSatisfaction += 0.5;
      } else if (event.type === 'delay') {
        newSatisfaction -= 2;
      } else if (event.type === 'cancellation') {
        newSatisfaction -= 10;
      }
    }

    // Clamp between 0 and 100
    newSatisfaction = Math.max(0, Math.min(100, newSatisfaction));
    
    return {
      ...contract,
      satisfaction: newSatisfaction
    };
  });

  // Remove contracts that dropped to 0 satisfaction
  const survivingContracts = newContracts.filter(c => {
    if (c.satisfaction <= 0) {
      newCooldowns[c.airlineId] = state.elapsedHours + (30 * 24);
      newPenaltyTiers[c.airlineId] = (state.penaltyTiers[c.airlineId] || 0) + 1;
      return false;
    }
    return true;
  });

  return {
    ...state,
    activeContracts: survivingContracts,
    cooldowns: newCooldowns,
    penaltyTiers: newPenaltyTiers
  };
}

/**
 * Calculates the overall airline rating based on average satisfaction of active contracts.
 * Returns 0 to 100. Compatible with PR #7 rating hooks.
 */
export function getAirlineRating(state: AirlineState): number {
  if (state.activeContracts.length === 0) return 50; // Default if no contracts
  
  const totalSatisfaction = state.activeContracts.reduce((sum, contract) => sum + contract.satisfaction, 0);
  return totalSatisfaction / state.activeContracts.length;
}
