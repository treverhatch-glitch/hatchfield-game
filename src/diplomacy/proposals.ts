import { DEFAULT_AIRLINES, meetsRequirements } from '../airlines/index.ts';
import type { ContractTerms } from '../airlines/index.ts';
import {
  CARGO_TERMS,
  PROPOSAL_EXPIRY_DAYS,
  TIER_BASE_TYPE,
  TIER_CONTRACT_TERMS
} from './constants.ts';
import {
  addModifier,
  allRelations,
  emit,
  newId,
  remember,
  spend,
  tierCost
} from './core.ts';
import type { EngineCore } from './core.ts';
import { applyCounterLines, counterCost, counterSuccess, resolveTicks } from './counter.ts';
import { composeLetter } from './generator.ts';
import { nextFloat } from './rng.ts';
import { alliesOf, evaluate, penalizeRivalsForPerk, refreshPerks, rivalsOf } from './relations.ts';
import type {
  ActionResult,
  AirlineRelation,
  Proposal,
  ProposalResponse
} from './types.ts';

export function defaultTermsFor(rel: AirlineRelation): ContractTerms {
  const t = rel.kind === 'cargo' ? CARGO_TERMS : TIER_CONTRACT_TERMS[rel.tier];
  return { ...t };
}

export interface SignPreviewLine {
  airlineId: string;
  name: string;
  delta: number;
  why: string;
}

export interface SignPreview {
  airlineId: string;
  rivals: SignPreviewLine[];
  allies: SignPreviewLine[];
  warnings: string[];
}

export type ReactionKind = 'sign' | 'perk' | 'hub' | 'slots';

const REACTION: Record<ReactionKind, { delta: number; why: string }> = {
  sign: { delta: -10, why: 'rival' },
  perk: { delta: -6, why: 'perk for a rival' },
  hub: { delta: -15, why: 'rival hub' },
  slots: { delta: -12, why: 'peak slots taken' }
};

/** Who reacts before a sign, perk, hub, or slot gift. Numbers stay off the button face. */
export function previewReaction(core: EngineCore, airlineId: string, kind: ReactionKind = 'sign'): SignPreview | null {
  const rel = core.state.relations[airlineId];
  if (!rel) return null;
  const spec = REACTION[kind];
  const allyIds = new Set(alliesOf(core, rel).map((a) => a.id));
  const rivals = rivalsOf(core, rel)
    .filter((r) => kind !== 'hub' || !allyIds.has(r.id))
    .map((r) => {
      const proud = kind === 'sign' && r.traits.includes('proud');
      return {
        airlineId: r.id,
        name: r.name,
        delta: spec.delta + (proud ? -6 : 0),
        why: proud ? 'rival, Proud: shared pier' : spec.why
      };
    });
  const allies =
    kind === 'sign'
      ? alliesOf(core, rel).map((r) => ({ airlineId: r.id, name: r.name, delta: 5, why: 'alliance partner' }))
      : [];
  const warnings: string[] = [];
  const util = core.ctx.metrics.standUtilization;
  if (util !== undefined && util >= 0.95) {
    warnings.push(`Stands at ${Math.round(util * 100)}%: risk of delays.`);
  }
  return { airlineId, rivals, allies, warnings };
}

/** Every sign/perk button shows this first: who gets angry, who is pleased, and operational risks. */
export function previewSign(core: EngineCore, airlineId: string): SignPreview | null {
  return previewReaction(core, airlineId, 'sign');
}

function rivalPenalty(rival: AirlineRelation): number {
  return -10 - (rival.traits.includes('proud') ? 6 : 0);
}

export function signContract(
  core: EngineCore,
  rel: AirlineRelation,
  terms: ContractTerms,
  discountPct = 0,
  discountDays = 0
): void {
  const state = core.state;
  const termYears = rel.tier >= 4 ? 2 : 1;
  rel.status = 'signed';
  rel.metDay ??= state.day;
  rel.contract = {
    terms: { ...terms },
    signedDay: state.day,
    termEndDay: state.day + termYears * state.config.yearDays,
    discountPct,
    discountEndDay: discountPct > 0 ? state.day + discountDays : state.day,
    peakSlotsPerWeek: Math.ceil(terms.slotsPerWeek * 0.4),
    seasonFlights: 0,
    seasonExcused: 0,
    baseGranted: false,
    flightBanks: 1
  };
  rel.flightsEma = terms.slotsPerWeek / 7;
  for (const rival of rivalsOf(core, rel)) {
    const penalty = rivalPenalty(rival);
    addModifier(
      core,
      rival,
      'signed_rival',
      rival.traits.includes('proud') ? `${rel.name} signed (rival, Proud)` : `${rel.name} signed (rival)`,
      rel.id,
      { value: penalty }
    );
    evaluate(core, rival, false);
  }
  for (const ally of alliesOf(core, rel)) {
    addModifier(core, ally, 'signed_ally', `Ally ${rel.name} signed`, rel.id);
  }
  evaluate(core, rel, false);
  refreshPerks(core, rel);
  remember(rel, `We signed with your airport on day ${Math.floor(state.day)}.`);
  emit(core, 'contract_signed', rel.id, `${rel.name} signs a contract.`, 'good', {
    termEndDay: rel.contract.termEndDay
  });
}

