import {
  ERA_CARRY_FRACTION,
  ERA_CARRY_MONTHS,
  FAVOUR_CAP,
  FAVOUR_EXPIRY_DAYS,
  FEE_CUT_CAP,
  FEE_CUT_PER_PCT,
  FEE_RISE_PER_PCT,
  INTEREST_GAP,
  MONTH_DAYS,
  clamp
} from './constants.ts';
import {
  addModifier,
  allRelations,
  currentYear,
  emit,
  newId,
  remember,
  signedRelations,
  spend,
  tierCost
} from './core.ts';
import type { EngineCore } from './core.ts';
import { createPromise } from './demands.ts';
import { TRAITS } from './data.ts';
import { hashString, nextFloat } from './rng.ts';
import { alliesOf, evaluate, rivalsOf } from './relations.ts';
import { modifierCurrent } from './standing.ts';
import type {
  ActionResult,
  AirlineRelation,
  TraitId
} from './types.ts';

export type FirstMeetChoice = 'formal' | 'warm' | 'bold' | 'tour';

const AFFINITY: Record<'formal' | 'warm' | 'bold', Partial<Record<TraitId, number>>> = {
  formal: { proud: 2, punctual: 2, hardball: 1, showman: -1 },
  warm: { patient: 2, green: 1, proud: -1, hardball: -1 },
  bold: { showman: 2, hardball: 1, lavish: 1, patient: -2, green: -1 }
};
const BASE_TONE = { formal: 3, warm: 4, bold: 2 };

export interface FirstMeetScene {
  airlineId: string;
  greeting: string[];
  heard: string;
  choices: FirstMeetChoice[];
}

export function firstMeetScene(core: EngineCore, airlineId: string): FirstMeetScene | null {
  const rel = core.state.relations[airlineId];
  if (!rel || !rel.keyFigure || rel.firstMeetDone) return null;
  const kf = rel.keyFigure;
  const onTime = core.ctx.metrics.onTimePct;
  const traitText = kf.traits.map((t) => TRAITS[t].label.toLowerCase()).join(' and ');
  return {
    airlineId,
    greeting: [`${kf.name}, ${kf.title} of ${rel.name}: "${TRAITS[kf.traits[0]].flavour}"`, `Known to be ${traitText}.`],
    heard: onTime !== undefined ? `What they've heard: your on-time rate is ${Math.round(onTime)}%.` : "What they've heard: you are new to the circuit.",
    choices: ['formal', 'warm', 'bold', 'tour']
  };
}

export function resolveFirstMeet(core: EngineCore, airlineId: string, choice: FirstMeetChoice): ActionResult {
  const rel = core.state.relations[airlineId];
  if (!rel || !rel.keyFigure) return { ok: false, cost: 0, message: 'No key figure to meet.' };
  if (rel.firstMeetDone) return { ok: false, cost: 0, message: 'Already met.' };
  const kf = rel.keyFigure;
  let tone: number;
  let liked: TraitId | null = null;
  if (choice === 'tour') {
    const top = rel.interests[0];
    const def = INTEREST_GAP[top];
    const value = core.ctx.metrics[def.metric] ?? (def.metric === 'feeIndex' ? core.state.feeIndex : 0);
    const fit = 1 - def.gap(value);
    tone = Math.round(-5 + 15 * fit);
  } else {
    const affinity = AFFINITY[choice];
    let sum = BASE_TONE[choice];
    for (const t of kf.traits) {
      const a = affinity[t] ?? 0;
      sum += a;
      if (a > 0 && !liked) liked = t;
    }
    const voiceMatch =
      (choice === 'formal' && kf.voice === 'formal') ||
      (choice === 'warm' && kf.voice === 'warm') ||
      (choice === 'bold' && (kf.voice === 'flamboyant' || kf.voice === 'blunt'));
    if (voiceMatch) sum += 1;
    tone = clamp(sum, -5, 8);
  }
  rel.firstMeetDone = true;
  addModifier(core, rel, 'first_meet', `First meeting (${choice})`, 'first-meet', { value: tone, months: 24 });
  let promiseText = '';
  if (choice === 'bold') {
    const promise = createPromise(core, rel, hashString(rel.id) % 2);
    promiseText = ` Promise: ${promise.text}.`;
  }
  evaluate(core, rel, false);
  const first = kf.name.split(' ')[0];
  const sign = tone >= 0 ? `+${tone}` : `${tone}`;
  const label = choice === 'tour' ? 'Show them around' : choice.charAt(0).toUpperCase() + choice.slice(1);
  const likedText = liked ? `, ${TRAITS[liked].label} liked it` : '';
  const toast = `${first}: ${sign} (${label}${likedText})${promiseText}`;
  remember(rel, `We met at your field and you chose a ${choice} welcome.`);
  emit(core, 'info', rel.id, toast, tone >= 0 ? 'good' : 'warn', { tone });
  return { ok: true, cost: 0, message: toast, data: { tone } };
}

