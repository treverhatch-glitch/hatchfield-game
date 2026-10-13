import { addModifier, allRelations, emit, signedRelations } from './core.ts';
import type { EngineCore } from './core.ts';
import {
  MAJOR_SHARE_PCT,
  MINOR_SHARE_PCT,
  clamp
} from './constants.ts';
import { AGENDAS, HOSTILE_TRAIT_PAIRS } from './data.ts';
import { bandIndex, bandWithHysteresis, computeBreakdown } from './standing.ts';
import type { AirlineRelation, Band, ShareClass, StandingBreakdown } from './types.ts';

export function shareClassOf(sharePct: number): ShareClass {
  if (sharePct > MAJOR_SHARE_PCT) return 'major';
  if (sharePct < MINOR_SHARE_PCT) return 'minor';
  return 'normal';
}

/** Major airlines get their band effects (good and bad) multiplied by 1.5. */
export function effectMultiplier(rel: AirlineRelation): number {
  return rel.shareClass === 'major' ? 1.5 : 1;
}

export function updateShares(core: EngineCore): void {
  const signed = signedRelations(core);
  const supplied = core.ctx.shares;
  const totalEma = signed.reduce((s, r) => s + r.flightsEma, 0);
  for (const rel of allRelations(core)) {
    if (rel.status !== 'signed') {
      rel.sharePct = 0;
      rel.shareClass = 'minor';
      continue;
    }
    let pct: number;
    if (supplied && supplied[rel.id] !== undefined) pct = supplied[rel.id];
    else if (totalEma > 0) pct = (rel.flightsEma / totalEma) * 100;
    else pct = 100 / Math.max(1, signed.length);
    rel.sharePct = pct;
    rel.shareClass = shareClassOf(pct);
  }
}

function traitsConflict(a: AirlineRelation, b: AirlineRelation): boolean {
  return HOSTILE_TRAIT_PAIRS.some(
    ([x, y]) =>
      (a.traits.includes(x) && b.traits.includes(y)) || (a.traits.includes(y) && b.traits.includes(x))
  );
}

/** Direct competitors: same tier and kind, overlapping passenger type, interests or clashing traits. */
export function rivalScore(a: AirlineRelation, b: AirlineRelation): number {
  if (a.id === b.id || a.tier !== b.tier || a.kind !== b.kind) return 0;
  let score = 0;
  if (a.passengerType === b.passengerType) score += 1;
  if (a.interests[0] === b.interests[0]) score += 1;
  const shared = a.interests.filter((i) => b.interests.includes(i)).length;
  if (shared >= 2) score += 1;
  if (traitsConflict(a, b)) score += 1;
  return score;
}

export function rivalsOf(core: EngineCore, rel: AirlineRelation): AirlineRelation[] {
  return allRelations(core).filter(
    (o) => (o.status === 'signed' || o.status === 'prospect') && rivalScore(rel, o) >= 2
  );
}

export function alliesOf(core: EngineCore, rel: AirlineRelation): AirlineRelation[] {
  if (!rel.allianceId) return [];
  const alliance = core.state.alliances.find((a) => a.id === rel.allianceId);
  if (!alliance || !alliance.active) return [];
  return alliance.members
    .filter((id) => id !== rel.id)
    .map((id) => core.state.relations[id])
    .filter((r) => r && (r.status === 'signed' || r.status === 'prospect'));
}

export function agendaBias(core: EngineCore, rel: AirlineRelation): { bias: number; label: string | null } {
  if (!rel.keyFigure || rel.status === 'locked') return { bias: 0, label: null };
  const agenda = rel.keyFigure.agenda;
  const label = AGENDAS[agenda].label;
  switch (agenda) {
    case 'never_second':
    case 'biggest_everywhere': {
      if (rel.status !== 'signed') return { bias: 0, label };
      const bigger = signedRelations(core).some(
        (o) => o.id !== rel.id && o.tier === rel.tier && o.sharePct > rel.sharePct
      );
      return { bias: bigger ? -4 : 2, label };
    }
    case 'loyal_partner': {
      const signed = rel.contract ? core.state.day - rel.contract.signedDay : 0;
      return { bias: rel.status === 'signed' && signed > core.state.config.yearDays ? 3 : 0, label };
    }
    case 'cost_cutter': {
      const fee = core.ctx.metrics.feeIndex ?? core.state.feeIndex;
      return { bias: -clamp((fee - 1) / 0.05, 0, 4), label };
    }
  }
}

