import { describe, it, expect } from 'vitest';
import {
  MOBILE_GPU_UNITS,
  classRank,
  gpuMinutesForStand,
  canCover,
  apuTonnesSaved,
  fleetCoverage,
  validateGpuPca,
} from './gpu_pca.ts';
import type { TurnaroundPowerNeed } from './gpu_pca.ts';

describe('gpu_pca pure module', () => {
  it('classRank orders aircraft classes correctly', () => {
    expect(classRank('regional')).toBe(1);
    expect(classRank('narrowbody')).toBe(2);
    expect(classRank('widebody')).toBe(3);
    expect(classRank('super')).toBe(4);
  });

  it('gpuMinutesForStand maps stand sizes to correct minutes', () => {
    expect(gpuMinutesForStand('light')).toBe(20);
    expect(gpuMinutesForStand('narrow')).toBe(35);
    expect(gpuMinutesForStand('heavy')).toBe(60);
  });

  it('canCover respects fixedLive, maxClass, and PCA requirements', () => {
    const gpuVan = MOBILE_GPU_UNITS.find(u => u.id === 'gpu_van')!;
    const gpuPcaNarrow = MOBILE_GPU_UNITS.find(u => u.id === 'gpu_pca_narrow')!;

    // fixedLive needs no truck
    expect(canCover(gpuVan, {
      acClass: 'super', standSize: 'heavy', minutes: 60, wantPca: true, fixedLive: true
    })).toBe(true);

    // gpu_van (maxClass: regional, no PCA)
    expect(canCover(gpuVan, {
      acClass: 'regional', standSize: 'light', minutes: 20, wantPca: false, fixedLive: false
    })).toBe(true);

    // gating: requires PCA
    expect(canCover(gpuVan, {
      acClass: 'regional', standSize: 'light', minutes: 20, wantPca: true, fixedLive: false
    })).toBe(false);

    // gating: maxClass too low
    expect(canCover(gpuVan, {
      acClass: 'narrowbody', standSize: 'narrow', minutes: 35, wantPca: false, fixedLive: false
    })).toBe(false);

    // gpu_pca_narrow (maxClass: narrowbody, has PCA)
    expect(canCover(gpuPcaNarrow, {
      acClass: 'regional', standSize: 'light', minutes: 20, wantPca: true, fixedLive: false
    })).toBe(true);
    expect(canCover(gpuPcaNarrow, {
      acClass: 'narrowbody', standSize: 'narrow', minutes: 35, wantPca: true, fixedLive: false
    })).toBe(true);
    expect(canCover(gpuPcaNarrow, {
      acClass: 'widebody', standSize: 'heavy', minutes: 60, wantPca: true, fixedLive: false
    })).toBe(false); // maxClass too low
  });

  it('apuTonnesSaved is monotonic in minutes and returns 0 when not covered', () => {
    const need: TurnaroundPowerNeed = {
      acClass: 'widebody',
      standSize: 'heavy',
      minutes: 60,
      wantPca: false,
      fixedLive: false
    };

    // not covered -> 0
    expect(apuTonnesSaved(need, false)).toBe(0);

    // 60 minutes = 1 hour -> 0.35 tonnes
    expect(apuTonnesSaved(need, true)).toBeCloseTo(0.35);

    // 120 minutes = 2 hours -> 0.70 tonnes
    need.minutes = 120;
    expect(apuTonnesSaved(need, true)).toBeCloseTo(0.70);

    // monotonic property
    need.minutes = 30;
    const save30 = apuTonnesSaved(need, true);
    need.minutes = 60;
    const save60 = apuTonnesSaved(need, true);
    expect(save60).toBeGreaterThan(save30);
  });

  it('apuTonnesSaved falls back to fixedLive for cover check', () => {
    const need: TurnaroundPowerNeed = {
      acClass: 'regional',
      standSize: 'light',
      minutes: 60, // 1 hour -> 0.08 tonnes
      wantPca: false,
      fixedLive: true
    };
    expect(apuTonnesSaved(need)).toBeCloseTo(0.08);

    need.fixedLive = false;
    expect(apuTonnesSaved(need)).toBe(0);
  });

  it('fleetCoverage computes covered and shortfalls correctly', () => {
    const units = [
      MOBILE_GPU_UNITS.find(u => u.id === 'gpu_van')!,
      MOBILE_GPU_UNITS.find(u => u.id === 'gpu_pca_narrow')!
    ];

    const needs: TurnaroundPowerNeed[] = [
      // Can be covered by gpu_van
      { acClass: 'regional', standSize: 'light', minutes: 20, wantPca: false, fixedLive: false },
      // Needs PCA, covered by gpu_pca_narrow
      { acClass: 'narrowbody', standSize: 'narrow', minutes: 35, wantPca: true, fixedLive: false },
      // Needs fixedLive (already covered)
      { acClass: 'super', standSize: 'heavy', minutes: 60, wantPca: true, fixedLive: true },
      // Uncovered (widebody not supported by remaining units)
      { acClass: 'widebody', standSize: 'heavy', minutes: 60, wantPca: false, fixedLive: false }
    ];

    const result = fleetCoverage(units, needs);
    expect(result.covered).toBe(3); // 1 fixed, 2 by trucks
    expect(result.shortfall).toBe(1);
  });

  it('validateGpuPca validates mobile unit definitions', () => {
    // Should be valid
    expect(validateGpuPca(MOBILE_GPU_UNITS)).toEqual([]);

    // Missing ID
    expect(validateGpuPca([{ name: 'Test', maxClass: 'regional', hasPca: false, cost: 100, upkeepPerDay: 10 }])).toContainEqual(expect.stringContaining('missing an id'));

    // Duplicate ID
    expect(validateGpuPca([MOBILE_GPU_UNITS[0], MOBILE_GPU_UNITS[0]])).toContainEqual(expect.stringContaining('Duplicate id'));

    // Invalid maxClass
    expect(validateGpuPca([{ id: 'test1', name: 'Test', maxClass: 'invalid', hasPca: false, cost: 100, upkeepPerDay: 10 }])).toContainEqual(expect.stringContaining('invalid maxClass'));

    // Invalid cost
    expect(validateGpuPca([{ id: 'test2', name: 'Test', maxClass: 'regional', hasPca: false, cost: -100, upkeepPerDay: 10 }])).toContainEqual(expect.stringContaining('invalid cost'));
  });
});
