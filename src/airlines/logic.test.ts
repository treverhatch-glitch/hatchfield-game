import { describe, it, expect } from 'vitest';
import {
  checkUnlocks,
  meetsRequirements,
  generateContractOffers,
  acceptContractOffer,
  rejectContractOffer,
  expireOffers,
  processFlightEvents,
  getAirlineRating
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
    hasHeavyVehicles: false,
    onTimePercentage: 100,
    totalFlightsHandled: 0
  };

  const initialState: AirlineState = {
    availableAirlines: DEFAULT_AIRLINES,
    unlockedAirlines: [],
    contractOffers: [],
    activeContracts: [],
    cooldowns: {},
    penaltyTiers: {},
    elapsedMinutes: 0,
    events: []
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
        unlockedAirlines: ['air_regional_1'],
        elapsedMinutes: 1440
      };
      const airport = { ...baseAirport, runwayLengthMeters: 1500, hasSmallStands: true };
      
      // Force random to always be 0 for testing (guaranteed to trigger if prob > 0)
      const originalRandom = Math.random;
      Math.random = () => 0.0;

      const newState = generateContractOffers(state, airport, 1440); // 24 hours passed
      
      Math.random = originalRandom;

      expect(newState.contractOffers.length).toBe(1);
      expect(newState.contractOffers[0].airlineId).toBe('air_regional_1');
      expect(newState.contractOffers[0].expiresAtMinute).toBe(1440 + 7 * 1440); // elapsedMinutes + 7 days
      expect(newState.events.length).toBe(1);
      expect(newState.events[0].type).toBe('contract_offer');
    });

    it('should not generate offer if on cooldown', () => {
      const state = {
        ...initialState,
        unlockedAirlines: ['air_regional_1'],
        elapsedMinutes: 1440,
        cooldowns: { 'air_regional_1': 2880 } // On cooldown until minute 2880
      };
      const airport = { ...baseAirport, runwayLengthMeters: 1500, hasSmallStands: true };
      
      const originalRandom = Math.random;
      Math.random = () => 0.0;

      const newState = generateContractOffers(state, airport, 1440);
      
      Math.random = originalRandom;

      expect(newState.contractOffers.length).toBe(0);
    });
  });

  describe('accept/reject/expire offers', () => {
    const offer = {
      id: 'offer_1',
      airlineId: 'air_regional_1',
      terms: { slotsPerWeek: 14, feePerPassenger: 5, feePerLanding: 150, penaltyPerCancellation: 500, penaltyPerDelayMinute: 5 },
      expiresAtMinute: 5 * 1440,
      penaltyTier: 0
    };

    it('should accept an offer and create an active contract', () => {
      const state = { ...initialState, contractOffers: [offer] };
      const newState = acceptContractOffer(state, 'offer_1');
      
      expect(newState.contractOffers.length).toBe(0);
      expect(newState.activeContracts.length).toBe(1);
      expect(newState.activeContracts[0].airlineId).toBe('air_regional_1');
      expect(newState.activeContracts[0].satisfaction).toBe(70); // baseSatisfaction
      expect(newState.events.length).toBe(1);
      expect(newState.events[0].type).toBe('contract_signed');
    });

    it('should reject an offer and trigger cooldown/penalty', () => {
      const state = { ...initialState, contractOffers: [offer], elapsedMinutes: 1440 };
      const newState = rejectContractOffer(state, 'offer_1');
      
      expect(newState.contractOffers.length).toBe(0);
      expect(newState.activeContracts.length).toBe(0);
      expect(newState.cooldowns['air_regional_1']).toBe(1440 + 30 * 1440); // 30 days
      expect(newState.penaltyTiers['air_regional_1']).toBe(1);
    });

    it('should expire offers and trigger cooldown/penalty', () => {
      const state = { ...initialState, contractOffers: [offer], elapsedMinutes: 6 * 1440 };
      const newState = expireOffers(state);
      
      expect(newState.contractOffers.length).toBe(0);
      expect(newState.cooldowns['air_regional_1']).toBe(6 * 1440 + 30 * 1440);
      expect(newState.penaltyTiers['air_regional_1']).toBe(1);
    });
  });

  describe('processFlightEvents', () => {
    const contract = {
      id: 'contract_1',
      airlineId: 'air_regional_1',
      terms: { slotsPerWeek: 14, feePerPassenger: 5, feePerLanding: 150, penaltyPerCancellation: 500, penaltyPerDelayMinute: 5 },
      signedAtMinute: 1440,
      satisfaction: 50,
      penaltyTier: 0
    };

    it('should increase satisfaction on success', () => {
      const state = { ...initialState, activeContracts: [contract] };
      const newState = processFlightEvents(state, [{ contractId: 'contract_1', type: 'success' }]);
      
      expect(newState.activeContracts[0].satisfaction).toBe(50.5);
    });

    it('should terminate contract if satisfaction drops to 0 and trigger penalty', () => {
      const state = { ...initialState, activeContracts: [{ ...contract, satisfaction: 5 }], elapsedMinutes: 2880 };
      const newState = processFlightEvents(state, [{ contractId: 'contract_1', type: 'cancellation' }]);
      
      expect(newState.activeContracts.length).toBe(0);
      expect(newState.cooldowns['air_regional_1']).toBe(2880 + 30 * 1440);
      expect(newState.penaltyTiers['air_regional_1']).toBe(1);
      expect(newState.events.length).toBe(1);
      expect(newState.events[0].type).toBe('contract_terminated');
    });
  });

  describe('getAirlineRating', () => {
    it('should calculate average satisfaction', () => {
      const state = {
        ...initialState,
        activeContracts: [
          { id: 'c1', airlineId: 'a1', terms: {} as any, signedAtMinute: 0, satisfaction: 80, penaltyTier: 0 },
          { id: 'c2', airlineId: 'a2', terms: {} as any, signedAtMinute: 0, satisfaction: 60, penaltyTier: 0 }
        ]
      };
      
      expect(getAirlineRating(state)).toBe(70);
    });
  });
});
