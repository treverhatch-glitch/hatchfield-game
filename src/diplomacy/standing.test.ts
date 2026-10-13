import { describe, expect, it } from 'vitest';
import { createDiplomacyState } from './engine.ts';
import { createRelation } from './generator.ts';
import { ROSTER } from './data.ts';
import {
  bandWithHysteresis,
  computeBreakdown,
  gradeTurnaround,
  modifierCurrent,
  modifierLines,
  pruneModifiers,
  rawBand,
  recordGrade,
  stepPerformance
} from './standing.ts';
import type { AirlineRelation, ModifierKind, StandingModifier } from './types.ts';

function relation(id = 'northline'): AirlineRelation {
  const state = createDiplomacyState({ seed: 1 });
  const seed = ROSTER.find((s) => s.id === id)!;
  return createRelation(state, seed);
}

function mod(value: number, kind: ModifierKind = 'other', startDay = 0, durationDays = 360): StandingModifier {
  return { id: `m${Math.random()}`, kind, label: `${kind} ${value}`, source: 't', value, startDay, durationDays };
}

describe('bands', () => {
  it('uses the Civ VII cut points on a -100..+100 scale', () => {
    expect(rawBand(-100)).toBe('hostile');
    expect(rawBand(-60.1)).toBe('hostile');
    expect(rawBand(-60)).toBe('cold');
    expect(rawBand(-20.1)).toBe('cold');
    expect(rawBand(-20)).toBe('neutral');
    expect(rawBand(20)).toBe('neutral');
    expect(rawBand(20.1)).toBe('warm');
    expect(rawBand(60)).toBe('warm');
    expect(rawBand(60.1)).toBe('partner');
    expect(rawBand(100)).toBe('partner');
  });

  it('gains a band at the edge but loses it only 5 points past the edge', () => {
    expect(bandWithHysteresis(21, 'neutral')).toBe('warm');
    expect(bandWithHysteresis(17, 'warm')).toBe('warm');
    expect(bandWithHysteresis(15, 'warm')).toBe('warm');
    expect(bandWithHysteresis(14.9, 'warm')).toBe('neutral');
    expect(bandWithHysteresis(56, 'partner')).toBe('partner');
    expect(bandWithHysteresis(54, 'partner')).toBe('warm');
    expect(bandWithHysteresis(-24, 'neutral')).toBe('neutral');
    expect(bandWithHysteresis(-26, 'neutral')).toBe('cold');
    expect(bandWithHysteresis(-64, 'cold')).toBe('cold');
    expect(bandWithHysteresis(-66, 'cold')).toBe('hostile');
  });

  it('can drop several bands at once when the value is far enough', () => {
    expect(bandWithHysteresis(-90, 'partner')).toBe('hostile');
    expect(bandWithHysteresis(-30, 'partner')).toBe('cold');
  });
});

describe('modifiers', () => {
  it('decay linearly to zero over their duration', () => {
    const m = mod(10, 'other', 0, 360);
    expect(modifierCurrent(m, 0)).toBeCloseTo(10);
    expect(modifierCurrent(m, 180)).toBeCloseTo(5);
    expect(modifierCurrent(m, 360)).toBeCloseTo(0);
    expect(modifierCurrent(m, 500)).toBe(0);
  });

  it('are pruned once expired', () => {
    const mods = [mod(5, 'other', 0, 30), mod(5, 'other', 0, 360)];
    expect(pruneModifiers(mods, 31)).toHaveLength(1);
  });

  it('stack with diminishing returns: 2nd x0.5, 3rd x0.25', () => {
    const lines = modifierLines([mod(15, 'demand_met'), mod(15, 'demand_met'), mod(15, 'demand_met')], 0);
    const total = lines.reduce((s, l) => s + l.value, 0);
    expect(total).toBeCloseTo(15 + 7.5 + 3.75);
  });

  it('keeps positive and negative stacks of the same kind apart', () => {
    const lines = modifierLines([mod(15, 'incident'), mod(-20, 'incident')], 0);
    expect(lines.map((l) => Math.round(l.value)).sort((a, b) => a - b)).toEqual([-20, 15]);
  });
});

