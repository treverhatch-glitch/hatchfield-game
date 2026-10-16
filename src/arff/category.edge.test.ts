import { describe, it, expect } from 'vitest';
import {
  categoryForAirframe,
  requiredCategory,
  remissionAllowed,
  effectiveCategory,
  missingCover,
} from './category.ts';
import { ARFF_CATEGORIES } from './data.ts';

describe('categoryForAirframe', () => {
  it('exclusive length table (narrow width so width step-up does not fire)', () => {
    const bounds = [
      { bound: 9, cat: 1 },
      { bound: 12, cat: 2 },
      { bound: 18, cat: 3 },
      { bound: 24, cat: 4 },
      { bound: 28, cat: 5 },
      { bound: 39, cat: 6 },
      { bound: 49, cat: 7 },
      { bound: 61, cat: 8 },
      { bound: 76, cat: 9 },
    ];

    for (const { bound, cat } of bounds) {
      // lengthM = bound - 0.01 maps to the category whose maxLengthM === bound
      expect(categoryForAirframe({ lengthM: bound - 0.01, widthM: 1 })).toBe(cat);
      // lengthM = bound maps to the next category (exclusive upper bound)
      expect(categoryForAirframe({ lengthM: bound, widthM: 1 })).toBe(cat + 1);
    }
  });

  it('documents cat for lengthM = 0, negative length, and Infinity (cat 10)', () => {
    expect(categoryForAirframe({ lengthM: 0, widthM: 1 })).toBe(1);
    expect(categoryForAirframe({ lengthM: -10, widthM: 1 })).toBe(1);
    expect(categoryForAirframe({ lengthM: Infinity, widthM: 1 })).toBe(10);
  });

  it('width step-up: for categories 1-9, widthM = maxWidthM + 0.01 returns min(10, N+1)', () => {
    for (let c = 1; c <= 9; c++) {
      const config = ARFF_CATEGORIES[c];
      const lengthM = config.maxLengthM - 0.01;
      const widthM = config.maxWidthM + 0.01;
      expect(categoryForAirframe({ lengthM, widthM })).toBe(Math.min(10, c + 1));
    }
  });

  it('Cat 10 stays 10 even if width exceeds maxWidthM', () => {
    const config = ARFF_CATEGORIES[10];
    // Use length that would be cat 10
    expect(categoryForAirframe({ lengthM: 80, widthM: config.maxWidthM + 0.01 })).toBe(10);
  });

  it('Exact width equal to maxWidthM does not step up', () => {
    for (let c = 1; c <= 9; c++) {
      const config = ARFF_CATEGORIES[c];
      const lengthM = config.maxLengthM - 0.01;
      const widthM = config.maxWidthM;
      expect(categoryForAirframe({ lengthM, widthM })).toBe(c);
    }
  });

  it('Purity: helpers do not mutate input airframe', () => {
    const airframe = Object.freeze({ lengthM: 20, widthM: 2 });
    expect(() => categoryForAirframe(airframe)).not.toThrow();
    expect(categoryForAirframe(airframe)).toBe(4);
  });
});

describe('requiredCategory', () => {
  it('requiredCategory([]) and falsy cast -> 0', () => {
    expect(requiredCategory([])).toBe(0);
    // @ts-expect-error testing falsy cast
    expect(requiredCategory(null)).toBe(0);
    // @ts-expect-error testing falsy cast
    expect(requiredCategory(undefined)).toBe(0);
  });

  it('single airframe equals categoryForAirframe', () => {
    expect(requiredCategory([{ lengthM: 20, widthM: 2 }])).toBe(4);
  });

  it('max across a mixed list wins', () => {
    const list = [
      { lengthM: 8, widthM: 1 }, // cat 1
      { lengthM: 20, widthM: 2 }, // cat 4
      { lengthM: 15, widthM: 1 }, // cat 3
    ];
    expect(requiredCategory(list)).toBe(4);
  });

  it('Purity: helpers do not mutate input airframe arrays/objects', () => {
    const list = Object.freeze([
      Object.freeze({ lengthM: 8, widthM: 1 }),
      Object.freeze({ lengthM: 20, widthM: 2 })
    ]);
    expect(() => requiredCategory(list as any)).not.toThrow();
    expect(requiredCategory(list as any)).toBe(4);
  });
});

