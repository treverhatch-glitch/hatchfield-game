// @ts-ignore -- vitest is provided by test runner
import { describe, it, expect } from 'vitest';
import {
  needsDeicing,
  scheduleDeicing,
  GlycolStock,
  runwayRateFactor,
  GLYCOL_ORDER_LEAD_TIME,
  GLYCOL_PRICE_PER_LITRE,
  GLYCOL_LITRES_PER_CLASS,
  type Departure,
  type Pad,
} from './index';

describe('winterops module', () => {
  describe('needsDeicing', () => {
    it('evaluates truth table correctly', () => {
      // temp > 3°C, any precip -> false
      expect(needsDeicing({ tempC: 4, precip: 'snow', visibilityM: 1000 })).toBe(false);
      expect(needsDeicing({ tempC: 10, precip: 'freezing_rain', visibilityM: 500 })).toBe(false);

      // temp <= 3°C, precip === 'none' -> false
      expect(needsDeicing({ tempC: 3, precip: 'none', visibilityM: 1000 })).toBe(false);
      expect(needsDeicing({ tempC: -5, precip: 'none', visibilityM: 1000 })).toBe(false);

      // temp <= 3°C, precip === 'snow' or 'freezing_rain' -> true
      expect(needsDeicing({ tempC: 3, precip: 'snow', visibilityM: 1000 })).toBe(true);
      expect(needsDeicing({ tempC: 0, precip: 'freezing_rain', visibilityM: 1000 })).toBe(true);
      expect(needsDeicing({ tempC: -10, precip: 'snow', visibilityM: 500 })).toBe(true);
    });

    it('handles empty / invalid weather states without throwing or returning NaN', () => {
      expect(needsDeicing(null)).toBe(false);
      expect(needsDeicing(undefined)).toBe(false);
      expect(needsDeicing({ tempC: NaN, precip: 'snow', visibilityM: 1000 })).toBe(false);
      expect(needsDeicing({ tempC: 2, precip: undefined as any, visibilityM: 1000 })).toBe(false);
    });
  });

  describe('scheduling de-icing queue', () => {
    it('schedules 2 pads and 5 departures without overlaps, respecting class limits and queue order', () => {
      const pads: Pad[] = [
        { id: 'pad-narrow', maxCls: 'narrowbody', busyUntil: 0 },
        { id: 'pad-wide', maxCls: 'widebody', busyUntil: 0 },
      ];

      const departures: Departure[] = [
        { flightId: 'F1-narrow', cls: 'narrowbody', readyAt: 0 },
        { flightId: 'F2-wide', cls: 'widebody', readyAt: 0 },
        { flightId: 'F3-regional', cls: 'regional', readyAt: 2 },
        { flightId: 'F4-small', cls: 'small', readyAt: 5 },
        { flightId: 'F5-jumbo', cls: 'jumbo', readyAt: 0 }, // no pad fits jumbo
      ];

      const result = scheduleDeicing(0, departures, pads, 10000);

      // 4 assignments, 1 waiting (F5-jumbo)
      expect(result.assignments.length).toBe(4);
      expect(result.waiting).toEqual(['F5-jumbo']);

      // Check class limits respected
      const assignMap = new Map(result.assignments.map((a) => [a.flightId, a]));
      expect(assignMap.get('F2-wide')?.padId).toBe('pad-wide');

      // Check no pad overlaps
      const padAssignments = new Map<string, Array<{ start: number; end: number }>>();
      for (const a of result.assignments) {
        if (!padAssignments.has(a.padId)) {
          padAssignments.set(a.padId, []);
        }
        padAssignments.get(a.padId)!.push({ start: a.start, end: a.end });
      }

      for (const times of padAssignments.values()) {
        times.sort((a, b) => a.start - b.start);
        for (let i = 0; i < times.length - 1; i++) {
          expect(times[i + 1].start).toBeGreaterThanOrEqual(times[i].end);
        }
      }

      // Check glycol used calculation
      const expectedGlycol =
        GLYCOL_LITRES_PER_CLASS['narrowbody'] +
        GLYCOL_LITRES_PER_CLASS['widebody'] +
        GLYCOL_LITRES_PER_CLASS['regional'] +
        GLYCOL_LITRES_PER_CLASS['small'];
      expect(result.glycolUsed).toBe(expectedGlycol);
    });

    it('leaves flights waiting when glycol runs out', () => {
      const stock = new GlycolStock(500); // 500L available
      const pads: Pad[] = [{ id: 'pad-1', maxCls: 'widebody', busyUntil: 0 }];
      const departures: Departure[] = [
        { flightId: 'F1', cls: 'narrowbody', readyAt: 0 }, // needs 400L
        { flightId: 'F2', cls: 'regional', readyAt: 10 },   // needs 250L -> total 650L > 500L
      ];

      const result = scheduleDeicing(0, departures, pads, stock);

      expect(result.assignments.length).toBe(1);
      expect(result.assignments[0].flightId).toBe('F1');
      expect(result.waiting).toEqual(['F2']);
      expect(stock.litres).toBe(100); // 500 - 400 = 100
      expect(result.glycolUsed).toBe(400);
    });
  });

  describe('GlycolStock', () => {
    it('charges orders to ledger and delivers stock only after lead time', () => {
      const stock = new GlycolStock(0);
      const now = 10;

      stock.order(1000, now); // Order 1000 L

      // Ledger entry check
      expect(stock.ledger.length).toBe(1);
      expect(stock.ledger[0]).toEqual({
        kind: 'glycol_order',
        amount: -(1000 * GLYCOL_PRICE_PER_LITRE),
        time: 10,
      });

      // Stock before lead time
      stock.tick(now + GLYCOL_ORDER_LEAD_TIME - 1); // t = 129
      expect(stock.litres).toBe(0);

      // Stock at lead time
      stock.tick(now + GLYCOL_ORDER_LEAD_TIME); // t = 130
      expect(stock.litres).toBe(1000);
    });

    it('consumes stock correctly', () => {
      const stock = new GlycolStock(500);
      expect(stock.consume(200)).toBe(true);
      expect(stock.litres).toBe(300);

      expect(stock.consume(400)).toBe(false);
      expect(stock.litres).toBe(300); // unchanged when consumption fails
    });
  });

  describe('runwayRateFactor', () => {
    it('calculates factor per visibility thresholds and CAT III capability', () => {
      // >= 800m
      expect(runwayRateFactor(1000, false)).toBe(1.0);
      expect(runwayRateFactor(800, false)).toBe(1.0);

      // < 800m and >= 400m
      expect(runwayRateFactor(799, false)).toBe(0.7);
      expect(runwayRateFactor(400, false)).toBe(0.7);

      // < 400m and >= 200m
      expect(runwayRateFactor(399, false)).toBe(0.45);
      expect(runwayRateFactor(200, false)).toBe(0.45);

      // < 200m without CAT III -> 0
      expect(runwayRateFactor(199, false)).toBe(0.0);
      expect(runwayRateFactor(50, false)).toBe(0.0);

      // < 200m with CAT III -> 0.25
      expect(runwayRateFactor(199, true)).toBe(0.25);
      expect(runwayRateFactor(50, true)).toBe(0.25);
    });
  });

  describe('edge case handling and NaN safety', () => {
    it('returns valid results with no NaN for empty or invalid inputs', () => {
      // empty departures/pads
      const emptyResult = scheduleDeicing(NaN, [], [], NaN);
      expect(emptyResult.assignments).toEqual([]);
      expect(emptyResult.waiting).toEqual([]);
      expect(emptyResult.glycolUsed).toBe(0);
      expect(Number.isNaN(emptyResult.glycolUsed)).toBe(false);

      // invalid visibility
      expect(Number.isNaN(runwayRateFactor(NaN, false))).toBe(false);
      expect(Number.isNaN(runwayRateFactor(null, false))).toBe(false);

      // GlycolStock initial NaN
      const nanStock = new GlycolStock(NaN);
      expect(nanStock.litres).toBe(0);
      expect(Number.isNaN(nanStock.litres)).toBe(false);

      nanStock.order(NaN, NaN);
      expect(nanStock.ledger.length).toBe(0);

      nanStock.tick(NaN);
      expect(nanStock.consume(NaN)).toBe(false);
    });
  });
});
