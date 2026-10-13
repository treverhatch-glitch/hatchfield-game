import { describe, expect, it } from 'vitest';
import { createHarness, push } from './testkit.ts';
import type { Harness } from './testkit.ts';

function twoHostile(): Harness {
  const h = createHarness({ fieldLevel: 3, seed: 5 });
  for (const id of ['skypenny', 'zoomjet', 'budgie_air']) h.sign(id);
  for (const id of ['skypenny', 'zoomjet', 'budgie_air']) push(h, id, -100, 80);
  return h;
}

describe('hostile airlines', () => {
  it('sue or disrupt operations through host hooks', () => {
    const h = twoHostile();
    h.run(85);
    expect(h.hostile.length).toBeGreaterThan(0);
    const kinds = new Set(h.hostile.map((a) => a.kind));
    expect([...kinds].every((k) => ['lawsuit', 'late_slot_change', 'refused_gate', 'slowed_turnarounds'].includes(k))).toBe(true);
    for (const a of h.hostile) {
      expect(h.engine.relation(a.airlineId)).toBeDefined();
      expect(a.text.length).toBeGreaterThan(5);
    }
    expect(h.events.some((e) => e.type === 'hostile_action')).toBe(true);
  });

  it('charges legal fees through the host for a lawsuit and can settle out of court', () => {
    const h = twoHostile();
    let suit = h.engine.state.lawsuits[0];
    for (let i = 0; i < 90 && !suit; i++) {
      h.run(1);
      suit = h.engine.state.lawsuits[0];
    }
    expect(suit).toBeDefined();
    expect(h.ledger.some((l) => l.category === 'legal' && l.amount === suit.legalFee)).toBe(true);
    const res = h.engine.settleLawsuit(suit.id);
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(Math.round(suit.legalFee * 1.5));
    expect(suit.settled).toBe(true);
    expect(h.engine.settleLawsuit(suit.id).ok).toBe(false);
  });

  it('closes unsettled lawsuits with a verdict after 45 days', () => {
    const h = twoHostile();
    let suit = h.engine.state.lawsuits[0];
    for (let i = 0; i < 90 && !suit; i++) {
      h.run(1);
      suit = h.engine.state.lawsuits[0];
    }
    h.run(46);
    expect(suit.closed).toBe(true);
    expect(h.events.some((e) => e.type === 'lawsuit_verdict')).toBe(true);
  });

  it('exposes active disruptions the sim can apply (slowdown, refused gates, late slot changes)', () => {
    const h = twoHostile();
    let seen = false;
    h.run(120, () => {
      const fx = h.engine.operationalEffects();
      if (fx.active.length > 0) {
        seen = true;
        expect(fx.turnaroundSlowFactor).toBeGreaterThanOrEqual(1);
        expect(fx.refusedGates).toBeGreaterThanOrEqual(0);
        expect(fx.extraDelayMinutes).toBeGreaterThanOrEqual(0);
        for (const a of fx.active) expect(fx.perAirline[a.airlineId]).toBeDefined();
      }
    });
    expect(seen).toBe(true);
  });

  it('do nothing while merely Cold', () => {
    const h = createHarness({ fieldLevel: 3, seed: 5 });
    h.sign('zoomjet');
    push(h, 'zoomjet', -40, 60);
    expect(h.engine.relation('zoomjet')!.band).toBe('cold');
    h.run(100);
    expect(h.hostile).toHaveLength(0);
  });
});

function spatHarness(): Harness {
  const h = createHarness({ fieldLevel: 3, seed: 9 });
  h.sign('skypenny');
  h.sign('zoomjet');
  h.engine.notifyFeeChange(1.1);
  push(h, 'zoomjet', 30, 12);
  h.run(2);
  return h;
}

