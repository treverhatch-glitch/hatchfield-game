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
    // Trucks stay on the apron and the public road. The terminal is a building,
    // so a shortcut through the hall is not a vehicle path.
    return (
      tile === 'taxi' ||
      tile === 'stand' ||
      tile === 'fuel' ||
      tile === 'bags' ||
      tile === 'belt' ||
      tile === 'snack' ||
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
    tile === 'late_rail' ||
    tile === 'late_landmark' ||
    tile === 'late_cargo' ||
    tile === 'spotters_deck'
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
  pass?: (c: number, r: number) => boolean,
): Vec[] | null {
  let best: Vec[] | null = null
  for (const goal of goals) {
    const p = astar(tiles, start, goal, kind, pass)
    if (p && (!best || p.length < best.length)) best = p
  }
  return best
}

/**
 * Bowser walk: any truck cell except a fuel farm. The farm cell is the tank yard.
 * `from` stays open so a bowser already standing on a farm (old saves) can drive off it.
 */
export function bowserPass(tiles: Tile[][], from?: Vec): (c: number, r: number) => boolean {
  return (c, r) => tiles[r][c] !== 'fuel' || (!!from && c === from.c && r === from.r)
}

/** Truck cells beside a farm where a bowser waits and bottom-loads. */
export function farmDocks(tiles: Tile[][], farm: Vec): Vec[] {
  return neighbors(farm.c, farm.r).filter((n) => {
    const tile = tiles[n.r][n.c]
    return tile !== 'fuel' && walkableFor('truck', tile)
  })
}

/** Shortest bowser route to the goals from a dock beside the farm. Null when no dock reaches them. */
export function bowserPath(tiles: Tile[][], farm: Vec, goals: Vec[]): { dock: Vec; path: Vec[] } | null {
  const pass = bowserPass(tiles)
  let best: { dock: Vec; path: Vec[] } | null = null
  for (const dock of farmDocks(tiles, farm)) {
    const path = nearestPath(tiles, dock, goals, 'truck', pass)
    if (path && (!best || path.length < best.path.length)) best = { dock, path }
  }
  return best
}

/**
 * One walk to the closest reachable goal, not including `start`.
 * The path begins on the entity's current cell so the next step can roll from there.
 */
export function pathToNearest(
  tiles: Tile[][],
  start: Vec,
  goals: readonly Vec[],
  kind: 'jet' | 'truck' | 'person' | 'mechanic',
): Vec[] | null {
  if (!inBounds(start.c, start.r) || !cellOpen(tiles, start.c, start.r, kind)) return null
  const goal = new Uint8Array(SIZE * SIZE)
  let count = 0
  for (const cell of goals) {
    if (!inBounds(cell.c, cell.r) || (cell.c === start.c && cell.r === start.r)) continue
    if (!cellOpen(tiles, cell.c, cell.r, kind)) continue
    const index = cell.r * SIZE + cell.c
    if (goal[index]) continue
    goal[index] = 1
    count += 1
  }
  if (!count) return null
  const parent = new Int32Array(SIZE * SIZE)
  parent.fill(-2)
  const startI = start.r * SIZE + start.c
  parent[startI] = -1
  const queue = [startI]
  let head = 0
  while (head < queue.length) {
    const cur = queue[head]
    head += 1
    if (goal[cur]) {
      const path: Vec[] = []
      for (let k = cur; k >= 0; k = parent[k]) path.push({ c: k % SIZE, r: Math.floor(k / SIZE) })
      path.reverse()
      return path
    }
    const pc = cur % SIZE
    const pr = (cur - pc) / SIZE
    for (const d of DIRS) {
      const nc = pc + d.c
      const nr = pr + d.r
      if (!cellOpen(tiles, nc, nr, kind)) continue
      const next = nr * SIZE + nc
      if (parent[next] !== -2) continue
      parent[next] = cur
      queue.push(next)
    }
  }
  return null
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

/**
 * True when the hall reaches the stand on the belt graph, and that link
 * dies if the bag-sort cells are removed. A belt that runs hall → stand
 * without the sort returns false.
 */
export function standBeltViaSort(tiles: Tile[][], stand: Vec): boolean {
  if (!standBeltLinked(tiles, stand)) return false
  const blocked = tiles.map((row) => row.slice())
  for (const makeup of tilesOf(tiles, 'bags')) blocked[makeup.r][makeup.c] = 'grass'
  const halls = tilesOf(tiles, 'terminal')
  return !halls.some((hall) => beltReachable(blocked, hall, stand))
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

/**
 * One strip per connected runway piece.
 * A 14×2 prefab is a single strip: the centerline is the longest straight run,
 * so a wide pavement does not count once per row. Length is that run, which is
 * what airframe gates and the approach use.
 */
export function runwayStrips(tiles: Tile[][], min: number): Vec[][] {
  const seen = new Set<string>()
  const strips: Vec[][] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (tiles[r][c] !== 'runway' || seen.has(`${c},${r}`)) continue
      const cells: Vec[] = []
      const stack: Vec[] = [{ c, r }]
      seen.add(`${c},${r}`)
      while (stack.length) {
        const p = stack.pop()!
        cells.push(p)
        for (const n of neighbors(p.c, p.r)) {
          const id = `${n.c},${n.r}`
          if (seen.has(id) || tiles[n.r][n.c] !== 'runway') continue
          seen.add(id)
          stack.push(n)
        }
      }
      const line = runwayCenterline(cells)
      if (line.length >= min) strips.push(line)
    }
  }
  return strips
}

/** Longest straight run inside one runway piece, ordered along the strip. */
function runwayCenterline(cells: Vec[]): Vec[] {
  const byRow = new Map<number, number[]>()
  const byCol = new Map<number, number[]>()
  for (const p of cells) {
    const cols = byRow.get(p.r)
    if (cols) cols.push(p.c)
    else byRow.set(p.r, [p.c])
    const rows = byCol.get(p.c)
    if (rows) rows.push(p.r)
    else byCol.set(p.c, [p.r])
  }
  let best: Vec[] = []
  let bestAxis: 'h' | 'v' = 'h'
  let bestFixed = Infinity
  const take = (coords: number[], fixed: number, axis: 'h' | 'v') => {
    coords.sort((a, b) => a - b)
    let start = 0
    for (let i = 1; i <= coords.length; i++) {
      if (i < coords.length && coords[i] === coords[i - 1] + 1) continue
      const run = coords.slice(start, i)
      const longer = run.length > best.length
      const tie =
        run.length === best.length &&
        run.length > 0 &&
        (axis === 'h' && bestAxis === 'v' || (axis === bestAxis && fixed < bestFixed))
      if (longer || tie) {
        bestAxis = axis
        bestFixed = fixed
        best =
          axis === 'h' ? run.map((c) => ({ c, r: fixed })) : run.map((r) => ({ c: fixed, r }))
      }
      start = i
    }
  }
  for (const [r, cols] of byRow) take(cols, r, 'h')
  for (const [c, rows] of byCol) take(rows, c, 'v')
  return best
}
