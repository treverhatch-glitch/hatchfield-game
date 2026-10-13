import type { LinkDef, LinkMetrics, NodeDef, NodeMetrics, NodeState, UnitType } from './types.ts';

const EMA_ALPHA = 0.2;
const EPS = 1e-9;

interface Transit {
  amount: number;
  arriveAt: number;
}

export interface FlowNode {
  def: NodeDef;
  inBuf: Map<UnitType, number>;
  outBuf: Map<UnitType, number>;
  inRate: number;
  outRate: number;
  processedRate: number;
  processed: number;
  lost: number;
  starvedMin: number;
  blockedMin: number;
  state: NodeState;
  /** Counters fed by individual agents (passengers) via recordEnter/recordLeave. */
  agentIn: number;
  agentOut: number;
  agentInside: number;
  tickIn: number;
  tickOut: number;
}

export interface FlowLink {
  def: Required<Pick<LinkDef, 'id' | 'from' | 'to' | 'unit' | 'capacityPerMin'>> & LinkDef;
  transit: Transit[];
  load: number;
  moved: number;
  tickMoved: number;
  held: number;
}

/**
 * Generic deterministic flow graph. Nodes buffer, process and dispatch units;
 * links carry them with capacity and travel time. Time unit = game-minute.
 */
export class FlowGraph {
  readonly nodes = new Map<string, FlowNode>();
  readonly links = new Map<string, FlowLink>();
  time = 0;
  private outLinks = new Map<string, FlowLink[]>();
  private inLinks = new Map<string, FlowLink[]>();

  addNode(def: NodeDef): FlowNode {
    if (this.nodes.has(def.id)) throw new Error(`duplicate node ${def.id}`);
    const n: FlowNode = {
      def,
      inBuf: new Map(),
      outBuf: new Map(),
      inRate: 0,
      outRate: 0,
      processedRate: 0,
      processed: 0,
      lost: 0,
      starvedMin: 0,
      blockedMin: 0,
      state: 'idle',
      agentIn: 0,
      agentOut: 0,
      agentInside: 0,
      tickIn: 0,
      tickOut: 0,
    };
    this.nodes.set(def.id, n);
    this.outLinks.set(def.id, []);
    this.inLinks.set(def.id, []);
    return n;
  }

  addLink(def: LinkDef): FlowLink {
    if (!this.nodes.has(def.from) || !this.nodes.has(def.to)) throw new Error(`link endpoints missing ${def.from}->${def.to}`);
    const id = def.id ?? `${def.from}>${def.to}:${def.unit}`;
    if (this.links.has(id)) throw new Error(`duplicate link ${id}`);
    const l: FlowLink = { def: { ...def, id }, transit: [], load: 0, moved: 0, tickMoved: 0, held: 0 };
    this.links.set(id, l);
    this.outLinks.get(def.from)!.push(l);
    this.inLinks.get(def.to)!.push(l);
    return l;
  }

