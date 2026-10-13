import { TIER_COST, clamp } from './constants.ts';
import { counterChance } from './demands.ts';
import type { AirlineRelation, CounterLine, CounterLineKey, CounterQuote, Proposal } from './types.ts';

const ALL_KEYS: CounterLineKey[] = ['landing', 'passenger', 'slots', 'discount', 'penalties'];

/** Line items the player can tick. Each tick is a change in the airport's favour. */
export function counterLines(proposal: Proposal): CounterLine[] {
  const lines: CounterLine[] = [];
  const terms = proposal.terms;
  if (terms) {
    lines.push({
      key: 'landing',
      label: 'Landing fee',
      offered: String(terms.feePerLanding),
      countered: String(Math.round(terms.feePerLanding * 1.1))
    });
    if (terms.feePerPassenger > 0) {
      lines.push({
        key: 'passenger',
        label: 'Passenger fee',
        offered: String(terms.feePerPassenger),
        countered: String(Math.round(terms.feePerPassenger * 1.1))
      });
    }
    lines.push({
      key: 'slots',
      label: 'Flights / week',
      offered: String(terms.slotsPerWeek),
      countered: String(Math.max(1, Math.round(terms.slotsPerWeek * 0.85)))
    });
    lines.push({
      key: 'penalties',
      label: 'Delay penalty',
      offered: String(terms.penaltyPerDelayMinute),
      countered: String(Math.round(terms.penaltyPerDelayMinute * 1.2))
    });
  }
  if (proposal.discountPct > 0) {
    const pct = Math.max(5, Math.round(proposal.discountPct * 0.6));
    const days = Math.round(proposal.discountDays * 0.7);
    lines.push({
      key: 'discount',
      label: 'Discount',
      offered: `${proposal.discountPct}% for ${proposal.discountDays}d`,
      countered: `${pct}% for ${days}d`
    });
  }
  return lines;
}

/**
 * Shown before the roll. One ticked line uses the base chance.
 * Each extra line costs 7 points, because asking for more is harder.
 * A Favour forces the counter through.
 */
export function counterSuccess(rel: AirlineRelation, ticked: number, payWith: 'money' | 'favour'): number {
  if (payWith === 'favour') return 1;
  const extra = Math.max(0, ticked - 1) * 0.07;
  return clamp(counterChance(rel) - extra, 0.1, 0.9);
}

export function counterCost(rel: AirlineRelation): number {
  return Math.round(((TIER_COST as Record<number, number>)[rel.tier] ?? TIER_COST[1]) * 0.5);
}

/** `ticks` omitted means every available line (the legacy one-button counter). */
export function resolveTicks(proposal: Proposal, ticks?: CounterLineKey[]): CounterLineKey[] {
  const available = new Set(counterLines(proposal).map((line) => line.key));
  if (!ticks) return ALL_KEYS.filter((key) => available.has(key));
  return ticks.filter((key) => available.has(key));
}

export function quoteCounter(rel: AirlineRelation, proposal: Proposal, ticks?: CounterLineKey[]): CounterQuote {
  const lines = counterLines(proposal);
  const ticked = resolveTicks(proposal, ticks);
  return {
    lines,
    ticked,
    chance: counterSuccess(rel, Math.max(1, ticked.length), 'money'),
    cost: counterCost(rel)
  };
}

/** Mutates the proposal so a later Accept uses the countered terms. */
export function applyCounterLines(proposal: Proposal, keys: CounterLineKey[]): void {
  const chosen = new Set(keys);
  if (proposal.terms) {
    const terms = { ...proposal.terms };
    if (chosen.has('landing')) terms.feePerLanding = Math.round(terms.feePerLanding * 1.1);
    if (chosen.has('passenger')) terms.feePerPassenger = Math.round(terms.feePerPassenger * 1.1);
    if (chosen.has('slots')) terms.slotsPerWeek = Math.max(1, Math.round(terms.slotsPerWeek * 0.85));
    if (chosen.has('penalties')) terms.penaltyPerDelayMinute = Math.round(terms.penaltyPerDelayMinute * 1.2);
    proposal.terms = terms;
  }
  if (chosen.has('discount') && proposal.discountPct > 0) {
    proposal.discountPct = Math.max(5, Math.round(proposal.discountPct * 0.6));
    proposal.discountDays = Math.round(proposal.discountDays * 0.7);
  }
}
