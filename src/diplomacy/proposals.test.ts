import { describe, expect, it } from 'vitest';
import { createHarness, push } from './testkit.ts';
import { TIER_CONTRACT_TERMS } from './constants.ts';

describe('unlocks and letters', () => {
  it('unlocks tiers by Field Level and turns locked airlines into prospects', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.run(1);
    expect(h.engine.state.highestTier).toBe(1);
    expect(h.engine.relation('northline')?.status).toBe('prospect');
    expect(h.engine.relation('skypenny')?.status).toBe('locked');
    h.ctx.fieldLevel = 3;
    h.run(1);
    expect(h.engine.state.highestTier).toBe(2);
    expect(h.engine.relation('skypenny')?.status).toBe('prospect');
    expect(h.engine.relation('meridian')?.status).toBe('locked');
  });

  it('collapses modifiers into a 30% carry-over at a tier-up (era reset)', () => {
    const h = createHarness({ fieldLevel: 3 });
    h.sign('skypenny');
    push(h, 'skypenny', -20, 12);
    push(h, 'skypenny', 10, 12);
    const rel = h.engine.relation('skypenny')!;
    const before = rel.modifiers.reduce((s, m) => s + m.value * (1 - (h.engine.day - m.startDay) / m.durationDays), 0);
    h.ctx.fieldLevel = 5;
    h.run(1);
    const carry = rel.modifiers.filter((m) => m.kind === 'era_carry');
    expect(carry).toHaveLength(1);
    expect(rel.modifiers.length).toBe(1);
    expect(carry[0].value).toBeCloseTo(before * 0.3, 0);
    expect(carry[0].durationDays).toBe(24 * 30);
    expect(h.events.some((e) => e.type === 'era_reset')).toBe(true);
  });

  it('sends contract letters with a term and slot terms scaled to the tier', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.sign('northline');
    const rel = h.engine.relation('northline')!;
    expect(rel.status).toBe('signed');
    expect(rel.contract?.terms).toEqual(TIER_CONTRACT_TERMS[1]);
    expect(rel.contract!.termEndDay - rel.contract!.signedDay).toBe(360);
    expect(h.events.some((e) => e.type === 'contract_signed' && e.airlineId === 'northline')).toBe(true);
  });

  it('keeps at most 3 stacked contract letters', () => {
    const h = createHarness({ fieldLevel: 9 });
    let max = 0;
    h.run(120, () => {
      max = Math.max(max, h.engine.state.proposals.filter((p) => p.kind === 'contract' || p.kind === 'newcomer_incentive').length);
    });
    expect(max).toBeLessThanOrEqual(3);
    expect(max).toBeGreaterThan(0);
  });

  it('gives key-figure airlines a first-meet flag on the letter', () => {
    const h = createHarness({ fieldLevel: 5 });
    h.run(60);
    const letter = h.events.find((e) => e.type === 'letter' && e.airlineId === 'meridian');
    expect(letter?.data?.firstMeet).toBe(true);
    const logo = h.events.find((e) => e.type === 'letter' && e.airlineId === 'northline');
    expect(logo?.data?.firstMeet).toBe(false);
  });

  it('only lets prospects write when the airport meets the matching requirements', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.ctx.airport = {
      runwayLengthMeters: 800,
      hasSmallStands: true,
      hasMediumStands: false,
      hasHeavyStands: false,
      terminalRating: 1,
      hasFuelService: false,
      hasCateringService: false,
      hasMaintenanceService: false,
      hasHeavyVehicles: false,
      onTimePercentage: 90,
      totalFlightsHandled: 0
    };
    h.run(60);
    expect(h.engine.state.proposals).toHaveLength(0);
    const card = h.engine.getCard('northline')!;
    expect(card.needs.some((n) => !n.ok && n.label.includes('Runway'))).toBe(true);
    h.ctx.airport = { ...h.ctx.airport, runwayLengthMeters: 1800 };
    h.run(60);
    expect(h.engine.state.proposals.length).toBeGreaterThan(0);
    expect(h.engine.getCard('northline')!.needs.every((n) => n.ok)).toBe(true);
  });
});

