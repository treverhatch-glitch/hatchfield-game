import { describe, expect, it } from 'vitest';
import {
  FlowGraph, HotspotTracker, audit, chainReports, congestionColor, detectHotspots, infoView,
  registerLogistics, registerTerminal, rootCause, traceRoute, vehicleLinkCapacity,
} from './index.ts';

function line(rateB: number, staffB = 2) {
  const g = new FlowGraph();
  g.addNode({ id: 'src', kind: 'source', chain: 'passenger', accepts: {}, ratePerMin: 0, generates: { passenger: 10 }, outCapacity: 50 });
  g.addNode({ id: 'b', kind: 'security', chain: 'passenger', accepts: { passenger: 100 }, ratePerMin: rateB, staffRequired: 2, staffAssigned: staffB });
  g.addNode({ id: 'gate', kind: 'gate', chain: 'passenger', accepts: { passenger: 1000 }, ratePerMin: 100, sink: true });
  g.addLink({ from: 'src', to: 'b', unit: 'passenger', capacityPerMin: 50 });
  g.addLink({ from: 'b', to: 'gate', unit: 'passenger', capacityPerMin: 50 });
  return g;
}
const run = (g: FlowGraph, mins: number, dt = 1) => { for (let t = 0; t < mins; t += dt) g.tick(dt); };

