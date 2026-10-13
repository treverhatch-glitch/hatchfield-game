import {
  CAPACITY_CUT_FACTOR,
  MONTH_DAYS,
  SPAT_FADE_DAYS,
  SPAT_REPUTATION_PER_MONTH,
  clamp
} from './constants.ts';
import {
  addModifier,
  allRelations,
  emit,
  newId,
  signedRelations,
  spend,
  tierCost
} from './core.ts';
import type { EngineCore } from './core.ts';
import { composeLetter } from './generator.ts';
import { nextFloat, pick } from './rng.ts';
import { applyFeeChange } from './actions.ts';
import { evaluate, effectMultiplier, rivalsOf } from './relations.ts';
import { bandIndex, modifierCurrent } from './standing.ts';
import { exitAirline, exitsInCurrentYear, openSlotPool } from './departure.ts';
import type {
  ActionResult,
  AirlineRelation,
  HostileAction,
  HostileActionKind,
  OperationalEffects,
  Spat
} from './types.ts';

function hasActiveFeeRise(core: EngineCore, rel: AirlineRelation): boolean {
  return rel.modifiers.some((m) => m.kind === 'fee_rise' && modifierCurrent(m, core.state.day) <= -1);
}

export function tickSpats(core: EngineCore): void {
  const state = core.state;
  for (const rel of signedRelations(core)) {
    if (rel.shareClass !== 'major' || bandIndex(rel.band) > bandIndex('cold')) continue;
    if (!hasActiveFeeRise(core, rel)) continue;
    const recent = state.spats.some(
      (s) => s.airlineId === rel.id && (!s.resolved || (s.resolvedDay ?? 0) > state.day - 120)
    );
    if (recent) continue;
    const offers = rivalsOf(core, rel)
      .filter((r) => r.status === 'signed' && bandIndex(r.band) >= bandIndex('neutral'))
      .map((r) => r.id);
    const spat: Spat = {
      id: newId(core, 'spat'),
      airlineId: rel.id,
      startedDay: state.day,
      headline: `${rel.name}: "Hatchfield's fees are driving airlines away."`,
      reputationPerMonth: SPAT_REPUTATION_PER_MONTH,
      resolved: false,
      resolvedDay: null,
      resolution: null,
      rivalOffers: offers,
      holdFailed: false
    };
    state.spats.push(spat);
    emit(core, 'spat', rel.id, spat.headline, 'bad');
    emit(core, 'letter', rel.id, composeLetter(rel, 'spat', spat.headline).join(' '), 'bad');
    for (const id of offers) {
      const rival = state.relations[id];
      emit(core, 'rival_offer', id, `${rival.name} publicly offers to take ${rel.name}'s peak slots.`, 'info', {
        spatId: spat.id
      });
    }
  }
  for (const spat of state.spats) {
    if (spat.resolved) continue;
    const rel = state.relations[spat.airlineId];
    const perMonth = spat.holdFailed ? spat.reputationPerMonth * 1.5 : spat.reputationPerMonth;
    state.reputationDelta += perMonth / MONTH_DAYS;
    if (rel && bandIndex(rel.band) >= bandIndex('neutral')) closeSpat(core, spat, 'recovered');
    else if (state.day - spat.startedDay >= SPAT_FADE_DAYS) closeSpat(core, spat, 'faded');
  }
}

function closeSpat(core: EngineCore, spat: Spat, resolution: NonNullable<Spat['resolution']>): void {
  spat.resolved = true;
  spat.resolvedDay = core.state.day;
  spat.resolution = resolution;
  emit(core, 'spat_resolved', spat.airlineId, `Spat with ${core.state.relations[spat.airlineId]?.name ?? spat.airlineId} ends (${resolution}).`, 'info');
}

export interface OpenSpatView {
  id: string;
  airlineId: string;
  airline: string;
  headline: string;
  reputationPerMonth: number;
  offers: { id: string; name: string; cost: number }[];
}