describe('public spats', () => {
  it('start when a Major airline goes Cold after a fee rise, with rivals offering to take its slots', () => {
    const h = spatHarness();
    const spat = h.engine.state.spats[0];
    expect(spat).toBeDefined();
    expect(spat.airlineId).toBe('skypenny');
    expect(spat.rivalOffers).toEqual(['zoomjet']);
    expect(h.events.some((e) => e.type === 'rival_offer' && e.airlineId === 'zoomjet')).toBe(true);
    expect(h.engine.relation('skypenny')!.shareClass).toBe('major');
  });

  it('drain Reputation by about 2 a month until resolved', () => {
    const h = spatHarness();
    h.engine.consumeReputationDelta();
    h.run(30);
    const delta = h.engine.consumeReputationDelta();
    expect(delta).toBeLessThan(-1.8);
    expect(delta).toBeGreaterThan(-2.2);
    expect(h.engine.consumeReputationDelta()).toBe(0);
  });

  it('do not happen for airlines under 20% share', () => {
    const h = createHarness({ fieldLevel: 3, seed: 9 });
    h.sign('skypenny');
    h.ctx.shares = { skypenny: 10 };
    h.engine.notifyFeeChange(1.1);
    h.run(10);
    expect(h.engine.state.spats).toHaveLength(0);
  });

  it('concede: fees fall 5%, the airline warms, the spat ends', () => {
    const h = spatHarness();
    const spat = h.engine.state.spats[0];
    const res = h.engine.respondToSpat(spat.id, 'concede');
    expect(res.ok).toBe(true);
    expect(res.data?.newFeeIndex).toBeCloseTo(1.045);
    expect(h.engine.state.feeIndex).toBeCloseTo(1.045);
    expect(spat.resolved).toBe(true);
    expect(spat.resolution).toBe('concede');
    expect(h.engine.relation('skypenny')!.modifiers.some((m) => m.kind === 'concession' && m.value === 12)).toBe(true);
    h.engine.consumeReputationDelta();
    h.run(30);
    expect(h.engine.consumeReputationDelta()).toBe(0);
  });

  it('hold firm with Leverage always works and spends the Leverage', () => {
    const h = spatHarness();
    const rel = h.engine.relation('skypenny')!;
    rel.leverage = 1;
    const res = h.engine.respondToSpat(h.engine.state.spats[0].id, 'hold');
    expect(res.ok).toBe(true);
    expect(res.chance).toBe(1);
    expect(rel.leverage).toBe(0);
  });

  it('hold firm without Leverage is a gamble: success ends it, failure escalates', () => {
    const h = spatHarness();
    const spat = h.engine.state.spats[0];
    const res = h.engine.respondToSpat(spat.id, 'hold');
    expect(res.chance).toBeGreaterThanOrEqual(0.1);
    expect(res.chance).toBeLessThanOrEqual(0.6);
    if (res.ok) expect(spat.resolution).toBe('hold');
    else {
      expect(spat.holdFailed).toBe(true);
      expect(spat.resolved).toBe(false);
      expect(h.engine.relation('skypenny')!.modifiers.some((m) => m.kind === 'spat_loss')).toBe(true);
    }
  });

  it('court a rival: it gets more flights, the original airline cuts capacity', () => {
    const h = spatHarness();
    const spat = h.engine.state.spats[0];
    const zoom = h.engine.relation('zoomjet')!;
    const slots = zoom.contract!.terms.slotsPerWeek;
    expect(h.engine.respondToSpat(spat.id, 'court').ok).toBe(false);
    const res = h.engine.respondToSpat(spat.id, 'court', 'zoomjet');
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(1500);
    expect(zoom.contract!.terms.slotsPerWeek).toBe(Math.round(slots * 1.2));
    expect(zoom.modifiers.some((m) => m.kind === 'court_rival' && m.value === 10)).toBe(true);
    expect(h.engine.relation('skypenny')!.stage).toBe('capacity_cut');
    expect(h.engine.relation('skypenny')!.capacityFactor).toBeCloseTo(0.7);
    expect(spat.resolution).toBe('court');
  });

  it('end by themselves when the airline recovers or after 120 days', () => {
    const h = spatHarness();
    const spat = h.engine.state.spats[0];
    push(h, 'skypenny', 60, 12);
    h.run(2);
    expect(spat.resolved).toBe(true);
    expect(spat.resolution).toBe('recovered');

    const h2 = spatHarness();
    const s2 = h2.engine.state.spats[0];
    h2.run(125);
    expect(s2.resolved).toBe(true);
  });
});

describe('rival airport', () => {
  it('poaches an unhappy airline at season end and gains appeal', () => {
    const h = createHarness({ fieldLevel: 3, seed: 21 });
    h.sign('skypenny');
    push(h, 'skypenny', -50, 60);
    const rival = h.engine.state.rivalAirport;
    rival.appeal = 100;
    expect(h.engine.poachRisk('skypenny')).toBeGreaterThan(0.3);
    const rel = h.engine.relation('skypenny')!;
    let guard = 0;
    while (rel.status === 'signed' && guard++ < 900) h.run(1);
    expect(rel.status).toBe('former');
    expect(rel.exitReason).toBe('poached');
    expect(h.engine.day % 90).toBe(0);
    expect(rival.poached).toContain('skypenny');
    expect(rival.lastPoachDay).toBe(h.engine.day);
    expect(rival.appeal).toBeGreaterThan(90);
    expect(h.events.some((e) => e.type === 'poached' && e.text.includes(rival.name))).toBe(true);
    expect(h.engine.state.exitLog).toHaveLength(1);
  });

  it('never poaches a happy airline', () => {
    const h = createHarness({ fieldLevel: 3, seed: 21 });
    h.sign('skypenny');
    h.engine.state.rivalAirport.appeal = 100;
    push(h, 'skypenny', 40, 60);
    expect(h.engine.poachRisk('skypenny')).toBe(0);
    h.run(300);
    expect(h.engine.relation('skypenny')!.status).toBe('signed');
  });

  it('a counter-offer shields the airline until the next season has passed', () => {
    const h = createHarness({ fieldLevel: 3, seed: 21 });
    h.sign('skypenny');
    push(h, 'skypenny', -50, 60);
    h.engine.state.rivalAirport.appeal = 100;
    expect(h.engine.poachRisk('skypenny')).toBeGreaterThan(0);
    const res = h.engine.defendAgainstPoach('skypenny');
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(3600);
    expect(h.engine.poachRisk('skypenny')).toBe(0);
    const rel = h.engine.relation('skypenny')!;
    const until = rel.poachShieldUntilDay;
    h.run(Math.floor(until - h.engine.day) - 1);
    expect(rel.status).toBe('signed');
  });
});
