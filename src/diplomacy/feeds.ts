import { FEE_CUT_CAP, FEE_CUT_PER_PCT, FEE_RISE_PER_PCT, clamp } from './constants.ts';
import { addModifier, emit, newId, relationOf, remember } from './core.ts';
import type { EngineCore } from './core.ts';
import { evaluate } from './relations.ts';
import type { AirlineRelation, ModifierKind } from './types.ts';

/**
 * Typed feeds from neighbouring modules.
 *
 * Trunk today:
 * - negotiation (PR #44) — `noteNegotiation`, and a walked airline via `noteRivalAirport`
 * - fees (PR #51) — `notePublishedFees` on the global index, `noteAirlineFee` per carrier
 * - premium screening (PR #54) — `notePremiumScreening` from the security lanes
 * - missed connections — `noteMissedConnections` (connectivity / PR #70 when that module lands)
 * - rival airport — `noteRivalAirport` (src/rival, PR #64, when that module lands)
 *
 * Callers that are not on trunk yet can call the same functions. Missing callers change nothing.
 */

export interface MissedConnectionFeed {
  airlineId: string;
  missed: number;
  showMe?: string;
}

export interface RivalAirportFeed {
  rivalName: string;
  airlineId: string;
  taken: boolean;
}

export interface PremiumScreeningFeed {
  /** 0..1 premium passengers cleared inside the comfort window. */
  clearRate: number;
}

export interface NegotiationFeed {
  airlineId: string;
  value: number;
  label: string;
  durationDays: number;
  source: string;
}

export interface FeeFeed {
  /** 1 is the published schedule. 1.05 is a 5% rise. */
  index: number;
}

export function noteMissedConnections(core: EngineCore, feed: MissedConnectionFeed): void {
  if (feed.missed <= 0) return;
  const rel = signed(core, feed.airlineId);
  if (!rel) return;
  const value = -Math.min(12, feed.missed * 2);
  push(core, rel, 'missed_connection', `${feed.missed} missed connection${feed.missed === 1 ? '' : 's'}`, 'connectivity', value, 6 * 30, feed.showMe ?? 'connectivity');
  emit(
    core,
    'info',
    rel.id,
    `${rel.name}: ${feed.missed} missed connection${feed.missed === 1 ? '' : 's'}.`,
    'warn',
    { missed: feed.missed }
  );
}

/**
 * A rival airport courting or taking an airline.
 * If negotiation already wrote a modifier today, this only records the poach
 * so the two feeds do not stack a double penalty.
 */
export function noteRivalAirport(core: EngineCore, feed: RivalAirportFeed): void {
  const rel = relationOf(core, feed.airlineId);
  if (!rel || rel.status === 'former') return;
  const already = rel.modifiers.some(
    (m) => m.kind === 'negotiation' && m.startDay === core.state.day && m.source === 'walk'
  );
  if (!already) {
    const value = feed.taken ? -12 : -6;
    const label = feed.taken ? `${feed.rivalName} took the route` : `${feed.rivalName} is courting them`;
    push(core, rel, 'rival_poach', label, 'rival', value, 12 * 30, 'rival');
  }
  remember(rel, feed.taken ? `${feed.rivalName} poached this carrier.` : `${feed.rivalName} made a public offer.`);
  emit(
    core,
    feed.taken ? 'poached' : 'rival_offer',
    rel.id,
    feed.taken ? `${feed.rivalName} poached ${rel.name}.` : `${feed.rivalName} offered to take ${rel.name}'s slots.`,
    feed.taken ? 'bad' : 'warn'
  );
}

/** Refresh one premium-screening modifier per interested airline. Safe to call once a day. */
export function notePremiumScreening(core: EngineCore, feed: PremiumScreeningFeed): void {
  const rate = clamp(feed.clearRate, 0, 1);
  core.state.premiumScreenPct = rate;
  const value = rate >= 0.85 ? 3 : rate >= 0.7 ? 0 : Math.round((rate - 0.7) * 20);
  const label = `Premium screening ${Math.round(rate * 100)}%`;
  for (const rel of Object.values(core.state.relations)) {
    if (rel.status !== 'signed' || !rel.interests.includes('premium')) continue;
    const existing = rel.modifiers.find((m) => m.kind === 'premium_screen' && m.source === 'premium-screen');
    if (value === 0) {
      if (existing) {
        rel.modifiers = rel.modifiers.filter((m) => m !== existing);
        evaluate(core, rel);
      }
      continue;
    }
    if (existing) {
      existing.value = value;
      existing.label = label;
      existing.startDay = core.state.day;
      existing.durationDays = 30;
      existing.showMe = 'security';
      evaluate(core, rel);
    } else {
      push(core, rel, 'premium_screen', label, 'premium-screen', value, 30, 'security');
    }
  }
}

export function noteNegotiation(core: EngineCore, feed: NegotiationFeed): void {
  const rel = relationOf(core, feed.airlineId);
  if (!rel || rel.status === 'former') return;
  if (feed.value === 0 || feed.durationDays <= 0) return;
  rel.modifiers.push({
    id: newId(core, 'mod'),
    kind: 'negotiation',
    label: feed.label,
    source: feed.source,
    value: feed.value,
    startDay: core.state.day,
    durationDays: feed.durationDays
  });
  evaluate(core, rel);
}

/**
 * Per-airline fee factor from the negotiation desk (1 = posted schedule).
 * Replaces the previous negotiation-fee modifier instead of stacking.
 */
export function noteAirlineFee(core: EngineCore, airlineId: string, factor: number): void {
  const rel = signed(core, airlineId);
  if (!rel) return;
  const source = 'negotiation-fee';
  rel.modifiers = rel.modifiers.filter((m) => m.source !== source);
  const pct = (factor - 1) * 100;
  if (Math.abs(pct) < 0.5) {
    evaluate(core, rel);
    return;
  }
  const sensitive = rel.interests[0] === 'cost' || rel.traits.includes('frugal') ? 1.5 : 1;
  const value =
    pct > 0
      ? Math.max(-30, FEE_RISE_PER_PCT * pct * sensitive)
      : Math.min(FEE_CUT_CAP, FEE_CUT_PER_PCT * Math.abs(pct));
  push(
    core,
    rel,
    pct > 0 ? 'fee_rise' : 'fee_cut',
    pct > 0 ? `Negotiated fees +${pct.toFixed(1)}%` : `Negotiated fees ${pct.toFixed(1)}%`,
    source,
    value,
    12 * 30,
    'fees'
  );
}

function signed(core: EngineCore, id: string): AirlineRelation | null {
  const rel = relationOf(core, id);
  if (!rel || rel.status !== 'signed') return null;
  return rel;
}

function push(
  core: EngineCore,
  rel: AirlineRelation,
  kind: ModifierKind,
  label: string,
  source: string,
  value: number,
  durationDays: number,
  showMe?: string
): void {
  addModifier(core, rel, kind, label, source, { value, months: durationDays / 30, showMe });
  evaluate(core, rel);
}