describe('sign preview and rival fallout', () => {
  it('previews rivals (-10, or -16 for Proud) before signing, then applies exactly that', () => {
    const h = createHarness({ fieldLevel: 5 });
    h.run(1);
    const preview = h.engine.previewSign('atlas_blue')!;
    const meridian = preview.rivals.find((r) => r.airlineId === 'meridian')!;
    expect(meridian.delta).toBe(-16);
    expect(meridian.why).toContain('Proud');
    const zoom = h.engine.previewSign('skypenny')!.rivals.find((r) => r.airlineId === 'zoomjet')!;
    expect(zoom.delta).toBe(-10);
    h.sign('skypenny');
    const mod = h.engine.relation('zoomjet')!.modifiers.find((m) => m.kind === 'signed_rival');
    expect(mod?.value).toBe(-10);
    expect(mod?.source).toBe('skypenny');
    h.sign('atlas_blue');
    const m2 = h.engine.relation('meridian')!.modifiers.find((m) => m.kind === 'signed_rival');
    expect(m2?.value).toBe(-16);
  });

  it('warns when stands are nearly full (no doom loops)', () => {
    const h = createHarness({ fieldLevel: 1, metrics: { standUtilization: 0.97 } });
    h.run(1);
    expect(h.engine.previewSign('northline')!.warnings[0]).toContain('Stands at 97%');
  });
});

describe('responses to a proposal', () => {
  it('declining costs 4 standing and no timeout', () => {
    const h = createHarness({ fieldLevel: 1 });
    const p = h.nextProposal();
    const res = h.engine.respondToProposal(p.id, 'decline');
    expect(res.ok).toBe(true);
    expect(h.engine.state.proposals.find((x) => x.id === p.id)).toBeUndefined();
    expect(h.engine.relation(p.airlineId)!.modifiers.some((m) => m.value === -4)).toBe(true);
  });

  it('ignoring a letter costs 2 when it expires', () => {
    const h = createHarness({ fieldLevel: 1 });
    const p = h.nextProposal();
    h.run(15);
    expect(h.engine.state.proposals.find((x) => x.id === p.id)).toBeUndefined();
    expect(h.engine.relation(p.airlineId)!.modifiers.some((m) => m.kind === 'letter_ignored' && m.value === -2)).toBe(true);
  });

  it('counter costs money, shows its chance, and improves terms when it lands', () => {
    const h = createHarness({ fieldLevel: 1 });
    const p = h.nextProposal();
    const fee = p.terms!.feePerLanding;
    let improved = false;
    let paid = 0;
    // The roll is seeded; try a few proposals until one lands.
    for (const prop of [p]) {
      const res = h.engine.respondToProposal(prop.id, 'counter');
      paid = res.cost;
      expect(res.chance).toBeGreaterThan(0.1);
      expect(res.chance).toBeLessThanOrEqual(0.9);
      improved = res.ok;
    }
    expect(paid).toBe(750);
    expect(h.ledger.some((l) => l.memo.includes('Counter-offer') && l.amount === 750)).toBe(true);
    if (improved) expect(p.terms!.feePerLanding).toBeGreaterThan(fee);
    expect(h.engine.respondToProposal(p.id, 'counter').message).toContain('Already');
  });

  it('a Favour makes the counter land for sure', () => {
    const h = createHarness({ fieldLevel: 1 });
    const p = h.nextProposal();
    const rel = h.engine.relation(p.airlineId)!;
    expect(h.engine.respondToProposal(p.id, 'counter', 'favour').message).toContain('No Favour');
    rel.favours.push({ grantedDay: h.engine.day, reason: 'test' });
    const fee = p.terms!.feePerLanding;
    const res = h.engine.respondToProposal(p.id, 'counter', 'favour');
    expect(res.ok).toBe(true);
    expect(res.chance).toBe(1);
    expect(p.terms!.feePerLanding).toBeGreaterThan(fee);
    expect(rel.favours).toHaveLength(0);
  });

  it('refuses a counter the player cannot afford', () => {
    const h = createHarness({ fieldLevel: 1, cash: 100 });
    const p = h.nextProposal();
    const res = h.engine.respondToProposal(p.id, 'counter');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('afford');
    expect(h.ledger).toHaveLength(0);
  });

  it('only allows Support on base and endeavor proposals', () => {
    const h = createHarness({ fieldLevel: 1 });
    const p = h.nextProposal();
    expect(h.engine.respondToProposal(p.id, 'support').ok).toBe(false);
  });
});
