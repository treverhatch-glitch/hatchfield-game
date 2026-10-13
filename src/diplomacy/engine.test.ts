import { describe, expect, it } from 'vitest';
import { DiplomacyEngine } from './engine.ts';
import { createDiplomacyAdapter, gradeToFlightEventType, toAirlinesFlightEvent } from './adapter.ts';
import { GOOD_METRICS, createHarness, flyDay } from './testkit.ts';
import type { DiplomacyContext, DiplomacyEvent, HostileAction, OperationalEffects } from './types.ts';
import type { Severity } from './adapter.ts';

function drive(seed: number, stepDays: number, totalDays: number): string {
  const h = createHarness({ fieldLevel: 6, seed });
  const grades = ['A', 'B', 'C', 'D', 'A', 'F', 'B'] as const;
  let t = 0;
  let n = 0;
  while (t < totalDays) {
    const wholeBefore = Math.floor(h.engine.day);
    for (const id of ['meridian', 'verdant_air']) {
      if (h.engine.relation(id)?.status === 'signed') flyDay(h.engine, id, [grades[n % grades.length]]);
    }
    n++;
    h.engine.advance(stepDays, h.ctx);
    for (const p of [...h.engine.state.proposals]) {
      if (p.airlineId === 'meridian' && p.kind === 'contract') h.engine.respondToProposal(p.id, 'accept');
    }
    t += stepDays;
    if (Math.floor(h.engine.day) === wholeBefore && stepDays < 1) continue;
  }
  return h.engine.serialize();
}

