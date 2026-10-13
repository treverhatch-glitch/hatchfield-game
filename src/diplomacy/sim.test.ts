import { describe, expect, it } from 'vitest';
import { createDiplomacyState } from './engine.ts';
import { TIER_ROSTER_CAP } from './constants.ts';
import { GOOD_METRICS, createHarness, flyDay } from './testkit.ts';
import type { Harness } from './testkit.ts';
import type { DiplomacyEvent, Grade } from './types.ts';

interface Policy {
  name: string;
  /** Probability weights for grades A..F for each flight. */
  grades: Grade[];
  accepts: boolean;
  answersDemands: boolean;
  settlesLawsuits: boolean;
  /** Serious incident on a random signed airline every N days (0 = never). */
  incidentEvery: number;
  /** Raise fees at this index at day 30 (1 = never). */
  feeIndex: number;
}

const DILIGENT: Policy = {
  name: 'diligent',
  grades: ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'A'],
  accepts: true,
  answersDemands: true,
  settlesLawsuits: true,
  incidentEvery: 0,
  feeIndex: 1
};

const NEGLECTFUL: Policy = {
  name: 'neglectful',
  grades: ['D', 'F', 'D', 'F', 'C', 'F', 'D', 'F'],
  accepts: true,
  answersDemands: false,
  settlesLawsuits: false,
  incidentEvery: 45,
  feeIndex: 1.6
};

interface Outcome {
  harness: Harness;
  events: DiplomacyEvent[];
  meanSigned: number;
  maxSigned: number;
  maxExitNotices: number;
  signedEver: Set<string>;
}

function simulate(policy: Policy, seed: number, days: number, invariants = true): Outcome {
  const h = createHarness({
    fieldLevel: 3,
    seed,
    metrics: { ...GOOD_METRICS, onTimePct: 82, cafes: 0, loungeSeats: 0, standCount: 3, familyAmenities: 0, prestigeItems: 0, electricTugs: 0, solarCoveragePct: 0 }
  });
  let tick = 0;
  let maxSigned = 0;
  let sumSigned = 0;
  let sampleDays = 0;
  let maxExitNotices = 0;
  const signedEver = new Set<string>();

  h.run(days, (day) => {
    tick++;
    h.ctx.fieldLevel = day < 120 ? 3 : day < 240 ? 5 : 7;
    if (policy.feeIndex !== 1 && day === 30) h.engine.notifyFeeChange(policy.feeIndex);
    if (policy.incidentEvery > 0 && day > 0 && day % policy.incidentEvery === 0) {
      for (const id of h.engine.signedAirlineIds()) h.engine.recordIncident(id, 'ground collision', 'Stand 4');
    }
    for (const id of h.engine.signedAirlineIds()) {
      signedEver.add(id);
      const rel = h.engine.relation(id)!;
      const flights = Math.max(1, Math.round(rel.capacityFactor * 3));
      for (let f = 0; f < flights; f++) {
        flyDay(h.engine, id, [policy.grades[(tick + f + id.length) % policy.grades.length]]);
      }
    }
    for (const p of [...h.engine.state.proposals]) {
      if (policy.accepts && (p.kind === 'contract' || p.kind === 'newcomer_incentive')) {
        h.engine.respondToProposal(p.id, 'accept');
      }
    }
    if (policy.answersDemands) {
      for (const c of h.engine.state.commitments) {
        if (c.kind === 'demand' && c.status === 'open') h.engine.respondToDemand(c.id, 'accept');
      }
      for (const s of h.engine.state.spats) if (!s.resolved) h.engine.respondToSpat(s.id, 'concede');
    }
    if (policy.settlesLawsuits) {
      for (const l of h.engine.state.lawsuits) if (!l.settled && !l.closed) h.engine.settleLawsuit(l.id);
    }

    if (invariants) {
      const state = h.engine.state;
      let notices = 0;
      let hubs = 0;
      for (const rel of Object.values(state.relations)) {
        if (!Number.isFinite(rel.standing) || rel.standing < -100 || rel.standing > 100) {
          throw new Error(`standing out of range for ${rel.id}: ${rel.standing}`);
        }
        if (rel.stage === 'exit_notice' && rel.status === 'signed') notices++;
        if (rel.isHub) hubs++;
        if (rel.status === 'signed' && !rel.contract) throw new Error(`${rel.id} signed without contract`);
        if (rel.status === 'locked' && rel.contract) throw new Error(`${rel.id} locked with contract`);
      }
      maxExitNotices = Math.max(maxExitNotices, notices);
      if (hubs > 1) throw new Error('more than one hub');
      const year = Math.floor(day / state.config.yearDays);
      const yearExits = state.exitLog.filter((e) => Math.floor(e.day / state.config.yearDays) === year).length;
      if (yearExits > state.config.maxExitsPerYear) throw new Error(`too many exits in game-year ${year}: ${yearExits}`);
    }

    const signed = h.engine.signedAirlineIds();
    if (signed.length > 0) {
      sampleDays++;
      let total = 0;
      for (const id of signed) total += h.engine.relation(id)!.standing;
      sumSigned += total / signed.length;
    }
    maxSigned = Math.max(maxSigned, signed.length);
  });

  return {
    harness: h,
    events: h.events,
    meanSigned: sampleDays ? sumSigned / sampleDays : 0,
    maxSigned,
    maxExitNotices,
    signedEver
  };
}