describe('performance', () => {
  it('moves toward the grade score with a 30-day half-life', () => {
    const rel = relation();
    for (let d = 0; d < 30; d++) {
      recordGrade(rel, 'A', false);
      stepPerformance(rel, 1);
    }
    expect(rel.performance).toBeCloseTo(20, 0);
    for (let d = 0; d < 90; d++) {
      recordGrade(rel, 'A', false);
      stepPerformance(rel, 1);
    }
    expect(rel.performance).toBeGreaterThan(37);
    expect(rel.performance).toBeLessThanOrEqual(40);
  });

  it('maps A..F to +40..-40', () => {
    const rel = relation();
    recordGrade(rel, 'A', false);
    recordGrade(rel, 'F', false);
    expect(rel.pendingGradeSum).toBe(0);
    recordGrade(rel, 'B', false);
    expect(rel.pendingGradeSum).toBe(20);
  });

  it('counts excused delays as C regardless of the grade', () => {
    const rel = relation();
    expect(recordGrade(rel, 'F', true, 'storm')).toBe('C');
    expect(rel.pendingGradeSum).toBe(0);
    expect(rel.causeTally.storm).toBeUndefined();
  });

  it('remembers what hurt, so the breakdown can point at it', () => {
    const rel = relation();
    recordGrade(rel, 'F', false, 'security_queue');
    stepPerformance(rel, 1);
    expect(rel.causeTally.security_queue).toBeGreaterThan(0);
    const b = computeBreakdown({ relation: rel, day: 1, metrics: {}, agendaBias: 0, agendaLabel: null });
    const perf = b.lines.find((l) => l.kind === 'performance');
    expect(perf?.showMe).toBe('security_queue');
    expect(perf?.label).toContain('security queue');
  });

  it('grades a turnaround with a 60-minute grace window and stand fit', () => {
    expect(gradeTurnaround({ delayMinutes: 0, bagMinutes: 15, paxMood: 1, standFit: true })).toBe('A');
    expect(gradeTurnaround({ delayMinutes: 20, bagMinutes: 25, paxMood: 0.8, standFit: true })).toBe('B');
    expect(gradeTurnaround({ delayMinutes: 45, bagMinutes: 40, paxMood: 0.6, standFit: true })).toBe('C');
    expect(gradeTurnaround({ delayMinutes: 120, bagMinutes: 70, paxMood: 0.2, standFit: false })).toBe('F');
  });
});

describe('breakdown', () => {
  it('prints the formula literally: Performance + Modifiers + Traits = value band', () => {
    const rel = relation();
    rel.traits = ['patient'];
    rel.performance = 18;
    rel.modifiers = [mod(-7, 'incident', 0, 360)];
    const b = computeBreakdown({ relation: rel, day: 0, metrics: {}, agendaBias: 2, agendaLabel: 'Test agenda' });
    expect(b.performance).toBe(18);
    expect(Math.round(b.modifiers)).toBe(-7);
    expect(Math.round(b.traits)).toBe(4);
    expect(b.formula).toBe('Performance +18 \u00b7 Modifiers \u22127 \u00b7 Traits +4 = +15 Neutral');
  });

  it('shows at most 6 lines and counts the rest', () => {
    const rel = relation();
    rel.performance = 10;
    rel.modifiers = ['demand_met', 'demand_timeout', 'incident', 'first_meet', 'apology', 'mediation', 'vouch', 'incentive'].map(
      (k, i) => mod(i + 1, k as ModifierKind)
    );
    const b = computeBreakdown({ relation: rel, day: 0, metrics: {}, agendaBias: 0, agendaLabel: null });
    expect(b.visibleLines).toHaveLength(6);
    expect(b.hiddenLineCount).toBe(b.lines.length - 6);
    expect(b.hiddenLineCount).toBeGreaterThan(0);
  });

  it('clamps the final standing to -100..+100', () => {
    const rel = relation('skypenny');
    rel.performance = -40;
    rel.modifiers = [mod(-90, 'other', 1000), mod(-90, 'incident', 1000)];
    const low = computeBreakdown({ relation: rel, day: 1000, metrics: {}, agendaBias: 0, agendaLabel: null });
    expect(low.value).toBe(-100);
    rel.performance = 40;
    rel.modifiers = [mod(90, 'other', 1000), mod(90, 'demand_met', 1000)];
    const high = computeBreakdown({ relation: rel, day: 1000, metrics: {}, agendaBias: 0, agendaLabel: null });
    expect(high.value).toBe(100);
  });

  it('protects tier 1 airlines from falling below Cold during the first two years', () => {
    const rel = relation('northline');
    rel.performance = -40;
    rel.modifiers = [mod(-80, 'incident', 0, 2000)];
    const early = computeBreakdown({ relation: rel, day: 100, metrics: {}, agendaBias: 0, agendaLabel: null });
    expect(early.value).toBe(-60);
    expect(early.band).toBe('cold');
    const late = computeBreakdown({ relation: rel, day: 800, metrics: {}, agendaBias: 0, agendaLabel: null });
    expect(late.value).toBeLessThan(-60);
  });

  it('applies trait leaning from the airport (Green likes solar, Punctual likes on-time)', () => {
    const rel = relation();
    rel.traits = ['green', 'punctual'];
    const good = computeBreakdown({ relation: rel, day: 0, metrics: { solarCoveragePct: 60, onTimePct: 95 }, agendaBias: 0, agendaLabel: null });
    const bad = computeBreakdown({ relation: rel, day: 0, metrics: { solarCoveragePct: 0, onTimePct: 70 }, agendaBias: 0, agendaLabel: null });
    expect(good.traits).toBeGreaterThan(bad.traits);
    expect(good.traits).toBeLessThanOrEqual(10);
    expect(bad.traits).toBeGreaterThanOrEqual(-10);
  });
});