export function respondToProposal(
  core: EngineCore,
  proposalId: string,
  response: ProposalResponse,
  payWith: 'money' | 'favour' = 'money',
  ticks?: import('./types.ts').CounterLineKey[]
): ActionResult {
  const proposal = core.state.proposals.find((p) => p.id === proposalId);
  if (!proposal) return { ok: false, cost: 0, message: 'No such proposal.' };
  const rel = core.state.relations[proposal.airlineId];
  const drop = () => {
    core.state.proposals = core.state.proposals.filter((p) => p.id !== proposal.id);
  };

  if (response === 'decline') {
    drop();
    addModifier(core, rel, 'demand_declined', `Declined: ${proposal.kind} proposal`, proposal.id);
    rel.nextLetterDay = core.state.day + 30;
    return { ok: true, cost: 0, message: 'Declined politely.' };
  }

  if (response === 'counter') {
    if (proposal.counterUsed) return { ok: false, cost: 0, message: 'Already countered.' };
    const chosen = resolveTicks(proposal, ticks);
    if (chosen.length === 0) return { ok: false, cost: 0, message: 'Tick at least one line.' };
    let cost = 0;
    if (payWith === 'favour') {
      if (rel.favours.length === 0) return { ok: false, cost: 0, message: 'No Favour available.' };
    } else {
      cost = counterCost(rel);
      if (!spend(core, cost, 'diplomacy', `Counter-offer to ${rel.name}`)) {
        return { ok: false, cost: 0, message: 'Cannot afford the counter-offer.' };
      }
    }
    proposal.counterUsed = true;
    const chance = counterSuccess(rel, chosen.length, payWith);
    if (payWith === 'favour') rel.favours.shift();
    if (nextFloat(core.state) >= chance) {
      addModifier(core, rel, 'counter_rejected', 'Counter-offer rejected', proposal.id);
      return { ok: false, cost, chance, message: `${rel.name} rejected the counter-offer.` };
    }
    applyCounterLines(proposal, chosen);
    return { ok: true, cost, chance, message: 'Counter accepted: the terms are now better for you.' };
  }

  if (response === 'support' && proposal.kind !== 'base' && proposal.kind !== 'endeavor') {
    return { ok: false, cost: 0, message: 'Support is only available on base and endeavor proposals.' };
  }

  let cost = 0;
  if (response === 'support') {
    cost = proposal.supportCost;
    if (!spend(core, cost, 'diplomacy', `Support ${proposal.kind} with ${rel.name}`)) {
      return { ok: false, cost: 0, message: 'Cannot afford to support this.' };
    }
  }

  switch (proposal.kind) {
    case 'contract':
    case 'newcomer_incentive':
    case 'flights': {
      if (proposal.kind === 'flights') {
        if (rel.status !== 'signed' || !rel.contract || !proposal.terms) {
          return { ok: false, cost: 0, message: 'Flight contracts need a signed master.' };
        }
        rel.contract.terms = { ...rel.contract.terms, slotsPerWeek: proposal.terms.slotsPerWeek };
        rel.contract.flightBanks = (rel.contract.flightBanks ?? 1) + 1;
        drop();
        emit(core, 'contract_signed', rel.id, `${rel.name} adds a flight bank (${rel.contract.terms.slotsPerWeek}/week).`, 'good', {
          flights: rel.contract.flightBanks
        });
        return { ok: true, cost, message: `${rel.name} added flights.` };
      }
      if (rel.status === 'signed') return { ok: false, cost: 0, message: 'Already signed.' };
      if (!proposal.terms) return { ok: false, cost: 0, message: 'Proposal has no terms.' };
      signContract(core, rel, proposal.terms, proposal.discountPct, proposal.discountDays);
      drop();
      return { ok: true, cost: 0, message: `Signed with ${rel.name}.` };
    }
    case 'base': {
      if (rel.status !== 'signed' || !rel.contract) return { ok: false, cost: 0, message: 'Not signed.' };
      rel.isBase = true;
      rel.contract.baseGranted = true;
      rel.contract.discountPct = Math.max(rel.contract.discountPct, proposal.discountPct);
      rel.contract.discountEndDay = Math.max(rel.contract.discountEndDay, core.state.day + proposal.discountDays);
      addModifier(
        core,
        rel,
        response === 'support' ? 'endeavor_supported' : 'endeavor_accepted',
        response === 'support' ? 'Base backed with a hangar' : 'Base agreed'
      , proposal.id);
      drop();
      penalizeRivalsForPerk(core, rel, 'perk_rival', 'received a Base');
      emit(core, 'base_granted', rel.id, `${rel.name} bases aircraft overnight.`, 'good');
      return { ok: true, cost, message: `${rel.name} is now a Base airline.` };
    }
    case 'endeavor': {
      addModifier(
        core,
        rel,
        response === 'support' ? 'endeavor_supported' : 'endeavor_accepted',
        response === 'support' ? 'Joint endeavor, fully backed' : 'Joint endeavor agreed',
        proposal.id
      );
      drop();
      return { ok: true, cost, message: 'Endeavor agreed.' };
    }
  }
}