/** Open public spats, with the court price kept off the headline. */
export function listOpenSpats(core: EngineCore): OpenSpatView[] {
  return core.state.spats
    .filter((s) => !s.resolved)
    .map((s) => {
      const rel = core.state.relations[s.airlineId];
      const perMonth = s.holdFailed ? s.reputationPerMonth * 1.5 : s.reputationPerMonth;
      return {
        id: s.id,
        airlineId: s.airlineId,
        airline: rel?.name ?? s.airlineId,
        headline: s.headline,
        reputationPerMonth: perMonth,
        offers: s.rivalOffers.map((id) => {
          const rival = core.state.relations[id];
          return { id, name: rival?.name ?? id, cost: rival ? Math.round(tierCost(rival.tier) * 0.5) : 0 };
        })
      };
    });
}

export function respondToSpat(
  core: EngineCore,
  spatId: string,
  response: 'concede' | 'hold' | 'court',
  rivalId?: string
): ActionResult {
  const spat = core.state.spats.find((s) => s.id === spatId);
  if (!spat || spat.resolved) return { ok: false, cost: 0, message: 'No open spat.' };
  const rel = core.state.relations[spat.airlineId];
  if (!rel) return { ok: false, cost: 0, message: 'Unknown airline.' };

  if (response === 'concede') {
    const newIndex = Math.max(0.5, core.state.feeIndex * 0.95);
    applyFeeChange(core, newIndex);
    addModifier(core, rel, 'concession', 'You conceded on fees', spat.id, { value: 12, months: 6 });
    evaluate(core, rel);
    closeSpat(core, spat, 'concede');
    return { ok: true, cost: 0, message: 'Fees cut 5%; the spat ends.', data: { newFeeIndex: newIndex } };
  }

  if (response === 'hold') {
    if (rel.leverage > 0) {
      rel.leverage -= 1;
      closeSpat(core, spat, 'hold');
      return { ok: true, cost: 0, message: 'You hold firm using Leverage; the airline backs down.', chance: 1 };
    }
    const chance = clamp(0.35 + rel.standing / 400, 0.1, 0.6);
    if (nextFloat(core.state) < chance) {
      closeSpat(core, spat, 'hold');
      return { ok: true, cost: 0, message: 'You held firm and the airline backs down.', chance };
    }
    spat.holdFailed = true;
    addModifier(core, rel, 'spat_loss', 'Held firm; airline escalates', spat.id, { value: -8, months: 6 });
    evaluate(core, rel);
    return { ok: false, cost: 0, message: 'The airline escalates; the spat gets louder.', chance };
  }

  const rival = rivalId ? core.state.relations[rivalId] : undefined;
  if (!rival || !spat.rivalOffers.includes(rival.id) || rival.status !== 'signed' || !rival.contract) {
    return { ok: false, cost: 0, message: 'Pick a rival who offered to take the slots.' };
  }
  const cost = Math.round(tierCost(rival.tier) * 0.5);
  if (!spend(core, cost, 'diplomacy', `Court ${rival.name}`)) {
    return { ok: false, cost: 0, message: 'Cannot afford to court the rival.' };
  }
  rival.contract.terms = {
    ...rival.contract.terms,
    slotsPerWeek: Math.round(rival.contract.terms.slotsPerWeek * 1.2)
  };
  addModifier(core, rival, 'court_rival', `You gave ${rel.name}'s slots to us`, spat.id, { value: 10 });
  addModifier(core, rel, 'spat_loss', 'You courted our rival', spat.id, { value: -6, months: 6 });
  evaluate(core, rival);
  evaluate(core, rel);
  if (rel.stage === 'none' || rel.stage === 'cold_warning') {
    rel.stage = 'capacity_cut';
    rel.capacityFactor = CAPACITY_CUT_FACTOR;
    emit(core, 'capacity_cut', rel.id, `${rel.name} cuts 30% of its flights after being passed over.`, 'bad');
    openSlotPool(core, rel, 'passed over for a rival');
  }
  closeSpat(core, spat, 'court');
  return { ok: true, cost, message: `${rival.name} takes more slots; ${rel.name} cuts capacity.` };
}

export function poachRisk(core: EngineCore, rel: AirlineRelation): number {
  if (rel.status !== 'signed') return 0;
  if (core.state.day < rel.poachShieldUntilDay) return 0;
  const standingFactor = clamp((-rel.standing - 10) / 100, 0, 0.8);
  const inSpat = core.state.spats.some((s) => s.airlineId === rel.id && !s.resolved) ? 0.15 : 0;
  const appeal = core.state.rivalAirport.appeal / 60;
  const risk = standingFactor * appeal + inSpat * appeal;
  return clamp(risk, 0, 0.9);
}

