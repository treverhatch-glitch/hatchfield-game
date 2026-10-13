import { describe, it, expect } from 'vitest';
import { runwayCapacity, getWakeMultiplier, calculateAverageWakePenalty } from './runway';
import { TOWER_BASE_CAPACITY, DUAL_RUNWAY_MULTIPLIERS, WAKE_MULTIPLIERS } from './data';

describe('Runway Capacity & Mode Multipliers', () => {
  it('single-runway movements/hr base capacities by Tower tier', () => {
    expect(runwayCapacity({ runways: 1, tower: 1 })).toBe(30);
    expect(runwayCapacity({ runways: 1, tower: 2 })).toBe(40);
    expect(runwayCapacity({ runways: 1, tower: 3 })).toBe(50);
    expect(runwayCapacity({ runways: 1, tower: 'I' })).toBe(30);
    expect(runwayCapacity({ runways: 1, tower: 'II' })).toBe(40);
    expect(runwayCapacity({ runways: 1, tower: 'III' })).toBe(50);
  });

  it('dual runways mode multipliers (segregated 1.6x, mixed 1.85x, independent 2.0x)', () => {
    const baseTower1 = TOWER_BASE_CAPACITY[1]; // 30

    expect(runwayCapacity({ runways: 2, tower: 1, mode: 'segregated' })).toBe(baseTower1 * DUAL_RUNWAY_MULTIPLIERS.segregated);
    expect(runwayCapacity({ runways: 2, tower: 1, mode: 'mixed' })).toBe(baseTower1 * DUAL_RUNWAY_MULTIPLIERS.mixed);
    expect(runwayCapacity({ runways: 2, tower: 1, mode: 'independent' })).toBe(baseTower1 * DUAL_RUNWAY_MULTIPLIERS.independent);

    // Single runway ignores dual mode multiplier
    expect(runwayCapacity({ runways: 1, tower: 1, mode: 'independent' })).toBe(30);
  });

  it('wake separation multipliers for leading aircraft', () => {
    expect(getWakeMultiplier('heavy', 'light')).toBe(WAKE_MULTIPLIERS.HEAVY_LEAD_LIGHT);
    expect(getWakeMultiplier('widebody', 'small')).toBe(1.25);
    expect(getWakeMultiplier('jumbo', 'regional')).toBe(1.25);

    expect(getWakeMultiplier('super', 'narrowbody')).toBe(WAKE_MULTIPLIERS.SUPER_LEAD_NON_SUPER);
    expect(getWakeMultiplier('a380', 'widebody')).toBe(1.4);
    expect(getWakeMultiplier('super', 'super')).toBe(1.0);

    expect(getWakeMultiplier('narrowbody', 'light')).toBe(1.0);
    expect(getWakeMultiplier('small', 'widebody')).toBe(1.0);
  });

  it('calculates weighted wake penalty and applies to runway capacity', () => {
    // Equal mix of heavy and light
    const fleetMix = { widebody: 50, small: 50 };
    // Pairings:
    // widebody -> widebody: 1.0 (0.25 share)
    // widebody -> small: 1.25 (0.25 share)
    // small -> widebody: 1.0 (0.25 share)
    // small -> small: 1.0 (0.25 share)
    // Weighted avg = 0.25*1.0 + 0.25*1.25 + 0.25*1.0 + 0.25*1.0 = 1.0625
    const expectedPenalty = 0.25 * 1.0 + 0.25 * 1.25 + 0.25 * 1.0 + 0.25 * 1.0;
    expect(calculateAverageWakePenalty(fleetMix)).toBeCloseTo(expectedPenalty, 5);

    const baseCap = 30; // Tower 1
    const expectedCap = baseCap / expectedPenalty;
    expect(runwayCapacity({ runways: 1, tower: 1, fleetMix })).toBeCloseTo(expectedCap, 5);
  });

  it('handles empty options, missing parameters, and prevents NaN', () => {
    expect(runwayCapacity()).toBe(30);
    expect(runwayCapacity({ tower: NaN as any })).toBe(30);
    expect(runwayCapacity({ runways: NaN as any })).toBe(30);
    expect(runwayCapacity({ fleetMix: { narrowbody: NaN as any } })).toBe(30);
  });
});
