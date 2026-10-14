import { describe, it, expect } from 'vitest';
import {
  wearAfter,
  breakdownChance,
  repairCost,
  EQUIPMENT_WEAR_RATES,
} from './wear';

describe('equipment wear module', () => {
  describe('wearAfter', () => {
    it('calculates wear increment based on days, usage, and equipment kind', () => {
      // 10 days * 5 uses/day * 0.005 (baggage_belt) = 0.25 wear
      const wear = wearAfter(10, 5, 'baggage_belt', 0);
      expect(wear).toBe(0.25);
    });

    it('accrues wear from initial wear', () => {
      // initial 0.3 + (10 * 5 * 0.004 jetway = 0.2) = 0.5
      const wear = wearAfter(10, 5, 'jetway', 0.3);
      expect(wear).toBeCloseTo(0.5);
    });

    it('caps maximum wear at 1.0', () => {
      const wear = wearAfter(1000, 100, 'tug', 0.5);
      expect(wear).toBe(1.0);
    });

    it('falls back to default rate for unknown equipment kinds', () => {
      const defaultWear = wearAfter(10, 2, 'unknown_kind', 0);
      const expectedWear = 10 * 2 * EQUIPMENT_WEAR_RATES.default;
      expect(defaultWear).toBe(expectedWear);
    });

    it('handles negative or NaN inputs safely', () => {
      expect(wearAfter(-5, 10, 'tug', 0)).toBe(0);
      expect(wearAfter(10, NaN, 'tug', NaN)).toBe(0);
    });
  });

  describe('breakdownChance', () => {
    it('returns 0 for wear below 0.6', () => {
      expect(breakdownChance(0)).toBe(0);
      expect(breakdownChance(0.3)).toBe(0);
      expect(breakdownChance(0.599)).toBe(0);
    });

    it('rises linearly from 0 at 0.6 wear to 0.25 at 1.0 wear', () => {
      expect(breakdownChance(0.6)).toBe(0);
      expect(breakdownChance(0.8)).toBeCloseTo(0.125);
      expect(breakdownChance(1.0)).toBe(0.25);
    });

    it('caps breakdown chance at 0.25 for wear > 1.0', () => {
      expect(breakdownChance(1.2)).toBe(0.25);
    });

    it('handles negative or NaN inputs without NaN', () => {
      expect(breakdownChance(-0.5)).toBe(0);
      expect(breakdownChance(NaN)).toBe(0);
    });
  });

  describe('repairCost', () => {
    it('calculates repair cost proportional to base cost and wear', () => {
      expect(repairCost(1000, 0.5)).toBe(500);
      expect(repairCost(1000, 1.0)).toBe(1000);
      expect(repairCost(1000, 0)).toBe(0);
    });

    it('caps wear factor at 1.0 for repair cost', () => {
      expect(repairCost(1000, 1.5)).toBe(1000);
    });

    it('handles invalid base cost or wear without NaN', () => {
      expect(repairCost(-500, 0.5)).toBe(0);
      expect(repairCost(1000, NaN)).toBe(0);
      expect(repairCost(NaN, 0.5)).toBe(0);
    });
  });
});
