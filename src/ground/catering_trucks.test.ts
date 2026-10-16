import { describe, it, expect } from 'vitest';
import {
  CATERING_TRUCKS,
  classRank,
  requiresHighLift,
  cartsNeeded,
  canServe,
  fleetCoverage,
  validateCateringTrucks,
} from './catering_trucks.ts';
import type { CateringDemand } from './catering_trucks.ts';

describe('catering_trucks', () => {
  it('classRank works correctly', () => {
    expect(classRank('regional')).toBe(1);
    expect(classRank('narrowbody')).toBe(2);
    expect(classRank('widebody')).toBe(3);
    expect(classRank('super')).toBe(4);
    // @ts-ignore
    expect(classRank('unknown')).toBe(0);
  });

  it('requiresHighLift correctly identifies widebody and super', () => {
    expect(requiresHighLift('regional')).toBe(false);
    expect(requiresHighLift('narrowbody')).toBe(false);
    expect(requiresHighLift('widebody')).toBe(true);
    expect(requiresHighLift('super')).toBe(true);
  });

  it('cartsNeeded is monotonic in seats and strictly >= 1 for seats > 0', () => {
    const d1: CateringDemand = { airframeClass: 'regional', seats: 0, serviceLevel: 0.5 };
    expect(cartsNeeded(d1)).toBe(0);

    const d2: CateringDemand = { airframeClass: 'regional', seats: 10, serviceLevel: 0.5 };
    expect(cartsNeeded(d2)).toBe(1);

    const d3: CateringDemand = { airframeClass: 'narrowbody', seats: 150, serviceLevel: 0.5 };
    const d4: CateringDemand = { airframeClass: 'narrowbody', seats: 150, serviceLevel: 1.0 };
    const d5: CateringDemand = { airframeClass: 'widebody', seats: 300, serviceLevel: 1.0 };
    
    expect(cartsNeeded(d3)).toBeLessThan(cartsNeeded(d4));
    expect(cartsNeeded(d4)).toBeLessThan(cartsNeeded(d5));
    
    // Test exact math (150 * (0.4 + 0.8 * 0.5) / 30) = (150 * 0.8) / 30 = 120 / 30 = 4
    expect(cartsNeeded(d3)).toBe(4);
  });

  it('canServe logic validates rank, high-lift gating, and cart capacity', () => {
    const van = CATERING_TRUCKS.find(t => t.id === 'trk_cat_van')!;
    const hlTruck = CATERING_TRUCKS.find(t => t.id === 'trk_cat_hl_standard')!;

    const smallDemand: CateringDemand = { airframeClass: 'regional', seats: 50, serviceLevel: 0.5 };
    const largeDemand: CateringDemand = { airframeClass: 'widebody', seats: 250, serviceLevel: 0.8 };

    // Van can serve small regional demand
    expect(canServe(van, smallDemand)).toBe(true);
    // Van cannot serve widebody (needs high-lift)
    expect(canServe(van, largeDemand)).toBe(false);

    // High lift can serve large demand
    expect(canServe(hlTruck, largeDemand)).toBe(true);

    const largeCapacityDemand: CateringDemand = { airframeClass: 'regional', seats: 200, serviceLevel: 1.0 };
    // Van cannot serve large capacity regional (capacity 4 vs needed 200 * 1.2 / 30 = 8)
    expect(canServe(van, largeCapacityDemand)).toBe(false);
  });

  it('fleetCoverage returns shortfall when regional vans face a widebody', () => {
    const van1 = CATERING_TRUCKS.find(t => t.id === 'trk_cat_van')!;
    const van2 = CATERING_TRUCKS.find(t => t.id === 'trk_cat_van')!;
    
    const demands: CateringDemand[] = [
      { airframeClass: 'widebody', seats: 250, serviceLevel: 0.5 }
    ];

    const result = fleetCoverage([van1, van2], demands);
    expect(result.ok).toBe(false);
    expect(result.shortfall).toBe(1);
  });
  
  it('fleetCoverage returns ok when trucks match demands', () => {
    const van = CATERING_TRUCKS.find(t => t.id === 'trk_cat_van')!;
    const hlTruck = CATERING_TRUCKS.find(t => t.id === 'trk_cat_hl_standard')!;

    const demands: CateringDemand[] = [
      { airframeClass: 'regional', seats: 50, serviceLevel: 0.5 },
      { airframeClass: 'widebody', seats: 250, serviceLevel: 0.5 }
    ];

    const result = fleetCoverage([van, hlTruck], demands);
    expect(result.ok).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it('validators check unique ids and value ranges', () => {
    expect(validateCateringTrucks(CATERING_TRUCKS)).toEqual([]);

    const badTrucks = [
      ...CATERING_TRUCKS,
      { ...CATERING_TRUCKS[0] } // duplicate id
    ];
    expect(validateCateringTrucks(badTrucks).length).toBe(1);
    expect(validateCateringTrucks(badTrucks)[0]).toContain('Duplicate id');

    const invalidCapacity = [{ ...CATERING_TRUCKS[0], cartCapacity: -1 }];
    expect(validateCateringTrucks(invalidCapacity).length).toBe(1);
    expect(validateCateringTrucks(invalidCapacity)[0]).toContain('invalid cart capacity');
  });
});
