// Run: npx tsx --test src/advisor/advisor.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Advisor, ALL_RULES, isGrowing, securityQueue, bagsLeft, fuel, shopStock, standSize, cashBurn, airlineStanding, cateringLate, runwayCapacity } from './index';

test('isGrowing', () => {
  assert.equal(isGrowing([5, 10, 20, 30, 45]), true);
  assert.equal(isGrowing([40, 38, 41, 39, 40]), false);
  assert.equal(isGrowing([1, 2, 3, 4, 5]), false); // too small
});
test('security queue suggests opening lane when available', () => {
  const [c] = securityQueue({ time: 0, checkpoints: [{ id: 'sec', queue: 90, queueHistory: [10, 30, 50, 70, 90], lanesOpen: 1, lanesMax: 2 }] });
  assert.equal(c.severity, 'critical'); assert.match(c.fix, /Open another lane/); assert.equal(c.target?.id, 'sec');
});
test('bags left behind', () => {
  const [c] = bagsLeft({ time: 0, departures: [{ flightId: 'HF1', standId: 'A1', bagsLoaded: 0, bagsExpected: 193 }, { flightId: 'HF2', bagsLoaded: 10, bagsExpected: 10 }] });
  assert.equal(c.key, 'bags-left:HF1'); assert.equal(c.details?.missing, 193); assert.equal(c.severity, 'critical');
});
test('fuel outage beats low', () => {
  assert.equal(fuel({ time: 0, fuel: { storagePct: 2, groundedFlights: 3, trucksIdle: 0, trucksTotal: 2 } })[0].key, 'fuel:outage');
  assert.equal(fuel({ time: 0, fuel: { storagePct: 10, groundedFlights: 0, trucksIdle: 1, trucksTotal: 2 } })[0].key, 'fuel:low');
  assert.equal(fuel({ time: 0, fuel: { storagePct: 80, groundedFlights: 0, trucksIdle: 1, trucksTotal: 2 } }).length, 0);
});
test('shop, stand, catering, runway', () => {
  assert.equal(shopStock({ time: 0, shops: [{ id: 's', name: 'Cafe', outOfStock: ['coffee'] }] }).length, 1);
  assert.equal(standSize({ time: 0, standConflicts: [{ standId: 'B2', flightId: 'X', aircraft: 'A380', standClass: 'C', needClass: 'F' }] })[0].target?.kind, 'stand');
  assert.equal(cateringLate({ time: 0, catering: [{ flightId: 'X', minutesLate: 3 }, { flightId: 'Y', minutesLate: 25 }] }).map((c) => c.severity).join(), 'critical');
  assert.equal(runwayCapacity({ time: 0, runways: [{ id: '09L', hourMovements: 40, capacityPerHour: 30 }, { id: '09R', hourMovements: 20, capacityPerHour: 30 }] }).length, 1);
});
test('cash burn forecast', () => {
  const [c] = cashBurn({ time: 0, cash: { balance: 100_000, perDay: -23_000 } });
  assert.equal(c.title, 'Cash runs out in ~4 days'); assert.equal(c.severity, 'critical');
  assert.equal(cashBurn({ time: 0, cash: { balance: 10_000_000, perDay: -23_000 } }).length, 0);
  assert.equal(cashBurn({ time: 0, cash: { balance: 0, perDay: 5 } }).length, 0);
});
test('airline standing', () => {
  assert.equal(airlineStanding({ time: 0, airlines: [{ id: 'a', name: 'Siam Air', standing: 20, standingDelta7d: -15, reason: 'late turnarounds' }] })[0].body, 'Standing is dropping: late turnarounds.');
});
test('engine dedupes, sorts, caps, cools down, dismisses', () => {
  const adv = new Advisor({ cooldown: 60, dismissCooldown: 300, maxCards: 3 });
  const snap = (t: number, bad = true) => ({ time: t,
    shops: bad ? [{ id: 's', name: 'Cafe', outOfStock: ['x'] }] : [],
    fuel: bad ? { storagePct: 1, groundedFlights: 1, trucksIdle: 0, trucksTotal: 1 } : undefined,
    runways: bad ? [{ id: 'r', hourMovements: 31, capacityPerHour: 30 }] : [] });
  let cards = adv.update(snap(0));
  assert.deepEqual(cards.map((c) => c.rule), ['fuel', 'runway-capacity', 'shop-stock']);
  cards = adv.update(snap(10)); assert.equal(cards.length, 3); assert.equal(cards[0].createdAt, 0);
  assert.equal(adv.update(snap(30, false)).length, 3); // cleared, but within cooldown
  assert.equal(adv.update(snap(80, false)).length, 0);
  adv.update(snap(100)); adv.dismiss('fuel:outage', 100);
  assert.ok(!adv.update(snap(200)).some((c) => c.key === 'fuel:outage'));
  assert.ok(adv.update(snap(450)).some((c) => c.key === 'fuel:outage'));
});
test('empty snapshot yields nothing', () => {
  for (const r of ALL_RULES) assert.deepEqual(r({ time: 0 }), []);
});
