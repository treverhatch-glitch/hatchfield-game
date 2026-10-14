import { personStepCost } from '../scale/logic'
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
  // Hangar bay is apron-accessible so line-MX jets can taxi in and park.
  if (kind === 'jet') {
    return tile === 'runway' || tile === 'taxi' || tile === 'stand' || tile === 'hangar' || tile === 'mro'
  }
  if (kind === 'truck') {
    return (
      tile === 'taxi' ||
      tile === 'stand' ||
      tile === 'fuel' ||
      tile === 'bags' ||
      tile === 'belt' ||
      tile === 'snack' ||
      tile === 'terminal' ||
      tile === 'fire' ||
      tile === 'police' ||
      tile === 'cargo' ||
      tile === 'guard' ||
      tile === 'road' ||
      tile === 'hangar' ||
      tile === 'deice' ||
      tile === 'termbus' ||
      tile === 'mover' ||
      tile === 'xferbus' ||
      tile === 'kitchen' ||
      tile === 'depot' ||
      tile === 'mro' ||
      tile === 'nighthub' ||
      tile === 'saf'
    )
  }
  if (kind === 'mechanic') {
    return (
      tile === 'runway' ||
      tile === 'taxi' ||
      tile === 'stand' ||
      tile === 'hangar' ||
      tile === 'road' ||
      tile === 'fuel' ||
      tile === 'deice' ||
      tile === 'mro'
    )
  }
  // Apron / landside foot traffic — hotel, parks, bus curb, rail hall included.
  return (
    tile === 'taxi' ||
    tile === 'stand' ||
    tile === 'terminal' ||
    tile === 'snack' ||
    tile === 'bags' ||
    tile === 'belt' ||
    tile === 'road' ||
    tile === 'police' ||
    tile === 'cargo' ||
    tile === 'guard' ||
    tile === 'hangar' ||
    tile === 'fuel' ||
    tile === 'fire' ||
    tile === 'deice' ||
    tile === 'hotel' ||
    tile === 'park_s' ||
    tile === 'park_l' ||
    tile === 'park_g' ||
    tile === 'park_u' ||
    tile === 'bus' ||
    tile === 'termbus' ||
    tile === 'mover' ||
    tile === 'xferbus' ||
    tile === 'mro' ||
    tile === 'nighthub' ||
    tile === 'skywalk' ||
    tile === 'travelator' ||
    tile === 'rail' ||
    tile === 'late_hotel' ||
    tile === 'late_rail'
  )
}

function cellOpen(
  tiles: Tile[][],
  c: number,
  r: number,
  kind: 'jet' | 'truck' | 'person' | 'mechanic',
  pass?: (c: number, r: number) => boolean,
): boolean {
  return inBounds(c, r) && walkableFor(kind, tiles[r][c]) && (!pass || pass(c, r))
}

export function astar(
  tiles: Tile[][],
  start: Vec,
  goal: Vec,
  kind: 'jet' | 'truck' | 'person' | 'mechanic',
  pass?: (c: number, r: number) => boolean,
): Vec[] | null {
  if (!inBounds(start.c, start.r) || !inBounds(goal.c, goal.r)) return null
  if (start.c === goal.c && start.r === goal.r) return [start]
  if (!cellOpen(tiles, start.c, start.r, kind, pass) || !cellOpen(tiles, goal.c, goal.r, kind, pass)) return null

  // Cells are indexed r * SIZE + c in reused scratch arrays. A cell's g/came/open entries
  // count only when its stamp matches this call, so nothing is cleared or allocated per search.
  // Open-list order and tie-breaks match the old string-keyed version, so paths are identical.
  if (++searchGen === 0xffffffff) {
    searchStamp.fill(0)
    searchGen = 1
  }
  const gen = searchGen
  const startI = start.r * SIZE + start.c
  const goalI = goal.r * SIZE + goal.c
  const open: number[] = [startI]
  searchStamp[startI] = gen
  searchG[startI] = 0
  searchCame[startI] = -1
  searchOpen[startI] = 1

  while (open.length) {
    let bestI = 0
    let bestF = Infinity
    for (let i = 0; i < open.length; i++) {
      const n = open[i]
      const c = n % SIZE
      const f = searchG[n] + Math.abs(c - goal.c) + Math.abs((n - c) / SIZE - goal.r)
      if (f < bestF) {
        bestF = f
        bestI = i
      }
    }
    const cur = open.splice(bestI, 1)[0]
    searchOpen[cur] = 0
    if (cur === goalI) {
      const path: Vec[] = []
      for (let k = cur; k >= 0; k = searchCame[k]) path.push({ c: k % SIZE, r: Math.floor(k / SIZE) })
      path.reverse()
      return path
    }
    const pc = cur % SIZE
    const pr = (cur - pc) / SIZE
    for (const d of DIRS) {
      const nc = pc + d.c
      const nr = pr + d.r
      if (!cellOpen(tiles, nc, nr, kind, pass)) continue
      const n = nr * SIZE + nc
      const step = kind === 'person' ? personStepCost(tiles[nr][nc]) : 1
      const ng = searchG[cur] + step
      const seen = searchStamp[n] === gen
      if (seen && ng >= searchG[n]) continue
      if (!seen) {
        searchStamp[n] = gen
        searchOpen[n] = 0
      }
      searchCame[n] = cur
      searchG[n] = ng
      if (!searchOpen[n]) {
        searchOpen[n] = 1
        open.push(n)
      }
    }
  }
  return null
}

