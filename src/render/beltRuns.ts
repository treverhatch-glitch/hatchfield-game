/**
 * Apron belt layout for the renderer. A run is one connected chain of belt
 * cells, walked end to end. Bags ride their own run and never jump a gap.
 */
import type { Tile } from '../game/types.ts'

export interface BeltCell {
  c: number
  r: number
}

/** Which sides of a belt cell continue into another belt cell. */
export interface BeltArms {
  n: boolean
  s: boolean
  e: boolean
  w: boolean
}

const STEPS: readonly [keyof BeltArms, number, number][] = [
  ['e', 1, 0],
  ['w', -1, 0],
  ['s', 0, 1],
  ['n', 0, -1],
]

function isBelt(tiles: readonly (readonly Tile[])[], c: number, r: number): boolean {
  return tiles[r]?.[c] === 'belt'
}

export function beltArms(tiles: readonly (readonly Tile[])[], c: number, r: number): BeltArms {
  return {
    e: isBelt(tiles, c + 1, r),
    w: isBelt(tiles, c - 1, r),
    s: isBelt(tiles, c, r + 1),
    n: isBelt(tiles, c, r - 1),
  }
}

function beltNeighbours(tiles: readonly (readonly Tile[])[], c: number, r: number): BeltCell[] {
  const out: BeltCell[] = []
  for (const [, dc, dr] of STEPS) if (isBelt(tiles, c + dc, r + dr)) out.push({ c: c + dc, r: r + dr })
  return out
}

/**
 * Every belt chain as an ordered list of cells. Each run starts at a dead end
 * when it has one. A branch at a junction becomes its own run that ends on the
 * junction cell, so every step in a run is between neighbouring belt cells.
 */
export function beltRuns(tiles: readonly (readonly Tile[])[]): BeltCell[][] {
  const seen = new Set<string>()
  const cells: BeltCell[] = []
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]
    for (let c = 0; c < (row?.length ?? 0); c++) if (row[c] === 'belt') cells.push({ c, r })
  }
  const id = (p: BeltCell) => `${p.c},${p.r}`
  const freeDegree = (p: BeltCell) => beltNeighbours(tiles, p.c, p.r).filter((n) => !seen.has(id(n))).length
  const runs: BeltCell[][] = []
  while (seen.size < cells.length) {
    const open = cells.filter((p) => !seen.has(id(p)))
    const start = open.find((p) => freeDegree(p) <= 1) ?? open[0]
    const run: BeltCell[] = []
    const joined = beltNeighbours(tiles, start.c, start.r).find((n) => seen.has(id(n)))
    if (joined) run.push(joined)
    let at: BeltCell | undefined = start
    while (at) {
      seen.add(id(at))
      run.push(at)
      const here: BeltCell = at
      const prev = run.length > 1 ? run[run.length - 2] : null
      const free = beltNeighbours(tiles, here.c, here.r).filter((n) => !seen.has(id(n)))
      at = free[0]
      if (!at) {
        const tail = beltNeighbours(tiles, here.c, here.r).find((n) => seen.has(id(n)) && (!prev || id(n) !== id(prev)) && !run.some((p) => id(p) === id(n)))
        if (tail) run.push(tail)
      }
    }
    runs.push(run)
  }
  return runs
}

/** Split `count` bags over runs by length. Every run gets one before any run gets a second. */
export function bagsPerRun(lengths: readonly number[], count: number): number[] {
  const out = lengths.map(() => 0)
  if (!lengths.length || count <= 0) return out
  const order = lengths.map((_, i) => i).sort((a, b) => lengths[b] - lengths[a] || a - b)
  let left = count
  for (const i of order) {
    if (left <= 0) break
    out[i] = 1
    left -= 1
  }
  const total = lengths.reduce((n, l) => n + l, 0)
  while (left > 0 && total > 0) {
    let best = order[0]
    let bestGap = -Infinity
    for (const i of order) {
      const gap = (lengths[i] / total) * count - out[i]
      if (gap > bestGap) {
        bestGap = gap
        best = i
      }
    }
    out[best] += 1
    left -= 1
  }
  return out
}

/** Point `u` (0..1) of the way along a polyline, by length. */
export function alongRun<T extends { x: number; z: number }>(points: readonly T[], u: number): { x: number; z: number } {
  if (points.length === 1) return { x: points[0].x, z: points[0].z }
  let total = 0
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
  let remain = Math.min(1, Math.max(0, u)) * total
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    if (remain <= d || i === points.length - 1) {
      const t = d < 1e-9 ? 0 : Math.min(1, remain / d)
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
    }
    remain -= d
  }
  const last = points[points.length - 1]
  return { x: last.x, z: last.z }
}
