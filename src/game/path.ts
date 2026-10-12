import { SIZE, type Tile, type Vec } from './types'

export function inBounds(c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < SIZE && r < SIZE
}

export function key(c: number, r: number): string {
  return `${c},${r}`
}

export function parseKey(s: string): Vec {
  const [c, r] = s.split(',').map(Number)
  return { c, r }
}

const DIRS: Vec[] = [
  { c: 1, r: 0 },
  { c: -1, r: 0 },
  { c: 0, r: 1 },
  { c: 0, r: -1 },
]

export function neighbors(c: number, r: number): Vec[] {
  const out: Vec[] = []
  for (const d of DIRS) {
    const n = { c: c + d.c, r: r + d.r }
    if (inBounds(n.c, n.r)) out.push(n)
  }
  return out
}

export function walkableFor(
  kind: 'jet' | 'truck' | 'person' | 'mechanic',
  tile: Tile,
): boolean {
  if (kind === 'jet') return tile === 'runway' || tile === 'taxi' || tile === 'stand'
  if (kind === 'truck') {
    return (
      tile === 'taxi' ||
      tile === 'stand' ||
      tile === 'fuel' ||
      tile === 'bags' ||
      tile === 'snack' ||
      tile === 'terminal' ||
      tile === 'fire' ||
      tile === 'police' ||
      tile === 'cargo' ||
      tile === 'road' ||
      tile === 'hangar'
    )
  }
  if (kind === 'mechanic') {
    return (
      tile === 'runway' ||
      tile === 'taxi' ||
      tile === 'stand' ||
      tile === 'hangar' ||
      tile === 'road' ||
      tile === 'fuel'
    )
  }
  // Apron foot traffic — hangar included so line-MX / staff can cross the shop door.
  return (
    tile === 'taxi' ||
    tile === 'stand' ||
    tile === 'terminal' ||
    tile === 'snack' ||
    tile === 'bags' ||
    tile === 'road' ||
    tile === 'police' ||
    tile === 'cargo' ||
    tile === 'hangar' ||
    tile === 'fuel' ||
    tile === 'fire'
  )
}

export function astar(
  tiles: Tile[][],
  start: Vec,
  goal: Vec,
  kind: 'jet' | 'truck' | 'person' | 'mechanic',
): Vec[] | null {
  if (!inBounds(start.c, start.r) || !inBounds(goal.c, goal.r)) return null
  if (start.c === goal.c && start.r === goal.r) return [start]
  if (!walkableFor(kind, tiles[start.r][start.c])) return null
  if (!walkableFor(kind, tiles[goal.r][goal.c])) return null

  const startK = key(start.c, start.r)
  const goalK = key(goal.c, goal.r)
  const open: string[] = [startK]
  const came = new Map<string, string>()
  const g = new Map<string, number>([[startK, 0]])
  const h = (c: number, r: number) => Math.abs(c - goal.c) + Math.abs(r - goal.r)

  while (open.length) {
    let bestI = 0
    let bestF = Infinity
    for (let i = 0; i < open.length; i++) {
      const p = parseKey(open[i])
      const f = (g.get(open[i]) ?? 1e9) + h(p.c, p.r)
      if (f < bestF) {
        bestF = f
        bestI = i
      }
    }
    const cur = open.splice(bestI, 1)[0]
    if (cur === goalK) {
      const path = [parseKey(cur)]
      let k = cur
      while (came.has(k)) {
        k = came.get(k)!
        path.push(parseKey(k))
      }
      path.reverse()
      return path
    }
    const p = parseKey(cur)
    for (const n of neighbors(p.c, p.r)) {
      if (!walkableFor(kind, tiles[n.r][n.c])) continue
      const nk = key(n.c, n.r)
      const ng = (g.get(cur) ?? 1e9) + 1
      if (ng < (g.get(nk) ?? Infinity)) {
        came.set(nk, cur)
        g.set(nk, ng)
        if (!open.includes(nk)) open.push(nk)
      }
    }
  }
  return null
}

export function nearestPath(
  tiles: Tile[][],
  start: Vec,
  goals: Vec[],
  kind: 'jet' | 'truck' | 'person' | 'mechanic',
): Vec[] | null {
  let best: Vec[] | null = null
  for (const goal of goals) {
    const p = astar(tiles, start, goal, kind)
    if (p && (!best || p.length < best.length)) best = p
  }
  return best
}

export function tilesOf(tiles: Tile[][], type: Tile | Tile[]): Vec[] {
  const set = new Set(Array.isArray(type) ? type : [type])
  const out: Vec[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (set.has(tiles[r][c])) out.push({ c, r })
    }
  }
  return out
}

export function farmBesidePavement(tiles: Tile[][], farm: Vec): boolean {
  return neighbors(farm.c, farm.r).some((n) => {
    const t = tiles[n.r][n.c]
    return t === 'taxi' || t === 'stand' || t === 'runway' || t === 'road'
  })
}

export function runwayStrips(tiles: Tile[][], min: number): Vec[][] {
  const strips: Vec[][] = []
  for (let r = 0; r < SIZE; r++) {
    let run: Vec[] = []
    for (let c = 0; c <= SIZE; c++) {
      const isRw = c < SIZE && tiles[r][c] === 'runway'
      if (isRw) run.push({ c, r })
      if (!isRw || c === SIZE) {
        if (run.length >= min) strips.push(run)
        run = []
      }
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let run: Vec[] = []
    for (let r = 0; r <= SIZE; r++) {
      const isRw = r < SIZE && tiles[r][c] === 'runway'
      if (isRw) run.push({ c, r })
      if (!isRw || r === SIZE) {
        if (run.length >= min) strips.push(run)
        run = []
      }
    }
  }
  return strips
}