export function defendAgainstPoach(core: EngineCore, airlineId: string): ActionResult {
  const rel = core.state.relations[airlineId];
  if (!rel || rel.status !== 'signed') return { ok: false, cost: 0, message: 'Only signed airlines can be defended.' };
  const cost = Math.round(tierCost(rel.tier) * 1.2);
  if (!spend(core, cost, 'diplomacy', `Counter-offer against ${core.state.rivalAirport.name}`)) {
    return { ok: false, cost: 0, message: 'Cannot afford the counter-offer.' };
  }
  const seasonDays = core.state.config.seasonDays;
  const nextSeasonEnd = (Math.floor(core.state.day / seasonDays) + 2) * seasonDays;
  rel.poachShieldUntilDay = nextSeasonEnd;
  addModifier(core, rel, 'poach_defence', `Matched ${core.state.rivalAirport.name}'s offer`, 'poach', { value: 4, months: 6 });
  evaluate(core, rel);
  return { ok: true, cost, message: `${rel.name} is shielded from ${core.state.rivalAirport.name} until day ${nextSeasonEnd}.` };
}

/** The rival airport may poach one unhappy airline each season, at season end. */
export function rivalAirportSeason(core: EngineCore): void {
  const state = core.state;
  const rival = state.rivalAirport;
  rival.appeal = clamp(rival.appeal - 3, 20, 100);
  let poachedThisSeason = false;
  for (const rel of signedRelations(core)) {
    if (poachedThisSeason) break;
    if (exitsInCurrentYear(core) >= state.config.maxExitsPerYear) break;
    const risk = poachRisk(core, rel);
    if (risk <= 0 || nextFloat(state) >= risk) continue;
    rival.poached.push(rel.id);
    rival.lastPoachDay = state.day;
    rival.appeal = clamp(rival.appeal + 10, 20, 100);
    emit(core, 'poached', rel.id, `${rival.name} poaches ${rel.name}.`, 'bad');
    exitAirline(core, rel, 'poached');
    poachedThisSeason = true;
  }
}

const HOSTILE_KINDS: { kind: HostileActionKind; weight: number }[] = [
  { kind: 'lawsuit', weight: 0.3 },
  { kind: 'late_slot_change', weight: 0.25 },
  { kind: 'refused_gate', weight: 0.2 },
  { kind: 'slowed_turnarounds', weight: 0.25 }
];

function pickHostileKind(core: EngineCore): HostileActionKind {
  const roll = nextFloat(core.state);
  let acc = 0;
  for (const k of HOSTILE_KINDS) {
    acc += k.weight;
    if (roll < acc) return k.kind;
  }
  return pick(core.state, HOSTILE_KINDS).kind;
}

/** Hostile-band airlines sue or make the airport run less smoothly. Hooks: `host.onHostileAction`. */
export function tickHostile(core: EngineCore): void {
  const state = core.state;
  state.hostileActions = state.hostileActions.filter((a) => a.expiresDay > state.day);
  for (const rel of signedRelations(core)) {
    if (rel.band !== 'hostile') continue;
    const dailyChance = Math.min(0.2, (1 / 20) * effectMultiplier(rel));
    if (nextFloat(state) >= dailyChance) continue;
    const activeFor = state.hostileActions.filter((a) => a.airlineId === rel.id && a.expiresDay > state.day).length;
    if (activeFor >= 2) continue;
    const kind = pickHostileKind(core);
    if (kind === 'lawsuit' && state.lawsuits.some((l) => l.airlineId === rel.id && !l.closed)) continue;
    const action: HostileAction = {
      id: newId(core, 'hostile'),
      kind,
      airlineId: rel.id,
      day: state.day,
      expiresDay: state.day + 21,
      legalFee: 0,
      turnaroundSlowFactor: 1,
      refusedGates: 0,
      extraDelayMinutes: 0,
      text: ''
    };
    switch (kind) {
      case 'lawsuit': {
        action.legalFee = Math.round(tierCost(rel.tier) * 0.4);
        action.expiresDay = state.day + 45;
        action.text = `${rel.name} files a lawsuit against the airport.`;
        state.lawsuits.push({
          id: newId(core, 'suit'),
          airlineId: rel.id,
          filedDay: state.day,
          legalFee: action.legalFee,
          verdictDay: state.day + 45,
          settled: false,
          closed: false
        });
        core.host.charge(action.legalFee, 'legal', `Legal fees: ${rel.name} lawsuit`);
        break;
      }
      case 'late_slot_change':
        action.expiresDay = state.day + 14;
        action.extraDelayMinutes = 20;
        action.text = `${rel.name} makes late slot changes (+20 min delays).`;
        break;
      case 'refused_gate':
        action.refusedGates = 1;
        action.text = `${rel.name} refuses to use one of your gates.`;
        break;
      case 'slowed_turnarounds':
        action.turnaroundSlowFactor = 1.25;
        action.text = `${rel.name} slows its turnarounds (x1.25).`;
        break;
    }
    state.hostileActions.push(action);
    emit(core, 'hostile_action', rel.id, action.text, 'bad', { kind, legalFee: action.legalFee });
    core.host.onHostileAction?.(action);
  }
}