export interface EndeavorPreview {
  cost: number;
  pSupport: number;
  pAccept: number;
  pReject: number;
}

export function endeavorPreview(core: EngineCore, airlineId: string): EndeavorPreview | null {
  const rel = core.state.relations[airlineId];
  if (!rel) return null;
  const x = (rel.standing + 100) / 200;
  const pSupport = 0.5 * x * x;
  const pReject = 0.5 * (1 - x) * (1 - x);
  return { cost: tierCost(rel.tier), pSupport, pAccept: 1 - pSupport - pReject, pReject };
}

/** Joint project: accepted +5, supported +12 (airline co-funds 40%), rejected refunds half. */
export function startEndeavor(core: EngineCore, airlineId: string): ActionResult {
  const rel = core.state.relations[airlineId];
  if (!rel || rel.status !== 'signed') return { ok: false, cost: 0, message: 'Only signed airlines run endeavors.' };
  const preview = endeavorPreview(core, airlineId);
  if (!preview) return { ok: false, cost: 0, message: 'Unknown airline.' };
  if (!spend(core, preview.cost, 'diplomacy', `Endeavor with ${rel.name}`)) {
    return { ok: false, cost: 0, message: 'Cannot afford the endeavor.' };
  }
  const roll = nextFloat(core.state);
  if (roll < preview.pSupport) {
    addModifier(core, rel, 'endeavor_supported', 'Joint endeavor, airline co-funded', 'endeavor');
    core.host.charge(-Math.round(preview.cost * 0.4), 'diplomacy', `${rel.name} co-funds endeavor`);
    evaluate(core, rel);
    return { ok: true, cost: preview.cost, message: `${rel.name} supports the endeavor (+12).`, data: { stance: 'support' } };
  }
  if (roll < preview.pSupport + preview.pAccept) {
    addModifier(core, rel, 'endeavor_accepted', 'Joint endeavor agreed', 'endeavor');
    evaluate(core, rel);
    return { ok: true, cost: preview.cost, message: `${rel.name} accepts the endeavor (+5).`, data: { stance: 'accept' } };
  }
  core.host.charge(-Math.round(preview.cost * 0.5), 'diplomacy', `Refund, ${rel.name} declined endeavor`);
  return { ok: false, cost: preview.cost, message: `${rel.name} rejects the endeavor; half is refunded.`, data: { stance: 'reject' } };
}

