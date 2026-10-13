import type { RoadEdge, RoadNode } from './types'

/** Tiny service-road graph with cached Dijkstra distances (metres). */
export class RoadGraph {
  private readonly adj = new Map<string, { to: string; len: number }[]>()
  private readonly cache = new Map<string, Map<string, number>>()
  private readonly pos = new Map<string, RoadNode>()

  constructor(nodes: RoadNode[], edges: RoadEdge[]) {
    const pos = this.pos
    for (const n of nodes) {
      pos.set(n.id, n)
      this.adj.set(n.id, [])
    }
    for (const e of edges) {
      const a = pos.get(e.a)
      const b = pos.get(e.b)
      if (!a || !b) throw new Error(`Edge references unknown node: ${e.a}-${e.b}`)
      const len = e.length ?? Math.hypot(a.x - b.x, a.y - b.y)
      this.adj.get(e.a)!.push({ to: e.b, len })
      this.adj.get(e.b)!.push({ to: e.a, len })
    }
  }

  has(id: string): boolean {
    return this.adj.has(id)
  }

  /** Node coordinates, when the id is on this graph. */
  at(id: string): RoadNode | undefined {
    return this.pos.get(id)
  }

  /**
   * Shortest node sequence, including both ends.
   * Empty when the nodes are missing or disconnected.
   */
  route(from: string, to: string): string[] {
    if (!this.adj.has(from) || !this.adj.has(to)) return []
    if (from === to) return [from]
    const dist = new Map<string, number>([[from, 0]])
    const prev = new Map<string, string>()
    const done = new Set<string>()
    for (;;) {
      let best: string | null = null
      let bestD = Infinity
      for (const [id, d] of dist) {
        if (!done.has(id) && d < bestD) {
          best = id
          bestD = d
        }
      }
      if (best === null || best === to) break
      done.add(best)
      for (const { to: nxt, len } of this.adj.get(best)!) {
        const nd = bestD + len
        if (nd < (dist.get(nxt) ?? Infinity)) {
          dist.set(nxt, nd)
          prev.set(nxt, best)
        }
      }
    }
    if (!prev.has(to) && from !== to) return []
    const out = [to]
    let cur = to
    while (cur !== from) {
      const p = prev.get(cur)
      if (!p) return []
      out.push(p)
      cur = p
    }
    out.reverse()
    return out
  }

  /** Shortest distance in metres, Infinity when unreachable. */
  distance(from: string, to: string): number {
    if (!this.adj.has(from) || !this.adj.has(to)) return Infinity
    let table = this.cache.get(from)
    if (!table) {
      table = this.dijkstra(from)
      this.cache.set(from, table)
    }
    return table.get(to) ?? Infinity
  }

  /** Travel minutes at the given speed. */
  travelMinutes(from: string, to: string, speedKmh: number): number {
    const d = this.distance(from, to)
    if (!Number.isFinite(d)) return Infinity
    return d / ((speedKmh * 1000) / 60)
  }

  private dijkstra(src: string): Map<string, number> {
    const dist = new Map<string, number>([[src, 0]])
    const done = new Set<string>()
    for (;;) {
      let best: string | null = null
      let bestD = Infinity
      for (const [id, d] of dist) {
        if (!done.has(id) && (d < bestD || (d === bestD && best !== null && id < best))) {
          best = id
          bestD = d
        }
      }
      if (best === null) return dist
      done.add(best)
      for (const { to, len } of this.adj.get(best)!) {
        const nd = bestD + len
        if (nd < (dist.get(to) ?? Infinity)) dist.set(to, nd)
      }
    }
  }
}
