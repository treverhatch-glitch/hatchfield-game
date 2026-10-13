import { describe, expect, it } from 'vitest';
import { createHarness, push } from './testkit.ts';
import type { Harness } from './testkit.ts';
import { applySlotRule, reenter, reenterBand } from './departure.ts';
import { generateNewcomerSeed, isNameAllowed } from './generator.ts';
import { createDiplomacyState } from './engine.ts';
import { ROSTER } from './data.ts';

function exitDays(h: Harness): number[] {
  return h.events.filter((e) => e.type === 'exit').map((e) => e.day);
}

describe('staged departure', () => {
  it('goes cold warning, capacity cut, exit notice, then exits only at season end', () => {
    const h = createHarness({ fieldLevel: 3 });
    h.sign('skypenny');
    const rel = h.engine.relation('skypenny')!;

    push(h, 'skypenny', -30, 60);
    expect(rel.band).toBe('cold');
    h.run(29);
    expect(rel.stage).toBe('none');
    h.run(3);
    expect(rel.stage).toBe('cold_warning');
    expect(h.events.some((e) => e.type === 'cold_warning')).toBe(true);

    push(h, 'skypenny', -70, 60);
    expect(rel.band).toBe('hostile');
    h.run(1);
    expect(rel.stage).toBe('capacity_cut');
    expect(rel.capacityFactor).toBeCloseTo(0.7);
    expect(h.engine.state.slotPools.some((p) => p.leaverId === 'skypenny')).toBe(true);

    h.run(31);
    expect(rel.stage).toBe('exit_notice');
    const noticeDay = rel.exitNoticeDay!;
    const exits = h.events.filter((e) => e.type === 'exit_notice');
    expect(exits).toHaveLength(1);
    expect(exits[0].text).toContain('45 days');

    while (rel.status === 'signed') {
      h.run(1);
      if (rel.status === 'signed') expect(h.engine.day - noticeDay).toBeLessThan(140);
    }
    const exitDay = exitDays(h)[0];
    expect(exitDay % 90).toBe(0);
    expect(exitDay - noticeDay).toBeGreaterThanOrEqual(45);
    expect(rel.status).toBe('former');
    expect(rel.exitReason).toBe('standing');
    expect(rel.lastBandBeforeExit).toBe('hostile');
    expect(rel.contract).toBeNull();
  });

  it('can be rescued: a recovered standing restores the flights and withdraws the notice', () => {
    const h = createHarness({ fieldLevel: 3 });
    h.sign('skypenny');
    const rel = h.engine.relation('skypenny')!;
    push(h, 'skypenny', -100, 60);
    h.run(2);
    expect(rel.stage).toBe('capacity_cut');
    push(h, 'skypenny', 100, 60);
    h.run(2);
    expect(rel.capacityFactor).toBe(1);
    expect(['none', 'cold_warning']).toContain(rel.stage);
    expect(h.events.some((e) => e.type === 'capacity_restored')).toBe(true);

    rel.modifiers = [];
    push(h, 'skypenny', -100, 60);
    h.run(2);
    h.run(32);
    expect(rel.stage).toBe('exit_notice');
    push(h, 'skypenny', 120, 60);
    h.run(2);
    expect(rel.stage).not.toBe('exit_notice');
    expect(rel.status).toBe('signed');
    expect(h.events.some((e) => e.type === 'exit_rescued')).toBe(true);
  });

  it('last-chance counter at exit notice: 35% base, certain at 55% with a Favour, costs money', () => {
    const h = createHarness({ fieldLevel: 3 });
    h.sign('skypenny');
    const rel = h.engine.relation('skypenny')!;
    expect(h.engine.counterExitNotice('skypenny').message).toContain('No exit notice');
    push(h, 'skypenny', -100, 60);
    h.run(36);
    expect(rel.stage).toBe('exit_notice');
    rel.favours.push({ grantedDay: h.engine.day, reason: 'test' });
    const res = h.engine.counterExitNotice('skypenny', true);
    expect(res.chance).toBeCloseTo(0.55);
    expect(res.cost).toBeGreaterThan(0);
    expect(h.engine.counterExitNotice('skypenny').message).toContain('Already');
  });

  it('allows at most one airline in exit notice at a time and two exits per game-year', () => {
    const h = createHarness({ fieldLevel: 3 });
    for (const id of ['skypenny', 'zoomjet', 'budgie_air', 'northline']) h.sign(id);
    for (const id of ['skypenny', 'zoomjet', 'budgie_air', 'northline']) push(h, id, -100, 80);
    let maxNotices = 0;
    h.run(700, () => {
      const notices = h.engine.cards().filter((c) => c.stage === 'exit_notice').length;
      maxNotices = Math.max(maxNotices, notices);
    });
    expect(maxNotices).toBeLessThanOrEqual(1);
    const perYear = new Map<number, number>();
    for (const d of exitDays(h)) perYear.set(Math.floor(d / 360), (perYear.get(Math.floor(d / 360)) ?? 0) + 1);
    expect(exitDays(h).length).toBeGreaterThanOrEqual(2);
    for (const n of perYear.values()) expect(n).toBeLessThanOrEqual(2);
    for (const d of exitDays(h)) expect(d % 90).toBe(0);
  });

  it('makes a Partner-left modifier (-8) for alliance mates when a member exits', () => {
    const h = createHarness({ fieldLevel: 7 });
    h.sign('verdant_air');
    h.sign('skyglass');
    const verdant = h.engine.relation('verdant_air')!;
    push(h, 'verdant_air', -100, 60);
    while (verdant.status === 'signed') h.run(1);
    const mate = h.engine.relation('skyglass')!;
    expect(mate.modifiers.some((m) => m.kind === 'partner_left' && m.value === -8)).toBe(true);
  });
});

