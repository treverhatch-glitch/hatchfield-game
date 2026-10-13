import { describe, expect, it } from 'vitest';
import { createHarness } from './testkit.ts';

describe('contract ladder', () => {
  it('signs a master contract with the first flight bank, then another bank', () => {
    const h = createHarness({ fieldLevel: 1 });
    const proposal = h.nextProposal();
    expect(proposal.text).toContain('master contract');
    expect(h.engine.getCard(proposal.airlineId)!.ladder.find((step) => step.id === 'master')?.state).toBe('offered');
    h.engine.respondToProposal(proposal.id, 'accept');
    const rel = h.engine.relation(proposal.airlineId)!;
    expect(rel.contract?.flightBanks).toBe(1);
    const ladder = h.engine.contractLadder(rel.id);
    expect(ladder.find((step) => step.id === 'master')?.state).toBe('done');
    expect(ladder.find((step) => step.id === 'flights')?.state).toBe('done');
    expect(ladder.find((step) => step.id === 'hub')?.state).toBe('locked');
    expect(ladder.find((step) => step.id === 'hub')?.detail.length).toBeGreaterThan(0);
    const before = rel.contract!.terms.slotsPerWeek;
    h.engine.state.proposals.push({
      id: 'flight-extra',
      airlineId: rel.id,
      kind: 'flights',
      text: `${rel.name} wants 7 more flights a week on the master contract.`,
      terms: { ...rel.contract!.terms, slotsPerWeek: before + 7 },
      discountPct: 0,
      discountDays: 0,
      issuedDay: h.engine.day,
      expiresDay: h.engine.day + 21,
      counterUsed: false,
      supportCost: 0
    });
    expect(h.engine.contractLadder(rel.id).find((step) => step.id === 'flights')?.state).toBe('offered');
    const added = h.engine.respondToProposal('flight-extra', 'accept');
    expect(added.ok).toBe(true);
    expect(rel.contract!.terms.slotsPerWeek).toBe(before + 7);
    expect(rel.contract!.flightBanks).toBe(2);
    expect(h.engine.contractLadder(rel.id).find((step) => step.id === 'base')?.state).not.toBe('done');
  });
});

describe('line-item counter', () => {
  it('shows a success percent and only changes the ticked lines', () => {
    const h = createHarness({ fieldLevel: 1 });
    const proposal = h.nextProposal();
    const one = h.engine.counterQuote(proposal.id, ['landing'])!;
    const many = h.engine.counterQuote(proposal.id, ['landing', 'passenger', 'slots'])!;
    expect(one.lines.length).toBeGreaterThanOrEqual(3);
    expect(one.chance).toBeGreaterThan(many.chance);
    expect(one.chance).toBeLessThanOrEqual(0.9);
    expect(many.chance).toBeGreaterThanOrEqual(0.1);
    const landing = proposal.terms!.feePerLanding;
    const slots = proposal.terms!.slotsPerWeek;
    const rel = h.engine.relation(proposal.airlineId)!;
    rel.favours.push({ grantedDay: h.engine.day, reason: 'test' });
    const res = h.engine.respondToProposal(proposal.id, 'counter', 'favour', ['landing']);
    expect(res.ok).toBe(true);
    expect(res.chance).toBe(1);
    expect(proposal.terms!.feePerLanding).toBe(Math.round(landing * 1.1));
    expect(proposal.terms!.slotsPerWeek).toBe(slots);
  });
});

describe('standing feeds', () => {
  it('records missed connections, premium screening, a rival poach, and a fee rise', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.sign('northline');
    h.engine.noteMissedConnections({ airlineId: 'northline', missed: 3, showMe: 'connectivity' });
    const missed = h.engine.relation('northline')!.modifiers.find((m) => m.kind === 'missed_connection');
    expect(missed?.value).toBe(-6);
    expect(missed?.showMe).toBe('connectivity');

    const meridian = h.engine.relation('meridian')!;
    meridian.status = 'signed';
    h.engine.notePremiumScreening({ clearRate: 0.4 });
    const premium = meridian.modifiers.find((m) => m.kind === 'premium_screen');
    expect(premium?.value).toBe(-6);
    expect(premium?.showMe).toBe('security');
    h.engine.notePremiumScreening({ clearRate: 0.4 });
    expect(meridian.modifiers.filter((m) => m.kind === 'premium_screen')).toHaveLength(1);
    expect(h.engine.relation('northline')!.modifiers.some((m) => m.kind === 'premium_screen')).toBe(false);

    h.engine.noteNegotiation({
      airlineId: 'northline',
      value: -10,
      label: 'Walked away',
      durationDays: 360,
      source: 'walk'
    });
    h.engine.noteRivalAirport({ rivalName: 'Riverside', airlineId: 'northline', taken: true });
    expect(h.engine.relation('northline')!.modifiers.some((m) => m.kind === 'rival_poach')).toBe(false);
    expect(h.events.some((e) => e.type === 'poached')).toBe(true);

    h.engine.notePublishedFees(1.05);
    expect(h.engine.relation('northline')!.modifiers.some((m) => m.kind === 'fee_rise')).toBe(true);
    const card = h.engine.getCard('northline')!;
    expect(card.breakdown!.visibleLines.length).toBeLessThanOrEqual(6);
    expect(card.breakdown!.formula).toContain('Performance');
    expect(card.ladder.map((step) => step.id)).toEqual(['master', 'flights', 'base', 'hub']);
  });

  it('applies a rival-airport penalty when negotiation did not already record the walk', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.sign('northline');
    h.engine.noteRivalAirport({ rivalName: 'Riverside', airlineId: 'northline', taken: true });
    const hit = h.engine.relation('northline')!.modifiers.find((m) => m.kind === 'rival_poach');
    expect(hit?.value).toBe(-12);
    expect(hit?.label).toContain('Riverside');
  });
});
