/**
 * Adapter: registers terminal zones (sim.ts, owned by the terminal agent) as flow nodes.
 * Passengers stay individual agents in sim.ts. The sim calls `onZoneEnter` / `onZoneLeave`
 * as agents cross zones so the flow layer can measure them without simulating them twice.
 * Bags are aggregate units created at check-in.
 */
import { FlowGraph } from '../graph.ts';
import type { NodeKind, Vec2 } from '../types.ts';

export type TerminalZoneKind = 'curb' | 'checkin' | 'security' | 'gate' | 'shops' | 'food' | 'toilets' | 'arrivals' | 'claim' | 'exit';

export interface TerminalZone {
  id: string;
  kind: TerminalZoneKind;
  /** Desks, lanes, doors etc. */
  servers: number;
  /** Pax per minute per server at full staffing. */
  ratePerServer: number;
  staffPerServer?: number;
  staffAssigned?: number;
  queueCapacity: number;
  position?: Vec2;
}

const KIND: Record<TerminalZoneKind, NodeKind> = {
  curb: 'entry', checkin: 'checkin', security: 'security', gate: 'gate', shops: 'retail',
  food: 'food', toilets: 'toilet', arrivals: 'entry', claim: 'claim', exit: 'exit',
};

/** Real departure order: curb -> check-in -> security -> airside (shops/food/toilets) -> gate. */
const DEPARTURE_ORDER: TerminalZoneKind[] = ['curb', 'checkin', 'security', 'shops', 'food', 'toilets', 'gate'];

export interface TerminalAdapter {
  onZoneEnter(zoneId: string, count?: number): void;
  onZoneLeave(zoneId: string, count?: number): void;
  onMissedFlight(zoneId: string, count?: number): void;
  /** Pax checked in with bags: bags enter screening. Returns overflow (mishandled). */
  onBagsChecked(paxCount: number): number;
}

export function registerTerminal(g: FlowGraph, zones: TerminalZone[], opts: { bagsPerPax?: number; bagSortRate?: number } = {}): TerminalAdapter {
  for (const z of zones) {
    const staffReq = z.staffPerServer ? z.staffPerServer * z.servers : undefined;
    g.addNode({
      id: z.id, kind: KIND[z.kind], chain: z.kind === 'shops' || z.kind === 'food' ? 'retail' : 'passenger', position: z.position,
      accepts: { passenger: z.queueCapacity },
      ratePerMin: z.servers * z.ratePerServer, staffRequired: staffReq, staffAssigned: z.staffAssigned ?? staffReq,
      sink: z.kind === 'gate' || z.kind === 'exit',
    });
  }
  // Wire departure zones in order, splitting across parallel zones of the same kind.
  const byKind = (k: TerminalZoneKind) => zones.filter((z) => z.kind === k);
  const seq = DEPARTURE_ORDER.map(byKind).filter((a) => a.length > 0);
  for (let i = 0; i + 1 < seq.length; i++) {
    for (const a of seq[i]) for (const b of seq[i + 1]) {
      g.addLink({ from: a.id, to: b.id, unit: 'passenger', capacityPerMin: Math.max(1, b.servers * b.ratePerServer * 2), mode: 'walk', travelTimeMin: 0 });
    }
  }
  const arr = byKind('arrivals'), claim = byKind('claim'), exit = byKind('exit');
  for (const [from, to] of [[arr, claim], [claim, exit]] as const) for (const a of from) for (const b of to) {
    g.addLink({ from: a.id, to: b.id, unit: 'passenger', capacityPerMin: Math.max(1, b.servers * b.ratePerServer * 2), mode: 'walk' });
  }
  // Bags: check-in hands bags to hold-bag screening, then the sorter / make-up area.
  const hasBags = (opts.bagsPerPax ?? 0) > 0 && byKind('checkin').length > 0;
  if (hasBags) {
    g.addNode({ id: 'bag:screen', kind: 'bagScreen', chain: 'baggage', accepts: { bag: 200 }, ratePerMin: 30, targetWaitMin: 15 });
    g.addNode({ id: 'bag:sort', kind: 'bagSort', chain: 'baggage', accepts: { bag: 500 }, ratePerMin: opts.bagSortRate ?? 30, sink: true, targetWaitMin: 15 });
    g.addLink({ from: 'bag:screen', to: 'bag:sort', unit: 'bag', capacityPerMin: 60, mode: 'belt' });
  }
  return {
    onZoneEnter: (id, count = 1) => g.recordEnter(id, count),
    onZoneLeave: (id, count = 1) => g.recordLeave(id, count),
    onMissedFlight: (id, count = 1) => g.recordLoss(id, count),
    onBagsChecked: (pax) => {
      if (!hasBags) return 0;
      const over = g.inject('bag:screen', 'bag', pax * (opts.bagsPerPax ?? 0));
      if (over > 0) g.recordLoss('bag:screen', over);
      return over;
    },
  };
}