/** Published scheme for a whole tier (non-discriminatory, like FAA incentive policy). */
export function launchIncentiveDeal(core: EngineCore, tier: number, discountPct: number, days: number): ActionResult {
  const state = core.state;
  if (tier < 1 || tier > state.highestTier) return { ok: false, cost: 0, message: 'That tier is not unlocked.' };
  const pct = clamp(discountPct, 5, 30);
  if (state.incentiveDeals.some((d) => d.tier === tier && d.endDay > state.day)) {
    return { ok: false, cost: 0, message: 'This tier already has an incentive deal running.' };
  }
  const cost = Math.round(tierCost(tier));
  if (!spend(core, cost, 'diplomacy', `Incentive deal, tier ${tier}`)) {
    return { ok: false, cost: 0, message: 'Cannot afford the incentive deal.' };
  }
  const deal = { id: newId(core, 'deal'), tier: tier as 1 | 2 | 3 | 4 | 5, discountPct: pct, startDay: state.day, endDay: state.day + days };
  state.incentiveDeals.push(deal);
  for (const rel of allRelations(core)) {
    if (rel.tier !== tier || (rel.status !== 'signed' && rel.status !== 'prospect')) continue;
    addModifier(core, rel, 'incentive', `Tier ${tier} incentive deal (${pct}% off)`, deal.id);
    evaluate(core, rel);
  }
  emit(core, 'info', null, `Incentive deal: ${pct}% off for every tier ${tier} airline for ${Math.round(days / MONTH_DAYS)} months.`, 'info');
  return { ok: true, cost, message: `Incentive deal published for tier ${tier}.` };
}

/** Current fee discount (0..100) an airline enjoys from its contract and any tier incentive deal. */
export function feeDiscountPct(core: EngineCore, rel: AirlineRelation): number {
  let pct = 0;
  const c = rel.contract;
  if (c && c.discountPct > 0 && core.state.day < c.discountEndDay) pct = c.discountPct;
  for (const d of core.state.incentiveDeals) {
    if (d.tier === rel.tier && d.endDay > core.state.day) pct = Math.max(pct, d.discountPct);
  }
  return pct;
}

/** Apology package: fee discount for 90 days, +8 (2nd in a year +4, no 3rd). */
export function apologize(core: EngineCore, airlineId: string): ActionResult {
  const rel = core.state.relations[airlineId];
  if (!rel || rel.status !== 'signed' || !rel.contract) return { ok: false, cost: 0, message: 'Only signed airlines accept an apology package.' };
  const year = core.state.config.yearDays;
  rel.apologyDays = rel.apologyDays.filter((d) => core.state.day - d < year);
  if (rel.apologyDays.length >= 2) return { ok: false, cost: 0, message: 'No third apology in a year.' };
  const cost = Math.round(tierCost(rel.tier) * 0.5);
  if (!spend(core, cost, 'diplomacy', `Apology package, ${rel.name}`)) {
    return { ok: false, cost: 0, message: 'Cannot afford the apology package.' };
  }
  const value = rel.apologyDays.length === 0 ? 8 : 4;
  rel.apologyDays.push(core.state.day);
  addModifier(core, rel, 'apology', 'Apology package', 'apology', { value, months: 6 });
  const c = rel.contract;
  c.discountPct = Math.max(core.state.day < c.discountEndDay ? c.discountPct : 0, 10);
  c.discountEndDay = Math.max(c.discountEndDay, core.state.day + 90);
  evaluate(core, rel);
  return { ok: true, cost, message: `Apology accepted (+${value}).`, data: { value } };
}

/** Mediation by a Partner ally: +5, costs a fee. One per target per six months. */
export function mediate(core: EngineCore, targetId: string, mediatorId: string): ActionResult {
  const target = core.state.relations[targetId];
  const mediator = core.state.relations[mediatorId];
  if (!target || !mediator || target.status !== 'signed' || mediator.status !== 'signed') {
    return { ok: false, cost: 0, message: 'Both airlines must be signed.' };
  }
  if (mediator.band !== 'partner') return { ok: false, cost: 0, message: 'The mediator must be a Partner.' };
  if (!alliesOf(core, target).some((a) => a.id === mediator.id)) {
    return { ok: false, cost: 0, message: 'The mediator must be allied with the target.' };
  }
  const recent = target.modifiers.some(
    (m) => m.kind === 'mediation' && core.state.day - m.startDay < 6 * MONTH_DAYS
  );
  if (recent) return { ok: false, cost: 0, message: 'Mediation was tried recently.' };
  const cost = Math.round(tierCost(target.tier) * 0.8);
  if (!spend(core, cost, 'diplomacy', `Mediation fee, ${target.name}`)) {
    return { ok: false, cost: 0, message: 'Cannot afford the mediation fee.' };
  }
  addModifier(core, target, 'mediation', `${mediator.name} mediated for you`, mediator.id);
  evaluate(core, target);
  return { ok: true, cost, message: `${mediator.name} mediates (+5).` };
}

