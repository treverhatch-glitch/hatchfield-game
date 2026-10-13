import {
  DEMAND_CHECK_DAYS,
  DEMAND_GLOBAL_COOLDOWN_DAYS,
  DEMAND_PRESSURE_THRESHOLD,
  FAVOUR_CAP,
  INTEREST_GAP,
  INTEREST_WEIGHTS,
  MAX_OPEN_DEMANDS,
  clamp
} from './constants.ts';
import {
  addModifier,
  emit,
  newId,
  remember,
  signedRelations,
  spend,
  tierCost
} from './core.ts';
import type { EngineCore } from './core.ts';
import { DEMAND_TEMPLATES, PROMISE_PITCHES } from './data.ts';
import { composeLetter } from './generator.ts';
import { nextFloat } from './rng.ts';
import { rivalsOf, alliesOf } from './relations.ts';
import type {
  ActionResult,
  AirlineRelation,
  Commitment,
  Interest,
  MetricKey,
  RivalStance
} from './types.ts';

export function metricValue(core: EngineCore, key: MetricKey): number {
  const supplied = core.ctx.metrics[key];
  if (supplied !== undefined) return supplied;
  if (key === 'feeIndex') return core.state.feeIndex;
  if (key === 'incentiveDealActive') {
    return core.state.incentiveDeals.some((d) => d.endDay > core.state.day) ? 1 : 0;
  }
  return 0;
}

export function isSatisfied(c: Commitment, value: number): boolean {
  return c.compare === 'gte' ? value >= c.target : value <= c.target;
}

/** 0..1 numeric progress bar for a demand or promise. */
export function commitmentProgress(c: Commitment, value: number): number {
  const ok = isSatisfied(c, value);
  if (c.holdDays > 0) return ok ? clamp(c.heldDays / c.holdDays, 0, 1) : 0;
  if (ok) return 1;
  if (c.compare === 'gte') {
    const start = Math.min(c.baseline, c.target);
    const denom = c.target - start;
    return denom <= 0 ? 0 : clamp((value - start) / denom, 0, 1);
  }
  return value <= 0 ? 1 : clamp(c.target / value, 0, 1);
}

export function openCommitmentOf(core: EngineCore, airlineId: string): Commitment | null {
  return core.state.commitments.find((c) => c.airlineId === airlineId) ?? null;
}

function hardballFactor(rel: AirlineRelation): number {
  return rel.traits.includes('hardball') ? 1.5 : 1;
}

function removeCommitment(core: EngineCore, id: string): void {
  core.state.commitments = core.state.commitments.filter((c) => c.id !== id);
}

export function counterChance(rel: AirlineRelation): number {
  return clamp(0.4 + rel.standing / 250 - (rel.traits.includes('hardball') ? 0.1 : 0), 0.1, 0.9);
}

function maxDemandsFor(rel: AirlineRelation): number {
  return rel.shareClass === 'major' ? 2 : 1;
}

function resolveMet(core: EngineCore, c: Commitment, rel: AirlineRelation): void {
  removeCommitment(core, c.id);
  if (c.kind === 'promise') {
    addModifier(core, rel, 'promise_kept', `Promise kept: ${c.text}`, c.id);
    emit(core, 'promise_kept', rel.id, `${rel.name}: promise kept (${c.text}).`, 'good');
    remember(rel, `You kept your word: ${c.text}.`);
    return;
  }
  addModifier(core, rel, 'demand_met', `Demand met: ${c.text}`, c.id, { value: c.rewardS });
  remember(rel, `You met our request: ${c.text}.`);
  if (c.costly && rel.favours.length < FAVOUR_CAP) {
    rel.favours.push({ grantedDay: core.state.day, reason: `Accepted costly ask: ${c.text}` });
  }
  emit(core, 'demand_met', rel.id, `${rel.name}: demand met (${c.text}).`, 'good', { reward: c.rewardS });
  for (const [rivalId, stance] of Object.entries(c.rivalStances)) {
    const rival = core.state.relations[rivalId];
    if (!rival || rival.status === 'former' || rival.status === 'locked') continue;
    if (stance === 'oppose') {
      addModifier(core, rival, 'compliance', `Compliance with ${rel.name}'s demand`, c.id, { value: -5, months: 6 });
    } else if (stance === 'back') {
      addModifier(core, rival, 'compliance', `Backed ${rel.name}'s demand`, c.id, { value: 3, months: 6 });
    }
  }
  for (const ally of alliesOf(core, rel)) {
    addModifier(core, ally, 'signed_ally', `Ally ${rel.name} got its way`, c.id, { value: 4, months: 12 });
  }
}

