import { describe, expect, it } from 'vitest';
import { createHarness, push } from './testkit.ts';
import { createDiplomacyState } from './engine.ts';
import { ROSTER } from './data.ts';
import { buildPortraitCard, bandChip } from './portrait.ts';

describe('key figures', () => {
  it('exist only from tier 3 up, for roughly half of those airlines', () => {
    const state = createDiplomacyState({ seed: 4 });
    const high = Object.values(state.relations).filter((r) => r.tier >= 3);
    const withFigure = high.filter((r) => r.keyFigure);
    expect(Object.values(state.relations).filter((r) => r.tier <= 2 && r.keyFigure)).toHaveLength(0);
    expect(withFigure.length / high.length).toBeGreaterThan(0.4);
    expect(withFigure.length / high.length).toBeLessThan(0.75);
    for (const r of withFigure) {
      const kf = r.keyFigure!;
      expect(kf.traits).toHaveLength(2);
      expect(new Set(kf.traits).size).toBe(2);
      expect(kf.agenda).toBeTruthy();
      expect(kf.voice).toBeTruthy();
      expect(kf.retireAtDay).toBeGreaterThanOrEqual(4 * 360);
      expect(kf.retireAtDay).toBeLessThanOrEqual(8 * 360);
    }
  });

  it('retire after 4-8 years: the successor keeps 50% of modifiers, keeps one trait and rolls another', () => {
    const h = createHarness({ fieldLevel: 5, seed: 12 });
    h.sign('meridian');
    push(h, 'meridian', 20, 24);
    const rel = h.engine.relation('meridian')!;
    const old = rel.keyFigure!;
    const modBefore = rel.modifiers.map((m) => m.value);
    old.retireAtDay = h.engine.day + 1;
    h.run(2);
    const next = rel.keyFigure!;
    expect(next.generation).toBe(1);
    expect(next.name).not.toBe(old.name);
    expect(next.traits.some((t) => old.traits.includes(t))).toBe(true);
    expect(rel.traits).toEqual(next.traits);
    expect(next.retireAtDay - next.tenureStartDay).toBeGreaterThanOrEqual(4 * 360);
    expect(next.retireAtDay - next.tenureStartDay).toBeLessThanOrEqual(8 * 360);
    const modAfter = rel.modifiers.filter((m) => m.source === 'test').map((m) => m.value);
    expect(modAfter[0]).toBeCloseTo(modBefore.find((v) => v === 20)! * 0.5);
    const event = h.events.find((e) => e.type === 'succession')!;
    expect(event.text).toContain(old.name);
    expect(event.text).toContain(next.name);
    expect(h.events.some((e) => e.type === 'letter' && e.airlineId === 'meridian' && e.text.includes('retired'))).toBe(true);
  });

  it('remember three events and quote the latest in letters', () => {
    const h = createHarness({ fieldLevel: 5, seed: 12 });
    h.sign('meridian');
    const rel = h.engine.relation('meridian')!;
    for (let i = 0; i < 6; i++) h.engine.core.state.relations.meridian.keyFigure!.memory.push(`event ${i}`);
    rel.keyFigure!.memory = rel.keyFigure!.memory.slice(-3);
    expect(rel.keyFigure!.memory).toHaveLength(3);
    h.engine.advance(0, h.ctx);
  });

  it('every letter carries a trait-flavoured line', () => {
    const h = createHarness({ fieldLevel: 5, seed: 3 });
    h.run(80);
    const letters = h.events.filter((e) => e.type === 'letter');
    expect(letters.length).toBeGreaterThan(0);
    for (const l of letters) expect(l.text.length).toBeGreaterThan(30);
    const flavours = [
      'CO2', 'leading carrier', 'schedule is sacred', 'comfort', 'theatre', 'ledger', 'fee sheet', 'seasons'
    ];
    for (const l of letters) expect(flavours.some((f) => l.text.includes(f))).toBe(true);
  });
});

