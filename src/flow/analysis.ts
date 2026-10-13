import type { FlowGraph, FlowNode } from './graph.ts';
import type { ChainId, ChainReport, FixSuggestion, Hotspot, HotspotSeverity, NodeKind, UnitType } from './types.ts';

export const HOTSPOT_CONGESTION = 0.85;

function severity(score: number): HotspotSeverity {
  return score >= 1.2 ? 'high' : score >= 1 ? 'medium' : 'low';
}

/** Pressure score for a node: >= 0.85 is a candidate hotspot, >= 1 is saturated. */
export function nodeScore(g: FlowGraph, n: FlowNode): number {
  const m = g.nodeMetrics(n.def.id);
  const target = n.def.targetWaitMin ?? 10;
  const waitScore = Number.isFinite(m.waitMin) ? m.waitMin / target : 2;
  let s = Math.max(m.utilization, Math.min(2, waitScore));
  if (m.state === 'blocked') s = Math.max(s, 1.2);
  if (m.state === 'starved') s = Math.max(s, 1);
  if (m.state === 'understaffed') s = Math.max(s, 0.9 + (1 - m.staffing) * 0.5);
  return s;
}

/** Walk upstream (starved) or downstream (blocked) to the first constrained node. */
export function rootCause(g: FlowGraph, id: string): string | undefined {
  const start = g.getNode(id);
  const dir = start.state === 'starved' ? 'up' : start.state === 'blocked' ? 'down' : null;
  if (!dir) return undefined;
  const seen = new Set<string>([id]);
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const cur of frontier) {
      const links = dir === 'up' ? g.incoming(cur) : g.outgoing(cur);
      for (const l of links) {
        const nid = dir === 'up' ? l.def.from : l.def.to;
        if (seen.has(nid)) continue;
        seen.add(nid);
        const n = g.getNode(nid);
        const lm = g.linkMetrics(l.def.id);
        if (lm.congestion >= HOTSPOT_CONGESTION) return l.def.id;
        if (n.state === 'understaffed' || n.state === 'overloaded' || n.state === 'blocked') return nid;
        if (dir === 'up' && (n.state === 'starved' || n.state === 'idle') && g.incoming(nid).length === 0) return nid;
        next.push(nid);
      }
    }
    frontier = next;
  }
  return undefined;
}

/** Instant hotspot scan, sorted by score desc then id (deterministic). */
export function detectHotspots(g: FlowGraph, unit?: UnitType): Hotspot[] {
  const out: Hotspot[] = [];
  for (const n of g.nodes.values()) {
    if (unit && !(unit in n.def.accepts) && !(n.def.generates && unit in n.def.generates)) continue;
    const s = nodeScore(g, n);
    if (s < HOTSPOT_CONGESTION) continue;
    const m = g.nodeMetrics(n.def.id);
    const reason =
      m.state === 'starved' ? 'starved: no input' :
      m.state === 'blocked' ? 'blocked: output full' :
      m.state === 'understaffed' ? `understaffed ${Math.round(m.staffing * 100)}%` :
      Number.isFinite(m.waitMin) && m.waitMin > (n.def.targetWaitMin ?? 10) ? `wait ${m.waitMin.toFixed(1)} min` :
      `utilisation ${Math.round(m.utilization * 100)}%`;
    out.push({ kind: 'node', id: n.def.id, severity: severity(s), score: s, reason, rootCause: rootCause(g, n.def.id), position: n.def.position });
  }
  for (const l of g.links.values()) {
    if (unit && l.def.unit !== unit) continue;
    const m = g.linkMetrics(l.def.id);
    if (m.congestion < HOTSPOT_CONGESTION && l.held <= 0) continue;
    const s = Math.max(m.congestion, l.held > 0 ? 1 : 0);
    const a = g.getNode(l.def.from).def.position;
    const b = g.getNode(l.def.to).def.position;
    out.push({
      kind: 'link', id: l.def.id, unit: l.def.unit, severity: severity(s), score: s,
      reason: `link ${Math.round(m.congestion * 100)}% of capacity`,
      position: a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : undefined,
    });
  }
  return out.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1));
}

/** Hotspots that persist N consecutive samples (avoids flicker). */
export class HotspotTracker {
  readonly samplesRequired: number;
  private streak = new Map<string, number>();
  constructor(samplesRequired = 3) {
    this.samplesRequired = samplesRequired;
  }
  sample(g: FlowGraph): Hotspot[] {
    const now = detectHotspots(g);
    const ids = new Set(now.map((h) => h.id));
    for (const k of this.streak.keys()) if (!ids.has(k)) this.streak.delete(k);
    for (const h of now) this.streak.set(h.id, (this.streak.get(h.id) ?? 0) + 1);
    return now.filter((h) => (this.streak.get(h.id) ?? 0) >= this.samplesRequired);
  }
}

export interface TraceHop {
  id: string;
  depth: number;
  /** Share of the selected node's flow that passes through this node (0..1). */
  share: number;
  via: string;
}

export interface RouteTrace {
  id: string;
  unit?: UnitType;
  upstream: TraceHop[];
  downstream: TraceHop[];
  links: string[];
}

