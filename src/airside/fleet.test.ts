import { describe, it, expect } from 'vitest';
import { requiredFleet } from './groundfleet';
import { gpuSavings } from './fuelsave';
import { towerTierFor, towerUpgradeAdvice } from './tower';

describe('Ground Fleet Sizing', () => {
  it('correctly maps aircraft classes to tugs, high-lift catering, and GPU equipment', () => {
    // 1 narrowbody turn: medium tug (1*1.15 = 1.15 -> 2), GPU (2)
    const nbFleet = requiredFleet({ narrowbody: 1 });
    expect(nbFleet.mediumTugs).toBe(2);
    expect(nbFleet.gpuUnits).toBe(2);
    expect(nbFleet.lightTugs).toBe(0);
    expect(nbFleet.heavyTugs).toBe(0);
    expect(nbFleet.highLiftCatering).toBe(0);

    // 1 widebody turn: heavy tug (2), high-lift (2), GPU (2)
    const wbFleet = requiredFleet({ widebody: 1 });
    expect(wbFleet.heavyTugs).toBe(2);
    expect(wbFleet.highLiftCatering).toBe(2);
    expect(wbFleet.gpuUnits).toBe(2);

    // 1 jumbo turn: heavy tug (2), towbarless tug (2), high-lift (2), GPU (2)
    const jbFleet = requiredFleet({ jumbo: 1 });
    expect(jbFleet.heavyTugs).toBe(2);
    expect(jbFleet.towbarlessTugs).toBe(2);
    expect(jbFleet.highLiftCatering).toBe(2);
    expect(jbFleet.gpuUnits).toBe(2);
  });

  it('rounds up required equipment with 15% spare factor', () => {
    // 10 small turns: 10 * 1.15 = 11.5 -> 12 light tugs
    const fleet = requiredFleet({ small: 10 });
    expect(fleet.lightTugs).toBe(12);

    // 100 regional turns: 100 * 1.15 = 115 light tugs
    const fleet100 = requiredFleet({ regional: 100 });
    expect(fleet100.lightTugs).toBe(115);
  });

  it('prevents NaN and handles invalid or missing turn inputs', () => {
    const fleet = requiredFleet({ narrowbody: NaN as any, small: -5 });
    expect(fleet.totalUnits).toBe(0);
    expect(Number.isNaN(fleet.totalUnits)).toBe(false);
  });
});

describe('GPU & PCA Fuel Savings', () => {
  it('saves 120 kg per turn for narrowbodies and 400 kg for widebodies', () => {
    const res = gpuSavings({ narrowbody: 10, widebody: 5 }, 1.5);
    // 10 * 120 = 1200 kg
    // 5 * 400 = 2000 kg
    // Total = 3200 kg
    expect(res.totalFuelSavedKg).toBe(3200);
    expect(res.totalCostSaved).toBe(3200 * 1.5);
    expect(res.savingsByClass.narrowbody.fuelSavedKg).toBe(1200);
    expect(res.savingsByClass.widebody.fuelSavedKg).toBe(2000);
  });

  it('handles empty inputs and prevents NaN', () => {
    const res = gpuSavings({ narrowbody: NaN as any }, NaN as any);
    expect(res.totalFuelSavedKg).toBe(0);
    expect(res.totalCostSaved).toBe(0);
    expect(Number.isNaN(res.totalFuelSavedKg)).toBe(false);
  });
});

describe('ATC Tower Tiers & Advice', () => {
  it('recommends tower tier based on movement thresholds', () => {
    expect(towerTierFor(20)).toBe(1);
    expect(towerTierFor(30)).toBe(1);
    expect(towerTierFor(35)).toBe(2);
    expect(towerTierFor(40)).toBe(2);
    expect(towerTierFor(45)).toBe(3);
    expect(towerTierFor(100)).toBe(3);
  });

  it('provides upgrade advice when movements exceed current tier capacity', () => {
    const advice = towerUpgradeAdvice(1, 35);
    expect(advice.currentTier).toBe(1);
    expect(advice.recommendedTier).toBe(2);
    expect(advice.needsUpgrade).toBe(true);
    expect(advice.currentCapacity).toBe(30);
    expect(advice.recommendedCapacity).toBe(40);
  });

  it('handles invalid movements or tier inputs without NaN', () => {
    expect(towerTierFor(NaN as any)).toBe(1);
    const advice = towerUpgradeAdvice('invalid' as any, -100);
    expect(advice.currentTier).toBe(1);
    expect(advice.recommendedTier).toBe(1);
    expect(advice.needsUpgrade).toBe(false);
  });
});
