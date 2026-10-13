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
    elapsedHours: 0
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
        elapsedHours: 24
      };
      const airport = { ...baseAirport, runwayLengthMeters: 1500, hasSmallStands: true };
      
      // Force random to always be 0 for testing (guaranteed to trigger if prob > 0)
      const originalRandom = Math.random;
      Math.random = () => 0.0;

      const newState = generateContractOffers(state, airport, 24); // 24 hours passed
      
      Math.random = originalRandom;

      expect(newState.contractOffers.length).toBe(1);
      expect(newState.contractOffers[0].airlineId).toBe('air_regional_1');
      expect(newState.contractOffers[0].expiresAtHour).toBe(24 + 7 * 24); // elapsedHours + 7 days
    });

    it('should not generate offer if on cooldown', () => {
      const state = {
        ...initialState,
        unlockedAirlines: ['air_regional_1'],
        elapsedHours: 24,
        cooldowns: { 'air_regional_1': 48 } // On cooldown until hour 48
      };
      const airport = { ...baseAirport, runwayLengthMeters: 1500, hasSmallStands: true };
      
      const originalRandom = Math.random;
      Math.random = () => 0.0;

      const newState = generateContractOffers(state, airport, 24);
      
      Math.random = originalRandom;

      expect(newState.contractOffers.length).toBe(0);
    });
  });

  describe('accept/reject/expire offers', () => {
    const offer = {
      id: 'offer_1',
      airlineId: 'air_regional_1',
      terms: { slotsPerWeek: 14, feePerPassenger: 5, feePerLanding: 150, penaltyPerCancellation: 500, penaltyPerDelay: 100 },
      expiresAtHour: 5 * 24,
      penaltyTier: 0
    };

    it('should accept an offer and create an active contract', () => {
      const state = { ...initialState, contractOffers: [offer] };
      const newState = acceptContractOffer(state, 'offer_1');
      
      expect(newState.contractOffers.length).toBe(0);
      expect(newState.activeContracts.length).toBe(1);
      expect(newState.activeContracts[0].airlineId).toBe('air_regional_1');
      expect(newState.activeContracts[0].satisfaction).toBe(70); // baseSatisfaction
    });

    it('should reject an offer and trigger cooldown/penalty', () => {
      const state = { ...initialState, contractOffers: [offer], elapsedHours: 24 };
      const newState = rejectContractOffer(state, 'offer_1');
      
      expect(newState.contractOffers.length).toBe(0);
      expect(newState.activeContracts.length).toBe(0);
      expect(newState.cooldowns['air_regional_1']).toBe(24 + 30 * 24); // 30 days
      expect(newState.penaltyTiers['air_regional_1']).toBe(1);
    });

    it('should expire offers and trigger cooldown/penalty', () => {
      const state = { ...initialState, contractOffers: [offer], elapsedHours: 6 * 24 };
      const newState = expireOffers(state);
      
      expect(newState.contractOffers.length).toBe(0);
      expect(newState.cooldowns['air_regional_1']).toBe(6 * 24 + 30 * 24);
      expect(newState.penaltyTiers['air_regional_1']).toBe(1);
    });
  });

  describe('processFlightEvents', () => {
    const contract = {
      id: 'contract_1',
      airlineId: 'air_regional_1',
      terms: { slotsPerWeek: 14, feePerPassenger: 5, feePerLanding: 150, penaltyPerCancellation: 500, penaltyPerDelay: 100 },
      signedAtHour: 24,
      satisfaction: 50,
      penaltyTier: 0
    };

    it('should increase satisfaction on success', () => {
      const state = { ...initialState, activeContracts: [contract] };
      const newState = processFlightEvents(state, [{ contractId: 'contract_1', type: 'success' }]);
      
      expect(newState.activeContracts[0].satisfaction).toBe(50.5);
    });

    it('should terminate contract if satisfaction drops to 0 and trigger penalty', () => {
      const state = { ...initialState, activeContracts: [{ ...contract, satisfaction: 5 }], elapsedHours: 48 };
      const newState = processFlightEvents(state, [{ contractId: 'contract_1', type: 'cancellation' }]);
      
      expect(newState.activeContracts.length).toBe(0);
      expect(newState.cooldowns['air_regional_1']).toBe(48 + 30 * 24);
      expect(newState.penaltyTiers['air_regional_1']).toBe(1);
    });
  });

  describe('getAirlineRating', () => {
    it('should calculate average satisfaction', () => {
      const state = {
        ...initialState,
        activeContracts: [
          { id: 'c1', airlineId: 'a1', terms: {} as any, signedAtHour: 0, satisfaction: 80, penaltyTier: 0 },
          { id: 'c2', airlineId: 'a2', terms: {} as any, signedAtHour: 0, satisfaction: 60, penaltyTier: 0 }
        ]
      };
      
      expect(getAirlineRating(state)).toBe(70);
    });
  });
});
