import { describe, it, expect } from 'vitest';
import {
  nightlyDemand,
  occupancy,
  nightlyRevenue,
  upkeep,
  dailyUpkeep,
  ROOM_NIGHTLY_RATE,
  ROOM_DAILY_UPKEEP,
} from './hotel';

describe('hotel module', () => {
  describe('nightlyDemand', () => {
    it('sums demand components correctly', () => {
      const demand = nightlyDemand({
        delayedOvernight: 15,
        transitOvernight: 20,
        crewNights: 5,
        baseShare: 10,
      });
      expect(demand).toBe(50);
    });

    it('handles missing or zero parameters', () => {
      expect(nightlyDemand({})).toBe(0);
      expect(nightlyDemand(null)).toBe(0);
      expect(nightlyDemand({ delayedOvernight: 12 })).toBe(12);
    });

    it('ignores negative or NaN inputs', () => {
      expect(nightlyDemand({ delayedOvernight: -10, transitOvernight: NaN, crewNights: 5 })).toBe(5);
    });
  });

  describe('occupancy', () => {
    it('calculates occupied, overflow, and rate when demand <= rooms', () => {
      const result = occupancy(30, 50);
      expect(result).toEqual({
        occupied: 30,
        overflow: 0,
        occupancyRate: 0.6,
      });
    });

    it('calculates overflow when demand > rooms', () => {
      const result = occupancy(80, 50);
      expect(result).toEqual({
        occupied: 50,
        overflow: 30,
        occupancyRate: 1.0,
      });
    });

    it('handles zero rooms', () => {
      const result = occupancy(20, 0);
      expect(result).toEqual({
        occupied: 0,
        overflow: 20,
        occupancyRate: 0,
      });
    });

    it('handles invalid or NaN inputs without NaN', () => {
      const result = occupancy(NaN, -5);
      expect(result).toEqual({
        occupied: 0,
        overflow: 0,
        occupancyRate: 0,
      });
      expect(Number.isNaN(result.occupied)).toBe(false);
      expect(Number.isNaN(result.overflow)).toBe(false);
      expect(Number.isNaN(result.occupancyRate)).toBe(false);
    });
  });

  describe('nightlyRevenue', () => {
    it('calculates revenue at $95 per room', () => {
      expect(ROOM_NIGHTLY_RATE).toBe(95);
      expect(nightlyRevenue(10)).toBe(950);
      expect(nightlyRevenue(0)).toBe(0);
    });

    it('handles invalid or negative input', () => {
      expect(nightlyRevenue(-5)).toBe(0);
      expect(nightlyRevenue(NaN)).toBe(0);
    });
  });

  describe('upkeep / dailyUpkeep', () => {
    it('calculates upkeep at $18 per room per day', () => {
      expect(ROOM_DAILY_UPKEEP).toBe(18);
      expect(upkeep(50)).toBe(900);
      expect(dailyUpkeep(50)).toBe(900);
    });

    it('handles invalid or negative input', () => {
      expect(upkeep(-10)).toBe(0);
      expect(upkeep(NaN)).toBe(0);
    });
  });
});