function resolveTimeout(core: EngineCore, c: Commitment, rel: AirlineRelation): void {
  removeCommitment(core, c.id);
  if (c.kind === 'promise') {
    addModifier(core, rel, 'promise_broken', `Promise broken: ${c.text}`, c.id);
    emit(core, 'promise_broken', rel.id, `${rel.name}: promise broken (${c.text}).`, 'bad');
    remember(rel, `You broke a promise: ${c.text}.`);
    return;
  }
  addModifier(core, rel, 'demand_timeout', `Demand timed out: ${c.text}`, c.id, { value: -c.penaltyS });
  emit(core, 'demand_timeout', rel.id, `${rel.name}: demand timed out (${c.text}).`, 'bad', { penalty: c.penaltyS });
  remember(rel, `You let our request lapse: ${c.text}.`);
}

/** Advance live demands and promises by whole days. */
export function tickCommitments(core: EngineCore, dtDays: number): void {
  for (const c of [...core.state.commitments]) {
    const rel = core.state.relations[c.airlineId];
    if (!rel || rel.status !== 'signed') {
      removeCommitment(core, c.id);
      continue;
    }
    const value = metricValue(core, c.metric);
    if (isSatisfied(c, value)) c.heldDays += dtDays;
    else c.heldDays = 0;
    c.progress = commitmentProgress(c, value);
    if (isSatisfied(c, value) && c.heldDays >= c.holdDays) {
      resolveMet(core, c, rel);
      continue;
    }
    if (core.state.day >= c.deadlineDay) {
      if (c.timeoutWaived) {
        removeCommitment(core, c.id);
        continue;
      }
      resolveTimeout(core, c, rel);
    }
  }
}

function pickRivalStances(core: EngineCore, rel: AirlineRelation): Record<string, RivalStance> {
  const out: Record<string, RivalStance> = {};
  for (const rival of rivalsOf(core, rel)) {
    if (rival.status !== 'signed') continue;
    const roll = nextFloat(core.state);
    out[rival.id] = roll < 0.25 ? 'back' : roll < 0.6 ? 'oppose' : 'ignore';
  }
  return out;
}

/** Per-interest pressure = weight x gap between the airport and the interest's target metric. */
export function pressureFor(core: EngineCore, rel: AirlineRelation): { interest: Interest; pressure: number }[] {
  return rel.interests.map((interest, i) => {
    const def = INTEREST_GAP[interest];
    const value = core.ctx.metrics[def.metric] ?? (def.metric === 'feeIndex' ? core.state.feeIndex : 0);
    return { interest, pressure: INTEREST_WEIGHTS[i] * def.gap(value) };
  });
}

