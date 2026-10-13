import { hubBlockers } from './actions.ts';
import type { EngineCore } from './core.ts';
import { allRelations, emit, newId, tierCost } from './core.ts';
import { nextFloat } from './rng.ts';
import type { AirlineRelation, LadderStep, Proposal } from './types.ts';

/**
 * Master (framework) → flight contracts (weekly banks) → Base → Hub.
 * The opening letter signs the master and the first flight bank together.
 */
export function contractLadder(core: EngineCore, rel: AirlineRelation): LadderStep[] {
  const proposals = core.state.proposals.filter((p) => p.airlineId === rel.id);
  const signed = rel.status === 'signed' && rel.contract != null;
  const slots = rel.contract?.terms.slotsPerWeek ?? 0;
  const banks = rel.contract?.flightBanks ?? (signed ? 1 : 0);
  const masterOffer = proposals.some((p) => p.kind === 'contract' || p.kind === 'newcomer_incentive');
  const flightOffer = proposals.find((p) => p.kind === 'flights');
  const baseOffer = proposals.some((p) => p.kind === 'base');
  const blockers = rel.isHub ? [] : hubBlockers(core, rel.id);
  return [
    {
      id: 'master',
      label: 'Master',
      state: signed ? 'done' : masterOffer ? 'offered' : 'locked',
      detail: signed ? 'Framework signed' : masterOffer ? 'Letter on the desk' : 'Waiting on a letter'
    },
    {
      id: 'flights',
      label: 'Flights',
      state: !signed ? 'locked' : flightOffer ? 'offered' : slots > 0 ? 'done' : 'open',
      detail: !signed
        ? 'Needs the master contract'
        : flightOffer
          ? flightOffer.text
          : `${slots}/week · ${banks} bank${banks === 1 ? '' : 's'}`
    },
    {
      id: 'base',
      label: 'Base',
      state: rel.isBase ? 'done' : baseOffer ? 'offered' : signed ? 'open' : 'locked',
      detail: rel.isBase ? 'Aircraft overnight' : baseOffer ? 'Base proposal open' : 'They ask once you are Partner'
    },
    {
      id: 'hub',
      label: 'Hub',
      state: rel.isHub ? 'done' : blockers.length === 0 ? 'open' : 'locked',
      detail: rel.isHub ? 'The one hub airline' : blockers[0] ?? 'Eligible — one hub at a time'
    }
  ];
}

/** Warm airlines propose another flight bank on the master contract. */
export function maybeFlightContracts(core: EngineCore): void {
  const state = core.state;
  if (state.proposals.length >= 3) return;
  for (const rel of allRelations(core)) {
    if (state.proposals.length >= 3) return;
    if (!canOfferFlights(core, rel)) continue;
    if (nextFloat(state) >= 1 / 45) continue;
    const contract = rel.contract;
    if (!contract) continue;
    const add = rel.tier <= 2 ? 7 : 4;
    const terms = { ...contract.terms, slotsPerWeek: contract.terms.slotsPerWeek + add };
    const proposal: Proposal = {
      id: newId(core, 'prop'),
      airlineId: rel.id,
      kind: 'flights',
      text: `${rel.name} wants ${add} more flights a week on the master contract.`,
      terms,
      discountPct: 0,
      discountDays: 0,
      issuedDay: state.day,
      expiresDay: state.day + 21,
      counterUsed: false,
      supportCost: Math.round(tierCost(rel.tier) * 0.4)
    };
    state.proposals.push(proposal);
    emit(core, 'letter', rel.id, proposal.text, 'info', { flights: add });
  }
}

function canOfferFlights(core: EngineCore, rel: AirlineRelation): boolean {
  if (rel.status !== 'signed' || !rel.contract || rel.stage !== 'none') return false;
  if (rel.band !== 'warm' && rel.band !== 'partner') return false;
  if (core.state.day - rel.contract.signedDay < 60) return false;
  if ((rel.contract.flightBanks ?? 1) >= 4) return false;
  if (core.state.proposals.some((p) => p.airlineId === rel.id)) return false;
  const util = core.ctx.metrics.standUtilization;
  if (util !== undefined && util >= 0.9) return false;
  return true;
}
