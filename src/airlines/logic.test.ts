import { describe, it, expect } from 'vitest';
import {
  checkUnlocks,
  meetsRequirements,
  generateContractOffers,
  acceptContractOffer,
  rejectContractOffer,
  expireOffers,
  processFlightEvents
} from './logic.ts';
import { DEFAULT_AIRLINES } from './data.ts';
import type { AirlineState, AirportCapabilities } from './types.ts';

describe('Airline Logic', () => {
  const baseAirport: AirportCapabilities = {
    runwayLengthMeters: 1000,
    hasSmallStands: false,
    hasMediumStands: false,
    hasHeavyStands: false,
    terminalRating: 1,
    hasFuelService: false,
    hasCateringService: false,
    hasMaintenanceService: false,
    onTimePercentage: 100,
    totalFlightsHandled: 0
  };

  const initialState: AirlineState = {
    availableAirlines: DEFAULT_AIRLINES,
    unlockedAirlines: [],
    contractOffers: [],
    activeContracts: [],
    currentDay: 1
  };

  describe('checkUnlocks', () => {
    it('should unlock airlines based on totalFlightsHandled', () => {
      const airport = { ...baseAirport, totalFlightsHandled: 60 };
      const newState = checkUnlocks(initialState, airport);
      
      expect(newState.unlockedAirlines).toContain('air_regional_1'); // requires 0
      expect(newState.unlockedAirlines).toContain('air_lowcost_1'); // requires 50
      expect(newState.unlockedAirlines).not.toContain('air_cargo_1'); // requires 100
    });
  });

  describe('meetsRequirements', () => {
    it('should return false if runway is too short', () => {
      const airline = DEFAULT_AIRLINES.find(a => a.id === 'air_regional_1')!;
      const airport = { ...baseAirport, runwayLengthMeters: 1000, hasSmallStands: true };
      expect(meetsRequirements(airline, airport)).toBe(false);
    });

    it('should return true if all requirements are met', () => {
      const airline = DEFAULT_AIRLINES.find(a => a.id === 'air_regional_1')!;
      const airport = { ...baseAirport, runwayLengthMeters: 1500, hasSmallStands: true };
      expect(meetsRequirements(airline, airport)).toBe(true);
    });

    it('should check for specific services', () => {
      const airline = DEFAULT_AIRLINES.find(a => a.id === 'air_fullservice_1')!;
      const airport = {
        ...baseAirport,
        runwayLengthMeters: 3000,
        hasMediumStands: true,
        terminalRating: 4,
        onTimePercentage: 90,
        hasFuelService: true,
        hasCateringService: false // Missing catering
      };
      expect(meetsRequirements(airline, airport)).toBe(false);

      airport.hasCateringService = true;
      expect(meetsRequirements(airline, airport)).toBe(true);
    });
  });

  describe('generateContractOffers', () => {
    it('should generate offers for unlocked airlines that meet requirements', () => {
      const state = {
        ...initialState,
        unlockedAirlines: ['air_regional_1']
      };
      const airport = { ...baseAirport, runwayLengthMeters: 1500, hasSmallStands: true };
      
      // Force random to always be < 0.2 for testing
      const originalRandom = Math.random;
      Math.random = () => 0.1;

      const newState = generateContractOffers(state, airport);
      
      Math.random = originalRandom;

      expect(newState.contractOffers.length).toBe(1);
      expect(newState.contractOffers[0].airlineId).toBe('air_regional_1');
      expect(newState.contractOffers[0].expiresAtDay).toBe(8); // currentDay (1) + 7
    });

    it('should not generate offer if one already exists', () => {
      const state = {
        ...initialState,
        unlockedAirlines: ['air_regional_1'],
        contractOffers: [{
          id: 'existing_offer',
          airlineId: 'air_regional_1',
          terms: { slotsPerWeek: 14, feePerPassenger: 5, feePerLanding: 100, penaltyPerCancellation: 500, penaltyPerDelay: 100 },
          expiresAtDay: 5
        }]
      };
      const airport = { ...baseAirport, runwayLengthMeters: 1500, hasSmallStands: true };
      
      const originalRandom = Math.random;
      Math.random = () => 0.1;

      const newState = generateContractOffers(state, airport);
      
      Math.random = originalRandom;

      expect(newState.contractOffers.length).toBe(1); // Still 1
    });
  });

  describe('accept/reject/expire offers', () => {
    const offer = {
      id: 'offer_1',
      airlineId: 'air_regional_1',
      terms: { slotsPerWeek: 14, feePerPassenger: 5, feePerLanding: 100, penaltyPerCancellation: 500, penaltyPerDelay: 100 },
      expiresAtDay: 5
    };

    it('should accept an offer and create an active contract', () => {
      const state = { ...initialState, contractOffers: [offer] };
      const newState = acceptContractOffer(state, 'offer_1');
      
      expect(newState.contractOffers.length).toBe(0);
      expect(newState.activeContracts.length).toBe(1);
      expect(newState.activeContracts[0].airlineId).toBe('air_regional_1');
      expect(newState.activeContracts[0].satisfaction).toBe(70); // baseSatisfaction
    });

    it('should reject an offer', () => {
      const state = { ...initialState, contractOffers: [offer] };
      const newState = rejectContractOffer(state, 'offer_1');
      
      expect(newState.contractOffers.length).toBe(0);
      expect(newState.activeContracts.length).toBe(0);
    });

    it('should expire offers', () => {
      const state = { ...initialState, contractOffers: [offer], currentDay: 6 };
      const newState = expireOffers(state);
      
      expect(newState.contractOffers.length).toBe(0);
    });
  });

  describe('processFlightEvents', () => {
    const contract = {
      id: 'contract_1',
      airlineId: 'air_regional_1',
      terms: { slotsPerWeek: 14, feePerPassenger: 5, feePerLanding: 100, penaltyPerCancellation: 500, penaltyPerDelay: 100 },
      signedAtDay: 1,
      satisfaction: 50
    };

    it('should increase satisfaction on success', () => {
      const state = { ...initialState, activeContracts: [contract] };
      const newState = processFlightEvents(state, [{ contractId: 'contract_1', type: 'success' }]);
      
      expect(newState.activeContracts[0].satisfaction).toBe(50.5);
    });

    it('should decrease satisfaction on delay and cancellation', () => {
      const state = { ...initialState, activeContracts: [contract] };
      const newState = processFlightEvents(state, [
        { contractId: 'contract_1', type: 'delay' },
        { contractId: 'contract_1', type: 'cancellation' }
      ]);
      
      expect(newState.activeContracts[0].satisfaction).toBe(38); // 50 - 2 - 10
    });

    it('should terminate contract if satisfaction drops to 0', () => {
      const state = { ...initialState, activeContracts: [{ ...contract, satisfaction: 5 }] };
      const newState = processFlightEvents(state, [{ contractId: 'contract_1', type: 'cancellation' }]);
      
      expect(newState.activeContracts.length).toBe(0);
    });
  });
});