/** Partner perk: an allied Partner vouches for you once a year (+5), free. */
export function vouch(core: EngineCore, mediatorId: string, targetId: string): ActionResult {
  const mediator = core.state.relations[mediatorId];
  const target = core.state.relations[targetId];
  if (!mediator || !target || mediator.status !== 'signed' || target.status === 'locked' || target.status === 'former') {
    return { ok: false, cost: 0, message: 'Invalid vouch.' };
  }
  if (!mediator.perks.includes('vouch')) return { ok: false, cost: 0, message: 'The airline does not offer Vouch.' };
  if (target.id === mediator.id) return { ok: false, cost: 0, message: 'Cannot vouch for itself.' };
  const known = alliesOf(core, mediator).some((a) => a.id === target.id);
  if (!known) return { ok: false, cost: 0, message: 'Vouch only reaches the mediator\u2019s alliance partners.' };
  if (target.modifiers.some((m) => m.kind === 'vouch' && m.source === mediator.id && core.state.day - m.startDay < core.state.config.yearDays)) {
    return { ok: false, cost: 0, message: 'Already vouched this year.' };
  }
  addModifier(core, target, 'vouch', `${mediator.name} vouches for you`, mediator.id);
  evaluate(core, target);
  return { ok: true, cost: 0, message: `${mediator.name} vouches for you (+5).` };
}

export function hubBlockers(core: EngineCore, airlineId: string): string[] {
  const rel = core.state.relations[airlineId];
  const out: string[] = [];
  if (!rel || rel.status !== 'signed') return ['Airline is not signed.'];
  if (core.state.hubAirlineId && core.state.hubAirlineId !== rel.id) {
    out.push(`${core.state.relations[core.state.hubAirlineId].name} is already the Hub (one at a time).`);
  }
  if (rel.isHub) out.push('Already the Hub.');
  if (rel.band !== 'partner') out.push('Standing must be Partner.');
  if (rel.tier < 3) out.push('Hub needs a tier 3 or higher airline.');
  if (rel.shareClass === 'minor') out.push('Airline is too small (Minor share).');
  if (!rel.isBase) out.push('The airline must be a Base first.');
  if ((core.ctx.metrics.hubDepartures ?? 0) < 2) out.push('Needs at least 2 daily departures year-round.');
  if ((core.ctx.metrics.maintenanceLevel ?? 0) < 2) out.push('Needs maintenance level 2.');
  return out;
}

export function hubCost(rel: AirlineRelation): number {
  return tierCost(rel.tier) * 4;
}

export function requestHub(core: EngineCore, airlineId: string): ActionResult {
  const blockers = hubBlockers(core, airlineId);
  if (blockers.length > 0) return { ok: false, cost: 0, message: blockers.join(' ') };
  const rel = core.state.relations[airlineId];
  const cost = hubCost(rel);
  if (!spend(core, cost, 'diplomacy', `Hub contract, ${rel.name}`)) {
    return { ok: false, cost: 0, message: 'Cannot afford the Hub contract.' };
  }
  rel.isHub = true;
  core.state.hubAirlineId = rel.id;
  rel.flightsEma *= 1.25;
  const allies = new Set(alliesOf(core, rel).map((a) => a.id));
  for (const rival of rivalsOf(core, rel)) {
    if (allies.has(rival.id)) continue;
    addModifier(core, rival, 'hub_rival', `${rel.name} became the Hub`, rel.id);
    evaluate(core, rival);
  }
  emit(core, 'hub_granted', rel.id, `${rel.name} is the Hub airline.`, 'good');
  return { ok: true, cost, message: `${rel.name} is now the Hub.` };
}

export function revokeHub(core: EngineCore, why: string): void {
  const id = core.state.hubAirlineId;
  if (!id) return;
  const rel = core.state.relations[id];
  core.state.hubAirlineId = null;
  if (rel) {
    rel.isHub = false;
    emit(core, 'hub_revoked', rel.id, `${rel.name} loses Hub status (${why}).`, 'warn');
  }
}