export function tickLawsuits(core: EngineCore): void {
  const state = core.state;
  for (const suit of state.lawsuits) {
    if (suit.closed || suit.verdictDay > state.day) continue;
    suit.closed = true;
    const rel = state.relations[suit.airlineId];
    const lost = nextFloat(state) < 0.5;
    if (lost) {
      const damages = Math.round(suit.legalFee * 3);
      core.host.charge(damages, 'legal', `Damages: ${rel?.name ?? suit.airlineId} lawsuit`);
      emit(core, 'lawsuit_verdict', suit.airlineId, `The court sides with ${rel?.name ?? 'the airline'}: damages ${damages}.`, 'bad', { damages });
    } else {
      emit(core, 'lawsuit_verdict', suit.airlineId, `The court dismisses ${rel?.name ?? 'the airline'}'s lawsuit.`, 'good', { damages: 0 });
    }
  }
  if (state.lawsuits.length > 30) state.lawsuits = state.lawsuits.filter((l) => !l.closed).concat(state.lawsuits.filter((l) => l.closed).slice(-10));
}

export function settleLawsuit(core: EngineCore, lawsuitId: string): ActionResult {
  const suit = core.state.lawsuits.find((l) => l.id === lawsuitId);
  if (!suit || suit.closed) return { ok: false, cost: 0, message: 'No open lawsuit.' };
  const cost = Math.round(suit.legalFee * 1.5);
  if (!spend(core, cost, 'legal', 'Settlement')) return { ok: false, cost: 0, message: 'Cannot afford the settlement.' };
  suit.closed = true;
  suit.settled = true;
  const rel = core.state.relations[suit.airlineId];
  if (rel) {
    addModifier(core, rel, 'lawsuit_settled', 'Lawsuit settled out of court', suit.id, { value: 6, months: 6 });
    evaluate(core, rel);
  }
  return { ok: true, cost, message: 'Settled out of court.' };
}

export function operationalEffects(core: EngineCore): OperationalEffects {
  const day = core.state.day;
  const active = core.state.hostileActions.filter((a) => a.kind !== 'lawsuit' && a.expiresDay > day);
  const perAirline: OperationalEffects['perAirline'] = {};
  let slow = 1;
  let gates = 0;
  let delay = 0;
  for (const a of active) {
    const entry = (perAirline[a.airlineId] ??= { turnaroundSlowFactor: 1, refusedGates: 0, extraDelayMinutes: 0 });
    entry.turnaroundSlowFactor = Math.max(entry.turnaroundSlowFactor, a.turnaroundSlowFactor);
    entry.refusedGates += a.refusedGates;
    entry.extraDelayMinutes += a.extraDelayMinutes;
    slow = Math.max(slow, a.turnaroundSlowFactor);
    gates += a.refusedGates;
    delay += a.extraDelayMinutes;
  }
  return {
    turnaroundSlowFactor: slow,
    refusedGates: gates,
    extraDelayMinutes: delay,
    openLawsuits: core.state.lawsuits.filter((l) => !l.closed).length,
    active,
    perAirline
  };
}

export function relationsInBand(core: EngineCore, band: AirlineRelation['band']): AirlineRelation[] {
  return allRelations(core).filter((r) => r.status === 'signed' && r.band === band);
}
