import { describe, expect, it } from 'vitest';
import type { StarStats } from './stars';
import { STAR_THRESHOLDS, newGamePlusUnlocked, starsEarned } from './stars';

const BASE_STATS: StarStats = {
  rating: 0.5,
  rivalShare: 0.5,
  transferShare: 0.1,
  mishandledRate: 0.05,
  onTimeRate: 0.5,
  paxPerDay: 1000,
  specializationsMastered: 0,
  awards: 0,
};

describe('Prestige Stars Evaluator', () => {
  describe('Threshold checks', () => {
    it('evaluates Star 1 threshold correctly (rating >= 0.80, rival share <= 0.45)', () => {
      const star1 = STAR_THRESHOLDS.find((t) => t.star === 1)!;
      expect(star1.check({ ...BASE_STATS, rating: 0.8, rivalShare: 0.45 })).toBe(true);
      expect(star1.check({ ...BASE_STATS, rating: 0.79, rivalShare: 0.45 })).toBe(false);
      expect(star1.check({ ...BASE_STATS, rating: 0.8, rivalShare: 0.46 })).toBe(false);
    });

    it('evaluates Star 2 threshold correctly (transfers >= 0.25, mishandled <= 0.008)', () => {
      const star2 = STAR_THRESHOLDS.find((t) => t.star === 2)!;
      expect(star2.check({ ...BASE_STATS, transferShare: 0.25, mishandledRate: 0.008 })).toBe(true);
      expect(star2.check({ ...BASE_STATS, transferShare: 0.24, mishandledRate: 0.008 })).toBe(false);
      expect(star2.check({ ...BASE_STATS, transferShare: 0.25, mishandledRate: 0.009 })).toBe(false);
    });

    it('evaluates Star 3 threshold correctly (on-time >= 0.90 at >= 8,000 pax/day)', () => {
      const star3 = STAR_THRESHOLDS.find((t) => t.star === 3)!;
      expect(star3.check({ ...BASE_STATS, onTimeRate: 0.9, paxPerDay: 8000 })).toBe(true);
      expect(star3.check({ ...BASE_STATS, onTimeRate: 0.89, paxPerDay: 8000 })).toBe(false);
      expect(star3.check({ ...BASE_STATS, onTimeRate: 0.9, paxPerDay: 7999 })).toBe(false);
    });

    it('evaluates Star 4 threshold correctly (>= 2 specializations mastered and >= 2 awards)', () => {
      const star4 = STAR_THRESHOLDS.find((t) => t.star === 4)!;
      expect(star4.check({ ...BASE_STATS, specializationsMastered: 2, awards: 2 })).toBe(true);
      expect(star4.check({ ...BASE_STATS, specializationsMastered: 1, awards: 2 })).toBe(false);
      expect(star4.check({ ...BASE_STATS, specializationsMastered: 2, awards: 1 })).toBe(false);
    });

    it('evaluates Star 5 threshold correctly (>= 15,000 pax/day, rating >= 0.90, rival share <= 0.25, >= 4 awards)', () => {
      const star5 = STAR_THRESHOLDS.find((t) => t.star === 5)!;
      const validStar5Stats: StarStats = {
        ...BASE_STATS,
        paxPerDay: 15000,
        rating: 0.9,
        rivalShare: 0.25,
        awards: 4,
      };
      expect(star5.check(validStar5Stats)).toBe(true);
      expect(star5.check({ ...validStar5Stats, paxPerDay: 14999 })).toBe(false);
      expect(star5.check({ ...validStar5Stats, rating: 0.89 })).toBe(false);
      expect(star5.check({ ...validStar5Stats, rivalShare: 0.26 })).toBe(false);
      expect(star5.check({ ...validStar5Stats, awards: 3 })).toBe(false);
    });
  });

  describe('In-order rule and progression', () => {
    it('does not earn Star 2 or 3 without earning previous stars first', () => {
      // Meets Star 2 criteria but not Star 1 criteria
      const star2OnlyStats: StarStats = {
        ...BASE_STATS,
        rating: 0.5,
        rivalShare: 0.5,
        transferShare: 0.5,
        mishandledRate: 0.001,
      };
      expect(starsEarned(0, star2OnlyStats)).toBe(0);

      // Meets Star 1 & Star 3 criteria but not Star 2
      const star1And3Stats: StarStats = {
        ...BASE_STATS,
        rating: 0.85,
        rivalShare: 0.4,
        transferShare: 0.1, // Fails Star 2
        mishandledRate: 0.05,
        onTimeRate: 0.95, // Meets Star 3
        paxPerDay: 10000, // Meets Star 3
      };
      expect(starsEarned(0, star1And3Stats)).toBe(1);
    });

    it('earns multiple stars sequentially if all criteria are met', () => {
      const allStarsStats: StarStats = {
        rating: 0.95,
        rivalShare: 0.2,
        transferShare: 0.3,
        mishandledRate: 0.005,
        onTimeRate: 0.95,
        paxPerDay: 20000,
        specializationsMastered: 3,
        awards: 5,
      };
      expect(starsEarned(0, allStarsStats)).toBe(5);
    });
  });

  describe('Never decreases rule', () => {
    it('retains earned stars even if stats drop', () => {
      const poorStats: StarStats = { ...BASE_STATS };
      expect(starsEarned(3, poorStats)).toBe(3);
      expect(starsEarned(5, poorStats)).toBe(5);
    });
  });

  describe('NaN safety', () => {
    it('never earns a star if required stats are NaN', () => {
      const nanStar1Stats: StarStats = {
        ...BASE_STATS,
        rating: NaN,
        rivalShare: 0.4,
      };
      expect(starsEarned(0, nanStar1Stats)).toBe(0);

      const nanCurrentStars = starsEarned(NaN, {
        ...BASE_STATS,
        rating: 0.85,
        rivalShare: 0.4,
      });
      expect(nanCurrentStars).toBe(1);
    });
  });

  describe('New Game+ unlock', () => {
    it('unlocks New Game+ if and only if 5 stars are achieved', () => {
      expect(newGamePlusUnlocked(0)).toBe(false);
      expect(newGamePlusUnlocked(4)).toBe(false);
      expect(newGamePlusUnlocked(5)).toBe(true);
      expect(newGamePlusUnlocked(6)).toBe(true);
      expect(newGamePlusUnlocked(NaN)).toBe(false);
    });
  });
});