export function maybeIssueDemand(core: EngineCore): Commitment | null {
  const state = core.state;
  if (state.day - state.lastDemandCheckDay < DEMAND_CHECK_DAYS) return null;
  state.lastDemandCheckDay = state.day;
  if (state.commitments.filter((c) => c.kind === 'demand').length >= MAX_OPEN_DEMANDS) return null;
  if (state.day - state.lastDemandIssuedDay < DEMAND_GLOBAL_COOLDOWN_DAYS) return null;

  let best: { rel: AirlineRelation; interest: Interest; pressure: number } | null = null;
  for (const rel of signedRelations(core)) {
    if (rel.shareClass === 'minor' || rel.stage === 'exit_notice') continue;
    const open = state.commitments.filter((c) => c.airlineId === rel.id && c.kind === 'demand').length;
    if (open >= maxDemandsFor(rel)) continue;
    for (const p of pressureFor(core, rel)) {
      if (p.pressure <= DEMAND_PRESSURE_THRESHOLD) continue;
      if (!best || p.pressure > best.pressure) best = { rel, interest: p.interest, pressure: p.pressure };
    }
  }
  if (!best) return null;

  const { rel, interest } = best;
  const templates = DEMAND_TEMPLATES.filter(
    (t) => t.interest === interest && t.tierMin <= rel.tier && rel.tier <= t.tierMax
  );
  for (const template of templates) {
    if (template.conflictTag) {
      const clash = state.commitments.some(
        (c) => c.conflictTag === template.conflictTag && c.airlineId !== rel.id
      );
      if (clash) continue;
    }
    const baseline = metricValue(core, template.metric);
    const target = template.mode === 'delta' ? baseline + template.value : template.value;
    const probe: Commitment = {
      id: '',
      airlineId: rel.id,
      kind: 'demand',
      interest,
      text: template.text,
      metric: template.metric,
      compare: template.compare,
      target,
      baseline,
      holdDays: template.holdDays,
      heldDays: 0,
      issuedDay: state.day,
      deadlineDay: 0,
      status: 'open',
      costly: template.costly,
      conflictTag: template.conflictTag ?? null,
      rivalStances: {},
      rewardS: 0,
      penaltyS: 0,
      progress: 0,
      extended: false,
      timeoutWaived: false,
      counterUsed: false
    };
    if (isSatisfied(probe, baseline) && template.holdDays === 0) continue;
    const factor = hardballFactor(rel);
    const demand: Commitment = {
      ...probe,
      id: newId(core, 'demand'),
      deadlineDay: state.day + template.deadlineDays,
      rivalStances: pickRivalStances(core, rel),
      rewardS: 15 * factor,
      penaltyS: 10 * factor,
      progress: commitmentProgress(probe, baseline)
    };
    state.commitments.push(demand);
    state.lastDemandIssuedDay = state.day;
    emit(core, 'demand_issued', rel.id, `${rel.name} asks: ${template.text}.`, 'info', {
      demandId: demand.id,
      deadlineDay: demand.deadlineDay
    });
    emit(core, 'letter', rel.id, composeLetter(rel, 'demand', template.text).join(' '), 'info');
    return demand;
  }
  return null;
}

export function respondToDemand(
  core: EngineCore,
  demandId: string,
  response: 'accept' | 'decline',
  useLeverage = false
): ActionResult {
  const c = core.state.commitments.find((x) => x.id === demandId && x.kind === 'demand');
  if (!c) return { ok: false, cost: 0, message: 'No such demand.' };
  const rel = core.state.relations[c.airlineId];
  if (c.status === 'accepted') return { ok: false, cost: 0, message: 'Already accepted.' };
  if (response === 'accept') {
    c.status = 'accepted';
    return { ok: true, cost: 0, message: `Accepted. ${rel.name} is tracking: ${c.text}.` };
  }
  if (useLeverage) {
    if (rel.leverage <= 0) return { ok: false, cost: 0, message: 'No Leverage with this airline.' };
    rel.leverage -= 1;
    removeCommitment(core, c.id);
    return { ok: true, cost: 0, message: 'Refused using Leverage; no penalty.' };
  }
  removeCommitment(core, c.id);
  addModifier(core, rel, 'demand_declined', 'Declined request politely', c.id);
  return { ok: true, cost: 0, message: 'Declined politely (-4 now, no timeout).' };
}

