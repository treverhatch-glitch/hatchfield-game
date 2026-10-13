import {
  TIER_UNLOCK_FIELD_LEVEL,
  defaultConfig
} from './constants.ts';
import {
  applyFeeChange,
  apologize,
  eraReset,
  enforcePerks,
  endeavorPreview,
  feeDiscountPct,
  firstMeetScene,
  grantYearlyFavours,
  hubBlockers,
  launchIncentiveDeal,
  mediate,
  refreshLeverage,
  requestHub,
  resolveFirstMeet,
  revokeHub,
  startEndeavor,
  vouch
} from './actions.ts';
import type { EndeavorPreview, FirstMeetChoice, FirstMeetScene } from './actions.ts';
import { buildCard } from './cards.ts';
import { allRelations, emit, signedRelations } from './core.ts';
import type { EngineCore } from './core.ts';
import {
  counterDemand,
  maybeIssueDemand,
  respondToDemand,
  tickCommitments,
  spendFavourOnDemand
} from './demands.ts';
import {
  applySlotRule,
  cancelContract,
  cancellationQuote,
  counterExitNotice,
  ensureTierFloor,
  executePendingExits,
  processReentry,
  processSlotPools,
  tickDeparture
} from './departure.ts';
import {
  defendAgainstPoach,
  operationalEffects,
  poachRisk,
  respondToSpat,
  rivalAirportSeason,
  settleLawsuit,
  tickHostile,
  tickLawsuits,
  tickSpats
} from './drama.ts';
import { ALLIANCE_SEEDS, RIVAL_AIRPORT_NAMES, ROSTER } from './data.ts';
import { composeLetter, createKeyFigure, createRelation } from './generator.ts';
import {
  expireProposals,
  maybeBaseProposals,
  maybeSendLetters,
  previewSign,
  respondToProposal
} from './proposals.ts';
import type { SignPreview } from './proposals.ts';
import { evaluate, refreshPerks, updateShares } from './relations.ts';
import { pick } from './rng.ts';
import { pruneModifiers, recordGrade, stepPerformance } from './standing.ts';
import type {
  ActionResult,
  AirlineCard,
  AirlineRelation,
  DiplomacyConfig,
  DiplomacyContext,
  DiplomacyEvent,
  DiplomacyHost,
  DiplomacyState,
  Grade,
  OperationalEffects,
  ProposalResponse
} from './types.ts';

export interface CreateStateOptions {
  seed?: number;
  config?: Partial<DiplomacyConfig>;
}

export function createDiplomacyState(options: CreateStateOptions = {}): DiplomacyState {
  const state: DiplomacyState = {
    version: 1,
    day: 0,
    rngState: (options.seed ?? 1) >>> 0,
    nextId: 0,
    config: { ...defaultConfig(), ...options.config },
    highestTier: 0,
    fieldLevel: 0,
    relations: {},
    order: [],
    proposals: [],
    commitments: [],
    alliances: ALLIANCE_SEEDS.map((a) => ({ id: a.id, name: a.name, members: [...a.members], active: false })),
    spats: [],
    lawsuits: [],
    hostileActions: [],
    rivalAirport: { name: '', appeal: 30, poached: [], lastPoachDay: null },
    hubAirlineId: null,
    slotPools: [],
    incentiveDeals: [],
    exitLog: [],
    feeIndex: 1,
    feeRiseLog: [],
    lastDemandCheckDay: 0,
    lastDemandIssuedDay: -Infinity,
    tierFloorSpawnDay: {},
    reputationDelta: 0,
    log: []
  };
  state.rivalAirport.name = pick(state, RIVAL_AIRPORT_NAMES);
  for (const seed of ROSTER) {
    const rel = createRelation(state, seed);
    state.relations[rel.id] = rel;
    state.order.push(rel.id);
  }
  for (const alliance of state.alliances) {
    for (const id of alliance.members) {
      const rel = state.relations[id];
      if (rel) rel.allianceId = alliance.id;
    }
  }
  return state;
}

export interface FlightRecord {
  excused?: boolean;
}

export interface GradeOptions {
  excused?: boolean;
  cause?: string;
}

const EMPTY_CTX: DiplomacyContext = { fieldLevel: 0, metrics: {} };

/**
 * Airline Diplomacy V2 engine. Deterministic given a seed and the same sequence of calls, and
 * independent of React, Three.js and `sim.ts`. All money flows through `DiplomacyHost`.
 */
export class DiplomacyEngine {
  readonly core: EngineCore;
  private pending: DiplomacyEvent[] = [];