describe('FlowGraph core', () => {
  it('rejects duplicates and dangling links', () => {
    const g = line(20);
    expect(() => g.addNode({ id: 'b', kind: 'generic', chain: 'passenger', accepts: {}, ratePerMin: 1 })).toThrow();
    expect(() => g.addLink({ from: 'x', to: 'b', unit: 'bag', capacityPerMin: 1 })).toThrow();
  });

  it('flows units through at steady state when capacity is enough', () => {
    const g = line(20);
    run(g, 60);
    expect(g.nodeMetrics('gate').processed).toBeGreaterThan(550);
    expect(g.nodeMetrics('b').state).toBe('ok');
    expect(g.nodeMetrics('b').queue).toBeLessThan(15);
  });

  it('conserves units (generated = sunk + held)', () => {
    const g = line(6);
    run(g, 30);
    const sunk = g.nodeMetrics('gate').processed;
    const lost = g.nodeMetrics('src').lost;
    expect(sunk + g.totalHeld('passenger') + lost).toBeCloseTo(300, 6);
  });

  it('queues grow and node becomes overloaded when under capacity', () => {
    const g = line(6);
    run(g, 20);
    const m = g.nodeMetrics('b');
    expect(m.queue).toBeGreaterThan(50);
    expect(m.utilization).toBeCloseTo(1, 5);
    expect(['overloaded', 'blocked']).toContain(m.state);
  });

  it('staffing throttles the rate', () => {
    const g = line(20, 1);
    expect(g.effectiveRate(g.getNode('b'))).toBe(10);
    g.tick(1);
    expect(g.nodeMetrics('b').staffing).toBe(0.5);
  });

  it('efficiency multiplier (research/tier) raises capacity', () => {
    const g = line(10);
    g.setEfficiency('b', 1.5);
    expect(g.effectiveRate(g.getNode('b'))).toBe(15);
  });

  it('blocks upstream when downstream buffer is full', () => {
    const g = new FlowGraph();
    g.addNode({ id: 's', kind: 'source', chain: 'baggage', accepts: {}, ratePerMin: 0, generates: { bag: 10 }, outCapacity: 20 });
    g.addNode({ id: 'sort', kind: 'bagSort', chain: 'baggage', accepts: { bag: 15 }, ratePerMin: 0 });
    g.addLink({ from: 's', to: 'sort', unit: 'bag', capacityPerMin: 100 });
    run(g, 10);
    expect(g.nodeMetrics('s').state).toBe('blocked');
    expect(g.nodeMetrics('s').lost).toBeGreaterThan(0);
    expect(g.totalHeld('bag')).toBeLessThanOrEqual(35 + 1e-9);
  });

  it('honours travel time on links', () => {
    const g = new FlowGraph();
    g.addNode({ id: 'a', kind: 'fuelFarm', chain: 'fuel', accepts: { fuel: 1000 }, ratePerMin: 100 });
    g.addNode({ id: 'z', kind: 'stand', chain: 'fuel', accepts: { fuel: 1e6 }, ratePerMin: 1e6, sink: true });
    g.addLink({ from: 'a', to: 'z', unit: 'fuel', capacityPerMin: 100, travelTimeMin: 5, mode: 'vehicle' });
    g.inject('a', 'fuel', 100);
    run(g, 3);
    expect(g.nodeMetrics('z').processed).toBe(0);
    expect(g.linkMetrics('a>z:fuel').inTransit).toBe(100);
    run(g, 4);
    expect(g.nodeMetrics('z').processed).toBe(100);
  });

  it('splits output by weight and spills to free links', () => {
    const g = new FlowGraph();
    g.addNode({ id: 's', kind: 'source', chain: 'passenger', accepts: {}, ratePerMin: 0, generates: { passenger: 30 }, outCapacity: 60 });
    for (const id of ['l1', 'l2']) g.addNode({ id, kind: 'security', chain: 'passenger', accepts: { passenger: 1000 }, ratePerMin: 100, sink: true });
    g.addLink({ from: 's', to: 'l1', unit: 'passenger', capacityPerMin: 100, weight: 2 });
    g.addLink({ from: 's', to: 'l2', unit: 'passenger', capacityPerMin: 100, weight: 1 });
    run(g, 10);
    const a = g.linkMetrics('s>l1:passenger').moved, b = g.linkMetrics('s>l2:passenger').moved;
    expect(a / b).toBeCloseTo(2, 5);
    g.setLinkCapacity('s>l1:passenger', 5);
    const a0 = a, b0 = b;
    run(g, 10);
    expect(g.linkMetrics('s>l1:passenger').moved - a0).toBeCloseTo(50, 5);
    expect(g.linkMetrics('s>l2:passenger').moved - b0).toBeCloseTo(250, 5);
  });

  it('recipes convert units (kitchen: supply -> meals)', () => {
    const g = new FlowGraph();
    g.addNode({ id: 'k', kind: 'kitchen', chain: 'catering', accepts: { supply: 100 }, ratePerMin: 2, recipes: [{ input: 'supply', output: 'meal', ratio: 4 }], outCapacity: 1000 });
    g.inject('k', 'supply', 10);
    run(g, 3);
    expect(g.getNode('k').outBuf.get('meal')).toBe(24);
    expect(g.withdraw('k', 'meal', 10)).toBe(10);
  });

  it('marks downstream starved when the source dries up and traces root cause', () => {
    const g = new FlowGraph();
    g.addNode({ id: 'farm', kind: 'fuelFarm', chain: 'fuel', accepts: { fuel: 1000 }, ratePerMin: 50 });
    g.addNode({ id: 'hyd', kind: 'hydrant', chain: 'fuel', accepts: { fuel: 100 }, ratePerMin: 50 });
    g.addNode({ id: 'st', kind: 'stand', chain: 'fuel', accepts: { fuel: 1e6 }, ratePerMin: 1e6, sink: true });
    g.addLink({ from: 'farm', to: 'hyd', unit: 'fuel', capacityPerMin: 100, mode: 'pipe' });
    g.addLink({ from: 'hyd', to: 'st', unit: 'fuel', capacityPerMin: 100, mode: 'pipe' });
    g.inject('farm', 'fuel', 100);
    run(g, 10);
    expect(g.nodeMetrics('hyd').state).toBe('starved');
    expect(rootCause(g, 'hyd')).toBe('farm');
    expect(g.nodeMetrics('hyd').starvedMin).toBeGreaterThan(0);
  });

  it('agent hooks count individual passengers without moving them', () => {
    const g = line(20);
    g.recordEnter('b', 5);
    g.recordLeave('b', 2);
    expect(g.getNode('b').agentInside).toBe(3);
    expect(g.nodeMetrics('b').queue).toBe(3);
  });

  it('is deterministic', () => {
    const snap = () => { const g = line(7); run(g, 45, 0.5); return JSON.stringify(audit(g)); };
    expect(snap()).toBe(snap());
  });

  it('vehicle link capacity follows distance (Manor Lords lesson)', () => {
    const near = vehicleLinkCapacity(2, 1000, 1, 1, 2);
    const far = vehicleLinkCapacity(2, 1000, 5, 1, 2);
    expect(near).toBeCloseTo(500, 6);
    expect(far).toBeCloseTo(2000 / 12, 6);
  });
});

