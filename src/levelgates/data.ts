import type { GateStats } from './gates';

export type GateLevel = 7 | 8 | 9 | 10;

export interface GateRequirement {
  key: keyof GateStats;
  need: number;
  comparison: 'gte' | 'lt';
}

export const LEVEL_GATES: Record<GateLevel, GateRequirement[]> = {
  7: [
    { key: 'profitStreakDays', need: 5, comparison: 'gte' },
    { key: 'morale', need: 0.7, comparison: 'gte' },
    { key: 'connectingBanks', need: 1, comparison: 'gte' },
  ],
  8: [
    { key: 'a380ContractDays', need: 7, comparison: 'gte' },
    { key: 'rating', need: 0.75, comparison: 'gte' },
    { key: 'transferShare', need: 0.1, comparison: 'gte' },
  ],
  9: [
    { key: 'paxPerDay', need: 5000, comparison: 'gte' },
    { key: 'mishandledRate', need: 0.01, comparison: 'lt' },
    { key: 'majorDisruptionsSurvived', need: 1, comparison: 'gte' },
  ],
  10: [
    { key: 'specializationBadges', need: 1, comparison: 'gte' },
    { key: 'marketsBeatingRival', need: 1, comparison: 'gte' },
  ],
};
