import { describe, it, expect } from 'vitest';
import {
  rosterCost,
  coverageGaps,
  NIGHT_PREMIUM_RATE,
  OVERTIME_FACTOR_RATE,
  type RoleShiftConfig,
} from './shifts';

describe('staff shifts module', () => {
  describe('rosterCost', () => {
    it('calculates cost without night premium for early and late shifts', () => {
      const roles: RoleShiftConfig[] = [
        {
          role: 'ground_crew',
          perShift: [2, 2, 0],
          wagePerDay: 100,
        },
      ];
      // 2 early ($200) + 2 late ($200) = $400
      expect(rosterCost(roles)).toBe(400);
    });

    it('applies 25% night premium for night shift', () => {
      expect(NIGHT_PREMIUM_RATE).toBe(0.25);
      const roles: RoleShiftConfig[] = [
        {
          role: 'ground_crew',
          perShift: [0, 0, 2],
          wagePerDay: 100,
        },
      ];
      // 2 night workers * $100 * 1.25 = $250
      expect(rosterCost(roles)).toBe(250);
    });

    it('combines all shifts with night premium', () => {
      const roles: RoleShiftConfig[] = [
        {
          role: 'security',
          perShift: [1, 1, 1],
          wagePerDay: 100,
        },
      ];
      // 100 + 100 + 125 = 325
      expect(rosterCost(roles)).toBe(325);
    });

    it('applies 10% overtime multiplier when any shift is under 80% staffed', () => {
      expect(OVERTIME_FACTOR_RATE).toBe(0.10);
      const roles: RoleShiftConfig[] = [
        {
          role: 'janitor',
          perShift: [10, 10, 7], // night shift is 7/10 = 70% (< 80%)
          requiredPerShift: [10, 10, 10],
          wagePerDay: 100,
        },
      ];
      // Base: (10*100) + (10*100) + (7*100*1.25) = 1000 + 1000 + 875 = 2875
      // Overtime factor: 2875 * 1.10 = 3162.5
      expect(rosterCost(roles)).toBe(3162.5);
    });

    it('does not apply overtime multiplier when all shifts are >= 80% staffed', () => {
      const roles: RoleShiftConfig[] = [
        {
          role: 'janitor',
          perShift: [8, 9, 8], // all >= 80%
          requiredPerShift: [10, 10, 10],
          wagePerDay: 100,
        },
      ];
      // Base: (8*100) + (9*100) + (8*100*1.25) = 800 + 900 + 1000 = 2700
      expect(rosterCost(roles)).toBe(2700);
    });

    it('handles empty or invalid roles array without NaN', () => {
      expect(rosterCost([])).toBe(0);
      expect(rosterCost(null)).toBe(0);
      expect(
        rosterCost([
          { role: 'test', perShift: [NaN as any, 1, 0], wagePerDay: NaN },
        ]),
      ).toBe(0);
    });
  });

  describe('coverageGaps', () => {
    it('returns empty array when there are no gaps', () => {
      const roles: RoleShiftConfig[] = [
        {
          role: 'ground_crew',
          perShift: [5, 5, 5],
          requiredPerShift: [5, 5, 5],
          wagePerDay: 100,
        },
      ];
      expect(coverageGaps(roles)).toEqual([]);
    });

    it('identifies understaffed shifts correctly', () => {
      const roles: RoleShiftConfig[] = [
        {
          role: 'security',
          perShift: [5, 3, 2],
          requiredPerShift: [5, 5, 4],
          wagePerDay: 150,
        },
      ];
      const gaps = coverageGaps(roles);
      expect(gaps.length).toBe(2);

      expect(gaps[0]).toEqual({
        role: 'security',
        shift: 'late',
        shiftIndex: 1,
        required: 5,
        actual: 3,
        deficit: 2,
        staffingRatio: 0.6,
        isUnder80Percent: true,
      });

      expect(gaps[1]).toEqual({
        role: 'security',
        shift: 'night',
        shiftIndex: 2,
        required: 4,
        actual: 2,
        deficit: 2,
        staffingRatio: 0.5,
        isUnder80Percent: true,
      });
    });

    it('handles null/undefined/empty input safely', () => {
      expect(coverageGaps(null)).toEqual([]);
      expect(coverageGaps([])).toEqual([]);
    });
  });
});