describe('remissionAllowed', () => {
  it('699 true, 700 false', () => {
    expect(remissionAllowed(699)).toBe(true);
    expect(remissionAllowed(700)).toBe(false);
  });
});

describe('effectiveCategory', () => {
  it('effectiveCategory(1, 0) floors at 1 (not 0)', () => {
    expect(effectiveCategory(1, 0)).toBe(1);
  });

  it('effectiveCategory(0, 0) -> 0', () => {
    expect(effectiveCategory(0, 0)).toBe(0);
  });

  it('effectiveCategory(5, 700) unchanged at 5', () => {
    expect(effectiveCategory(5, 700)).toBe(5);
  });
  
  it('effectiveCategory(5, 699) returns 4 (remission applied)', () => {
    expect(effectiveCategory(5, 699)).toBe(4);
  });
});

describe('missingCover', () => {
  it('cat <= 0 -> all zeros, isCovered: true', () => {
    expect(missingCover(5, 0)).toEqual({ vehicles: 0, agents: 0, waterLiters: 0, category: 0, isCovered: true });
    expect(missingCover({ vehicles: 1 }, -1)).toEqual({ vehicles: 0, agents: 0, waterLiters: 0, category: 0, isCovered: true });
  });

  it('Numeric have uses that categorys table resources', () => {
    // have: 3 -> v1, a2, w1800
    // req: 4 -> v1, a3, w2400
    // missing: v0, a1, w600, cat 1
    expect(missingCover(3, 4)).toEqual({
      vehicles: 0,
      agents: 1,
      waterLiters: 600,
      category: 1,
      isCovered: false,
    });
  });

  it('Object have with category > 0 fills missing fields from that categorys config when vehicles/agents/water omitted', () => {
    // have: cat 5 (v1, a4, w5400)
    // req: cat 6 (v2, a6, w7900)
    // missing: v1, a2, w2500, cat 1
    expect(missingCover({ category: 5 }, 6)).toEqual({
      vehicles: 1,
      agents: 2,
      waterLiters: 2500,
      category: 1,
      isCovered: false,
    });

    // Object have with category > 0 but override some
    expect(missingCover({ category: 5, agents: 6 }, 6)).toEqual({
      vehicles: 1,
      agents: 0,
      waterLiters: 2500,
      category: 1,
      isCovered: false,
    });
  });

  it('Object have without category infers avail category by scanning 10->1 for resources that meet the table', () => {
    // have: v2, a6, w8000
    // meets cat 6 (v2, a6, w7900), so availCat = 6
    // req: 7 (v2, a6, w12100)
    // missing: v0, a0, w4100, cat 1
    expect(missingCover({ vehicles: 2, agents: 6, waterLiters: 8000 }, 7)).toEqual({
      vehicles: 0,
      agents: 0,
      waterLiters: 4100,
      category: 1,
      isCovered: false,
    });
  });

  it('Partial cover: enough vehicles but short water -> isCovered false and positive waterLiters', () => {
    // have: v1, a2, w1799
    // meets cat 2 (v1, a2, w1000)
    // req: 3 (v1, a2, w1800)
    // missing: v0, a0, w1, cat 1
    expect(missingCover({ vehicles: 1, agents: 2, waterLiters: 1799 }, 3)).toEqual({
      vehicles: 0,
      agents: 0,
      waterLiters: 1,
      category: 1,
      isCovered: false,
    });
  });

  it('Purity: helpers do not mutate input object', () => {
    const have = Object.freeze({ vehicles: 1, agents: 2, waterLiters: 1799 });
    expect(() => missingCover(have, 3)).not.toThrow();
  });
});