  constructor(host: DiplomacyHost, state?: DiplomacyState, options: CreateStateOptions = {}) {
    const wrapped: DiplomacyHost = {
      spend: (amount, category, memo) => host.spend(amount, category, memo),
      charge: (amount, category, memo) => host.charge(amount, category, memo),
      onEvent: (event) => {
        this.pending.push(event);
        host.onEvent?.(event);
      },
      onHostileAction: (action) => host.onHostileAction?.(action)
    };
    this.core = {
      state: state ?? createDiplomacyState(options),
      host: wrapped,
      ctx: EMPTY_CTX
    };
  }

  get state(): DiplomacyState {
    return this.core.state;
  }

  get day(): number {
    return this.core.state.day;
  }

  loadState(state: DiplomacyState): void {
    this.core.state = state;
  }

  serialize(): string {
    return JSON.stringify(this.core.state, (_k, v) => (v === Infinity ? '__inf__' : v === -Infinity ? '__-inf__' : v));
  }

  static parse(json: string): DiplomacyState {
    return JSON.parse(json, (_k, v) => (v === '__inf__' ? Infinity : v === '__-inf__' ? -Infinity : v)) as DiplomacyState;
  }

  setSlotRule80(enabled: boolean): void {
    this.core.state.config.slotRule80 = enabled;
  }

  /** Advance game time in days. Fractional steps are fine; daily systems run at each whole-day boundary. */
  advance(dtDays: number, ctx: DiplomacyContext): DiplomacyEvent[] {
    const state = this.core.state;
    this.core.ctx = ctx;
    const target = state.day + dtDays;
    let boundary = Math.floor(state.day + 1e-9) + 1;
    const total = Math.max(0, Math.floor(target + 1e-9) - boundary + 1);
    let daysLeft = total;
    while (boundary <= target + 1e-9) {
      state.day = boundary;
      this.dailyTick(daysLeft);
      daysLeft -= 1;
      if (boundary % state.config.seasonDays === 0) this.seasonEnd();
      boundary += 1;
    }
    state.day = target;
    return this.drainEvents();
  }

  /** Events emitted since the last call (by `advance` or by player actions). */
  drainEvents(): DiplomacyEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private dailyTick(daysLeft: number): void {
    const core = this.core;
    const state = core.state;
    const ctx = core.ctx;
    this.unlockTiers(ctx.fieldLevel);

    const smoothing = 1 - Math.pow(0.5, 1 / 30);
    for (const rel of allRelations(core)) {
      if (rel.status === 'locked') continue;
      const perDay = daysLeft > 0 ? rel.flightsToday / daysLeft : 0;
      rel.flightsToday -= perDay;
      if (rel.status === 'signed') rel.flightsEma += (perDay - rel.flightsEma) * smoothing;
      stepPerformance(rel, 1);
      rel.modifiers = pruneModifiers(rel.modifiers, state.day);
    }
    updateShares(core);

    for (const rel of allRelations(core)) {
      if (rel.status !== 'signed' && rel.status !== 'prospect') continue;
      evaluate(core, rel);
      if (rel.status !== 'signed') continue;
      refreshPerks(core, rel);
      enforcePerks(core, rel);
      tickDeparture(core, rel);
      this.handleContractTerm(rel);
    }
    this.updateAlliances();
    refreshLeverage(core);
    grantYearlyFavours(core);
    tickCommitments(core, 1);
    tickSpats(core);
    tickHostile(core);
    tickLawsuits(core);
    maybeIssueDemand(core);
    expireProposals(core);
    maybeSendLetters(core);
    maybeBaseProposals(core);
    processSlotPools(core);
    ensureTierFloor(core);
    processReentry(core);
    this.checkSuccession();
    state.incentiveDeals = state.incentiveDeals.filter((d) => d.endDay > state.day - 30);
    state.feeRiseLog = state.feeRiseLog.filter((d) => state.day - d < state.config.yearDays);
  }

  private seasonEnd(): void {
    applySlotRule(this.core);
    executePendingExits(this.core);
    rivalAirportSeason(this.core);
  }

