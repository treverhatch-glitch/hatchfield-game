import { describe, expect, it } from 'vitest';
import { createHarness } from './testkit.ts';
import type { Harness } from './testkit.ts';
import { commitmentProgress, isSatisfied } from './demands.ts';

const POOR = { onTimePct: 80, feeIndex: 1.3, loungeSeats: 0, solarCoveragePct: 0, standUtilization: 0.95, familyAmenities: 0, prestigeItems: 0, cargoFacilities: 0 };

function withDemand(): { h: Harness; id: string } {
  const h = createHarness({ fieldLevel: 3, metrics: { ...POOR } });
  h.sign('skypenny');
  for (let i = 0; i < 120 && h.engine.state.commitments.length === 0; i++) h.run(1);
  const demand = h.engine.state.commitments[0];
  expect(demand).toBeDefined();
  return { h, id: demand.id };
}

describe('demands from interests', () => {
  it('issues a demand from the airline top interest with a numeric target and deadline', () => {
    const { h, id } = withDemand();
    const d = h.engine.state.commitments.find((c) => c.id === id)!;
    expect(d.interest).toBe('cost');
    expect(d.metric).toBe('feeIndex');
    expect(d.compare).toBe('lte');
    expect(d.target).toBe(1);
    expect(d.deadlineDay - d.issuedDay).toBe(120);
    expect(h.events.some((e) => e.type === 'demand_issued')).toBe(true);
  });

  it('applies the Hardball multiplier (x1.5) to reward and penalty', () => {
    const { h, id } = withDemand();
    const d = h.engine.state.commitments.find((c) => c.id === id)!;
    expect(d.rewardS).toBe(22.5);
    expect(d.penaltyS).toBe(15);
    expect(h.engine.relation('skypenny')!.traits).toContain('hardball');
  });

  it('is met after the hold period: +reward modifier and a Favour for a costly ask', () => {
    const { h, id } = withDemand();
    h.engine.respondToDemand(id, 'accept');
    h.ctx.metrics.feeIndex = 1;
    h.run(59);
    expect(h.engine.state.commitments.find((c) => c.id === id)).toBeDefined();
    expect(h.engine.state.commitments.find((c) => c.id === id)!.progress).toBeGreaterThan(0.9);
    h.run(2);
    expect(h.engine.state.commitments.find((c) => c.id === id)).toBeUndefined();
    const rel = h.engine.relation('skypenny')!;
    expect(rel.modifiers.some((m) => m.kind === 'demand_met' && m.value === 22.5)).toBe(true);
    expect(rel.favours).toHaveLength(1);
    expect(h.events.some((e) => e.type === 'demand_met')).toBe(true);
  });

  it('resets the hold counter when the player breaks the condition', () => {
    const { h, id } = withDemand();
    h.engine.respondToDemand(id, 'accept');
    h.ctx.metrics.feeIndex = 1;
    h.run(40);
    h.ctx.metrics.feeIndex = 1.2;
    h.run(1);
    expect(h.engine.state.commitments[0].heldDays).toBe(0);
  });

  it('times out when ignored: -penalty and a remembered line', () => {
    const { h, id } = withDemand();
    h.run(125);
    expect(h.engine.state.commitments.find((c) => c.id === id)).toBeUndefined();
    const rel = h.engine.relation('skypenny')!;
    expect(rel.modifiers.some((m) => m.kind === 'demand_timeout' && m.value === -15 && m.source === id)).toBe(true);
    expect(h.events.some((e) => e.type === 'demand_timeout')).toBe(true);
  });

  it('decline is -4 now and no timeout', () => {
    const { h, id } = withDemand();
    const res = h.engine.respondToDemand(id, 'decline');
    expect(res.ok).toBe(true);
    const rel = h.engine.relation('skypenny')!;
    expect(rel.modifiers.some((m) => m.kind === 'demand_declined' && m.value === -4)).toBe(true);
    expect(h.engine.state.commitments.find((c) => c.id === id)).toBeUndefined();
  });

  it('Leverage refuses a demand at no cost, once', () => {
    const { h, id } = withDemand();
    const rel = h.engine.relation('skypenny')!;
    expect(h.engine.respondToDemand(id, 'decline', true).ok).toBe(false);
    rel.leverage = 1;
    const res = h.engine.respondToDemand(id, 'decline', true);
    expect(res.ok).toBe(true);
    expect(rel.leverage).toBe(0);
    expect(rel.modifiers.some((m) => m.kind === 'demand_declined')).toBe(false);
  });

  it('counter with a Favour lengthens the deadline and cannot be repeated', () => {
    const { h, id } = withDemand();
    const rel = h.engine.relation('skypenny')!;
    rel.favours.push({ grantedDay: 0, reason: 'test' });
    const before = h.engine.state.commitments[0].deadlineDay;
    const res = h.engine.counterDemand(id, 'longer', 'favour');
    expect(res.ok).toBe(true);
    expect(h.engine.state.commitments[0].deadlineDay).toBeGreaterThan(before);
    expect(h.engine.counterDemand(id, 'longer', 'money').message).toContain('already');
  });

  it('counter with money is priced by tier and may fail', () => {
    const { h, id } = withDemand();
    const res = h.engine.counterDemand(id, 'lighter', 'money');
    expect(res.cost).toBe(1500);
    expect(res.chance).toBeGreaterThan(0);
    expect(res.chance).toBeLessThan(1);
  });

  it('a Favour can extend the deadline by 50% or waive one timeout', () => {
    const { h, id } = withDemand();
    const rel = h.engine.relation('skypenny')!;
    rel.favours.push({ grantedDay: 0, reason: 'a' }, { grantedDay: 0, reason: 'b' });
    const d = h.engine.state.commitments[0];
    const span = d.deadlineDay - d.issuedDay;
    const before = d.deadlineDay;
    expect(h.engine.spendFavourOnDemand(id, 'extend').ok).toBe(true);
    expect(d.deadlineDay - before).toBe(span / 2);
    expect(h.engine.spendFavourOnDemand(id, 'waive').ok).toBe(true);
    h.run(200);
    expect(rel.modifiers.some((m) => m.kind === 'demand_timeout' && m.source === id)).toBe(false);
    expect(h.engine.state.commitments.find((c) => c.id === id)).toBeUndefined();
  });

  it('shows rivals back, oppose or ignore on the card before the player decides', () => {
    const h = createHarness({ fieldLevel: 3, metrics: { ...POOR } });
    h.sign('zoomjet');
    h.sign('skypenny');
    for (let i = 0; i < 90 && h.engine.state.commitments.length === 0; i++) h.run(1);
    const d = h.engine.state.commitments[0];
    expect(d).toBeDefined();
    const stances = Object.entries(d.rivalStances);
    for (const [rivalId, stance] of stances) {
      expect(h.engine.relation(rivalId)?.status).toBe('signed');
      expect(['back', 'oppose', 'ignore']).toContain(stance);
    }
  });

  it('reports progress as a number from 0 to 1', () => {
    const { h, id } = withDemand();
    const d = h.engine.state.commitments.find((c) => c.id === id)!;
    expect(commitmentProgress(d, 1.3)).toBe(0);
    expect(isSatisfied(d, 1)).toBe(true);
    expect(commitmentProgress({ ...d, holdDays: 0, compare: 'gte', target: 10, baseline: 0 }, 5)).toBe(0.5);
  });
});