export function expireProposals(core: EngineCore): void {
  const keep: Proposal[] = [];
  for (const p of core.state.proposals) {
    if (p.expiresDay > core.state.day) {
      keep.push(p);
      continue;
    }
    const rel = core.state.relations[p.airlineId];
    if (rel && rel.status !== 'former') {
      addModifier(core, rel, 'letter_ignored', `Ignored ${p.kind} proposal`, p.id);
      rel.nextLetterDay = core.state.day + 30;
    }
  }
  core.state.proposals = keep;
}

function templateFor(rel: AirlineRelation) {
  const base = rel.kind === 'cargo' ? 'cargo' : TIER_BASE_TYPE[rel.tier];
  return DEFAULT_AIRLINES.find((a) => a.tier === base) ?? null;
}

/** Whether the airport meets the (src/airlines) requirements for this airline's tier. */
export function airportMeetsTier(core: EngineCore, rel: AirlineRelation): boolean {
  const airport = core.ctx.airport;
  if (!airport) return true;
  const template = templateFor(rel);
  return template ? meetsRequirements(template, airport) : true;
}

/** Prospects write a contract letter with probability that scales per day. */
export function maybeSendLetters(core: EngineCore): void {
  const state = core.state;
  const open = state.proposals.filter((p) => p.kind === 'contract' || p.kind === 'newcomer_incentive').length;
  if (open >= 3) return;
  const dailyChance = 0.12;
  for (const rel of allRelations(core)) {
    if (rel.status !== 'prospect' || rel.tier > state.highestTier) continue;
    if (state.proposals.some((p) => p.airlineId === rel.id)) continue;
    if (rel.nextLetterDay > state.day) continue;
    if (!airportMeetsTier(core, rel)) continue;
    if (state.proposals.filter((p) => p.kind === 'contract' || p.kind === 'newcomer_incentive').length >= 3) return;
    if (nextFloat(state) >= dailyChance) continue;
    const terms = defaultTermsFor(rel);
    state.proposals.push({
      id: newId(core, 'prop'),
      airlineId: rel.id,
      kind: 'contract',
      text: `${rel.name} proposes a master contract: ${terms.slotsPerWeek} flights a week.`,
      terms,
      discountPct: 0,
      discountDays: 0,
      issuedDay: state.day,
      expiresDay: state.day + PROPOSAL_EXPIRY_DAYS,
      counterUsed: false,
      supportCost: 0
    });
    const firstMeet = !!rel.keyFigure && !rel.firstMeetDone;
    rel.metDay ??= state.day;
    emit(core, 'letter', rel.id, composeLetter(rel, 'welcome', `We propose ${terms.slotsPerWeek} flights a week.`).join(' '), 'info', {
      firstMeet
    });
  }
}

/** Partner-band airlines propose a Base in return for a discount (Civ VII Endeavor analogue). */
export function maybeBaseProposals(core: EngineCore): void {
  const state = core.state;
  for (const rel of allRelations(core)) {
    if (rel.status !== 'signed' || !rel.contract || rel.isBase) continue;
    if (!rel.perks.includes('base_eligible')) continue;
    if (state.day - rel.contract.signedDay < 180) continue;
    if (state.proposals.some((p) => p.airlineId === rel.id && p.kind === 'base')) continue;
    if (nextFloat(state) >= 1 / 30) continue;
    state.proposals.push({
      id: newId(core, 'prop'),
      airlineId: rel.id,
      kind: 'base',
      text: `${rel.name} will station 2 aircraft overnight for 15% off for 2 years.`,
      terms: null,
      discountPct: 15,
      discountDays: 2 * state.config.yearDays,
      issuedDay: state.day,
      expiresDay: state.day + 30,
      counterUsed: false,
      supportCost: Math.round(tierCost(rel.tier) * 1.5)
    });
    emit(core, 'letter', rel.id, composeLetter(rel, 'demand', 'Base proposal: two aircraft overnight.').join(' '), 'info');
  }
}