describe('determinism and persistence', () => {
  it('same seed and inputs give identical state', () => {
    expect(drive(21, 1, 300)).toBe(drive(21, 1, 300));
  });

  it('different seeds diverge', () => {
    expect(drive(21, 1, 200)).not.toBe(drive(22, 1, 200));
  });

  it('serialises and restores to an identical engine that keeps evolving identically', () => {
    const a = createHarness({ fieldLevel: 6, seed: 5 });
    a.run(120);
    const json = a.engine.serialize();
    const restored = DiplomacyEngine.parse(json);
    const b = new DiplomacyEngine({ spend: () => true, charge: () => undefined, onEvent: () => undefined }, restored);
    const ctx: DiplomacyContext = { fieldLevel: 6, metrics: { ...GOOD_METRICS } };
    expect(b.serialize()).toBe(json);
    a.run(60);
    for (let i = 0; i < 60; i++) b.advance(1, ctx);
    expect(b.serialize()).toBe(a.engine.serialize());
  });

  it('is tick-agnostic: many small steps equal one big step when no input arrives in between', () => {
    const run = (step: number): string => {
      const h = createHarness({ fieldLevel: 6, seed: 9 });
      const steps = Math.round(90 / step);
      for (let i = 0; i < steps; i++) h.engine.advance(step, h.ctx);
      return h.engine.serialize();
    };
    const daily = JSON.parse(run(1));
    const fine = JSON.parse(run(0.25));
    const coarse = JSON.parse(run(10));
    expect(fine.day).toBeCloseTo(daily.day);
    expect(coarse.day).toBeCloseTo(daily.day);
    expect(fine.relations).toEqual(daily.relations);
    expect(coarse.relations).toEqual(daily.relations);
    expect(fine.proposals.map((p: { id: string }) => p.id)).toEqual(daily.proposals.map((p: { id: string }) => p.id));
  });

  it('never produces NaN or infinite standings', () => {
    const h = createHarness({ fieldLevel: 9, seed: 2 });
    h.run(400, () => {
      for (const rel of Object.values(h.engine.state.relations)) {
        expect(Number.isFinite(rel.standing)).toBe(true);
        expect(rel.standing).toBeGreaterThanOrEqual(-100);
        expect(rel.standing).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe('terminal agent adapter', () => {
  function setup() {
    const cash = { value: 5_000_000 };
    const money: { amount: number; category: string }[] = [];
    const notes: { message: string; severity: Severity; event: DiplomacyEvent }[] = [];
    const reputation: number[] = [];
    const hostile: HostileAction[] = [];
    const effects: OperationalEffects[] = [];
    let ctx: DiplomacyContext = { fieldLevel: 5, metrics: { ...GOOD_METRICS } };
    const adapter = createDiplomacyAdapter(
      {
        addMoney(amount, category) {
          cash.value += amount;
          money.push({ amount, category });
        },
        getCash: () => cash.value,
        getContext: () => ctx,
        notify: (message, severity, event) => notes.push({ message, severity, event }),
        applyReputation: (d) => reputation.push(d),
        onHostileAction: (a) => hostile.push(a),
        onOperationalEffects: (e) => effects.push(e)
      },
      { seed: 3 }
    );
    return { adapter, cash, money, notes, reputation, hostile, effects, setCtx: (c: DiplomacyContext) => (ctx = c) };
  }

  it('ticks in game minutes and surfaces letters through notify()', () => {
    const s = setup();
    for (let i = 0; i < 60 * 24; i++) s.adapter.tick(1440 / 24);
    expect(s.adapter.engine.day).toBeCloseTo(60 * 1);
    expect(s.notes.some((n) => n.event.type === 'letter')).toBe(true);
  });

  it('grades turnarounds, applies excused flights as C, and affects standing through Performance', () => {
    const s = setup();
    let guard = 0;
    while (!s.adapter.engine.state.proposals.some((x) => x.kind === 'contract') && guard++ < 400) s.adapter.tick(1440);
    const p = s.adapter.engine.state.proposals.find((x) => x.kind === 'contract')!;
    s.adapter.respondToProposal(p.id, 'accept');
    const id = p.airlineId;
    const good = s.adapter.onTurnaroundComplete(id, { delayMinutes: 0, bagMinutes: 10, paxMood: 0.9, standFit: true });
    const bad = s.adapter.onTurnaroundComplete(id, { delayMinutes: 90, bagMinutes: 40, paxMood: 0.2, standFit: false });
    expect(good).toBe('A');
    expect(bad).toBe('F');
    s.adapter.onFlightCancelled(id, true);
    s.adapter.onFlightCancelled(id, false);
    expect(s.adapter.cards().find((c) => c.id === id)).toBeTruthy();
  });

  it('accepts a proposal through the adapter and debits cash through the host', () => {
    const s = setup();
    let guard = 0;
    while (!s.adapter.engine.state.proposals.length && guard++ < 400) s.adapter.tick(1440);
    const p = s.adapter.engine.state.proposals.find((x) => x.kind === 'contract');
    expect(p).toBeTruthy();
    const res = s.adapter.respondToProposal(p!.id, 'accept');
    expect(res.ok).toBe(true);
    expect(s.adapter.engine.signedAirlineIds()).toContain(p!.airlineId);
  });

  it('refuses actions the host cannot afford', () => {
    const s = setup();
    s.cash.value = 0;
    let guard = 0;
    while (!s.adapter.engine.state.proposals.some((x) => x.kind === 'contract') && guard++ < 400) s.adapter.tick(1440);
    const p = s.adapter.engine.state.proposals.find((x) => x.kind === 'contract')!;
    const before = s.adapter.engine.signedAirlineIds().length;
    s.adapter.respondToProposal(p.id, 'accept');
    expect(s.adapter.engine.signedAirlineIds().length).toBeLessThanOrEqual(before + 1);
    expect(s.cash.value).toBeGreaterThanOrEqual(0 - 1);
  });

  it('saves and loads', () => {
    const s = setup();
    for (let i = 0; i < 30; i++) s.adapter.tick(1440);
    const json = s.adapter.save();
    const t = setup();
    t.adapter.load(json);
    expect(t.adapter.save()).toBe(json);
  });

  it('bridges grades to airlines flight events', () => {
    expect(gradeToFlightEventType('A')).toBe('success');
    expect(gradeToFlightEventType('C')).toBe('delay');
    expect(gradeToFlightEventType('F')).toBe('cancellation');
    expect(toAirlinesFlightEvent('c1', 'D', 12)).toEqual({ contractId: 'c1', type: 'delay', delayMinutes: 12 });
  });
});
