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
  if (airport.onTimePercentage < reqs.minOnTimePercentage) return false;

  return true;
}

/**
 * Generates contract terms based on the airline tier.
 */
function generateTermsForTier(tier: string): ContractTerms {
  switch (tier) {
    case 'regional':
      return {
        slotsPerWeek: 14,
        feePerPassenger: 5,
        feePerLanding: 100,
        penaltyPerCancellation: 500,
        penaltyPerDelay: 100
      };
    case 'low-cost':
      return {
        slotsPerWeek: 28,
        feePerPassenger: 15,
        feePerLanding: 300,
        penaltyPerCancellation: 1500,
        penaltyPerDelay: 300
      };
    case 'full-service':
      return {
        slotsPerWeek: 21,
        feePerPassenger: 25,
        feePerLanding: 800,
        penaltyPerCancellation: 3000,
        penaltyPerDelay: 800
      };
    case 'flag-carrier':
      return {
        slotsPerWeek: 14,
        feePerPassenger: 40,
        feePerLanding: 1500,
        penaltyPerCancellation: 5000,
        penaltyPerDelay: 1500
      };
    case 'cargo':
      return {
        slotsPerWeek: 7,
        feePerPassenger: 0, // Cargo has no passengers
        feePerLanding: 2000,
        penaltyPerCancellation: 4000,
        penaltyPerDelay: 1000
      };
    default:
      return {
        slotsPerWeek: 7,
        feePerPassenger: 10,
        feePerLanding: 200,
        penaltyPerCancellation: 1000,
        penaltyPerDelay: 200
      };
  }
}

/**
 * Randomly generates contract offers for unlocked airlines that meet requirements.
 * Ensures we don't spam offers if one already exists for the airline.
 */
export function generateContractOffers(state: AirlineState, airport: AirportCapabilities): AirlineState {
  const newOffers: ContractOffer[] = [...state.contractOffers];
  const existingOfferAirlineIds = new Set(newOffers.map(o => o.airlineId));
  const activeContractAirlineIds = new Set(state.activeContracts.map(c => c.airlineId));

  for (const airlineId of state.unlockedAirlines) {
    // Skip if we already have an offer or active contract
    if (existingOfferAirlineIds.has(airlineId) || activeContractAirlineIds.has(airlineId)) {
      continue;
    }

    const airline = state.availableAirlines.find(a => a.id === airlineId);
    if (!airline) continue;

    if (meetsRequirements(airline, airport)) {
      // 20% chance to generate an offer per tick/day
      if (Math.random() < 0.2) {
        newOffers.push({
          id: `offer_${Date.now()}_${airline.id}`,
          airlineId: airline.id,
          terms: generateTermsForTier(airline.tier),
          expiresAtDay: state.currentDay + 7 // Expires in 7 days
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
    signedAtDay: state.currentDay,
    satisfaction: airline ? airline.baseSatisfaction : 50
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
 */
export function rejectContractOffer(state: AirlineState, offerId: string): AirlineState {
  return {
    ...state,
    contractOffers: state.contractOffers.filter(o => o.id !== offerId)
  };
}

/**
 * Removes expired contract offers.
 */
export function expireOffers(state: AirlineState): AirlineState {
  return {
    ...state,
    contractOffers: state.contractOffers.filter(o => o.expiresAtDay > state.currentDay)
  };
}

export interface FlightEvent {
  contractId: string;
  type: 'success' | 'delay' | 'cancellation';
}

/**
 * Updates satisfaction based on flight events.
 */
export function processFlightEvents(state: AirlineState, events: FlightEvent[]): AirlineState {
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
  const survivingContracts = newContracts.filter(c => c.satisfaction > 0);

  return {
    ...state,
    activeContracts: survivingContracts
  };
}