describe('player cancellation', () => {
  it('before the term ends costs a fee plus credit and Favour loss; flights end at season end', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.sign('northline');
    const rel = h.engine.relation('northline')!;
    rel.favours.push({ grantedDay: 0, reason: 'a' }, { grantedDay: 0, reason: 'b' });
    rel.leverage = 1;
    const quote = h.engine.cancellationQuote('northline')!;
    expect(quote.fee).toBeGreaterThan(0);
    expect(quote.favoursLost).toBe(2);
    const before = h.cash.value;
    const res = h.engine.cancelContract('northline');
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(quote.fee);
    expect(before - h.cash.value).toBe(quote.fee);
    expect(rel.favours).toHaveLength(0);
    expect(rel.leverage).toBe(0);
    const credit = rel.modifiers.find((m) => m.kind === 'cancelled_by_player')!;
    expect(credit.value).toBeLessThanOrEqual(-8);
    expect(credit.value).toBeGreaterThanOrEqual(-20);
    expect(rel.status).toBe('signed');
    expect(h.engine.cancelContract('northline').message).toContain('already');
    while (rel.status === 'signed') h.run(1);
    expect(h.engine.day % 90).toBe(0);
    expect(rel.exitReason).toBe('player_cancelled');
    expect(h.engine.state.exitLog).toHaveLength(0);
  });

  it('fee scales with the months left, capped at 12 months of the cancellation penalty', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.sign('northline');
    const rel = h.engine.relation('northline')!;
    const penalty = rel.contract!.terms.penaltyPerCancellation;
    rel.contract!.termEndDay = h.engine.day + 90;
    expect(h.engine.cancellationQuote('northline')!.fee).toBe(penalty * 3);
    rel.contract!.termEndDay = h.engine.day + 3000;
    expect(h.engine.cancellationQuote('northline')!.fee).toBe(penalty * 12);
  });

  it('is free (no fee, credit or Favour loss) in the final 30 days of the term', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.sign('northline');
    const rel = h.engine.relation('northline')!;
    rel.contract!.termEndDay = h.engine.day + 20;
    rel.favours.push({ grantedDay: 0, reason: 'a' });
    const res = h.engine.cancelContract('northline');
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(0);
    expect(rel.favours).toHaveLength(1);
    expect(rel.modifiers.some((m) => m.kind === 'cancelled_by_player')).toBe(false);
  });

  it('is refused (and nothing changes) when the player cannot pay the fee', () => {
    const h = createHarness({ fieldLevel: 1, cash: 100 });
    h.sign('northline');
    const res = h.engine.cancelContract('northline');
    expect(res.ok).toBe(false);
    expect(h.engine.relation('northline')!.pendingCancel).toBe(false);
    expect(h.engine.relation('northline')!.modifiers.some((m) => m.kind === 'cancelled_by_player')).toBe(false);
  });

  it('re-entry after at least two game-years, one band below the band at cancellation', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.sign('northline');
    push(h, 'northline', 100, 60);
    const rel = h.engine.relation('northline')!;
    expect(rel.band).toBe('partner');
    h.engine.cancelContract('northline');
    while (rel.status === 'signed') h.run(1);
    expect(rel.lastBandBeforeExit).toBe('partner');
    expect(reenterBand(rel)).toBe('warm');
    const left = h.engine.day;
    h.run(700);
    expect(rel.status).toBe('former');
    expect(h.engine.day - left).toBeLessThan(720);
    let guard = 0;
    while (rel.status === 'former' && guard++ < 4000) h.run(1);
    expect(rel.status).toBe('prospect');
    expect(h.engine.day - left).toBeGreaterThanOrEqual(720);
    expect(rel.band).toBe('warm');
  });

  it('reenter() starts the airline at the band below, never below Cold', () => {
    const h = createHarness({ fieldLevel: 3 });
    h.sign('skypenny');
    const rel = h.engine.relation('skypenny')!;
    rel.lastBandBeforeExit = 'hostile';
    rel.status = 'former';
    rel.exitedDay = 0;
    reenter(h.engine.core, rel);
    expect(rel.band).toBe('cold');
    expect(rel.status).toBe('prospect');
    expect(rel.standing).toBeLessThan(-20);
    rel.status = 'former';
    rel.lastBandBeforeExit = 'warm';
    reenter(h.engine.core, rel);
    expect(rel.band).toBe('neutral');
  });
});