describe('first meeting', () => {
  it('shows a scene with greeting, what they have heard, and four choices', () => {
    const h = createHarness({ fieldLevel: 5 });
    h.run(1);
    const scene = h.engine.firstMeetScene('meridian')!;
    expect(scene.choices).toEqual(['formal', 'warm', 'bold', 'tour']);
    expect(scene.heard).toContain('94%');
    expect(scene.greeting.length).toBeGreaterThanOrEqual(2);
    expect(h.engine.firstMeetScene('northline')).toBeNull();
  });

  it('formal suits a Punctual, formal key figure: summary toast names the liked trait', () => {
    const h = createHarness({ fieldLevel: 5 });
    h.run(1);
    const res = h.engine.resolveFirstMeet('meridian', 'formal');
    expect(res.message).toBe('Isabella: +8 (Formal, Punctual liked it)');
    const rel = h.engine.relation('meridian')!;
    expect(rel.modifiers.find((m) => m.kind === 'first_meet')?.value).toBe(8);
    expect(rel.modifiers.find((m) => m.kind === 'first_meet')?.durationDays).toBe(24 * 30);
    expect(h.engine.resolveFirstMeet('meridian', 'warm').ok).toBe(false);
    expect(h.engine.firstMeetScene('meridian')).toBeNull();
  });

  it('tone ranges from -5 to +8 for spoken choices', () => {
    for (const choice of ['formal', 'warm', 'bold'] as const) {
      for (const id of ['meridian', 'verdant_air', 'skyglass', 'orient_crown', 'royal_aurum', 'global_one']) {
        const h = createHarness({ fieldLevel: 9 });
        h.run(1);
        const res = h.engine.resolveFirstMeet(id, choice);
        const tone = Number(res.data?.tone);
        expect(tone).toBeGreaterThanOrEqual(-5);
        expect(tone).toBeLessThanOrEqual(8);
      }
    }
  });

  it('"Show them around" scores how well the airport matches their top interest (-5..+10)', () => {
    const good = createHarness({ fieldLevel: 5, metrics: { onTimePct: 95 } });
    good.run(1);
    expect(good.engine.resolveFirstMeet('meridian', 'tour').data?.tone).toBe(10);
    const bad = createHarness({ fieldLevel: 5, metrics: { onTimePct: 60 } });
    bad.run(1);
    expect(bad.engine.resolveFirstMeet('meridian', 'tour').data?.tone).toBe(-5);
  });

  it('a bold pitch creates a Promise with a numeric target: kept +10, broken -15', () => {
    const kept = createHarness({ fieldLevel: 5 });
    kept.run(1);
    kept.sign('meridian');
    const res = kept.engine.resolveFirstMeet('meridian', 'bold');
    expect(res.message).toContain('Promise:');
    const promise = kept.engine.state.commitments.find((c) => c.kind === 'promise')!;
    expect(promise.target).toBeGreaterThan(0);
    expect(promise.deadlineDay).toBeGreaterThan(promise.issuedDay);
    kept.run(100);
    expect(kept.engine.relation('meridian')!.modifiers.some((m) => m.kind === 'promise_kept' && m.value === 10)).toBe(true);

    const broken = createHarness({ fieldLevel: 5, metrics: { onTimePct: 50, feeIndex: 1.5 } });
    broken.run(1);
    broken.sign('meridian');
    broken.engine.resolveFirstMeet('meridian', 'bold');
    broken.run(100);
    expect(broken.engine.relation('meridian')!.modifiers.some((m) => m.kind === 'promise_broken' && m.value === -15)).toBe(true);
  });
});

