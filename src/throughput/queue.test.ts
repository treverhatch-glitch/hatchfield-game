import { describe, expect, it } from 'vitest';
import { queueWaitMinutes } from './queue';

describe('queueWaitMinutes', () => {
  it('returns 0 for zero or negative arrivals', () => {
    expect(queueWaitMinutes(0, 5, 100)).toBe(0);
    expect(queueWaitMinutes(-50, 5, 100)).toBe(0);
  });

  it('returns 240 cap when capacity is 0 but arrivals > 0', () => {
    expect(queueWaitMinutes(100, 0, 100)).toBe(240);
    expect(queueWaitMinutes(100, 5, 0)).toBe(240);
    expect(queueWaitMinutes(100, -2, 50)).toBe(240);
  });

  it('calculates expected wait for unsaturated M/M/1 queue', () => {
    // 1 server, rate = 100 pax/hr, arrivals = 50 pax/hr (rho = 0.5)
    // Erlang-C wait_q = 60 * (0.5 / (100 * 0.5)) = 0.6 minutes
    const wait = queueWaitMinutes(50, 1, 100);
    expect(wait).toBeCloseTo(0.6, 2);
  });

  it('calculates expected wait for unsaturated M/M/c queue', () => {
    // 2 servers, rate = 100 pax/hr each, arrivals = 100 pax/hr (rho = 0.5)
    const wait = queueWaitMinutes(100, 2, 100);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThan(5);
  });

  it('handles saturated system (utilisation >= 1) with fallback capped at 240', () => {
    const waitSat = queueWaitMinutes(200, 1, 100); // rho = 2.0
    expect(waitSat).toBeGreaterThan(30);
    expect(waitSat).toBeLessThanOrEqual(240);

    const waitExtreme = queueWaitMinutes(10000, 1, 100);
    expect(waitExtreme).toBe(240);
  });

  it('is monotonic with respect to arrival rate', () => {
    const wait1 = queueWaitMinutes(50, 2, 100);
    const wait2 = queueWaitMinutes(100, 2, 100);
    const wait3 = queueWaitMinutes(150, 2, 100);
    const wait4 = queueWaitMinutes(200, 2, 100);

    expect(wait1).toBeLessThanOrEqual(wait2);
    expect(wait2).toBeLessThanOrEqual(wait3);
    expect(wait3).toBeLessThanOrEqual(wait4);
  });

  it('never returns NaN or non-finite values for invalid inputs', () => {
    expect(Number.isNaN(queueWaitMinutes(NaN, 2, 100))).toBe(false);
    expect(Number.isNaN(queueWaitMinutes(100, NaN, 100))).toBe(false);
    expect(Number.isNaN(queueWaitMinutes(100, 2, NaN))).toBe(false);
    expect(Number.isNaN(queueWaitMinutes(Infinity, 2, 100))).toBe(false);
    expect(Number.isFinite(queueWaitMinutes(100, Infinity, 100))).toBe(true);
  });
});