describe('replacement airlines', () => {
  it('opens a slot pool and sends 1-2 newcomers 30-90 days later with a new-entrant incentive ask', () => {
    const h = createHarness({ fieldLevel: 3 });
    h.sign('skypenny');
    const rel = h.engine.relation('skypenny')!;
    push(h, 'skypenny', -100, 60);
    h.run(2);
    const pool = h.engine.state.slotPools.find((p) => p.leaverId === 'skypenny')!;
    expect(pool.spawnDay - pool.openedDay).toBeGreaterThanOrEqual(30);
    expect(pool.spawnDay - pool.openedDay).toBeLessThanOrEqual(90);
    const rosterIds = new Set(ROSTER.map((r) => r.id));
    h.run(95);
    const fresh = h.engine.state.order.filter((id) => !rosterIds.has(id));
    expect(fresh.length).toBeGreaterThanOrEqual(1);
    const newcomers = h.events.filter((e) => e.type === 'newcomer' && e.text.includes("SkyPenny's slots"));
    expect(newcomers.length).toBeGreaterThanOrEqual(1);
    expect(newcomers.length).toBeLessThanOrEqual(2);
    const prop = h.engine.state.proposals.find((p) => p.kind === 'newcomer_incentive' && fresh.includes(p.airlineId));
    if (prop) {
      expect(prop.discountPct).toBeGreaterThanOrEqual(10);
      expect(prop.discountPct).toBeLessThanOrEqual(20);
      expect(prop.discountDays).toBeLessThanOrEqual(360);
      const res = h.engine.respondToProposal(prop.id, 'accept');
      expect(res.ok).toBe(true);
      expect(h.engine.feeDiscountPct(prop.airlineId)).toBe(prop.discountPct);
    }
    expect(rel.tier).toBe(2);
  });

  it('newcomers differ from the leaver on at least one of passenger type, top interest, fleet family', () => {
    const state = createDiplomacyState({ seed: 11 });
    const leaver = state.relations['skypenny'];
    for (let i = 0; i < 100; i++) {
      const seed = generateNewcomerSeed(state, { tier: 2, kind: 'pax', leaver });
      const differs =
        seed.passengerType !== leaver.passengerType ||
        seed.interests[0] !== leaver.interests[0] ||
        seed.fleetFamily !== leaver.fleetFamily;
      expect(differs).toBe(true);
      expect(isNameAllowed(seed.name)).toBe(true);
      expect(seed.tier).toBe(2);
    }
  });

  it('blocklists real airline names and refuses duplicates', () => {
    expect(isNameAllowed('Delta Wings')).toBe(false);
    expect(isNameAllowed('Qantas Link')).toBe(false);
    expect(isNameAllowed('Air France Jet')).toBe(false);
    expect(isNameAllowed('Juniper Lines')).toBe(true);
    expect(isNameAllowed('Juniper Lines', ['juniper lines'])).toBe(false);
    for (const seed of ROSTER) expect(isNameAllowed(seed.name)).toBe(true);
  });

  it('keeps at least two prospects in every unlocked tier', () => {
    const h = createHarness({ fieldLevel: 1 });
    for (const id of ['northline', 'puddle_air', 'coastal_hop']) h.sign(id);
    h.run(45);
    const prospects = h.engine.cards().filter((c) => c.tier === 1 && c.status === 'prospect');
    expect(prospects.length).toBeGreaterThanOrEqual(2);
  });
});

