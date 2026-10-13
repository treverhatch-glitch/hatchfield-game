import { describe, expect, it } from 'vitest';
import { CONCESSION_TYPES, expectedRent } from './shops';

describe('CONCESSION_TYPES', () => {
  it('has exactly 15 concession types', () => {
    expect(CONCESSION_TYPES).toHaveLength(15);
  });

  it('has unique ids for all concession types', () => {
    const ids = CONCESSION_TYPES.map((shop) => shop.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('contains all required concession types', () => {
    const requiredTypes = [
      'coffee_kiosk',
      'bakery',
      'fast_food',
      'sit_down_restaurant',
      'bar',
      'duty_free',
      'luxury_boutique',
      'newsagent',
      'electronics',
      'pharmacy',
      'currency_exchange',
      'lounge_spa',
      'kids_play_area',
      'chapel_quiet_room',
      'charging_bar',
    ];
    const presentIds = CONCESSION_TYPES.map((s) => s.id);
    for (const req of requiredTypes) {
      expect(presentIds).toContain(req);
    }
  });

  it('has non-negative costs and non-NaN values for all shop fields', () => {
    for (const shop of CONCESSION_TYPES) {
      expect(shop.buildCost).toBeGreaterThanOrEqual(0);
      expect(shop.upkeepPerDay).toBeGreaterThanOrEqual(0);
      expect(shop.baseRentPerDay).toBeGreaterThanOrEqual(0);
      expect(shop.footprintCells).toBeGreaterThan(0);
      expect(shop.minFootfallPerHour).toBeGreaterThan(0);
      expect(shop.happinessBonus).toBeGreaterThanOrEqual(0);
      expect(shop.dwellMinutes).toBeGreaterThan(0);
      expect(shop.minFL).toBeGreaterThanOrEqual(1);

      // Check no NaN values
      expect(Number.isNaN(shop.footprintCells)).toBe(false);
      expect(Number.isNaN(shop.buildCost)).toBe(false);
      expect(Number.isNaN(shop.upkeepPerDay)).toBe(false);
      expect(Number.isNaN(shop.baseRentPerDay)).toBe(false);
      expect(Number.isNaN(shop.minFootfallPerHour)).toBe(false);
      expect(Number.isNaN(shop.happinessBonus)).toBe(false);
      expect(Number.isNaN(shop.dwellMinutes)).toBe(false);
      expect(Number.isNaN(shop.minFL)).toBe(false);
    }
  });
});

describe('expectedRent', () => {
  const sampleShop = CONCESSION_TYPES.find((s) => s.id === 'coffee_kiosk')!;

  it('returns 0 when footfall is below minFootfallPerHour', () => {
    expect(expectedRent(sampleShop, 0)).toBe(0);
    expect(expectedRent(sampleShop, sampleShop.minFootfallPerHour - 1)).toBe(0);
  });

  it('returns baseRentPerDay when footfall equals minFootfallPerHour', () => {
    expect(expectedRent(sampleShop, sampleShop.minFootfallPerHour)).toBe(sampleShop.baseRentPerDay);
  });

  it('scales linearly when footfall is between minFootfallPerHour and 3x minFootfallPerHour', () => {
    // 1.5x minFootfall -> 1.5x baseRent
    const footfall = sampleShop.minFootfallPerHour * 1.5;
    expect(expectedRent(sampleShop, footfall)).toBe(sampleShop.baseRentPerDay * 1.5);
  });

  it('caps at 3x baseRentPerDay when footfall exceeds 3x minFootfallPerHour', () => {
    const footfall3x = sampleShop.minFootfallPerHour * 3;
    const footfall10x = sampleShop.minFootfallPerHour * 10;
    expect(expectedRent(sampleShop, footfall3x)).toBe(sampleShop.baseRentPerDay * 3);
    expect(expectedRent(sampleShop, footfall10x)).toBe(sampleShop.baseRentPerDay * 3);
  });

  it('never returns NaN for any shop or footfall input', () => {
    for (const shop of CONCESSION_TYPES) {
      for (const footfall of [0, -10, 25, 50, 100, 500, 10000]) {
        const rent = expectedRent(shop, footfall);
        expect(Number.isNaN(rent)).toBe(false);
      }
    }
  });
});