  private unlockTiers(fieldLevel: number): void {
    const core = this.core;
    const state = core.state;
    state.fieldLevel = fieldLevel;
    let highest = state.highestTier;
    for (const tier of [1, 2, 3, 4, 5] as const) {
      if (fieldLevel >= TIER_UNLOCK_FIELD_LEVEL[tier]) highest = Math.max(highest, tier);
    }
    if (highest <= state.highestTier) return;
    const previous = state.highestTier;
    state.highestTier = highest;
    for (let tier = previous + 1; tier <= highest; tier++) {
      emit(core, 'tier_unlocked', null, `Tier ${tier} airlines can now approach your field.`, 'good', { tier });
      for (const rel of allRelations(core)) {
        if (rel.tier === tier && rel.status === 'locked') {
          rel.status = 'prospect';
          rel.nextLetterDay = state.day + (rel.keyFigure ? 5 : 0);
        }
      }
    }
    if (previous >= 1) eraReset(core, highest);
  }

  private updateAlliances(): void {
    const core = this.core;
    for (const alliance of core.state.alliances) {
      const live = alliance.members.filter((id) => {
        const r = core.state.relations[id];
        return r && r.status !== 'locked';
      });
      const shouldBeActive = core.state.highestTier >= 4 && live.length >= 2;
      if (shouldBeActive && !alliance.active) {
        alliance.active = true;
        emit(core, 'alliance', null, `Alliance "${alliance.name}" forms: ${live.map((id) => core.state.relations[id].name).join(', ')}.`, 'info');
      }
    }
  }

  private handleContractTerm(rel: AirlineRelation): void {
    const c = rel.contract;
    if (!c || rel.pendingCancel) return;
    const state = this.core.state;
    if (state.day < c.termEndDay) return;
    const termDays = rel.band === 'hostile' ? 90 : (rel.tier >= 4 ? 2 : 1) * state.config.yearDays;
    c.termEndDay = state.day + termDays;
    emit(this.core, 'contract_renewed', rel.id, `${rel.name}'s contract renews.`, 'info', { termEndDay: c.termEndDay });
  }

  private checkSuccession(): void {
    const core = this.core;
    const state = core.state;
    for (const rel of allRelations(core)) {
      const kf = rel.keyFigure;
      if (!kf || (rel.status !== 'signed' && rel.status !== 'prospect')) continue;
      if (state.day < kf.retireAtDay) continue;
      const kept = pick(state, kf.traits);
      const next = createKeyFigure(state, {
        tier: rel.tier,
        day: state.day,
        yearDays: state.config.yearDays,
        generation: kf.generation + 1,
        keepTraits: [kept]
      });
      for (const m of rel.modifiers) m.value *= 0.5;
      rel.keyFigure = next;
      rel.traits = [...next.traits];
      rel.portraitSeed = next.portraitSeed;
      rel.history.push(`${kf.name} retired; ${next.name} took over.`);
      emit(core, 'succession', rel.id, `${kf.name} retires. ${next.name} (${next.title}) takes over at ${rel.name}.`, 'info', {
        generation: next.generation
      });
      emit(core, 'letter', rel.id, composeLetter(rel, 'succession', `${kf.name} has retired.`).join(' '), 'info');
      evaluate(core, rel, false);
    }
  }

  // ---- host reports ---------------------------------------------------------------------

  /** Grade a completed turnaround (A-F). Excused delays (weather, ATC) count as C. */
  recordGrade(airlineId: string, grade: Grade, options: GradeOptions = {}): Grade | null {
    const rel = this.core.state.relations[airlineId];
    if (!rel || rel.status !== 'signed') return null;
    return recordGrade(rel, grade, options.excused ?? false, options.cause);
  }

  recordFlight(airlineId: string, flight: FlightRecord = {}): void {
    const rel = this.core.state.relations[airlineId];
    if (!rel || rel.status !== 'signed' || !rel.contract) return;
    rel.flightsToday += 1;
    if (flight.excused) rel.contract.seasonExcused += 1;
    else rel.contract.seasonFlights += 1;
  }

  /** An incident on one airline's flight (-20 for 24 months). */
  recordIncident(airlineId: string, label: string, showMe?: string): void {
    const rel = this.core.state.relations[airlineId];
    if (!rel || rel.status !== 'signed') return;
    this.addIncident(rel, label, showMe);
  }

  private addIncident(rel: AirlineRelation, label: string, showMe?: string): void {
    const state = this.core.state;
    rel.modifiers.push({
      id: `mod_inc_${(state.nextId += 1)}`,
      kind: 'incident',
      label,
      source: 'incident',
      value: -20,
      startDay: state.day,
      durationDays: 24 * 30,
      showMe
    });
    evaluate(this.core, rel);
  }

  /** Set the fee index (1.0 = baseline). Rises hit every signed airline at -3 per 1%. */
  notifyFeeChange(newIndex: number): { pct: number } {
    return applyFeeChange(this.core, newIndex);
  }

