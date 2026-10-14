/**
 * Flow fields: one Dijkstra from a goal out over the nav grid gives every
 * cell its cost to the goal and the next cell to step to. Hundreds of
 * passengers heading to the same desk share one field, so a tick is O(1)
 * per passenger. Moves are 8-way; a diagonal needs both corner routes open,
 * so nobody cuts a wall corner.
 */
import { moveOpen, type NavGrid } from './grid.ts'

export interface Field {
  /** Cost to the goal, Infinity where the goal cannot be reached. */
  dist: Float32Array
  /** Next cell toward the goal; -1 at the goal or where it cannot be reached. */
  next: Int32Array
}

const SQRT2 = Math.SQRT2

/** Min-heap of (cost, cell) with lazy deletion. */
class Heap {
  private cost: number[] = []
  private cell: number[] = []
  get size() {
    return this.cost.length
  }
  push(cost: number, cell: number) {
    const c = this.cost
    const v = this.cell
    let i = c.length
    c.push(cost)
    v.push(cell)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (c[p] <= cost) break
      c[i] = c[p]
      v[i] = v[p]
      i = p
    }
    c[i] = cost
    v[i] = cell
  }
  /** Pops the cheapest; returns the cell and leaves its cost in `top`. */
  top = 0
  pop(): number {
    const c = this.cost
    const v = this.cell
    const outCost = c[0]
    const outCell = v[0]
    const lastCost = c.pop()!
    const lastCell = v.pop()!
    const n = c.length
    if (n > 0) {
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        if (l >= n) break
        const r = l + 1
        const m = r < n && c[r] < c[l] ? r : l
        if (c[m] >= lastCost) break
        c[i] = c[m]
        v[i] = v[m]
        i = m
      }
      c[i] = lastCost
      v[i] = lastCell
    }
    this.top = outCost
    return outCell
  }
}

/**
 * @param targets goal cells (cost 0)
 * @param layer   layer bits a cell needs to be walked
 * @param penalty extra cost to step into each cell (rope, other queues, lanes); null for none
 */
export function computeField(g: NavGrid, targets: readonly number[], layer: number, penalty: Float32Array | null): Field {
  const n = g.gw * g.gh
  const dist = new Float32Array(n).fill(Infinity)
  const next = new Int32Array(n).fill(-1)
  const heap = new Heap()
  for (const t of targets) {
    if (t < 0 || t >= n || !(g.mask[t] & layer) || dist[t] === 0) continue
    dist[t] = 0
    heap.push(0, t)
  }
  const gw = g.gw
  while (heap.size) {
    const u = heap.pop()
    const du = heap.top
    if (du > dist[u]) continue
    const ux = u % gw
    // Cost to step from a neighbour into u.
    const enter = penalty ? penalty[u] : 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const vx = ux + dx
        if (vx < 0 || vx >= gw) continue
        const v = u + dy * gw + dx
        if (v < 0 || v >= n || !(g.mask[v] & layer)) continue
        // Rounded to float32 so the heap key matches what `dist` stores.
        const nd = Math.fround(du + (dx !== 0 && dy !== 0 ? SQRT2 : 1) + enter)
        if (nd >= dist[v]) continue
        if (!moveOpen(g, v, u, layer)) continue
        dist[v] = nd
        next[v] = u
        heap.push(nd, v)
      }
    }
  }
  return { dist, next }
}