describe('demand caps', () => {
  it('never exceeds 3 open demands, 1 per airline (2 for Major), or one new demand per 60 days', () => {
    const h = createHarness({ fieldLevel: 5, metrics: { ...POOR, cafes: 0 } });
    for (const id of ['northline', 'puddle_air', 'skypenny', 'zoomjet', 'meridian', 'atlas_blue', 'verdant_air']) h.sign(id);
    const issued: number[] = [];
    let max = 0;
    h.run(400, () => {
      const open = h.engine.state.commitments.filter((c) => c.kind === 'demand');
      max = Math.max(max, open.length);
      for (const rel of h.engine.signedAirlineIds()) {
        const own = open.filter((c) => c.airlineId === rel).length;
        const cap = h.engine.relation(rel)!.shareClass === 'major' ? 2 : 1;
        expect(own).toBeLessThanOrEqual(cap);
      }
    });
    for (const e of h.events) if (e.type === 'demand_issued') issued.push(e.day);
    expect(issued.length).toBeGreaterThan(3);
    expect(max).toBeLessThanOrEqual(3);
    for (let i = 1; i < issued.length; i++) expect(issued[i] - issued[i - 1]).toBeGreaterThanOrEqual(60);
  });

  it('never has two open demands with mutually exclusive asks (exclusive pier, peak slots)', () => {
    const h = createHarness({ fieldLevel: 9, metrics: { ...POOR, prestigeItems: 0, exclusivePier: 0, heavyStands: 0 } });
    for (const id of ['meridian', 'verdant_air', 'skyglass', 'orient_crown', 'royal_aurum', 'global_one']) h.sign(id);
    h.run(700, () => {
      const tags = h.engine.state.commitments.map((c) => c.conflictTag).filter((t): t is string => !!t);
      expect(new Set(tags).size).toBe(tags.length);
    });
  });

  it('gives Minor airlines (under 5% share) no demands', () => {
    const h = createHarness({ fieldLevel: 3, metrics: { ...POOR } });
    h.sign('skypenny');
    h.ctx.shares = { skypenny: 3 };
    h.run(200);
    expect(h.events.filter((e) => e.type === 'demand_issued')).toHaveLength(0);
  });
});