const searchStamp = new Uint32Array(SIZE * SIZE)
const searchG = new Float64Array(SIZE * SIZE)
const searchCame = new Int32Array(SIZE * SIZE)
const searchOpen = new Uint8Array(SIZE * SIZE)
let searchGen = 0

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

/** Bag-belt graph: painted belt + makeup (bags) + stand bay + terminal drop. */
export function beltNode(tile: Tile): boolean {
  return tile === 'belt' || tile === 'bags' || tile === 'stand' || tile === 'terminal'
}

/** BFS on the belt graph — used to validate check-in → makeup → bay. */
export function beltReachable(tiles: Tile[][], start: Vec, goal: Vec): boolean {
  if (!inBounds(start.c, start.r) || !inBounds(goal.c, goal.r)) return false
  if (!beltNode(tiles[start.r][start.c]) || !beltNode(tiles[goal.r][goal.c])) return false
  if (start.c === goal.c && start.r === goal.r) return true
  const seen = new Set<string>([key(start.c, start.r)])
  const q: Vec[] = [start]
  while (q.length) {
    const cur = q.shift()!
    for (const n of neighbors(cur.c, cur.r)) {
      const nk = key(n.c, n.r)
      if (seen.has(nk)) continue
      if (!beltNode(tiles[n.r][n.c])) continue
      if (n.c === goal.c && n.r === goal.r) return true
      seen.add(nk)
      q.push(n)
    }
  }
  return false
}

/** True when makeup can reach the stand and a terminal via belt tiles. */
export function standBeltLinked(tiles: Tile[][], stand: Vec): boolean {
  const makeups = tilesOf(tiles, 'bags')
  const halls = tilesOf(tiles, 'terminal')
  if (!makeups.length || !halls.length) return false
  for (const m of makeups) {
    if (!beltReachable(tiles, m, stand)) continue
    if (halls.some((h) => beltReachable(tiles, m, h))) return true
  }
  return false
}

/** Any belt tile stamped — once true, broken links start to hurt. */
export function hasBeltNetwork(tiles: Tile[][]): boolean {
  return tilesOf(tiles, 'belt').length > 0
}

export function tilesOf(tiles: Tile[][], type: Tile | Tile[]): Vec[] {
  const out: Vec[] = []
  // Hot in the sim tick (hundreds of calls a frame): a single type skips the Set.
  if (!Array.isArray(type) || type.length === 1) {
    const want = Array.isArray(type) ? type[0] : type
    for (let r = 0; r < SIZE; r++) {
      const row = tiles[r]
      for (let c = 0; c < SIZE; c++) {
        if (row[c] === want) out.push({ c, r })
      }
    }
    return out
  }
  const set = new Set(type)
  for (let r = 0; r < SIZE; r++) {
    const row = tiles[r]
    for (let c = 0; c < SIZE; c++) {
      if (set.has(row[c])) out.push({ c, r })
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

const CURB: ReadonlySet<Tile> = new Set(['road', 'bus'])

/** A terminal cell with a road or bus curb on one side — the only door apron pax may use. */
export function isPaxEntrance(tiles: Tile[][], c: number, r: number): boolean {
  if (!inBounds(c, r) || tiles[r][c] !== 'terminal') return false
  return neighbors(c, r).some((n) => CURB.has(tiles[n.r][n.c]))
}

/**
 * Ground cells for apron passengers. Interior terminal, skywalks and travelators
 * are closed so a walker cannot cut across the roof. Door cells stay open.
 */
export function paxGround(tiles: Tile[][], c: number, r: number): boolean {
  if (!inBounds(c, r)) return false
  const tile = tiles[r][c]
  if (tile === 'skywalk' || tile === 'travelator' || tile === 'grass') return false
  if (tile === 'terminal') return isPaxEntrance(tiles, c, r)
  return walkableFor('person', tile)
}

/** Shortest ground walk. Null when the only route would leave the pavement or cross the roof. */
export function paxPath(tiles: Tile[][], from: Vec, to: Vec): Vec[] | null {
  return astar(tiles, from, to, 'person', (c, r) => paxGround(tiles, c, r))
}

/** True when every step is on a jet tile and no step cuts a corner or a chord. */
export function jetRouteOnGraph(tiles: Tile[][], path: readonly Vec[]): boolean {
  if (path.length < 2) return false
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const ac = Math.round(a.c)
    const ar = Math.round(a.r)
    const bc = Math.round(b.c)
    const br = Math.round(b.r)
    if (!inBounds(ac, ar) || !inBounds(bc, br)) return false
    if (!walkableFor('jet', tiles[ar][ac]) || !walkableFor('jet', tiles[br][bc])) return false
    if (Math.abs(ac - bc) + Math.abs(ar - br) > 1) return false
  }
  return true
}

/** Road or bus cells that share an edge with a terminal door. */
export function landsideCurbs(tiles: Tile[][]): Vec[] {
  const out: Vec[] = []
  const seen = new Set<string>()
  for (const door of tilesOf(tiles, 'terminal')) {
    if (!isPaxEntrance(tiles, door.c, door.r)) continue
    for (const n of neighbors(door.c, door.r)) {
      if (!CURB.has(tiles[n.r][n.c])) continue
      const k = key(n.c, n.r)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(n)
    }
  }
  return out
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