export function counterDemand(
  core: EngineCore,
  demandId: string,
  mode: 'lighter' | 'longer',
  payWith: 'money' | 'favour'
): ActionResult {
  const c = core.state.commitments.find((x) => x.id === demandId && x.kind === 'demand');
  if (!c) return { ok: false, cost: 0, message: 'No such demand.' };
  if (c.counterUsed) return { ok: false, cost: 0, message: 'You already countered this demand.' };
  const rel = core.state.relations[c.airlineId];
  let cost = 0;
  if (payWith === 'favour') {
    if (rel.favours.length === 0) return { ok: false, cost: 0, message: 'No Favour available.' };
  } else {
    cost = Math.round(tierCost(rel.tier) * 0.5);
    if (!spend(core, cost, 'diplomacy', `Counter-offer to ${rel.name}`)) {
      return { ok: false, cost: 0, message: 'Cannot afford the counter-offer.' };
    }
  }
  c.counterUsed = true;
  const chance = payWith === 'favour' ? 1 : counterChance(rel);
  if (payWith === 'favour') rel.favours.shift();
  if (nextFloat(core.state) >= chance) {
    addModifier(core, rel, 'counter_rejected', 'Counter-offer rejected', c.id);
    return { ok: false, cost, chance, message: `${rel.name} rejected the counter-offer.` };
  }
  if (mode === 'lighter') {
    if (c.compare === 'gte') {
      const start = Math.min(c.baseline, c.target);
      const lighter = start + (c.target - start) * 0.6;
      c.target = Number.isInteger(c.target) ? Math.ceil(lighter) : lighter;
    } else {
      c.target = c.target * 1.1;
    }
  } else {
    c.deadlineDay += Math.round((c.deadlineDay - c.issuedDay) * 0.6);
    c.extended = true;
  }
  return { ok: true, cost, chance, message: `${rel.name} accepted the counter-offer (${mode}).` };
}

/** Favour uses on a live demand: extend deadline by 50% or waive one timeout. */
export function spendFavourOnDemand(core: EngineCore, demandId: string, use: 'extend' | 'waive'): ActionResult {
  const c = core.state.commitments.find((x) => x.id === demandId);
  if (!c) return { ok: false, cost: 0, message: 'No such demand.' };
  const rel = core.state.relations[c.airlineId];
  if (rel.favours.length === 0) return { ok: false, cost: 0, message: 'No Favour available.' };
  if (use === 'extend') {
    if (c.extended) return { ok: false, cost: 0, message: 'Deadline already extended.' };
    c.deadlineDay += Math.round((c.deadlineDay - c.issuedDay) * 0.5);
    c.extended = true;
  } else {
    if (c.timeoutWaived) return { ok: false, cost: 0, message: 'Timeout already waived.' };
    c.timeoutWaived = true;
  }
  rel.favours.shift();
  return { ok: true, cost: 0, message: use === 'extend' ? 'Deadline extended by 50%.' : 'Timeout waived.' };
}

export function createPromise(core: EngineCore, rel: AirlineRelation, pitchIndex: number): Commitment {
  const pitch = PROMISE_PITCHES[pitchIndex % PROMISE_PITCHES.length];
  const baseline = metricValue(core, pitch.metric);
  const promise: Commitment = {
    id: newId(core, 'promise'),
    airlineId: rel.id,
    kind: 'promise',
    interest: null,
    text: pitch.text,
    metric: pitch.metric,
    compare: pitch.compare,
    target: pitch.value,
    baseline,
    holdDays: pitch.holdDays,
    heldDays: 0,
    issuedDay: core.state.day,
    deadlineDay: core.state.day + pitch.days,
    status: 'accepted',
    costly: false,
    conflictTag: null,
    rivalStances: {},
    rewardS: 10,
    penaltyS: 15,
    progress: 0,
    extended: false,
    timeoutWaived: false,
    counterUsed: false
  };
  core.state.commitments.push(promise);
  return promise;
}
