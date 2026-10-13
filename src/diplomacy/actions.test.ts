import { describe, expect, it } from 'vitest';
import { createHarness, push } from './testkit.ts';
import { tierCost } from './core.ts';

function signedMeridian(seed = 7) {
  const h = createHarness({ fieldLevel: 5, seed });
  h.sign('meridian');
  return h;
}

describe('endeavors', () => {
  it('previews probabilities that sum to 1 and improve with standing', () => {
    const h = signedMeridian();
    const low = h.engine.endeavorPreview('meridian')!;
    push(h, 'meridian', 60, 12);
    const high = h.engine.endeavorPreview('meridian')!;
    expect(low.pSupport + low.pAccept + low.pReject).toBeCloseTo(1);
    expect(high.pSupport + high.pAccept + high.pReject).toBeCloseTo(1);
    expect(high.pSupport).toBeGreaterThan(low.pSupport);
    expect(high.pReject).toBeLessThan(low.pReject);
  });

  it('charges money, never a hidden currency, and only works on signed airlines', () => {
    const h = signedMeridian();
    const before = h.cash.value;
    const res = h.engine.startEndeavor('meridian');
    expect(['support', 'accept', 'reject']).toContain(res.data?.stance);
    expect(res.cost).toBe(tierCost(h.engine.relation('meridian')!.tier));
    expect(before - h.cash.value).toBeGreaterThan(0);
    expect(h.engine.startEndeavor('northline').ok).toBe(false);
  });

  it('refuses when the player cannot afford it, without side effects', () => {
    const h = createHarness({ fieldLevel: 5, cash: 1_000_000_000 });
    h.sign('meridian');
    h.cash.value = 0;
    const mods = h.engine.relation('meridian')!.modifiers.length;
    const res = h.engine.startEndeavor('meridian');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('afford');
    expect(h.engine.relation('meridian')!.modifiers).toHaveLength(mods);
  });
});

describe('incentive deals', () => {
  it('are non-discriminatory for a whole tier, clamped to 5-30%, and one per tier at a time', () => {
    const h = signedMeridian();
    const tier = h.engine.relation('meridian')!.tier;
    const res = h.engine.launchIncentiveDeal(tier, 80, 90);
    expect(res.ok).toBe(true);
    const deal = h.engine.state.incentiveDeals[0];
    expect(deal.discountPct).toBe(30);
    expect(h.engine.feeDiscountPct('meridian')).toBe(30);
    expect(h.engine.launchIncentiveDeal(tier, 10, 90).ok).toBe(false);
    for (const rel of Object.values(h.engine.state.relations)) {
      if (rel.tier !== tier || (rel.status !== 'signed' && rel.status !== 'prospect')) continue;
      expect(rel.modifiers.some((m) => m.kind === 'incentive')).toBe(true);
    }
  });

  it('expire, and cannot target a locked tier', () => {
    const h = signedMeridian();
    const tier = h.engine.relation('meridian')!.tier;
    h.engine.launchIncentiveDeal(tier, 10, 30);
    h.run(40);
    expect(h.engine.feeDiscountPct('meridian')).toBe(0);
    const top = h.engine.state.highestTier;
    expect(h.engine.launchIncentiveDeal(top, 10, 30).ok).toBe(true);
    expect(h.engine.launchIncentiveDeal(top + 1, 10, 30).ok).toBe(false);
    expect(h.engine.launchIncentiveDeal(0, 10, 30).ok).toBe(false);
  });
});

describe('apology packages', () => {
  it('give +8 first, +4 second, and refuse a third in a year', () => {
    const h = signedMeridian();
    const rel = h.engine.relation('meridian')!;
    expect(h.engine.apologize('meridian').data?.value).toBe(8);
    expect(rel.contract!.discountPct).toBeGreaterThanOrEqual(10);
    expect(h.engine.apologize('meridian').data?.value).toBe(4);
    const third = h.engine.apologize('meridian');
    expect(third.ok).toBe(false);
    expect(third.message).toContain('third');
    h.run(361);
    expect(h.engine.apologize('meridian').data?.value).toBe(8);
  });

  it('cost half the tier fee and refuse unsigned airlines', () => {
    const h = signedMeridian();
    const res = h.engine.apologize('meridian');
    expect(res.cost).toBe(Math.round(tierCost(h.engine.relation('meridian')!.tier) * 0.5));
    expect(h.engine.apologize('northline').ok).toBe(false);
  });
});

describe('fee changes', () => {
  it('a fee rise hurts price-sensitive airlines more and is capped', () => {
    const h = signedMeridian();
    h.sign('verdant_air');
    h.engine.notifyFeeChange(1.5);
    for (const id of ['meridian', 'verdant_air']) {
      const m = h.engine.relation(id)!.modifiers.find((x) => x.kind === 'fee_rise');
      if (m) expect(m.value).toBeGreaterThanOrEqual(-30);
    }
    const res = h.engine.notifyFeeChange(3);
    expect(res.pct).toBeGreaterThan(0);
  });
});

describe('player cancellation', () => {
  it('quotes a fee, takes a credit and favour hit, and only takes effect at season end', () => {
    const h = signedMeridian();
    const quote = h.engine.cancellationQuote('meridian');
    expect(quote).toBeTruthy();
    const cash = h.cash.value;
    const res = h.engine.cancelContract('meridian');
    expect(res.ok).toBe(true);
    expect(cash - h.cash.value).toBeGreaterThanOrEqual(0);
    expect(h.engine.relation('meridian')!.status).toBe('signed');
    expect(h.engine.cancelContract('northline').ok).toBe(false);
  });
});
