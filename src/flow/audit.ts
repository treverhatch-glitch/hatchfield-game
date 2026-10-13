import { chainReports, detectHotspots } from './analysis.ts';
import type { FlowGraph } from './graph.ts';
import type { ChainReport, Hotspot, NodeMetrics, UnitType } from './types.ts';
import { UNIT_TYPES } from './types.ts';

export interface AuditSnapshot {
  time: number;
  nodes: NodeMetrics[];
  chains: ChainReport[];
  hotspots: Hotspot[];
  totals: { processed: number; lost: number; meanWaitMin: number; p95WaitMin: number; starvedMin: number; blockedMin: number };
  held: Partial<Record<UnitType, number>>;
}

/** Audit snapshot: throughput, losses, waits, weakest link per chain. Feeds weekly/monthly reports. */
export function audit(g: FlowGraph): AuditSnapshot {
  const nodes = [...g.nodes.keys()].map((id) => g.nodeMetrics(id));
  const waits = nodes.map((m) => m.waitMin).filter((w) => Number.isFinite(w) && w > 0).sort((a, b) => a - b);
  const sum = (f: (m: NodeMetrics) => number) => nodes.reduce((a, m) => a + f(m), 0);
  const held: Partial<Record<UnitType, number>> = {};
  for (const u of UNIT_TYPES) {
    const h = g.totalHeld(u);
    if (h > 0) held[u] = h;
  }
  return {
    time: g.time,
    nodes,
    chains: chainReports(g),
    hotspots: detectHotspots(g),
    totals: {
      processed: sum((m) => m.processed),
      lost: sum((m) => m.lost),
      meanWaitMin: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
      p95WaitMin: waits.length ? waits[Math.min(waits.length - 1, Math.floor(waits.length * 0.95))] : 0,
      starvedMin: sum((m) => m.starvedMin),
      blockedMin: sum((m) => m.blockedMin),
    },
    held,
  };
}
