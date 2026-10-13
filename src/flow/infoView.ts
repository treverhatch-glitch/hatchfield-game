import { detectHotspots, traceRoute } from './analysis.ts';
import type { FlowGraph } from './graph.ts';
import type { Hotspot, InfoViewId, NodeState, UnitType } from './types.ts';
import { VIEW_UNITS } from './types.ts';

/** CS-style gradient stops: green -> yellow -> orange -> red. */
export const CONGESTION_STOPS: readonly [number, string][] = [
  [0, '#2ecc71'],
  [0.5, '#f1c40f'],
  [0.75, '#e67e22'],
  [1, '#e74c3c'],
];
export const DIMMED = '#5f6670';
export const UPSTREAM = '#3498db';
export const DOWNSTREAM = '#9b59b6';

function hex(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
}

/** Map congestion 0..1+ to a hex colour on the gradient. */
export function congestionColor(c: number): string {
  const v = Math.max(0, Math.min(1, Number.isFinite(c) ? c : 1));
  for (let i = 1; i < CONGESTION_STOPS.length; i++) {
    const [p1, c1] = CONGESTION_STOPS[i];
    const [p0, c0] = CONGESTION_STOPS[i - 1];
    if (v <= p1) {
      const t = (v - p0) / (p1 - p0);
      const a = parseInt(c0.slice(1), 16);
      const b = parseInt(c1.slice(1), 16);
      const ch = (s: number) => ((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t;
      return `#${hex(ch(16))}${hex(ch(8))}${hex(ch(0))}`;
    }
  }
  return CONGESTION_STOPS[CONGESTION_STOPS.length - 1][1];
}

export interface LinkView {
  id: string;
  from: string;
  to: string;
  unit: UnitType;
  rate: number;
  congestion: number;
  color: string;
  /** Line width 1..8 scaled to the busiest link in view. */
  width: number;
  trace?: 'upstream' | 'downstream';
}

export interface NodeView {
  id: string;
  relevant: boolean;
  state: NodeState;
  pressure: number;
  color: string;
  queue: number;
  rate: number;
}

export interface InfoViewData {
  view: InfoViewId;
  units: readonly UnitType[];
  links: LinkView[];
  nodes: NodeView[];
  hotspots: Hotspot[];
  legend: { stops: readonly [number, string][]; dimmed: string; upstream: string; downstream: string };
  panel: { throughputPerMin: number; meanWaitMin: number; topHotspots: Hotspot[] };
}

/** Render/UI-facing data for one info view, optionally with route tracing from a selected node. */
export function infoView(g: FlowGraph, view: InfoViewId, selected?: string): InfoViewData {
  const units = VIEW_UNITS[view];
  const has = (u: UnitType) => units.includes(u);
  const trace = selected ? traceRoute(g, selected) : null;
  const up = new Set(trace?.upstream.map((h) => h.via));
  const down = new Set(trace?.downstream.map((h) => h.via));
  const ls = [...g.links.values()].filter((l) => has(l.def.unit));
  const maxRate = Math.max(1e-9, ...ls.map((l) => l.load));
  const links: LinkView[] = ls.map((l) => {
    const m = g.linkMetrics(l.def.id);
    const t = up.has(l.def.id) ? 'upstream' : down.has(l.def.id) ? 'downstream' : undefined;
    return {
      id: m.id, from: m.from, to: m.to, unit: m.unit, rate: m.load, congestion: m.congestion,
      color: t === 'upstream' ? UPSTREAM : t === 'downstream' ? DOWNSTREAM : congestionColor(m.congestion),
      width: 1 + 7 * (m.load / maxRate),
      trace: t,
    };
  });
  const nodes: NodeView[] = [];
  let throughput = 0;
  let waitSum = 0;
  let waitN = 0;
  for (const n of g.nodes.values()) {
    const relevant = units.some((u) => u in n.def.accepts || (n.def.generates !== undefined && u in n.def.generates));
    const m = g.nodeMetrics(n.def.id);
    const pressure = Math.max(m.utilization, m.state === 'blocked' || m.state === 'starved' ? 1 : 0);
    if (relevant && n.def.sink) throughput += m.outRate;
    if (relevant && Number.isFinite(m.waitMin) && m.waitMin > 0) {
      waitSum += m.waitMin;
      waitN++;
    }
    nodes.push({ id: m.id, relevant, state: m.state, pressure, color: relevant ? congestionColor(pressure) : DIMMED, queue: m.queue, rate: m.outRate });
  }
  const hotspots = units.flatMap((u) => detectHotspots(g, u));
  const dedup = [...new Map(hotspots.map((h) => [h.id, h])).values()].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return {
    view,
    units,
    links,
    nodes,
    hotspots: dedup,
    legend: { stops: CONGESTION_STOPS, dimmed: DIMMED, upstream: UPSTREAM, downstream: DOWNSTREAM },
    panel: { throughputPerMin: throughput, meanWaitMin: waitN ? waitSum / waitN : 0, topHotspots: dedup.slice(0, 3) },
  };
}
