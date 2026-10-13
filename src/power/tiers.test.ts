import { describe, expect, it } from 'vitest';
import { POWER_PLANTS, SUBSTATION_HEADROOM_BOOST } from './data';
import { brownoutFactor, dailyUpkeep, siteCapacityMW } from './tiers';

describe('power data constants', () => {
  it('defines plant specifications correctly', () => {
    expect(POWER_PLANTS[1]).toEqual({ tier: 1, capacityMW: 4, cost: 40_000, dailyUpkeep: 600 });
    expect(POWER_PLANTS[2]).toEqual({ tier: 2, capacityMW: 12, cost: 120_000, dailyUpkeep: 1_500 });
    expect(POWER_PLANTS[3]).toEqual({ tier: 3, capacityMW: 30, cost: 280_000, dailyUpkeep: 3_200 });
    expect(SUBSTATION_HEADROOM_BOOST).toBe(0.25);
  });
});

describe('siteCapacityMW', () => {
  it('calculates base plant capacities correctly', () => {
    expect(siteCapacityMW([1])).toBe(4);
    expect(siteCapacityMW([2])).toBe(12);
    expect(siteCapacityMW([3])).toBe(30);
    expect(siteCapacityMW([1, 2, 3])).toBe(46);
  });

  it('applies substation headroom boost', () => {
    expect(siteCapacityMW([1], 1)).toBe(5);
    expect(siteCapacityMW([2], 1)).toBe(15);
    expect(siteCapacityMW([3], 1)).toBe(37.5);
    expect(siteCapacityMW([1], true)).toBe(5);
    expect(siteCapacityMW([1], 2)).toBe(6);
  });

  it('handles flexible inputs', () => {
    expect(siteCapacityMW([])).toBe(0);
    expect(siteCapacityMW(undefined)).toBe(0);
    expect(siteCapacityMW(2)).toBe(12);
    expect(siteCapacityMW([{ tier: 1 }, { tier: 3 }])).toBe(34);
    expect(siteCapacityMW({ 1: 2, 2: 1 })).toBe(20);
  });
});

describe('dailyUpkeep', () => {
  it('calculates daily upkeep for power plant tiers', () => {
    expect(dailyUpkeep([1])).toBe(600);
    expect(dailyUpkeep([2])).toBe(1500);
    expect(dailyUpkeep([3])).toBe(3200);
    expect(dailyUpkeep([1, 2])).toBe(2100);
    expect(dailyUpkeep([])).toBe(0);
    expect(dailyUpkeep(undefined)).toBe(0);
  });
});

describe('brownoutFactor', () => {
  it('returns 1.0 when load is <= 90% of capacity', () => {
    expect(brownoutFactor(0, 10)).toBe(1);
    expect(brownoutFactor(4.5, 5)).toBe(1);
    expect(brownoutFactor(9, 10)).toBe(1);
  });

  it('falls linearly from 1.0 at 90% load to 0.5 at 120% load', () => {
    expect(brownoutFactor(10.5, 10)).toBeCloseTo(0.75, 5);
    expect(brownoutFactor(10, 10)).toBeCloseTo(5 / 6, 5);
    expect(brownoutFactor(12, 10)).toBe(0.5);
  });

  it('floors at 0.5 when load exceeds 120%', () => {
    expect(brownoutFactor(13, 10)).toBe(0.5);
    expect(brownoutFactor(20, 10)).toBe(0.5);
    expect(brownoutFactor(100, 10)).toBe(0.5);
  });

  it('returns 0.5 for 0 capacity at any load above 0', () => {
    expect(brownoutFactor(0.001, 0)).toBe(0.5);
    expect(brownoutFactor(1, 0)).toBe(0.5);
    expect(brownoutFactor(100, 0)).toBe(0.5);
  });

  it('returns 1 for 0 capacity when load is 0', () => {
    expect(brownoutFactor(0, 0)).toBe(1);
  });

  it('never returns NaN', () => {
    expect(Number.isNaN(brownoutFactor(Number.NaN, 10))).toBe(false);
    expect(Number.isNaN(brownoutFactor(10, Number.NaN))).toBe(false);
    expect(Number.isNaN(brownoutFactor(Number.NaN, Number.NaN))).toBe(false);
    expect(Number.isNaN(brownoutFactor(0, 0))).toBe(false);
  });
});
