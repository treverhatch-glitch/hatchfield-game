import type { AdvisorSnapshot, Rule } from './types';

const fmtMoney = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

/** Queue is "growing" if it rose in most of the last samples and is now meaningful. */
export function isGrowing(hist: number[], min = 15): boolean {
  if (hist.length < 4) return false;
  const h = hist.slice(-6);
  let ups = 0;
  for (let i = 1; i < h.length; i++) if (h[i] > h[i - 1]) ups++;
  return h[h.length - 1] >= min && ups >= Math.ceil((h.length - 1) * 0.6) && h[h.length - 1] > h[0];
}

export const securityQueue: Rule = (s) =>
  (s.checkpoints ?? []).filter((c) => isGrowing(c.queueHistory)).map((c) => ({
    key: `security-queue:${c.id}`, rule: 'security-queue',
    severity: c.queue >= 80 ? 'critical' : 'warn',
    title: 'Security queue is growing',
    body: 'More passengers are arriving at security than it can screen.',
    fix: c.lanesOpen < c.lanesMax ? 'Open another lane or add staff.' : 'Build another security lane or widen the hall.',
    target: { kind: 'room', id: c.id, pos: c.pos },
    details: { queue: c.queue, lanesOpen: c.lanesOpen, lanesMax: c.lanesMax },
  }));

export const bagsLeft: Rule = (s) =>
  (s.departures ?? []).filter((d) => d.bagsExpected > 0 && d.bagsLoaded < d.bagsExpected).map((d) => {
    const missing = d.bagsExpected - d.bagsLoaded;
    return {
      key: `bags-left:${d.flightId}`, rule: 'bags-left',
      severity: missing / d.bagsExpected >= 0.25 ? 'critical' : 'warn',
      title: `${d.flightId} left bags behind`,
      body: 'Bags did not reach the aircraft before doors closed.',
      fix: 'Add baggage tugs or shorten the belt route to this stand.',
      target: d.standId ? { kind: 'stand', id: d.standId, pos: d.pos } : undefined,
      details: { loaded: d.bagsLoaded, expected: d.bagsExpected, missing },
    };
  });

export const fuel: Rule = (s) => {
  const f = s.fuel; if (!f) return [];
  if (f.groundedFlights > 0) return [{
    key: 'fuel:outage', rule: 'fuel', severity: 'critical', title: 'Fuel outage is grounding flights',
    body: 'Flights cannot depart because fuel is not reaching them.',
    fix: f.storagePct < 5 ? 'Order a fuel delivery or build more tank storage.' : 'Buy more fuel trucks.',
    target: { kind: 'vehicle', id: 'fuel-farm', pos: f.farmPos },
    details: { storagePct: f.storagePct, grounded: f.groundedFlights, trucksIdle: f.trucksIdle, trucksTotal: f.trucksTotal },
  }];
  if (f.storagePct < 20) return [{
    key: 'fuel:low', rule: 'fuel', severity: 'warn', title: 'Fuel storage is low',
    body: 'Fuel stock will run out soon at the current pace.',
    fix: 'Order a fuel delivery or build more tank storage.',
    target: { kind: 'vehicle', id: 'fuel-farm', pos: f.farmPos }, details: { storagePct: f.storagePct },
  }];
  return [];
};

export const shopStock: Rule = (s) =>
  (s.shops ?? []).filter((x) => x.outOfStock.length > 0).map((x) => ({
    key: `shop-stock:${x.id}`, rule: 'shop-stock', severity: 'info',
    title: `${x.name} is out of stock`, body: 'Passengers are leaving without buying.',
    fix: 'Add a supply run or a storeroom closer to the shop.',
    target: { kind: 'shop', id: x.id, pos: x.pos }, details: { items: x.outOfStock.join(', ') },
  }));

export const standSize: Rule = (s) =>
  (s.standConflicts ?? []).map((c) => ({
    key: `stand-size:${c.standId}:${c.flightId}`, rule: 'stand-size', severity: 'warn',
    title: `Stand ${c.standId} is too small`, body: `${c.aircraft} needs a class ${c.needClass} stand.`,
    fix: 'Move the flight to a larger stand in the timetable, or upgrade this stand.',
    target: { kind: 'stand', id: c.standId, pos: c.pos },
    details: { flight: c.flightId, standClass: c.standClass, needClass: c.needClass },
  }));

export const cashBurn: Rule = (s) => {
  const c = s.cash; if (!c || c.perDay >= 0) return [];
  const days = c.balance > 0 ? c.balance / -c.perDay : 0;
  if (days > 30) return [];
  return [{
    key: 'cash-burn', rule: 'cash-burn', severity: days <= 7 ? 'critical' : 'warn',
    title: days <= 0 ? 'You are out of cash' : `Cash runs out in ~${Math.max(1, Math.floor(days))} days`,
    body: 'Daily costs are higher than income.',
    fix: 'Check the Finance panel for the biggest cost and sign another airline.',
    target: { kind: 'panel', id: 'finance', panel: 'finance' },
    details: { balance: fmtMoney(c.balance), perDay: fmtMoney(c.perDay), daysLeft: Math.floor(days) },
  }];
};

export const airlineStanding: Rule = (s) =>
  (s.airlines ?? []).filter((a) => a.standingDelta7d <= -10 || a.standing <= -40).map((a) => ({
    key: `airline-standing:${a.id}`, rule: 'airline-standing',
    severity: a.standing <= -60 ? 'critical' : 'warn',
    title: `${a.name} is unhappy`, body: a.reason ? `Standing is dropping: ${a.reason}.` : 'Standing is dropping.',
    fix: 'Open Diplomacy to see their complaints and fix their worst service.',
    target: { kind: 'panel', id: `airline:${a.id}`, panel: 'diplomacy' },
    details: { standing: a.standing, change7d: a.standingDelta7d },
  }));

export const cateringLate: Rule = (s) =>
  (s.catering ?? []).filter((c) => c.minutesLate >= 5).map((c) => ({
    key: `catering-late:${c.flightId}`, rule: 'catering-late',
    severity: c.minutesLate >= 20 ? 'critical' : 'warn',
    title: `Catering late for ${c.flightId}`, body: 'Carts are holding up the turnaround.',
    fix: 'Add catering trucks or build the kitchen closer to the stands.',
    target: c.standId ? { kind: 'stand', id: c.standId, pos: c.pos } : undefined,
    details: { minutesLate: c.minutesLate },
  }));

export const runwayCapacity: Rule = (s) =>
  (s.runways ?? []).filter((r) => r.capacityPerHour > 0 && r.hourMovements > r.capacityPerHour).map((r) => ({
    key: `runway-capacity:${r.id}`, rule: 'runway-capacity',
    severity: r.hourMovements > r.capacityPerHour * 1.25 ? 'critical' : 'warn',
    title: `Runway ${r.id} is over capacity`, body: 'More flights are scheduled this hour than it can handle.',
    fix: 'Drag flights to a quieter hour in the timetable, or build another runway.',
    target: { kind: 'runway', id: r.id, pos: r.pos },
    details: { movements: r.hourMovements, capacity: r.capacityPerHour },
  }));

export const ALL_RULES: Rule[] = [securityQueue, bagsLeft, fuel, shopStock, standSize, cashBurn, airlineStanding, cateringLate, runwayCapacity];