/** Base and Hub perks revoke once Warm is lost (band hysteresis already adds the 5-point buffer). */
export function enforcePerks(core: EngineCore, rel: AirlineRelation): void {
  const warmOk = rel.band === 'warm' || rel.band === 'partner';
  if (warmOk) return;
  if (rel.isHub) revokeHub(core, 'standing fell');
  if (rel.isBase) {
    rel.isBase = false;
    if (rel.contract) rel.contract.baseGranted = false;
    emit(core, 'perks_changed', rel.id, `${rel.name} withdraws its Base.`, 'warn');
  }
}

export function grantYearlyFavours(core: EngineCore): void {
  const year = currentYear(core);
  for (const rel of signedRelations(core)) {
    rel.favours = rel.favours.filter((f) => core.state.day - f.grantedDay < FAVOUR_EXPIRY_DAYS);
    if (rel.perks.includes('free_favour') && rel.freeFavourYear !== year && rel.favours.length < FAVOUR_CAP) {
      rel.favours.push({ grantedDay: core.state.day, reason: 'Partner perk: yearly Favour' });
      rel.freeFavourYear = year;
    }
  }
}

/** Leverage is rare: exclusivity (sole Base in its region) or slot dominance (>= 40% share). */
export function refreshLeverage(core: EngineCore): void {
  const signed = signedRelations(core);
  for (const rel of signed) {
    if (rel.leverage >= 1) continue;
    const exclusive = rel.isBase && !signed.some((o) => o.id !== rel.id && o.region === rel.region);
    const dominant = rel.sharePct >= 40 && signed.length >= 3;
    if ((exclusive || dominant) && core.state.day - rel.lastLeverageDay >= core.state.config.yearDays) {
      rel.leverage = 1;
      rel.lastLeverageDay = core.state.day;
    }
  }
}

/** Tier-up "era reset": all modifiers collapse into one carry-over worth 30% of their sum. */
export function eraReset(core: EngineCore, tier: number): void {
  for (const rel of allRelations(core)) {
    if (rel.status === 'locked' || rel.modifiers.length === 0) continue;
    const sum = rel.modifiers.reduce((s, m) => s + modifierCurrent(m, core.state.day), 0);
    rel.modifiers = [];
    if (Math.abs(sum) >= 0.5) {
      addModifier(core, rel, 'era_carry', `Carry-over from earlier years (tier ${tier})`, 'era-reset', {
        value: sum * ERA_CARRY_FRACTION,
        months: ERA_CARRY_MONTHS
      });
    }
  }
  emit(core, 'era_reset', null, `Tier ${tier} reached: old grudges and favours fade to 30%.`, 'info', { tier });
}

/** Called by the host when the landing/passenger fee index changes (1.0 is baseline). */
export function applyFeeChange(core: EngineCore, newIndex: number): { pct: number } {
  const old = core.state.feeIndex;
  core.state.feeIndex = newIndex;
  if (old <= 0 || newIndex === old) return { pct: 0 };
  const pct = ((newIndex - old) / old) * 100;
  if (pct > 0) core.state.feeRiseLog.push(core.state.day);
  for (const rel of signedRelations(core)) {
    const sensitive = rel.interests[0] === 'cost' || rel.traits.includes('frugal') ? 1.5 : 1;
    if (pct > 0) {
      addModifier(core, rel, 'fee_rise', `Fee rise of ${pct.toFixed(1)}%`, 'fees', {
        value: Math.max(-30, FEE_RISE_PER_PCT * pct * sensitive),
        showMe: 'fees'
      });
    } else {
      addModifier(core, rel, 'fee_cut', `Fee cut of ${Math.abs(pct).toFixed(1)}%`, 'fees', {
        value: Math.min(FEE_CUT_CAP, FEE_CUT_PER_PCT * Math.abs(pct))
      });
    }
    evaluate(core, rel);
  }
  return { pct };
}