describe('headless one-year simulation', () => {
  it('a diligent airport signs airlines, keeps standing healthy, and honours every invariant', () => {
    const out = simulate(DILIGENT, 11, 360);
    expect(out.signedEver.size).toBeGreaterThanOrEqual(3);
    expect(out.meanSigned).toBeGreaterThan(10);
    expect(out.maxExitNotices).toBeLessThanOrEqual(1);
    const types = new Set(out.events.map((e) => e.type));
    expect(types.has('letter')).toBe(true);
    expect(types.has('contract_signed')).toBe(true);
    expect(types.has('tier_unlocked')).toBe(true);
    expect(types.has('demand_issued')).toBe(true);
    expect(out.harness.engine.cards().length).toBeGreaterThan(0);
  });

  it('a neglectful airport loses airlines at season ends, never more than the cap per game-year, and suffers hostility', () => {
    const out = simulate(NEGLECTFUL, 11, 360);
    const state = out.harness.engine.state;
    const exits = out.events.filter((e) => e.type === 'exit');
    expect(exits.length).toBeGreaterThanOrEqual(1);
    const perYear = new Map<number, number>();
    for (const e of exits) perYear.set(Math.floor(e.day / state.config.yearDays), (perYear.get(Math.floor(e.day / state.config.yearDays)) ?? 0) + 1);
    for (const n of perYear.values()) expect(n).toBeLessThanOrEqual(state.config.maxExitsPerYear);
    for (const e of exits) expect(e.day % state.config.seasonDays).toBe(0);
    expect(out.harness.hostile.length).toBeGreaterThan(0);
    expect(out.events.some((e) => e.type === 'hostile_action')).toBe(true);
    const warned = out.events.some((e) => ['cold_warning', 'capacity_cut', 'exit_notice'].includes(e.type));
    expect(warned).toBe(true);
    const order = ['cold_warning', 'capacity_cut', 'exit_notice', 'exit'];
    for (const e of exits.filter((x) => x.data?.reason === 'standing')) {
      const earlier = out.events.filter((x) => x.airlineId === e.airlineId && x.day <= e.day).map((x) => x.type);
      const first = order.map((t) => earlier.indexOf(t as DiplomacyEvent['type']));
      expect(first[2]).toBeGreaterThanOrEqual(0);
      expect(first[2]).toBeLessThan(first[3] === -1 ? Infinity : earlier.lastIndexOf('exit') + 1);
    }
  });

  it('good play beats bad play on mean standing', () => {
    const good = simulate(DILIGENT, 5, 360);
    const bad = simulate(NEGLECTFUL, 5, 360);
    expect(good.meanSigned).toBeGreaterThan(bad.meanSigned + 15);
  });

  it('replacements for leavers are procedural newcomers, never real airline names', () => {
    const initial = createDiplomacyState({ seed: 3 });
    const initialLive: Record<number, number> = {};
    for (const r of Object.values(initial.relations)) initialLive[r.tier] = (initialLive[r.tier] ?? 0) + 1;
    const out = simulate(NEGLECTFUL, 3, 720);
    const newcomers = out.events.filter((e) => e.type === 'newcomer');
    const state = out.harness.engine.state;
    const known = new Set(Object.values(state.relations).map((r) => r.name));
    expect(known.size).toBe(Object.keys(state.relations).length);
    const blocked = ['Delta', 'United', 'American', 'Lufthansa', 'Emirates', 'Ryanair', 'Qantas', 'Southwest'];
    for (const rel of Object.values(state.relations)) {
      for (const word of blocked) expect(rel.name).not.toContain(word);
    }
    expect(newcomers.length).toBeGreaterThan(0);
    for (const tier of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const live = Object.values(state.relations).filter((r) => r.tier === tier && r.kind === 'pax' && (r.status === 'prospect' || r.status === 'signed'));
      expect(live.length).toBeLessThanOrEqual(Math.max(TIER_ROSTER_CAP, initialLive[tier] ?? 0));
    }
  });

  it('is fully deterministic for a seed across two years', () => {
    const a = simulate(DILIGENT, 8, 720, false);
    const b = simulate(DILIGENT, 8, 720, false);
    expect(a.harness.engine.serialize()).toBe(b.harness.engine.serialize());
    expect(a.events.map((e) => `${e.day}:${e.type}:${e.airlineId}`)).toEqual(b.events.map((e) => `${e.day}:${e.type}:${e.airlineId}`));
  });

  it('survives many seeds without throwing or breaking invariants', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const policy = seed % 2 === 0 ? DILIGENT : NEGLECTFUL;
      const out = simulate(policy, seed, 400);
      for (const rel of Object.values(out.harness.engine.state.relations)) {
        expect(Number.isFinite(rel.standing)).toBe(true);
      }
    }
  });

  it('serialises mid-run state to JSON without loss', () => {
    const out = simulate(DILIGENT, 2, 200, false);
    const json = out.harness.engine.serialize();
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json.length).toBeGreaterThan(1000);
  });
});
