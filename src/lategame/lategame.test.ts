import { describe, it, expect } from 'vitest';
import { FIELD_LEVELS, fieldLevelForXp, LATE_BUILDINGS, LATE_TECH, canResearch, PRESTIGE, prestigeLevel, specializationCost, availableBuildings, validateContent, totalLateRP, type PrestigeSnapshot } from './index.ts';

const base: PrestigeSnapshot = { fieldLevel: 10, paxPerDay: 16000, ratingPct: 92, onTimePct: 93, mishandledBagPct: 0.5, transferPaxPct: 30, rivalSharePct: 20, specializationsMastered: 2, awardsWon: 4 };

describe('lategame content', () => {
  it('validates', () => expect(validateContent()).toEqual([]));
  it('FL thresholds ascend to FL10', () => {
    expect(FIELD_LEVELS.at(-1)!.level).toBe(10);
    for (let i = 1; i < FIELD_LEVELS.length; i++) expect(FIELD_LEVELS[i].xp).toBeGreaterThan(FIELD_LEVELS[i - 1].xp);
    expect(fieldLevelForXp(1599).level).toBe(6);
    expect(fieldLevelForXp(99999).level).toBe(10);
  });
  it('has no terminal-count unlock (terminals are uncapped)', () => {
    expect(LATE_BUILDINGS.some((b) => /second terminal/i.test(b.name))).toBe(false);
  });
  it('unique ids', () => {
    expect(new Set(LATE_BUILDINGS.map((b) => b.id)).size).toBe(LATE_BUILDINGS.length);
    expect(new Set(LATE_TECH.map((t) => t.id)).size).toBe(LATE_TECH.length);
  });
  it('research gates on FL, RP and prereqs', () => {
    expect(canResearch('hub_banks', new Set(), 10, 99)).toBe(false);
    expect(canResearch('hub_banks', new Set(['hub_mct']), 7, 99)).toBe(false);
    expect(canResearch('hub_banks', new Set(['hub_mct']), 8, 17)).toBe(false);
    expect(canResearch('hub_banks', new Set(['hub_mct']), 8, 18)).toBe(true);
    expect(totalLateRP()).toBeGreaterThan(200);
  });
  it('buildings need FL and tech', () => {
    expect(availableBuildings(7, new Set()).map((b) => b.id)).not.toContain('people_mover');
    expect(availableBuildings(7, new Set(['con_apm'])).map((b) => b.id)).toContain('people_mover');
  });
  it('prestige stars in order with lower-is-better metrics', () => {
    expect(prestigeLevel(base, 20000)).toBe(5);
    expect(prestigeLevel(base, 9000)).toBe(2);
    expect(prestigeLevel({ ...base, mishandledBagPct: 2 }, 20000)).toBe(1);
    expect(prestigeLevel({ ...base, rivalSharePct: 60 }, 20000)).toBe(0);
    expect(PRESTIGE).toHaveLength(5);
  });
  it('mixed specializations cost more each', () => {
    expect(specializationCost(0)).toBe(50000);
    expect(specializationCost(2)).toBeGreaterThan(specializationCost(1));
  });
});