describe('optional 80% slot rule', () => {
  function setup(enabled: boolean) {
    const h = createHarness({ fieldLevel: 1, config: { slotRule80: enabled } });
    h.sign('northline');
    const rel = h.engine.relation('northline')!;
    rel.contract!.signedDay = h.engine.day - 100;
    return { h, rel };
  }

  it('is off by default and returns nothing when off', () => {
    const { h, rel } = setup(false);
    expect(h.engine.state.config.slotRule80).toBe(false);
    const before = rel.contract!.terms.slotsPerWeek;
    for (let i = 0; i < 10; i++) h.engine.recordFlight('northline');
    applySlotRule(h.engine.core);
    expect(rel.contract!.terms.slotsPerWeek).toBe(before);
    expect(rel.contract!.seasonFlights).toBe(0);
  });

  it('reverts peak slots when an airline uses under 80% of its slots', () => {
    const { h, rel } = setup(true);
    const before = rel.contract!.terms.slotsPerWeek;
    const peak = rel.contract!.peakSlotsPerWeek;
    for (let i = 0; i < 100; i++) h.engine.recordFlight('northline');
    applySlotRule(h.engine.core);
    expect(rel.contract!.terms.slotsPerWeek).toBe(before - peak);
    expect(rel.contract!.peakSlotsPerWeek).toBe(0);
    expect(h.events.some((e) => e.type === 'slot_series_reverted')).toBe(true);
    expect(h.engine.state.slotPools.some((p) => p.leaverId === 'northline')).toBe(true);
    expect(rel.status).toBe('signed');
    expect(rel.modifiers.some((m) => m.value < 0)).toBe(false);
  });

  it('keeps the slots at 80% or more, and excused flights count as used', () => {
    const a = setup(true);
    for (let i = 0; i < 150; i++) a.h.engine.recordFlight('northline');
    applySlotRule(a.h.engine.core);
    expect(a.rel.contract!.peakSlotsPerWeek).toBeGreaterThan(0);

    const b = setup(true);
    for (let i = 0; i < 90; i++) b.h.engine.recordFlight('northline');
    for (let i = 0; i < 60; i++) b.h.engine.recordFlight('northline', { excused: true });
    applySlotRule(b.h.engine.core);
    expect(b.rel.contract!.peakSlotsPerWeek).toBeGreaterThan(0);
  });

  it('can be toggled at runtime and runs at season end', () => {
    const h = createHarness({ fieldLevel: 1 });
    h.engine.setSlotRule80(true);
    expect(h.engine.state.config.slotRule80).toBe(true);
    h.sign('northline');
    const rel = h.engine.relation('northline')!;
    const peak = rel.contract!.peakSlotsPerWeek;
    expect(peak).toBeGreaterThan(0);
    h.run(200);
    expect(rel.contract?.peakSlotsPerWeek ?? 0).toBe(0);
  });
});
