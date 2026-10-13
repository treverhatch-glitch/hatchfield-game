import { describe, it, expect } from 'vitest';
import {
  checkUnlocks,
  generateContractOffers,
  acceptContractOffer,
  expireOffers,
  processFlightEvents
} from './logic.ts';
import { DEFAULT_AIRLINES } from './data.ts';
import type { AirlineState, AirportCapabilities, FlightEvent } from './types.ts';

describe('Airline 1-Year Balance Sim', () => {
  it('should run a 1-year headless simulation and print stats', () => {
    // 1 year = 365 days = 8760 hours = 525600 minutes
    const TOTAL_MINUTES = 525600;
    
    let state: AirlineState = {
      availableAirlines: DEFAULT_AIRLINES,
      unlockedAirlines: [],
      contractOffers: [],
      activeContracts: [],
      cooldowns: {},
      penaltyTiers: {},
      elapsedMinutes: 0,
      events: []
    };

    // Simulate a fully upgraded airport to allow all airlines
    const airport: AirportCapabilities = {
      runwayLengthMeters: 4000,
      hasSmallStands: true,
      hasMediumStands: true,
      hasHeavyStands: true,
      terminalRating: 5,
      hasFuelService: true,
      hasCateringService: true,
      hasMaintenanceService: true,
      hasHeavyVehicles: true,
      onTimePercentage: 95,
      totalFlightsHandled: 1000 // Unlocks everything
    };

    let totalRevenue = 0;
    let totalFlights = 0;
    let totalCancellations = 0;
    
    // Stats tracking
    const offersReceived: Record<string, number> = {};
    const contractsSigned: Record<string, number> = {};
    let totalTerminations = 0;

    for (let minute = 60; minute <= TOTAL_MINUTES; minute += 60) {
      state.elapsedMinutes = minute;

      // 1. Expire offers
      state = expireOffers(state);
      
      // 2. Check unlocks
      state = checkUnlocks(state, airport);

      // 3. Generate offers (tick-agnostic, passing 60 minutes)
      const beforeOffers = state.contractOffers.length;
      state = generateContractOffers(state, airport, 60);
      
      // Track new offers
      if (state.contractOffers.length > beforeOffers) {
        const newOffer = state.contractOffers[state.contractOffers.length - 1];
        offersReceived[newOffer.airlineId] = (offersReceived[newOffer.airlineId] || 0) + 1;
        
        // Auto-accept all offers for the simulation
        state = acceptContractOffer(state, newOffer.id);
        contractsSigned[newOffer.airlineId] = (contractsSigned[newOffer.airlineId] || 0) + 1;
      }

      // 4. Simulate flights based on active contracts
      const events: FlightEvent[] = [];
      
      for (const contract of state.activeContracts) {
        // slotsPerWeek / (7 * 24) = probability of a flight this hour
        const flightProb = contract.terms.slotsPerWeek / 168;
        
        if (Math.random() < flightProb) {
          totalFlights++;
          
          // 90% success, 8% delay, 2% cancellation
          const outcome = Math.random();
          if (outcome < 0.90) {
            events.push({ contractId: contract.id, type: 'success' });
            // Calculate revenue (assume 80% load factor for passengers)
            // We don't have airframe data directly here, so we'll just use a flat 100 pax for simplicity in the sim
            const pax = contract.terms.feePerPassenger > 0 ? 100 : 0;
            totalRevenue += contract.terms.feePerLanding + (pax * contract.terms.feePerPassenger);
          } else if (outcome < 0.98) {
            // Assume average delay of 45 minutes
            const delayMinutes = 45;
            events.push({ contractId: contract.id, type: 'delay', delayMinutes });
            const pax = contract.terms.feePerPassenger > 0 ? 100 : 0;
            totalRevenue += contract.terms.feePerLanding + (pax * contract.terms.feePerPassenger) - (contract.terms.penaltyPerDelayMinute * delayMinutes);
          } else {
            events.push({ contractId: contract.id, type: 'cancellation' });
            totalCancellations++;
            totalRevenue -= contract.terms.penaltyPerCancellation;
          }
        }
      }

      // 5. Process events
      const beforeContracts = state.activeContracts.length;
      state = processFlightEvents(state, events);
      
      // Track terminations
      if (state.activeContracts.length < beforeContracts) {
        totalTerminations += (beforeContracts - state.activeContracts.length);
      }
      
      // Clear events queue
      state = { ...state, events: [] };
    }

    console.log('\n--- 1-Year Airline Balance Sim Results ---');
    console.log(`Total Minutes: ${TOTAL_MINUTES}`);
    console.log(`Total Flights: ${totalFlights}`);
    console.log(`Total Cancellations: ${totalCancellations}`);
    console.log(`Total Terminations: ${totalTerminations}`);
    console.log(`Total Revenue: $${totalRevenue.toLocaleString()}`);
    console.log('\nOffers Received:', offersReceived);
    console.log('Contracts Signed:', contractsSigned);
    
    // Basic assertions to ensure the sim ran
    expect(totalFlights).toBeGreaterThan(0);
    expect(Object.keys(offersReceived).length).toBeGreaterThan(0);
  });
});