describe('alliances', () => {
  it('activate at tier 4, give signed allies +5, and mediation or vouching helps from a Partner ally', () => {
    const h = createHarness({ fieldLevel: 7 });
    h.sign('verdant_air');
    h.sign('skyglass');
    expect(h.engine.state.alliances.find((a) => a.id === 'orbit')!.active).toBe(true);
    expect(h.events.some((e) => e.type === 'alliance')).toBe(true);
    const skyglass = h.engine.relation('skyglass')!;
    expect(skyglass.modifiers.some((m) => m.kind === 'signed_ally' && m.value === 5)).toBe(true);

    expect(h.engine.mediate('skyglass', 'verdant_air').message).toContain('Partner');
    push(h, 'verdant_air', 100, 24);
    h.run(2);
    expect(h.engine.relation('verdant_air')!.band).toBe('partner');
    const cash = h.cash.value;
    const med = h.engine.mediate('skyglass', 'verdant_air');
    expect(med.ok).toBe(true);
    expect(med.cost).toBe(14400);
    expect(cash - h.cash.value).toBe(14400);
    expect(skyglass.modifiers.some((m) => m.kind === 'mediation' && m.value === 5)).toBe(true);
    expect(h.engine.mediate('skyglass', 'verdant_air').message).toContain('recently');

    const vouch = h.engine.vouch('verdant_air', 'skyglass');
    expect(vouch.ok).toBe(true);
    expect(skyglass.modifiers.some((m) => m.kind === 'vouch' && m.value === 5)).toBe(true);
    expect(h.engine.vouch('verdant_air', 'skyglass').message).toContain('Already');
  });

  it('refuses mediation from an airline outside the alliance', () => {
    const h = createHarness({ fieldLevel: 7 });
    h.sign('verdant_air');
    h.sign('orient_crown');
    push(h, 'verdant_air', 100, 24);
    h.run(2);
    expect(h.engine.mediate('orient_crown', 'verdant_air').message).toContain('allied');
  });
});

describe('single hub airline', () => {
  function hubSetup() {
    const h = createHarness({ fieldLevel: 5 });
    h.sign('meridian');
    h.sign('verdant_air');
    for (const id of ['meridian', 'verdant_air']) {
      push(h, id, 100, 36);
      h.engine.relation(id)!.isBase = true;
    }
    h.run(2);
    return h;
  }

  it('lists every blocking reason at once', () => {
    const h = createHarness({ fieldLevel: 5, metrics: {} });
    h.sign('meridian');
    const blockers = h.engine.hubBlockers('meridian');
    expect(blockers.length).toBeGreaterThanOrEqual(4);
    expect(blockers.join(' ')).toContain('Partner');
    expect(blockers.join(' ')).toContain('Base');
    expect(blockers.join(' ')).toContain('departures');
    expect(blockers.join(' ')).toContain('maintenance');
  });

  it('grants one Hub, charges money, and angers non-allied rivals by 15', () => {
    const h = hubSetup();
    expect(h.engine.hubBlockers('meridian')).toEqual([]);
    const res = h.engine.requestHub('meridian');
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(30000);
    expect(h.engine.state.hubAirlineId).toBe('meridian');
    const atlas = h.engine.relation('atlas_blue')!;
    expect(atlas.modifiers.some((m) => m.kind === 'hub_rival' && m.value === -15)).toBe(true);
  });

  it('refuses a second Hub while one exists, and frees it when the Hub is revoked', () => {
    const h = hubSetup();
    expect(h.engine.requestHub('meridian').ok).toBe(true);
    const second = h.engine.requestHub('verdant_air');
    expect(second.ok).toBe(false);
    expect(second.message).toContain('already the Hub');
    h.engine.revokeHub();
    expect(h.engine.state.hubAirlineId).toBeNull();
    expect(h.engine.requestHub('verdant_air').ok).toBe(true);
    expect(h.engine.relation('meridian')!.isHub).toBe(false);
  });

  it('loses Hub and Base when standing drops below Warm', () => {
    const h = hubSetup();
    h.engine.requestHub('meridian');
    push(h, 'meridian', -200, 36);
    h.run(2);
    const rel = h.engine.relation('meridian')!;
    expect(rel.isHub).toBe(false);
    expect(rel.isBase).toBe(false);
    expect(h.engine.state.hubAirlineId).toBeNull();
    expect(h.events.some((e) => e.type === 'hub_revoked')).toBe(true);
  });

  it('clears the Hub when the hub airline exits', () => {
    const h = hubSetup();
    h.engine.requestHub('meridian');
    h.engine.cancelContract('meridian');
    const rel = h.engine.relation('meridian')!;
    while (rel.status === 'signed') h.run(1);
    expect(h.engine.state.hubAirlineId).toBeNull();
  });
});

