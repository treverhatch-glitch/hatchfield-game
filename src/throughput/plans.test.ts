import { describe, expect, it } from 'vitest';
import { sorterPlan } from './bhs';
import { checkinMix } from './checkin';
import { SECURITY_TECH_RATES } from './data';
import { securityPlan } from './security';

describe('securityPlan', () => {
  it('calculates capacity, utilisation and wait for open lanes', () => {
    const lanes = [
      { tech: 'xray' as const, open: true }, // 150
      { tech: 'ct' as const, open: true }, // 200
      { tech: 'biometric' as const, open: false }, // 260 (closed)
    ];
    // Open capacity = 350 pax/hr
    const res = securityPlan(lanes, 175);

    expect(res.totalLanes).toBe(3);
    expect(res.openLanes).toBe(2);
    expect(res.capacity).toBe(350);
    expect(res.paxPerHr).toBe(175);
    expect(res.utilisation).toBeCloseTo(0.5, 2);
    expect(res.bottleneck).toBe(false);
    expect(Number.isNaN(res.waitMinutes)).toBe(false);
  });

  it('identifies bottleneck when utilisation >= 0.85', () => {
    const lanes = [{ tech: 'xray' as const, open: true }]; // 150 pax/hr
    const res = securityPlan(lanes, 135); // 90% utilisation

    expect(res.utilisation).toBeCloseTo(0.9, 2);
    expect(res.bottleneck).toBe(true);
  });

  it('handles all lanes closed with positive arrivals', () => {
    const lanes = [{ tech: 'xray' as const, open: false }];
    const res = securityPlan(lanes, 100);

    expect(res.openLanes).toBe(0);
    expect(res.capacity).toBe(0);
    expect(res.waitMinutes).toBe(240);
    expect(res.bottleneck).toBe(true);
  });

  it('uses tech rates defined in SECURITY_TECH_RATES', () => {
    expect(SECURITY_TECH_RATES.xray).toBe(150);
    expect(SECURITY_TECH_RATES.ct).toBe(200);
    expect(SECURITY_TECH_RATES.biometric).toBe(260);
  });
});

describe('checkinMix', () => {
  it('routes no-bag pax to kiosks first and bag pax to bag drops', () => {
    // 100 pax total, 0.8 bag share => 80 pax with bags, 20 no-bag pax
    // 1 kiosk (capacity 90): handles 20 no-bag pax, 0 overflow
    // 1 bag drop (capacity 120): handles 80 bag pax, 0 overflow
    // 2 desks (capacity 120): handles 0 overflow
    const config = { desks: 2, kiosks: 1, bagDrops: 1 };
    const res = checkinMix(config, 100, 0.8);

    expect(res.channels.kiosk.paxPerHr).toBe(20);
    expect(res.channels.bagDrop.paxPerHr).toBe(80);
    expect(res.channels.desk.paxPerHr).toBe(0);
    expect(res.totalPax).toBe(100);
    expect(res.totalCapacity).toBe(60 * 2 + 90 * 1 + 120 * 1); // 330
    expect(res.bottleneck).toBe(false);
  });

  it('routes overflow no-bag and bag pax to desks', () => {
    // 500 pax, 0.8 bag share => 400 bag pax, 100 no-bag pax
    // 1 kiosk (capacity 90): handles 90 no-bag pax -> 10 no-bag overflow
    // 2 bag drops (capacity 240): handles 240 bag pax -> 160 bag overflow
    // Desks receive 10 + 160 = 170 pax
    const config = { desks: 4, kiosks: 1, bagDrops: 2 };
    const res = checkinMix(config, 500, 0.8);

    expect(res.channels.kiosk.paxPerHr).toBe(90);
    expect(res.channels.bagDrop.paxPerHr).toBe(240);
    expect(res.channels.desk.paxPerHr).toBe(170);
  });

  it('never produces NaN for channel or total metrics', () => {
    const config = { desks: 0, kiosks: 0, bagDrops: 0 };
    const res = checkinMix(config, NaN, NaN);

    expect(Number.isNaN(res.totalPax)).toBe(false);
    expect(Number.isNaN(res.totalCapacity)).toBe(false);
    expect(Number.isNaN(res.overallUtilisation)).toBe(false);
    expect(Number.isNaN(res.maxWaitMinutes)).toBe(false);
  });
});

describe('sorterPlan', () => {
  it('calculates manual tier performance and suggests upgrade when saturated', () => {
    const res = sorterPlan('manual', 360); // 360 / 400 = 0.9 utilisation

    expect(res.tier).toBe('manual');
    expect(res.capacity).toBe(400);
    expect(res.bagsPerHr).toBe(360);
    expect(res.utilisation).toBeCloseTo(0.9, 2);
    expect(res.mishandleRate).toBe(0.025);
    expect(res.mishandledPerHr).toBeCloseTo(9, 2); // 360 * 0.025 = 9
    expect(res.upgradeSuggested).toBe(true);
    expect(res.nextTier).toBe('tilt-tray');
  });

  it('does not suggest upgrade for ICS top tier even if utilisation >= 0.85', () => {
    const res = sorterPlan('ics', 5500); // 5500 / 6000 = 0.916 utilisation

    expect(res.tier).toBe('ics');
    expect(res.capacity).toBe(6000);
    expect(res.utilisation).toBeGreaterThan(0.85);
    expect(res.upgradeSuggested).toBe(false);
    expect(res.nextTier).toBeUndefined();
  });

  it('never produces NaN for sorter metrics', () => {
    const res = sorterPlan('tilt-tray', NaN);

    expect(Number.isNaN(res.bagsPerHr)).toBe(false);
    expect(Number.isNaN(res.utilisation)).toBe(false);
    expect(Number.isNaN(res.mishandledPerHr)).toBe(false);
  });
});