  getNode(id: string): FlowNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`unknown node ${id}`);
    return n;
  }

  outgoing(id: string): readonly FlowLink[] {
    return this.outLinks.get(id) ?? [];
  }

  incoming(id: string): readonly FlowLink[] {
    return this.inLinks.get(id) ?? [];
  }

  /** Update staff, tier or research multiplier at runtime. */
  setStaff(id: string, assigned: number): void {
    this.getNode(id).def.staffAssigned = assigned;
  }

  setEfficiency(id: string, efficiency: number): void {
    this.getNode(id).def.efficiency = efficiency;
  }

  setLinkCapacity(id: string, capacityPerMin: number): void {
    const l = this.links.get(id);
    if (!l) throw new Error(`unknown link ${id}`);
    l.def.capacityPerMin = capacityPerMin;
  }

  /** Inject units into a node's input buffer (e.g. a tanker delivery). Overflow is returned. */
  inject(id: string, unit: UnitType, amount: number): number {
    const n = this.getNode(id);
    const free = this.freeIn(n, unit);
    const took = Math.min(free, amount);
    n.inBuf.set(unit, (n.inBuf.get(unit) ?? 0) + took);
    n.tickIn += took;
    return amount - took;
  }

  /** Take units out of a node's output (or input) buffer, e.g. a fuel truck loading. */
  withdraw(id: string, unit: UnitType, amount: number): number {
    const n = this.getNode(id);
    let got = 0;
    for (const buf of [n.outBuf, n.inBuf]) {
      const have = buf.get(unit) ?? 0;
      const take = Math.min(have, amount - got);
      buf.set(unit, have - take);
      got += take;
    }
    n.tickOut += got;
    return got;
  }

  /** Agent hooks: individual passengers crossing zone boundaries (sim.ts calls these). */
  recordEnter(id: string, count = 1): void {
    const n = this.getNode(id);
    n.agentIn += count;
    n.agentInside += count;
    n.tickIn += count;
  }

  recordLeave(id: string, count = 1): void {
    const n = this.getNode(id);
    n.agentOut += count;
    n.agentInside = Math.max(0, n.agentInside - count);
    n.tickOut += count;
  }

  recordLoss(id: string, count = 1): void {
    this.getNode(id).lost += count;
  }

  staffing(n: FlowNode): number {
    const req = n.def.staffRequired ?? 0;
    if (req <= 0) return 1;
    return Math.min(1, Math.max(0, (n.def.staffAssigned ?? 0) / req));
  }

  effectiveRate(n: FlowNode): number {
    return n.def.ratePerMin * this.staffing(n) * (n.def.efficiency ?? 1);
  }

  private inCap(n: FlowNode, unit: UnitType): number {
    return n.def.accepts[unit] ?? 0;
  }

  private freeIn(n: FlowNode, unit: UnitType): number {
    let pending = 0;
    for (const l of this.incoming(n.def.id)) if (l.def.unit === unit) for (const t of l.transit) pending += t.amount;
    return Math.max(0, this.inCap(n, unit) - (n.inBuf.get(unit) ?? 0) - pending);
  }

  private outCap(n: FlowNode): number {
    return n.def.outCapacity ?? Math.max(1, n.def.ratePerMin * 2);
  }

  /** Advance the graph by dt game-minutes. Deterministic: insertion order, no randomness. */
  tick(dt: number): void {
    if (dt <= 0) return;
    this.time += dt;
    for (const l of this.links.values()) l.tickMoved = 0;
    const blockedNow = new Set<string>();
    const starvedNow = new Set<string>();

    // 1. Sources generate into their output buffer.
    for (const n of this.nodes.values()) {
      const gen = n.def.generates;
      if (!gen) continue;
      for (const [u, rate] of Object.entries(gen) as [UnitType, number][]) {
        const cur = n.outBuf.get(u) ?? 0;
        const room = Math.max(0, this.outCap(n) - cur);
        const made = rate * dt;
        const put = Math.min(room, made);
        n.outBuf.set(u, cur + put);
        if (made - put > EPS) {
          n.lost += made - put;
          blockedNow.add(n.def.id);
        }
        n.tickIn += put;
      }
    }

    // 2. Deliver arrived transit into downstream input buffers.
    for (const l of this.links.values()) {
      if (l.transit.length === 0) continue;
      const to = this.getNode(l.def.to);
      const keep: Transit[] = [];
      for (const t of l.transit) {
        if (t.arriveAt <= this.time + EPS) {
          to.inBuf.set(l.def.unit, (to.inBuf.get(l.def.unit) ?? 0) + t.amount);
          to.tickIn += t.amount;
        } else keep.push(t);
      }
      l.transit = keep;
    }

    // 3. Process: input buffers -> output buffers (or consumed by sinks).
    for (const n of this.nodes.values()) {
      if (n.def.generates) continue;
      const capacity = this.effectiveRate(n) * dt;
      let budget = capacity;
      let hadInput = false;
      let outFull = false;
      const units = Object.keys(n.def.accepts) as UnitType[];
      for (const u of units) {
        const have = n.inBuf.get(u) ?? 0;
        if (have > EPS) hadInput = true;
        if (budget <= EPS || have <= EPS) continue;
        const recipe = n.def.recipes?.find((r) => r.input === u);
        const outUnit = recipe ? recipe.output : u;
        const ratio = recipe ? recipe.ratio : 1;
        let take = Math.min(have, budget);
        if (!n.def.sink) {
          const room = Math.max(0, this.outCap(n) - (n.outBuf.get(outUnit) ?? 0));
          if (room / ratio < take - EPS) {
            take = room / ratio;
            outFull = true;
          }
          n.outBuf.set(outUnit, (n.outBuf.get(outUnit) ?? 0) + take * ratio);
        } else {
          n.tickOut += take;
        }
        n.inBuf.set(u, have - take);
        budget -= take;
        n.processed += take;
      }
      n.processedRate = (capacity - budget) / dt;
      if (outFull) blockedNow.add(n.def.id);
      if (!hadInput && units.length > 0 && n.agentInside === 0) {
        // Starved only if something upstream is meant to feed it.
        if (this.incoming(n.def.id).length > 0 && this.anyUpstreamDemand(n)) starvedNow.add(n.def.id);
      }
    }

    // 4. Dispatch: output buffers -> links, weighted split, capped by link capacity and downstream room.
    for (const n of this.nodes.values()) {
      const outs = this.outgoing(n.def.id);
      if (outs.length === 0) continue;
      for (const [u, amount] of n.outBuf) {
        if (amount <= EPS) continue;
        const ls = outs.filter((l) => l.def.unit === u);
        if (ls.length === 0) continue;
        const allowance = ls.map((l) => Math.min(l.def.capacityPerMin * dt, this.freeIn(this.getNode(l.def.to), u)));
        const totalAllow = allowance.reduce((a, b) => a + b, 0);
        if (totalAllow <= EPS) {
          blockedNow.add(n.def.id);
          for (const l of ls) l.held += amount / ls.length;
          continue;
        }
        let remaining = Math.min(amount, totalAllow);
        const sent: number[] = ls.map(() => 0);
        // Water-filling by weight so saturated links spill to others, deterministic.
        for (let pass = 0; pass < ls.length && remaining > EPS; pass++) {
          const open = ls.map((_, i) => i).filter((i) => allowance[i] - sent[i] > EPS);
          const wsum = open.reduce((a, i) => a + (ls[i].def.weight ?? 1), 0);
          if (wsum <= 0) break;
          let used = 0;
          for (const i of open) {
            const share = (remaining * (ls[i].def.weight ?? 1)) / wsum;
            const add = Math.min(share, allowance[i] - sent[i]);
            sent[i] += add;
            used += add;
          }
          remaining -= used;
        }
        let total = 0;
        ls.forEach((l, i) => {
          const s = sent[i];
          if (s <= EPS) return;
          l.transit.push({ amount: s, arriveAt: this.time + (l.def.travelTimeMin ?? 0) });
          l.tickMoved += s;
          l.moved += s;
          total += s;
        });
        n.outBuf.set(u, amount - total);
        n.tickOut += total;
        if (amount - total > this.outCap(n) * 0.95) blockedNow.add(n.def.id);
      }
      // Instant links deliver this tick so chains of zero-latency nodes flow in one pass.
      for (const l of outs) {
        if ((l.def.travelTimeMin ?? 0) > 0) continue;
        const to = this.getNode(l.def.to);
        for (const t of l.transit) {
          to.inBuf.set(l.def.unit, (to.inBuf.get(l.def.unit) ?? 0) + t.amount);
          to.tickIn += t.amount;
        }
        l.transit = [];
      }
    }

    // 5. Metrics and states.
    for (const n of this.nodes.values()) {
      n.inRate += EMA_ALPHA * (n.tickIn / dt - n.inRate);
      n.outRate += EMA_ALPHA * (n.tickOut / dt - n.outRate);
      n.tickIn = 0;
      n.tickOut = 0;
      const q = this.queueOf(n);
      const util = this.utilizationOf(n);
      let state: NodeState = 'ok';
      if (blockedNow.has(n.def.id)) state = 'blocked';
      else if (starvedNow.has(n.def.id)) state = 'starved';
      else if (this.staffing(n) < 1) state = 'understaffed';
      else if (util > 0.95 && q > this.effectiveRate(n) * 1) state = 'overloaded';
      else if (q <= EPS && n.processedRate <= EPS && !n.def.generates) state = 'idle';
      n.state = state;
      if (state === 'blocked') n.blockedMin += dt;
      if (state === 'starved') n.starvedMin += dt;
    }
    for (const l of this.links.values()) {
      l.load += EMA_ALPHA * (l.tickMoved / dt - l.load);
    }
  }

  private anyUpstreamDemand(n: FlowNode): boolean {
    for (const l of this.incoming(n.def.id)) {
      const from = this.getNode(l.def.from);
      if (from.def.generates || from.processed > 0 || from.state !== 'idle') return true;
    }
    return false;
  }

  queueOf(n: FlowNode): number {
    let q = n.agentInside;
    for (const v of n.inBuf.values()) q += v;
    return q;
  }

  storedOf(n: FlowNode): number {
    let s = 0;
    for (const v of n.outBuf.values()) s += v;
    return s;
  }

  utilizationOf(n: FlowNode): number {
    const eff = this.effectiveRate(n);
    if (eff <= EPS) return this.queueOf(n) > EPS ? 1 : 0;
    return Math.min(1.5, n.processedRate / eff);
  }

  nodeMetrics(id: string): NodeMetrics {
    const n = this.getNode(id);
    const q = this.queueOf(n);
    const out = Math.max(n.outRate, n.processedRate);
    return {
      id,
      state: n.state,
      inRate: n.inRate,
      outRate: n.outRate,
      queue: q,
      stored: this.storedOf(n),
      waitMin: q <= EPS ? 0 : out <= EPS ? Infinity : q / out,
      utilization: this.utilizationOf(n),
      staffing: this.staffing(n),
      effectiveRate: this.effectiveRate(n),
      processed: n.processed,
      lost: n.lost,
      starvedMin: n.starvedMin,
      blockedMin: n.blockedMin,
    };
  }

  linkMetrics(id: string): LinkMetrics {
    const l = this.links.get(id);
    if (!l) throw new Error(`unknown link ${id}`);
    const cap = l.def.capacityPerMin;
    let inTransit = 0;
    for (const t of l.transit) inTransit += t.amount;
    return {
      id,
      from: l.def.from,
      to: l.def.to,
      unit: l.def.unit,
      load: l.load,
      capacity: cap,
      congestion: cap <= EPS ? (l.load > EPS ? 1 : 0) : l.load / cap,
      inTransit,
      moved: l.moved,
    };
  }

  /** Total units held anywhere (buffers + transit), per unit type. Used for conservation audits. */
  totalHeld(unit: UnitType): number {
    let s = 0;
    for (const n of this.nodes.values()) s += (n.inBuf.get(unit) ?? 0) + (n.outBuf.get(unit) ?? 0);
    for (const l of this.links.values()) if (l.def.unit === unit) for (const t of l.transit) s += t.amount;
    return s;
  }
}
