import type { RoadEdge, RoadNode } from './types'

/** Tiny service-road graph with cached Dijkstra distances (metres). */
export class RoadGraph {
  private readonly adj = new Map<string, { to: string; len: number }[]>()
  private readonly cache = new Map<string, Map<string, number>>()

  constructor(nodes: RoadNode[], edges: RoadEdge[]) {
    const pos = new Map<string, RoadNode>()
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