describe('analysis', () => {
  it('detects a hotspot at the slow node and suggests a fix', () => {
    const g = line(6);
    run(g, 20);
    const hs = detectHotspots(g);
    expect(hs[0].id).toBe('b');
    expect(hs[0].severity).toBe('high');
    const chain = chainReports(g).find((c) => c.chain === 'passenger')!;
    expect(chain.weakestId).toBe('b');
    expect(chain.fix?.research).toBe('CT Scanners');
  });

  it('no hotspots when healthy', () => {
    const g = line(40);
    run(g, 30);
    expect(detectHotspots(g)).toHaveLength(0);
  });

  it('tracker requires persistence', () => {
    const g = line(6);
    run(g, 20);
    const t = new HotspotTracker(3);
    expect(t.sample(g)).toHaveLength(0);
    t.sample(g);
    expect(t.sample(g).map((h) => h.id)).toContain('b');
  });

  it('traces routes upstream and downstream with shares', () => {
    const g = new FlowGraph();
    g.addNode({ id: 'c1', kind: 'source', chain: 'passenger', accepts: {}, ratePerMin: 0, generates: { passenger: 30 }, outCapacity: 60 });
    g.addNode({ id: 'c2', kind: 'source', chain: 'passenger', accepts: {}, ratePerMin: 0, generates: { passenger: 10 }, outCapacity: 60 });
    g.addNode({ id: 'sec', kind: 'security', chain: 'passenger', accepts: { passenger: 1000 }, ratePerMin: 100 });
    g.addNode({ id: 'gate', kind: 'gate', chain: 'passenger', accepts: { passenger: 1000 }, ratePerMin: 100, sink: true });
    g.addLink({ from: 'c1', to: 'sec', unit: 'passenger', capacityPerMin: 100 });
    g.addLink({ from: 'c2', to: 'sec', unit: 'passenger', capacityPerMin: 100 });
    g.addLink({ from: 'sec', to: 'gate', unit: 'passenger', capacityPerMin: 100 });
    run(g, 10);
    const tr = traceRoute(g, 'sec');
    expect(tr.upstream.find((h) => h.id === 'c1')!.share).toBeCloseTo(0.75, 5);
    expect(tr.downstream.map((h) => h.id)).toEqual(['gate']);
    const fromGate = traceRoute(g, 'gate');
    expect(fromGate.upstream.map((h) => h.id)).toEqual(['sec', 'c1', 'c2']);
  });
});

describe('info views and audit', () => {
  it('maps congestion to the green-red gradient', () => {
    expect(congestionColor(0)).toBe('#2ecc71');
    expect(congestionColor(1)).toBe('#e74c3c');
    expect(congestionColor(5)).toBe('#e74c3c');
    expect(congestionColor(0.5)).toBe('#f1c40f');
  });

  it('builds per-unit view data with dimmed irrelevant nodes and trace colours', () => {
    const g = line(6);
    g.addNode({ id: 'farm', kind: 'fuelFarm', chain: 'fuel', accepts: { fuel: 10 }, ratePerMin: 1 });
    run(g, 20);
    const v = infoView(g, 'passengers', 'b');
    expect(v.links).toHaveLength(2);
    expect(v.nodes.find((n) => n.id === 'farm')!.relevant).toBe(false);
    expect(v.nodes.find((n) => n.id === 'b')!.color).toBe('#e74c3c');
    expect(v.links.find((l) => l.from === 'src')!.trace).toBe('upstream');
    expect(v.links.find((l) => l.to === 'gate')!.trace).toBe('downstream');
    expect(v.panel.topHotspots[0].id).toBe('b');
    expect(infoView(g, 'fuel').links).toHaveLength(0);
  });

  it('audit snapshot totals', () => {
    const g = line(6);
    run(g, 20);
    const a = audit(g);
    expect(a.nodes).toHaveLength(3);
    expect(a.totals.p95WaitMin).toBeGreaterThan(0);
    expect(a.held.passenger).toBeGreaterThan(0);
    expect(a.hotspots[0].id).toBe('b');
  });
});

