import type { FieldLevelGoal } from './types.ts';
// FL1-5 thresholds match trunk; FL6-10 per Building Progression doc.
export const FIELD_LEVELS: FieldLevelGoal[] = [
  { level: 1, xp: 0, goals: ['Start'], grantCash: 0, grantRP: 0 },
  { level: 2, xp: 90, goals: ['10 turnarounds', '1 carrier'], grantCash: 15000, grantRP: 2 },
  { level: 3, xp: 220, goals: ['200 pax/day', 'rating 60%', '2 carriers'], grantCash: 25000, grantRP: 3 },
  { level: 4, xp: 420, goals: ['first jet bridge', '600 pax/day'], grantCash: 40000, grantRP: 4 },
  { level: 5, xp: 700, goals: ['first widebody turn', '1,200 pax/day', 'on-time 80%'], grantCash: 60000, grantRP: 5 },
  { level: 6, xp: 1100, goals: ['2,500 pax/day', '20 movements/hr'], grantCash: 80000, grantRP: 6 },
  { level: 7, xp: 1600, goals: ['profit 5 days running', 'staff morale 70%', 'first connecting bank'], grantCash: 100000, grantRP: 7 },
  { level: 8, xp: 2300, goals: ['A380 contract 7 days', 'rating 75%', 'transfer pax 10%'], grantCash: 140000, grantRP: 8 },
  { level: 9, xp: 3200, goals: ['5,000 pax/day', 'mishandled bags <1%', 'survive a major disruption'], grantCash: 180000, grantRP: 10 },
  { level: 10, xp: 4500, goals: ['specialization badge met', 'beat rival in one market'], grantCash: 250000, grantRP: 12 },
];

export function fieldLevelForXp(xp: number): FieldLevelGoal {
  let cur = FIELD_LEVELS[0];
  for (const fl of FIELD_LEVELS) if (xp >= fl.xp) cur = fl;
  return cur;
}
