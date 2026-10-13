import type { PrestigeSnapshot, PrestigeStar, LateBuilding } from './types.ts';
import { LATE_BUILDINGS } from './buildings.ts';
import { LATE_TECH } from './tech.ts';

export const PRESTIGE: PrestigeStar[] = [
  { star: 1, xp: 6500, challenge: 'Regional champion', req: { fieldLevel: 10, ratingPct: 80, rivalSharePct: 45 }, reward: 'Spotters deck skin, award banner' },
  { star: 2, xp: 8500, challenge: 'True hub', req: { fieldLevel: 10, transferPaxPct: 25, mishandledBagPct: 0.8 }, reward: 'Alliance livery set' },
  { star: 3, xp: 10500, challenge: 'Punctuality award', req: { fieldLevel: 10, onTimePct: 90, paxPerDay: 8000 }, reward: 'Landmark facade variants' },
  { star: 4, xp: 12500, challenge: 'Multi-specialist', req: { fieldLevel: 10, specializationsMastered: 2, awardsWon: 2 }, reward: 'Scenario: Mega-hub challenge' },
  { star: 5, xp: 14500, challenge: 'World-class airport', req: { fieldLevel: 10, paxPerDay: 15000, ratingPct: 90, rivalSharePct: 25, awardsWon: 4 }, reward: 'Gold tower, credits, New Game+' },
];

const LOWER_IS_BETTER: (keyof PrestigeSnapshot)[] = ['mishandledBagPct', 'rivalSharePct'];

export function meetsStar(star: PrestigeStar, s: PrestigeSnapshot, xp: number): boolean {
  if (xp < star.xp) return false;
  return (Object.keys(star.req) as (keyof PrestigeSnapshot)[]).every((k) => {
    const need = star.req[k] as number;
    return LOWER_IS_BETTER.includes(k) ? s[k] <= need : s[k] >= need;
  });
}

/** Stars are earned in order; returns highest consecutive star met (0 = none). */
export function prestigeLevel(s: PrestigeSnapshot, xp: number): number {
  let lvl = 0;
  for (const st of PRESTIGE) {
    if (!meetsStar(st, s, xp)) break;
    lvl = st.star;
  }
  return lvl;
}

/** Specializations can mix; each extra path costs more (owner decision). */
export function specializationCost(alreadyHeld: number): number {
  return Math.round(50000 * Math.pow(1.6, Math.max(0, alreadyHeld)));
}

export function availableBuildings(fl: number, tech: ReadonlySet<string>): LateBuilding[] {
  return LATE_BUILDINGS.filter((b) => fl >= b.unlockFL && (!b.requiresTech || tech.has(b.requiresTech)));
}

/** Data integrity check used by tests and at boot. */
export function validateContent(): string[] {
  const errs: string[] = [];
  const techIds = new Set(LATE_TECH.map((t) => t.id));
  for (const b of LATE_BUILDINGS) {
    if (b.requiresTech && !techIds.has(b.requiresTech)) errs.push(`${b.id}: unknown tech ${b.requiresTech}`);
    if (!(b.upkeepPerDay > 0)) errs.push(`${b.id}: needs daily upkeep`);
    if (!b.downside) errs.push(`${b.id}: needs a downside`);
    if (/second terminal|terminal 2/i.test(b.name)) errs.push(`${b.id}: terminals are uncapped, not an unlock`);
  }
  for (const t of LATE_TECH) for (const r of t.requires) {
    const p = LATE_TECH.find((x) => x.id === r);
    if (!p) errs.push(`${t.id}: missing prereq ${r}`);
    else if (p.unlockFL > t.unlockFL) errs.push(`${t.id}: prereq ${r} unlocks later`);
  }
  return errs;
}