describe('adapters', () => {
  it('logistics: fuel by truck and hydrant, catering via kitchen', () => {
    const g = new FlowGraph();
    registerLogistics(g, {
      fuelFarm: { id: 'ff', capacityL: 50000, pumpLPerMin: 2000, staff: 2, staffRequired: 2 },
      tankerSupplyLPerMin: 500,
      kitchen: { id: 'kit', storeCapacity: 200, mealsPerSupply: 4, supplyPerMin: 5, staff: 1, staffRequired: 2 },
      supplierPerMin: 3,
      stands: [{ id: 'A1', hydrant: true, distance: 1 }, { id: 'R1', distance: 4 }],
      fuelTrucks: { count: 1, payloadL: 10000, speedPerMin: 1, serviceMin: 2 },
      cateringTrucks: { count: 2, payloadMeals: 100, speedPerMin: 1, serviceMin: 3 },
      hydrantLPerMin: 800,
    });
    g.inject('ff', 'fuel', 20000);
    run(g, 30);
    expect(g.nodeMetrics('stand:A1').processed).toBeGreaterThan(0);
    expect(g.nodeMetrics('stand:R1').processed).toBeGreaterThan(0);
    expect(g.nodeMetrics('kit').state).toBe('understaffed');
    expect(infoView(g, 'catering').links.length).toBe(3);
    expect(chainReports(g).map((c) => c.chain)).toEqual(['catering', 'fuel', 'ground']);
  });

  it('terminal: departure order, agent hooks, bags and missed flights', () => {
    const g = new FlowGraph();
    const t = registerTerminal(g, [
      { id: 'curb', kind: 'curb', servers: 4, ratePerServer: 15, queueCapacity: 200 },
      { id: 'ci', kind: 'checkin', servers: 4, ratePerServer: 1.5, staffPerServer: 1, queueCapacity: 120 },
      { id: 'sec1', kind: 'security', servers: 1, ratePerServer: 20, staffPerServer: 2, queueCapacity: 80 },
      { id: 'sec2', kind: 'security', servers: 1, ratePerServer: 20, staffPerServer: 2, staffAssigned: 2, queueCapacity: 80 },
      { id: 'food', kind: 'food', servers: 3, ratePerServer: 5, queueCapacity: 60 },
      { id: 'g1', kind: 'gate', servers: 1, ratePerServer: 15, queueCapacity: 180 },
    ], { bagsPerPax: 1, bagSortRate: 30 });
    expect(g.outgoing('ci').map((l) => l.def.to)).toEqual(['sec1', 'sec2']);
    expect(g.outgoing('sec1').map((l) => l.def.to)).toEqual(['food']);
    t.onZoneEnter('ci', 10);
    t.onZoneLeave('ci', 4);
    expect(g.nodeMetrics('ci').queue).toBe(6);
    expect(t.onBagsChecked(4)).toBe(0);
    t.onMissedFlight('g1', 2);
    run(g, 2);
    expect(g.nodeMetrics('g1').lost).toBe(2);
    expect(g.nodeMetrics('bag:sort').processed).toBe(4);
    // aggregate mode also works: inject pax at the curb and they reach the gate
    g.inject('curb', 'passenger', 30);
    run(g, 30);
    expect(g.nodeMetrics('g1').processed).toBeCloseTo(30, 6);
  });
});

describe('performance', () => {
  it('500 nodes / ~1000 links tick fast enough', () => {
    const g = new FlowGraph();
    for (let c = 0; c < 50; c++) {
      g.addNode({ id: `s${c}`, kind: 'source', chain: 'baggage', accepts: {}, ratePerMin: 0, generates: { bag: 5 }, outCapacity: 20 });
      for (let i = 1; i < 10; i++) {
        g.addNode({ id: `n${c}-${i}`, kind: 'bagSort', chain: 'baggage', accepts: { bag: 50 }, ratePerMin: 6, sink: i === 9 });
        g.addLink({ from: i === 1 ? `s${c}` : `n${c}-${i - 1}`, to: `n${c}-${i}`, unit: 'bag', capacityPerMin: 10 });
        if (c > 0) g.addLink({ from: i === 1 ? `s${c}` : `n${c}-${i - 1}`, to: `n${c - 1}-${i}`, unit: 'bag', capacityPerMin: 2 });
      }
    }
    for (let i = 0; i < 20; i++) g.tick(1);
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) g.tick(1);
    const per = (performance.now() - t0) / 100;
    expect(g.nodes.size).toBe(500);
    expect(per).toBeLessThan(20);
  });
});