/** CS2-style route tracing: where units come from and go to, with flow shares by link volume. */
export function traceRoute(g: FlowGraph, id: string, unit?: UnitType, maxDepth = 12): RouteTrace {
  g.getNode(id);
  const links = new Set<string>();
  const walk = (dir: 'up' | 'down'): TraceHop[] => {
    const hops = new Map<string, TraceHop>();
    let frontier: { id: string; share: number }[] = [{ id, share: 1 }];
    for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
      const next = new Map<string, number>();
      for (const f of frontier) {
        const ls = (dir === 'up' ? g.incoming(f.id) : g.outgoing(f.id)).filter((l) => !unit || l.def.unit === unit);
        const total = ls.reduce((a, l) => a + l.moved, 0);
        for (const l of ls) {
          const nid = dir === 'up' ? l.def.from : l.def.to;
          if (nid === id) continue;
          const share = f.share * (total > 0 ? l.moved / total : 1 / ls.length);
          links.add(l.def.id);
          next.set(nid, (next.get(nid) ?? 0) + share);
          if (!hops.has(nid)) hops.set(nid, { id: nid, depth, share: 0, via: l.def.id });
        }
      }
      frontier = [];
      for (const [nid, share] of next) {
        const h = hops.get(nid)!;
        if (h.depth === depth) {
          h.share += share;
          frontier.push({ id: nid, share });
        }
      }
    }
    return [...hops.values()].sort((a, b) => a.depth - b.depth || b.share - a.share || (a.id < b.id ? -1 : 1));
  };
  const upstream = walk('up');
  const downstream = walk('down');
  return { id, unit, upstream, downstream, links: [...links].sort() };
}

const FIXES: Partial<Record<NodeKind, FixSuggestion>> = {
  checkin: { build: 'Add check-in desks or kiosks', upgrade: 'Check-in Hall II/III', research: 'Self-Service Kiosks / Bag-Drop Automation' },
  security: { build: 'Add a security lane', upgrade: 'Security hall tier', research: 'CT Scanners' },
  bagScreen: { build: 'Add a screening machine', upgrade: 'HBS tier', research: 'Faster Belts' },
  bagSort: { build: 'Add make-up laterals', upgrade: 'Sorter tier', research: 'Tilt-Tray Sorter' },
  claim: { build: 'Add a carousel', upgrade: 'Arrivals hall tier', research: 'RFID Tracking' },
  gate: { build: 'Add gates or stands', upgrade: 'Pier Concourse II', research: 'Biometric Boarding' },
  kitchen: { build: 'Add catering trucks', upgrade: 'Catering Kitchen II/III', research: 'Remote Catering Hub' },
  fuelFarm: { build: 'Add fuel trucks', upgrade: 'Fuel Farm II/III', research: 'Hydrant Fuel System' },
  hydrant: { build: 'Add hydrant dispensers', upgrade: 'Fuel Farm II', research: 'Hydrant Fuel System' },
  cargoShed: { build: 'Add loaders', upgrade: 'Cargo Shed II', research: 'Belly Cargo Handling' },
  retail: { build: 'Add back-of-house storage', upgrade: 'Retail Plaza II', research: 'Food Court Leases' },
  food: { build: 'Add food outlets', upgrade: 'Retail Plaza II', research: 'Food Court Leases' },
  staffPool: { build: 'Staff housing', upgrade: 'Training Centre', research: 'Staff Village / Rail Link' },
  vehiclePool: { build: 'Buy more vehicles', upgrade: 'GSE Depot II', research: 'Extra Vehicle Bays' },
  power: { build: 'Add a substation', upgrade: 'Substation tier', research: 'Battery Storage' },
};
const GENERIC_FIX: FixSuggestion = { build: 'Build another of this', upgrade: 'Upgrade the tier', research: 'Research an efficiency node' };

export function fixFor(kind: NodeKind): FixSuggestion {
  return FIXES[kind] ?? GENERIC_FIX;
}

/** Weakest link per chain = highest pressure node or link among the chain's members. */
export function chainReports(g: FlowGraph): ChainReport[] {
  const chains = new Map<ChainId, ChainReport>();
  const get = (c: ChainId) => {
    let r = chains.get(c);
    if (!r) {
      r = { chain: c, throughput: 0, weakestId: null, weakestKind: null, weakestScore: -1, fix: null };
      chains.set(c, r);
    }
    return r;
  };
  for (const n of g.nodes.values()) {
    const r = get(n.def.chain);
    if (n.def.sink) r.throughput += n.processedRate;
    if (n.def.generates || n.def.sink) continue;
    const s = nodeScore(g, n);
    if (s > r.weakestScore) {
      r.weakestScore = s;
      r.weakestId = n.def.id;
      r.weakestKind = 'node';
      r.fix = fixFor(n.def.kind);
    }
  }
  for (const l of g.links.values()) {
    const r = get(g.getNode(l.def.from).def.chain);
    const s = g.linkMetrics(l.def.id).congestion;
    if (s > r.weakestScore) {
      r.weakestScore = s;
      r.weakestId = l.def.id;
      r.weakestKind = 'link';
      r.fix = l.def.mode === 'vehicle' ? fixFor('vehiclePool') : { build: 'Widen or add a parallel route', upgrade: 'Upgrade the link (belt, road)', research: 'Faster Belts / Autonomous Tugs' };
    }
  }
  return [...chains.values()].sort((a, b) => (a.chain < b.chain ? -1 : 1));
}
