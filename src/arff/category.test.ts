import { describe, expect, it } from 'vitest';
import { ARFF_CATEGORIES, getCategoryConfig } from './data.ts';
import {
  categoryForAirframe,
  effectiveCategory,
  missingCover,
  remissionAllowed,
  requiredCategory,
} from './category.ts';

describe('ARFF data.ts', () => {
  it('defines categories 1 through 10 with valid configurations', () => {
    for (let cat = 1; cat <= 10; cat++) {
      const config = ARFF_CATEGORIES[cat];
      expect(config).toBeDefined();
      expect(config.category).toBe(cat);
      expect(config.vehicles).toBeGreaterThan(0);
      expect(config.agents).toBeGreaterThan(0);
      expect(config.waterLiters).toBeGreaterThan(0);
    }
  });

  it('matches required specs for key categories (Cat 6, Cat 9, Cat 10)', () => {
    const cat6 = getCategoryConfig(6);
    expect(cat6).toBeDefined();
    expect(cat6?.vehicles).toBe(2);
    expect(cat6?.agents).toBe(6);
    expect(cat6?.waterLiters).toBe(7900);

    const cat9 = getCategoryConfig(9);
    expect(cat9).toBeDefined();
    expect(cat9?.vehicles).toBe(3);
    expect(cat9?.agents).toBe(9);
    expect(cat9?.waterLiters).toBe(24300);

    const cat10 = getCategoryConfig(10);
    expect(cat10).toBeDefined();
    expect(cat10?.vehicles).toBe(3);
    expect(cat10?.agents).toBe(12);
    expect(cat10?.waterLiters).toBe(32300);

    // Cat 10 should have larger water capacity than Cat 9
    expect(cat10!.waterLiters).toBeGreaterThan(cat9!.waterLiters);
  });
});

describe('ARFF category calculations', () => {
  describe('categoryForAirframe', () => {
    it('classifies small aircraft (Cat 1)', () => {
      expect(categoryForAirframe({ lengthM: 8, widthM: 1.8 })).toBe(1);
    });

    it('classifies mid-size regional aircraft (Cat 5)', () => {
      expect(categoryForAirframe({ lengthM: 27, widthM: 3.5 })).toBe(5);
    });

    it('applies fuselage width step-up rule', () => {
      // Length 25m matches Cat 5 (range 24m - 28m, max width 4m)
      // Width 3.5m <= 4m -> Cat 5
      expect(categoryForAirframe({ lengthM: 25, widthM: 3.5 })).toBe(5);

      // Width 4.5m > 4m -> steps up to Cat 6
      expect(categoryForAirframe({ lengthM: 25, widthM: 4.5 })).toBe(6);
    });

    it('classifies large widebody aircraft and handles width step-up to Cat 10', () => {
      // Cat 9 length range 61m - 76m, max width 7m
      expect(categoryForAirframe({ lengthM: 70, widthM: 6.0 })).toBe(9);

      // Width 7.5m > 7m -> steps up to Cat 10
      expect(categoryForAirframe({ lengthM: 70, widthM: 7.5 })).toBe(10);

      // Cat 10 aircraft length >= 76m
      expect(categoryForAirframe({ lengthM: 80, widthM: 7.5 })).toBe(10);
    });

    it('caps maximum category at 10', () => {
      expect(categoryForAirframe({ lengthM: 85, widthM: 9.0 })).toBe(10);
    });
  });

  describe('requiredCategory', () => {
    it('returns 0 when no airframes are provided', () => {
      expect(requiredCategory([])).toBe(0);
    });

    it('determines the category based on the largest operating aircraft', () => {
      const airframes = [
        { lengthM: 10, widthM: 1.8 }, // Cat 2
        { lengthM: 35, widthM: 3.9 }, // Cat 6
        { lengthM: 25, widthM: 3.5 }, // Cat 5
      ];
      expect(requiredCategory(airframes)).toBe(6);
    });

    it('evaluates highest required category when width step-up is present', () => {
      const airframes = [
        { lengthM: 25, widthM: 4.5 }, // Cat 5 length, but width > 4m -> Cat 6
        { lengthM: 20, widthM: 2.0 }, // Cat 4
      ];
      expect(requiredCategory(airframes)).toBe(6);
    });
  });

  describe('remissionAllowed', () => {
    it('allows remission when top category movements are under 700', () => {
      expect(remissionAllowed(0)).toBe(true);
      expect(remissionAllowed(100)).toBe(true);
      expect(remissionAllowed(699)).toBe(true);
    });

    it('disallows remission when top category movements are 700 or greater', () => {
      expect(remissionAllowed(700)).toBe(false);
      expect(remissionAllowed(750)).toBe(false);
      expect(remissionAllowed(1200)).toBe(false);
    });
  });

  describe('effectiveCategory', () => {
    it('reduces required category by 1 level if remission is allowed', () => {
      expect(effectiveCategory(6, 500)).toBe(5);
      expect(effectiveCategory(10, 699)).toBe(9);
    });

    it('keeps required category unchanged if remission is not allowed', () => {
      expect(effectiveCategory(6, 700)).toBe(6);
      expect(effectiveCategory(10, 1000)).toBe(10);
    });

    it('does not drop category below 1 or 0', () => {
      expect(effectiveCategory(1, 100)).toBe(1);
      expect(effectiveCategory(0, 100)).toBe(0);
    });
  });

  describe('missingCover', () => {
    it('reports no deficits when airport meets required category level', () => {
      const result = missingCover(6, 6);
      expect(result.isCovered).toBe(true);
      expect(result.vehicles).toBe(0);
      expect(result.agents).toBe(0);
      expect(result.waterLiters).toBe(0);
      expect(result.category).toBe(0);
    });

    it('reports no deficits when airport exceeds required category level', () => {
      const result = missingCover(8, 6);
      expect(result.isCovered).toBe(true);
      expect(result.vehicles).toBe(0);
      expect(result.agents).toBe(0);
      expect(result.waterLiters).toBe(0);
      expect(result.category).toBe(0);
    });

    it('calculates missing resources when category is insufficient', () => {
      // Required Cat 6: 2 vehicles, 6 agents, 7900L
      // Provided Cat 4: 1 vehicle, 3 agents, 2400L
      const result = missingCover(4, 6);
      expect(result.isCovered).toBe(false);
      expect(result.vehicles).toBe(1);
      expect(result.agents).toBe(3);
      expect(result.waterLiters).toBe(5500);
      expect(result.category).toBe(2);
    });

    it('handles resource object inputs', () => {
      // Cat 6 needs 2 vehicles, 6 agents, 7900L
      const have = { vehicles: 1, agents: 6, waterLiters: 8000 };
      const result = missingCover(have, 6);
      expect(result.isCovered).toBe(false);
      expect(result.vehicles).toBe(1);
      expect(result.agents).toBe(0);
      expect(result.waterLiters).toBe(0);
    });

    it('handles empty or zero category requirements', () => {
      const result = missingCover(0, 0);
      expect(result.isCovered).toBe(true);
      expect(result.vehicles).toBe(0);
      expect(result.agents).toBe(0);
      expect(result.waterLiters).toBe(0);
      expect(result.category).toBe(0);
    });
  });
});
