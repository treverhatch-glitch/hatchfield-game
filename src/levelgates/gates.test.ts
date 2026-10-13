import { describe, expect, it } from 'vitest';
import type { GateStats } from './gates';
import { checkGate } from './gates';

function createMockStats(overrides: Partial<GateStats> = {}): GateStats {
  return {
    profitStreakDays: 10,
    morale: 0.9,
    connectingBanks: 5,
    a380ContractDays: 14,
    rating: 0.9,
    transferShare: 0.25,
    paxPerDay: 10000,
    mishandledRate: 0.001,
    majorDisruptionsSurvived: 5,
    specializationBadges: 3,
    marketsBeatingRival: 2,
    ...overrides,
  };
}

describe('Level Gates Checker', () => {
  describe('FL7 Gate', () => {
    it('passes at exact threshold', () => {
      const stats = createMockStats({
        profitStreakDays: 5,
        morale: 0.7,
        connectingBanks: 1,
      });
      const res = checkGate(7, stats);
      expect(res.ok).toBe(true);
      expect(res.missing).toEqual([]);
    });

    it('fails just below threshold for each requirement', () => {
      // Below profitStreakDays
      const resProfit = checkGate(
        7,
        createMockStats({
          profitStreakDays: 4,
          morale: 0.7,
          connectingBanks: 1,
        }),
      );
      expect(resProfit.ok).toBe(false);
      expect(resProfit.missing).toEqual([
        { key: 'profitStreakDays', have: 4, need: 5 },
      ]);

      // Below morale
      const resMorale = checkGate(
        7,
        createMockStats({
          profitStreakDays: 5,
          morale: 0.699,
          connectingBanks: 1,
        }),
      );
      expect(resMorale.ok).toBe(false);
      expect(resMorale.missing).toEqual([
        { key: 'morale', have: 0.699, need: 0.7 },
      ]);

      // Below connectingBanks
      const resBanks = checkGate(
        7,
        createMockStats({
          profitStreakDays: 5,
          morale: 0.7,
          connectingBanks: 0,
        }),
      );
      expect(resBanks.ok).toBe(false);
      expect(resBanks.missing).toEqual([
        { key: 'connectingBanks', have: 0, need: 1 },
      ]);
    });

    it('lists every missing item when multiple fail', () => {
      const res = checkGate(
        7,
        createMockStats({
          profitStreakDays: 3,
          morale: 0.5,
          connectingBanks: 0,
        }),
      );
      expect(res.ok).toBe(false);
      expect(res.missing).toEqual([
        { key: 'profitStreakDays', have: 3, need: 5 },
        { key: 'morale', have: 0.5, need: 0.7 },
        { key: 'connectingBanks', have: 0, need: 1 },
      ]);
    });
  });

  describe('FL8 Gate', () => {
    it('passes at exact threshold', () => {
      const stats = createMockStats({
        a380ContractDays: 7,
        rating: 0.75,
        transferShare: 0.1,
      });
      const res = checkGate(8, stats);
      expect(res.ok).toBe(true);
      expect(res.missing).toEqual([]);
    });

    it('fails just below threshold for each requirement', () => {
      // Below a380ContractDays
      const resDays = checkGate(
        8,
        createMockStats({
          a380ContractDays: 6,
          rating: 0.75,
          transferShare: 0.1,
        }),
      );
      expect(resDays.ok).toBe(false);
      expect(resDays.missing).toEqual([
        { key: 'a380ContractDays', have: 6, need: 7 },
      ]);

      // Below rating
      const resRating = checkGate(
        8,
        createMockStats({
          a380ContractDays: 7,
          rating: 0.749,
          transferShare: 0.1,
        }),
      );
      expect(resRating.ok).toBe(false);
      expect(resRating.missing).toEqual([
        { key: 'rating', have: 0.749, need: 0.75 },
      ]);

      // Below transferShare
      const resShare = checkGate(
        8,
        createMockStats({
          a380ContractDays: 7,
          rating: 0.75,
          transferShare: 0.099,
        }),
      );
      expect(resShare.ok).toBe(false);
      expect(resShare.missing).toEqual([
        { key: 'transferShare', have: 0.099, need: 0.1 },
      ]);
    });
  });

  describe('FL9 Gate', () => {
    it('passes at exact threshold', () => {
      const stats = createMockStats({
        paxPerDay: 5000,
        mishandledRate: 0.009,
        majorDisruptionsSurvived: 1,
      });
      const res = checkGate(9, stats);
      expect(res.ok).toBe(true);
      expect(res.missing).toEqual([]);
    });

    it('fails when paxPerDay is just below threshold', () => {
      const res = checkGate(
        9,
        createMockStats({
          paxPerDay: 4999,
          mishandledRate: 0.005,
          majorDisruptionsSurvived: 1,
        }),
      );
      expect(res.ok).toBe(false);
      expect(res.missing).toEqual([{ key: 'paxPerDay', have: 4999, need: 5000 }]);
    });

    it('fails when mishandledRate is at or above 0.01 threshold (< 0.01 required)', () => {
      const resExact = checkGate(
        9,
        createMockStats({
          paxPerDay: 5000,
          mishandledRate: 0.01,
          majorDisruptionsSurvived: 1,
        }),
      );
      expect(resExact.ok).toBe(false);
      expect(resExact.missing).toEqual([
        { key: 'mishandledRate', have: 0.01, need: 0.01 },
      ]);

      const resAbove = checkGate(
        9,
        createMockStats({
          paxPerDay: 5000,
          mishandledRate: 0.02,
          majorDisruptionsSurvived: 1,
        }),
      );
      expect(resAbove.ok).toBe(false);
      expect(resAbove.missing).toEqual([
        { key: 'mishandledRate', have: 0.02, need: 0.01 },
      ]);
    });

    it('fails when majorDisruptionsSurvived is below 1', () => {
      const res = checkGate(
        9,
        createMockStats({
          paxPerDay: 5000,
          mishandledRate: 0.005,
          majorDisruptionsSurvived: 0,
        }),
      );
      expect(res.ok).toBe(false);
      expect(res.missing).toEqual([
        { key: 'majorDisruptionsSurvived', have: 0, need: 1 },
      ]);
    });
  });

  describe('FL10 Gate', () => {
    it('passes at exact threshold', () => {
      const stats = createMockStats({
        specializationBadges: 1,
        marketsBeatingRival: 1,
      });
      const res = checkGate(10, stats);
      expect(res.ok).toBe(true);
      expect(res.missing).toEqual([]);
    });

    it('fails just below threshold', () => {
      const resBadges = checkGate(
        10,
        createMockStats({
          specializationBadges: 0,
          marketsBeatingRival: 1,
        }),
      );
      expect(resBadges.ok).toBe(false);
      expect(resBadges.missing).toEqual([
        { key: 'specializationBadges', have: 0, need: 1 },
      ]);

      const resMarkets = checkGate(
        10,
        createMockStats({
          specializationBadges: 1,
          marketsBeatingRival: 0,
        }),
      );
      expect(resMarkets.ok).toBe(false);
      expect(resMarkets.missing).toEqual([
        { key: 'marketsBeatingRival', have: 0, need: 1 },
      ]);
    });
  });

  describe('NaN values', () => {
    it('treats NaN as not met and lists as missing item', () => {
      const stats7 = createMockStats({
        profitStreakDays: NaN,
        morale: 0.7,
        connectingBanks: 1,
      });
      const res7 = checkGate(7, stats7);
      expect(res7.ok).toBe(false);
      expect(res7.missing).toEqual([
        { key: 'profitStreakDays', have: NaN, need: 5 },
      ]);

      const stats9 = createMockStats({
        paxPerDay: 5000,
        mishandledRate: NaN,
        majorDisruptionsSurvived: 1,
      });
      const res9 = checkGate(9, stats9);
      expect(res9.ok).toBe(false);
      expect(res9.missing).toEqual([
        { key: 'mishandledRate', have: NaN, need: 0.01 },
      ]);
    });
  });
});