export function breakdownFor(core: EngineCore, rel: AirlineRelation): StandingBreakdown {
  const { bias, label } = agendaBias(core, rel);
  return computeBreakdown({
    relation: rel,
    day: core.state.day,
    metrics: { feeIndex: core.state.feeIndex, ...core.ctx.metrics },
    agendaBias: bias,
    agendaLabel: label
  });
}

export interface BandChange {
  from: Band;
  to: Band;
}

/** Recompute standing and band for one airline. Emits a band event when the band changes. */
export function evaluate(core: EngineCore, rel: AirlineRelation, announce = true): BandChange | null {
  const breakdown = breakdownFor(core, rel);
  rel.prevStanding = rel.standing;
  rel.standing = breakdown.value;
  const from = rel.band;
  const to = breakdown.band;
  rel.band = to;
  if (from === to) return null;
  if (announce && rel.status === 'signed') {
    const better = bandIndex(to) > bandIndex(from);
    emit(
      core,
      'standing_band',
      rel.id,
      `${rel.name} is now ${to} (${breakdown.formula}).`,
      better ? 'good' : 'warn',
      { from, to, standing: Math.round(rel.standing) }
    );
  }
  return { from, to };
}

export function setBandFor(rel: AirlineRelation, value: number): Band {
  rel.band = bandWithHysteresis(value, rel.band);
  return rel.band;
}

export interface BandEffects {
  /** Share of normal flights the airline operates (Capacity Cut lowers it). */
  flightsFactor: number;
  newFlightsOffered: boolean;
  priceUpliftPct: number;
  extraStarOffers: number;
  demandSharpness: number;
}

export function bandEffects(rel: AirlineRelation): BandEffects {
  const mult = effectMultiplier(rel);
  const minor = rel.shareClass === 'minor';
  const base: BandEffects = {
    flightsFactor: rel.capacityFactor,
    newFlightsOffered: true,
    priceUpliftPct: 0,
    extraStarOffers: 0,
    demandSharpness: 1
  };
  switch (rel.band) {
    case 'hostile':
      return { ...base, newFlightsOffered: false, demandSharpness: 1.5 * mult };
    case 'cold':
      return { ...base, newFlightsOffered: false, demandSharpness: 1.25 * mult };
    case 'neutral':
      return base;
    case 'warm':
      return {
        ...base,
        flightsFactor: rel.capacityFactor * (1 + 0.1 * mult),
        priceUpliftPct: minor ? 0 : 5 * mult,
        extraStarOffers: minor ? 0 : 1
      };
    case 'partner':
      return {
        ...base,
        flightsFactor: rel.capacityFactor * (1 + 0.2 * mult),
        priceUpliftPct: minor ? 0 : 10 * mult,
        extraStarOffers: minor ? 0 : 1
      };
  }
}

export function computePerks(rel: AirlineRelation): string[] {
  if (rel.status !== 'signed' || rel.shareClass === 'minor') return [];
  const perks: string[] = [];
  if (bandIndex(rel.band) >= bandIndex('warm')) perks.push('price_uplift', 'higher_star_offers');
  if (rel.band === 'partner') {
    perks.push('marketing_push', 'free_favour', 'vouch', 'branded_lounge', 'base_eligible');
    if (rel.tier >= 3) perks.push('hub_eligible');
  }
  return perks;
}

export function refreshPerks(core: EngineCore, rel: AirlineRelation): void {
  const next = computePerks(rel);
  const changed = next.length !== rel.perks.length || next.some((p, i) => p !== rel.perks[i]);
  rel.perks = next;
  if (changed && rel.status === 'signed') {
    emit(core, 'perks_changed', rel.id, `${rel.name} perks: ${next.length ? next.join(', ') : 'none'}.`, 'info');
  }
}

/** Giving a perk, exclusive or peak slots to one airline irritates its direct rivals. */
export function penalizeRivalsForPerk(
  core: EngineCore,
  rel: AirlineRelation,
  kind: 'perk_rival' | 'slot_rival',
  why: string
): void {
  for (const rival of rivalsOf(core, rel)) {
    if (rival.status !== 'signed') continue;
    addModifier(core, rival, kind, `${rel.name}: ${why}`, rel.id);
    evaluate(core, rival, false);
  }
}