describe('2D portrait card data', () => {
  it('is deterministic per seed and carries every art token', () => {
    const a = buildPortraitCard({ seed: 123, tier: 3, hasKeyFigure: true, livery: ['#111111', '#eeeeee'] });
    const b = buildPortraitCard({ seed: 123, tier: 3, hasKeyFigure: true, livery: ['#111111', '#eeeeee'] });
    expect(a).toEqual(b);
    expect(a.style).toBe('flat-2d');
    expect(a.skin).toMatch(/^#/);
    expect(a.hair.style).toBeTruthy();
    expect(a.face.eyes).toBeTruthy();
    expect(a.clothing.color).toBe('#111111');
    expect(a.logoOnly).toBe(false);
    const c = buildPortraitCard({ seed: 124, tier: 3, hasKeyFigure: true, livery: ['#111111', '#eeeeee'] });
    expect(c).not.toEqual(a);
  });

  it('uses frames to show rank and marks logo-only contacts', () => {
    expect(buildPortraitCard({ seed: 1, tier: 1, hasKeyFigure: false, livery: ['#000', '#fff'] })).toMatchObject({ frame: 'bronze', logoOnly: true });
    expect(buildPortraitCard({ seed: 1, tier: 3, hasKeyFigure: true, livery: ['#000', '#fff'] }).frame).toBe('silver');
    expect(buildPortraitCard({ seed: 1, tier: 5, hasKeyFigure: true, livery: ['#000', '#fff'] }).frame).toBe('gold');
  });

  it('band chips use colour + icon + word, all distinct', () => {
    const chips = (['hostile', 'cold', 'neutral', 'warm', 'partner'] as const).map(bandChip);
    expect(new Set(chips.map((c) => c.color)).size).toBe(5);
    expect(new Set(chips.map((c) => c.icon)).size).toBe(5);
    expect(new Set(chips.map((c) => c.word)).size).toBe(5);
  });

  it('card data bundles the portrait, formula, causes, needs, rivals and history', () => {
    const h = createHarness({ fieldLevel: 5 });
    h.sign('meridian');
    push(h, 'meridian', -22, 12);
    h.engine.recordGrade('meridian', 'F', { cause: 'security_queue' });
    h.run(3);
    const card = h.engine.getCard('meridian')!;
    expect(card.portrait.logoOnly).toBe(false);
    expect(card.figure?.name).toBe('Isabella Okafor');
    expect(card.figure?.agenda).toBe('Never second at any field');
    expect(card.breakdown!.formula).toMatch(/^Performance .* \u00b7 Modifiers .* \u00b7 Traits .* = .* (Hostile|Cold|Neutral|Warm|Partner)$/);
    expect(card.breakdown!.visibleLines.length).toBeLessThanOrEqual(6);
    expect(card.topCauses.length).toBeLessThanOrEqual(2);
    expect(card.topCauses.every((l) => l.value < 0)).toBe(true);
    expect(card.band.word).toBeTruthy();
    expect(card.interests).toHaveLength(3);
    expect(card.rivals).toContain('atlas_blue');
    expect(card.history.length).toBeGreaterThan(0);
    expect(['up', 'down', 'flat']).toContain(card.trend);
    expect(h.engine.cards().find((c) => c.id === 'royal_aurum')).toBeUndefined();
  });
});