  // ---- player actions ---------------------------------------------------------------------

  respondToProposal(proposalId: string, response: ProposalResponse, payWith: 'money' | 'favour' = 'money'): ActionResult {
    return respondToProposal(this.core, proposalId, response, payWith);
  }

  previewSign(airlineId: string): SignPreview | null {
    return previewSign(this.core, airlineId);
  }

  respondToDemand(demandId: string, response: 'accept' | 'decline', useLeverage = false): ActionResult {
    return respondToDemand(this.core, demandId, response, useLeverage);
  }

  counterDemand(demandId: string, mode: 'lighter' | 'longer', payWith: 'money' | 'favour' = 'money'): ActionResult {
    return counterDemand(this.core, demandId, mode, payWith);
  }

  spendFavourOnDemand(demandId: string, use: 'extend' | 'waive'): ActionResult {
    return spendFavourOnDemand(this.core, demandId, use);
  }

  firstMeetScene(airlineId: string): FirstMeetScene | null {
    return firstMeetScene(this.core, airlineId);
  }

  resolveFirstMeet(airlineId: string, choice: FirstMeetChoice): ActionResult {
    return resolveFirstMeet(this.core, airlineId, choice);
  }

  endeavorPreview(airlineId: string): EndeavorPreview | null {
    return endeavorPreview(this.core, airlineId);
  }

  startEndeavor(airlineId: string): ActionResult {
    return startEndeavor(this.core, airlineId);
  }

  launchIncentiveDeal(tier: number, discountPct: number, days: number): ActionResult {
    return launchIncentiveDeal(this.core, tier, discountPct, days);
  }

  apologize(airlineId: string): ActionResult {
    return apologize(this.core, airlineId);
  }

  mediate(targetId: string, mediatorId: string): ActionResult {
    return mediate(this.core, targetId, mediatorId);
  }

  vouch(mediatorId: string, targetId: string): ActionResult {
    return vouch(this.core, mediatorId, targetId);
  }

  counterExitNotice(airlineId: string, useFavour = false): ActionResult {
    return counterExitNotice(this.core, airlineId, useFavour);
  }

  respondToSpat(spatId: string, response: 'concede' | 'hold' | 'court', rivalId?: string): ActionResult {
    return respondToSpat(this.core, spatId, response, rivalId);
  }

  defendAgainstPoach(airlineId: string): ActionResult {
    return defendAgainstPoach(this.core, airlineId);
  }

  settleLawsuit(lawsuitId: string): ActionResult {
    return settleLawsuit(this.core, lawsuitId);
  }

  cancelContract(airlineId: string): ActionResult {
    return cancelContract(this.core, airlineId);
  }

  cancellationQuote(airlineId: string) {
    return cancellationQuote(this.core, airlineId);
  }

  hubBlockers(airlineId: string): string[] {
    return hubBlockers(this.core, airlineId);
  }

  requestHub(airlineId: string): ActionResult {
    return requestHub(this.core, airlineId);
  }

  revokeHub(): void {
    revokeHub(this.core, 'player decision');
  }

  // ---- views ------------------------------------------------------------------------------

  getCard(airlineId: string): AirlineCard | null {
    const rel = this.core.state.relations[airlineId];
    return rel ? buildCard(this.core, rel) : null;
  }

  /** Cards for every airline the player has met (prospects, signed, former). */
  cards(): AirlineCard[] {
    return allRelations(this.core)
      .filter((r) => r.status !== 'locked')
      .map((r) => buildCard(this.core, r));
  }

  relation(airlineId: string): AirlineRelation | undefined {
    return this.core.state.relations[airlineId];
  }

  signedAirlineIds(): string[] {
    return signedRelations(this.core).map((r) => r.id);
  }

  feeDiscountPct(airlineId: string): number {
    const rel = this.core.state.relations[airlineId];
    return rel ? feeDiscountPct(this.core, rel) : 0;
  }

  poachRisk(airlineId: string): number {
    const rel = this.core.state.relations[airlineId];
    return rel ? poachRisk(this.core, rel) : 0;
  }

  /** Hostile actions the sim should apply (slowed turnarounds, refused gates, late slot changes). */
  operationalEffects(): OperationalEffects {
    return operationalEffects(this.core);
  }

  /** Reputation change accumulated by public spats since the last call. The host applies and clears it. */
  consumeReputationDelta(): number {
    const d = this.core.state.reputationDelta;
    this.core.state.reputationDelta = 0;
    return d;
  }
}
