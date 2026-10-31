/**
 * Terminal room plan: a fine nav grid over each terminal footprint, labelled with
 * rooms (check-in hall, security, airside concourse, shops, gate holdrooms, R&D lab,
 * offices), the walls between them, doorways, and blocked squares under solid props.
 *
 * Pure data. The renderer draws walls / floors from it and routes the crowd with
 * `navPath`; the sim can use the same plan so guests respect the same walls.
 */
import { METERS_PER_CELL, WORLD_PER_METER } from '../aircraft/specs'
import { DIR_VEC, type TerminalInfo } from './layout'
import type { CellZone, Prop, PropKind } from './plan'
import { CELL, cellX, cellZ } from './view'
import { detCos, detHypot, detSin } from '../../game/detMath'

const m = (meters: number) => meters * WORLD_PER_METER

export type RoomKind = 'checkin' | 'security' | 'airside' | 'shops' | 'gate' | 'lab' | 'office'

/** One nav square per meter, so a door of n squares is n meters wide. */
export const NAV_RES = METERS_PER_CELL
export const NAV_SQ = CELL / NAV_RES

export const ROOM_LABEL: Record<RoomKind, string> = {
  checkin: 'CHECK-IN HALL',
  security: 'SECURITY',
  airside: 'AIRSIDE',
  shops: 'SHOPS · CAFÉ',
  gate: 'GATE',
  lab: 'R&D LAB',
  office: 'OFFICES',
}

/** Rooms the public may walk through. Staff rooms are only entered as a start / goal. */
export const PUBLIC_ROOMS: ReadonlySet<RoomKind> = new Set(['checkin', 'security', 'airside', 'shops', 'gate'])
/** Past the screening line. */
export const STERILE_ROOMS: ReadonlySet<RoomKind> = new Set(['airside', 'shops', 'gate'])

/**
 * Sim hall node → room kind, so `HallGuest.node` can be placed in (and routed through)
 * the in-world terminal. Unlisted nodes fall back to `airside`.
 */
export const HALL_NODE_ROOM: Readonly<Record<string, RoomKind>> = {
  entrance: 'checkin',
  info: 'checkin',
  checkin: 'checkin',
  bathroom: 'checkin',
  exit: 'checkin',
  security: 'security',
  food: 'shops',
  shop: 'shops',
  lounge: 'airside',
  gaming: 'airside',
  spa: 'airside',
  dayhotel: 'airside',
  pool: 'airside',
  golf: 'airside',
  waterfall: 'airside',
  claim: 'airside',
  gate: 'gate',
  lab_desk: 'office',
  lab_board: 'lab',
  lab_bench: 'lab',
}

export interface Room {
  id: number
  kind: RoomKind
  label: string
  /** Nav square indices (j * w + i). */
  squares: number[]
  /** Centroid, world space. */
  x: number
  z: number
}

export type DoorKind = 'opening' | 'door' | 'staff'

export interface Door {
  a: number
  b: number
  /** Centre, world space. */
  x: number
  z: number
  /** Axis the wall runs along. */
  axis: 'x' | 'z'
  /** Metres. */
  width: number
  kind: DoorKind
}

export type WallKind = 'solid' | 'glass'

export interface Wall {
  x0: number
  z0: number
  x1: number
  z1: number
  kind: WallKind
  /** Lintel over a doorway (drawn above door height only). */
  header?: boolean
  a: number
  b: number
}

export interface RoomPlan {
  /** World-space min corner of the grid. */
  x0: number
  z0: number
  w: number
  h: number
  size: number
  /** Room id per square, -1 outside the building. */
  grid: Int16Array
  /** 1 where a solid prop stands. */
  blocked: Uint8Array
  rooms: Room[]
  doors: Door[]
  walls: Wall[]
  /** Edge ids that are doorways (see `edgeId`). */
  doorEdges: Set<number>
}

/** Edge between square (i, j) and its +x neighbour (`dir` 0) or +z neighbour (`dir` 1). */
export function edgeId(w: number, i: number, j: number, dir: 0 | 1): number {
  return (j * w + i) * 2 + dir
}

const DOOR_RULES: Record<string, { n: number; kind: DoorKind }> = {
  'checkin|security': { n: 8, kind: 'opening' },
  'airside|security': { n: 8, kind: 'opening' },
  'airside|shops': { n: 8, kind: 'opening' },
  'airside|gate': { n: 8, kind: 'opening' },
  'gate|gate': { n: 6, kind: 'opening' },
  'checkin|office': { n: 3, kind: 'staff' },
  'lab|office': { n: 4, kind: 'door' },
}

const pairKey = (a: RoomKind, b: RoomKind) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Glass partitions between neighbouring holdrooms; plaster everywhere else. */
export function wallKind(a: RoomKind, b: RoomKind): WallKind {
  return a === 'gate' && b === 'gate' ? 'glass' : 'solid'
}

/** Rooms that stay one-per-cell instead of merging with same-kind neighbours. */
const PER_CELL: ReadonlySet<RoomKind> = new Set(['gate', 'lab', 'office'])

/** Footprint half-extents (meters, then world units) of props walkers must go around. */
const SOLID: Partial<Record<PropKind, [number, number]>> = {
  counter: [m(0.6), m(0.25)],
  belt: [m(2.6), m(0.19)],
  bench: [m(0.65), m(0.21)],
  podium: [m(0.45), m(0.23)],
  xray: [m(0.31), m(1.15)],
  kiosk: [m(0.63), m(0.88)],
  table: [m(0.3), m(0.3)],
  stool: [m(0.13), m(0.13)],
  planter: [m(0.25), m(0.25)],
}
/** Body radius kept clear of walls and furniture. */
export const NAV_CLEAR = m(0.22)

export function roomKindAt(zone: CellZone['zone'], v: number, oneDeep: boolean, twoDeep = false): RoomKind {
  // Shops on a two-deep airside row keep the same landside concourse the gates use.
  if (twoDeep && zone === 'shops' && v < -CELL / 6) return 'airside'
  if (zone === 'gate') return !oneDeep && v < -CELL / 2 + CELL / 3 ? 'airside' : 'gate'
  if (zone === 'backoffice') return v < 0 ? 'office' : 'lab'
  return zone
}

export function planRooms(t: TerminalInfo, zones: readonly CellZone[], props: readonly Prop[], oneDeep: boolean, twoDeep = false): RoomPlan {
  const { minC, minR, maxC, maxR } = t.cluster
  const w = (maxC - minC + 1) * NAV_RES
  const h = (maxR - minR + 1) * NAV_RES
  const x0 = cellX(minC) - CELL / 2
  const z0 = cellZ(minR) - CELL / 2
  const A = DIR_VEC[t.airside]
  const zoneAt = new Map(zones.map((z) => [`${z.c},${z.r}`, z.zone]))

  const kind: (RoomKind | null)[] = new Array(w * h).fill(null)
  const cellOf = new Int32Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = minC + Math.floor(i / NAV_RES)
      const r = minR + Math.floor(j / NAV_RES)
      const zone = zoneAt.get(`${c},${r}`)
      if (!zone) continue
      const ox = ((i % NAV_RES) + 0.5) * NAV_SQ - CELL / 2
      const oz = ((j % NAV_RES) + 0.5) * NAV_SQ - CELL / 2
      kind[j * w + i] = roomKindAt(zone, ox * A.dc + oz * A.dr, oneDeep, twoDeep)
      cellOf[j * w + i] = c * 1024 + r
    }
  }

  // Flood fill same-kind squares into rooms.
  const grid = new Int16Array(w * h).fill(-1)
  const rooms: Room[] = []
  for (let s0 = 0; s0 < w * h; s0++) {
    const k = kind[s0]
    if (!k || grid[s0] >= 0) continue
    const id = rooms.length
    const squares: number[] = []
    const stack = [s0]
    grid[s0] = id
    while (stack.length) {
      const s = stack.pop()!
      squares.push(s)
      const i = s % w
      const j = (s - i) / w
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue
        const n = nj * w + ni
        if (grid[n] >= 0 || kind[n] !== k) continue
        if (PER_CELL.has(k) && cellOf[n] !== cellOf[s]) continue
        grid[n] = id
        stack.push(n)
      }
    }
    let sx = 0
    let sz = 0
    for (const s of squares) {
      sx += x0 + ((s % w) + 0.5) * NAV_SQ
      sz += z0 + (Math.floor(s / w) + 0.5) * NAV_SQ
    }
    rooms.push({ id, kind: k, label: ROOM_LABEL[k], squares, x: sx / squares.length, z: sz / squares.length })
  }
  numberGates(rooms, t)

  // Boundary runs between rooms, grouped by room pair and wall line.
  interface Run {
    a: number
    b: number
    axis: 'x' | 'z'
    line: number
    k0: number
    k1: number
  }
  const lines = new Map<string, { a: number; b: number; axis: 'x' | 'z'; line: number; ks: number[] }>()
  const addEdge = (a: number, b: number, axis: 'x' | 'z', line: number, k: number) => {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    const key = `${lo}|${hi}|${axis}|${line}`
    let l = lines.get(key)
    if (!l) lines.set(key, (l = { a: lo, b: hi, axis, line, ks: [] }))
    l.ks.push(k)
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const a = grid[j * w + i]
      if (a < 0) continue
      // Wall between (i,j) and (i+1,j) runs along z at x-line i+1.
      if (i + 1 < w && grid[j * w + i + 1] >= 0 && grid[j * w + i + 1] !== a) addEdge(a, grid[j * w + i + 1], 'z', i + 1, j)
      if (j + 1 < h && grid[(j + 1) * w + i] >= 0 && grid[(j + 1) * w + i] !== a) addEdge(a, grid[(j + 1) * w + i], 'x', j + 1, i)
    }
  }
  const runs: Run[] = []
  for (const l of lines.values()) {
    l.ks.sort((p, q) => p - q)
    let k0 = l.ks[0]
    let prev = k0
    for (let n = 1; n <= l.ks.length; n++) {
      const k = l.ks[n]
      if (k === prev + 1) {
        prev = k
        continue
      }
      runs.push({ a: l.a, b: l.b, axis: l.axis, line: l.line, k0, k1: prev + 1 })
      k0 = k
      prev = k
    }
  }

  const doorEdges = new Set<number>()
  const doors: Door[] = []
  const edgeOf = (r: Run, k: number) => (r.axis === 'z' ? edgeId(w, r.line - 1, k, 0) : edgeId(w, k, r.line - 1, 1))
  const openDoor = (r: Run, n: number, kind: DoorKind) => {
    const len = r.k1 - r.k0
    const width = Math.min(n, len)
    const start = r.k0 + Math.floor((len - width) / 2)
    for (let k = start; k < start + width; k++) doorEdges.add(edgeOf(r, k))
    const along = (start + width / 2) * NAV_SQ
    const across = r.line * NAV_SQ
    doors.push({
      a: r.a,
      b: r.b,
      x: r.axis === 'z' ? x0 + across : x0 + along,
      z: r.axis === 'z' ? z0 + along : z0 + across,
      axis: r.axis,
      width: width * NAV_SQ,
      kind,
    })
  }
  const longest = (list: Run[]) => list.reduce<Run | null>((best, r) => (!best || r.k1 - r.k0 > best.k1 - best.k0 ? r : best), null)

  const byPair = new Map<string, Run[]>()
  for (const r of runs) {
    const key = `${r.a}|${r.b}`
    if (!byPair.has(key)) byPair.set(key, [])
    byPair.get(key)!.push(r)
  }
  for (const list of byPair.values()) {
    const rule = DOOR_RULES[pairKey(rooms[list[0].a].kind, rooms[list[0].b].kind)]
    if (rule) openDoor(longest(list)!, rule.n, rule.kind)
  }

  // Every room reachable from the landside hall (odd layouts get a fallback door).
  const linked = (a: number, b: number) => doors.some((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a))
  for (;;) {
    const start = rooms.find((r) => r.kind === 'checkin')?.id ?? 0
    const seen = new Set([start])
    const q = [start]
    while (q.length) {
      const cur = q.shift()!
      for (const d of doors) {
        const n = d.a === cur ? d.b : d.b === cur ? d.a : -1
        if (n >= 0 && !seen.has(n)) {
          seen.add(n)
          q.push(n)
        }
      }
    }
    if (seen.size >= rooms.length) break
    const bridge = longest(runs.filter((r) => seen.has(r.a) !== seen.has(r.b) && !linked(r.a, r.b)))
    if (!bridge) break
    openDoor(bridge, 4, 'door')
  }

  // Walls: boundary edges that are not doorways, merged into straight segments.
  const walls: Wall[] = []
  for (const r of runs) {
    const wk = wallKind(rooms[r.a].kind, rooms[r.b].kind)
    const seg = (k0: number, k1: number, header = false) => {
      const across = r.line * NAV_SQ
      walls.push(
        r.axis === 'z'
          ? { x0: x0 + across, z0: z0 + k0 * NAV_SQ, x1: x0 + across, z1: z0 + k1 * NAV_SQ, kind: wk, header, a: r.a, b: r.b }
          : { x0: x0 + k0 * NAV_SQ, z0: z0 + across, x1: x0 + k1 * NAV_SQ, z1: z0 + across, kind: wk, header, a: r.a, b: r.b },
      )
    }
    let k0 = -1
    let d0 = -1
    for (let k = r.k0; k <= r.k1; k++) {
      const isDoor = k < r.k1 && doorEdges.has(edgeOf(r, k))
      const isWall = k < r.k1 && !isDoor
      if (isWall && k0 < 0) k0 = k
      if (!isWall && k0 >= 0) {
        seg(k0, k)
        k0 = -1
      }
      if (isDoor && d0 < 0) d0 = k
      if (!isDoor && d0 >= 0) {
        if (wk === 'solid') seg(d0, k, true)
        d0 = -1
      }
    }
  }

  const plan: RoomPlan = { x0, z0, w, h, size: NAV_SQ, grid, blocked: new Uint8Array(w * h), rooms, doors, walls, doorEdges }
  blockProps(plan, props)
  return plan
}

/** Gate holdrooms get the same letters / numbers as the exterior gate signs. */
function numberGates(rooms: Room[], t: TerminalInfo) {
  const airEdges = t.edges.filter((e) => e.side === t.airside)
  const order = (r: Room) => {
    const k = airEdges.findIndex((e) => Math.abs(cellX(e.c) - r.x) < CELL / 2 && Math.abs(cellZ(e.r) - r.z) < CELL / 2)
    return k < 0 ? airEdges.length + r.id : k
  }
  const gates = rooms.filter((r) => r.kind === 'gate').sort((p, q) => order(p) - order(q))
  gates.forEach((g, i) => (g.label = `GATE ${i + 1}`))
}

function blockProps(plan: RoomPlan, props: readonly Prop[]) {
  const nearDoor = new Uint8Array(plan.w * plan.h)
  for (const e of plan.doorEdges) {
    const s = e >> 1
    const i = s % plan.w
    const j = (s - i) / plan.w
    for (let dj = -1; dj <= 1 + (e & 1); dj++) {
      for (let di = -1; di <= 1 + (1 - (e & 1)); di++) {
        const ni = i + di
        const nj = j + dj
        if (ni >= 0 && nj >= 0 && ni < plan.w && nj < plan.h) nearDoor[nj * plan.w + ni] = 1
      }
    }
  }
  const mark = (x: number, z: number) => {
    const s = squareAt(plan, x, z)
    if (s >= 0 && !nearDoor[s]) plan.blocked[s] = 1
  }
  for (const p of props) {
    // Security arches are walked through; only their posts block.
    const posts = p.kind === 'arch'
    const ext = posts ? null : SOLID[p.kind]
    if (!ext && !posts) continue
    const ux = detCos(p.yaw)
    const uz = -detSin(p.yaw)
    if (posts) {
      for (const o of [-m(0.42), m(0.42)]) mark(p.x + ux * o, p.z + uz * o)
      continue
    }
    const hx = ext![0] + m(0.08)
    const hz = ext![1] + m(0.08)
    const step = m(0.2)
    const nx = Math.max(1, Math.ceil((hx * 2) / step))
    const nz = Math.max(1, Math.ceil((hz * 2) / step))
    for (let a = 0; a <= nx; a++) {
      for (let b = 0; b <= nz; b++) {
        const lx = -hx + (2 * hx * a) / nx
        const lz = -hz + (2 * hz * b) / nz
        // Local z maps to world (sin yaw, cos yaw).
        mark(p.x + ux * lx + detSin(p.yaw) * lz, p.z + uz * lx + detCos(p.yaw) * lz)
      }
    }
  }
}

export function squareAt(plan: RoomPlan, x: number, z: number): number {
  const i = Math.floor((x - plan.x0) / plan.size)
  const j = Math.floor((z - plan.z0) / plan.size)
  if (i < 0 || j < 0 || i >= plan.w || j >= plan.h) return -1
  const s = j * plan.w + i
  return plan.grid[s] >= 0 ? s : -1
}

export function roomAt(plan: RoomPlan, x: number, z: number): Room | null {
  const s = squareAt(plan, x, z)
  return s < 0 ? null : plan.rooms[plan.grid[s]]
}

export function squareCenter(plan: RoomPlan, s: number): { x: number; z: number } {
  const i = s % plan.w
  return { x: plan.x0 + (i + 0.5) * plan.size, z: plan.z0 + ((s - i) / plan.w + 0.5) * plan.size }
}

/** Can a walker step from square `a` to 4-neighbour `b`? Same room, or through a doorway. */
export function canStep(plan: RoomPlan, a: number, b: number): boolean {
  if (plan.grid[b] < 0) return false
  if (plan.grid[a] === plan.grid[b]) return true
  const ia = a % plan.w
  const ib = b % plan.w
  const lo = Math.min(a, b)
  const li = lo % plan.w
  const lj = (lo - li) / plan.w
  const dir: 0 | 1 = ia !== ib ? 0 : 1
  return plan.doorEdges.has(edgeId(plan.w, li, lj, dir))
}

/**
 * Shortest walk between two world points on the nav grid, through doorways only,
 * around solid props, and only through public rooms (plus the start / goal rooms).
 * Returns a string-pulled polyline in world space, or null when unreachable.
 */
export function navPath(
  plan: RoomPlan,
  from: { x: number; z: number },
  to: { x: number; z: number },
  opts: { avoidProps?: boolean; staff?: boolean; strict?: boolean } = {},
): { x: number; z: number }[] | null {
  const a = squareAt(plan, from.x, from.z)
  const b = squareAt(plan, to.x, to.z)
  if (a < 0 || b < 0) return null
  const avoid = opts.avoidProps ?? true
  const ra = plan.grid[a]
  const rb = plan.grid[b]
  const passable = (s: number) =>
    s === a ||
    s === b ||
    ((!avoid || !plan.blocked[s]) &&
      (opts.staff || plan.grid[s] === ra || plan.grid[s] === rb || PUBLIC_ROOMS.has(plan.rooms[plan.grid[s]].kind)))
  const came = new Int32Array(plan.w * plan.h).fill(-1)
  came[a] = a
  const q = [a]
  let head = 0
  while (head < q.length) {
    const s = q[head++]
    if (s === b) break
    const i = s % plan.w
    const j = (s - i) / plan.w
    const nb = [i + 1 < plan.w ? s + 1 : -1, i > 0 ? s - 1 : -1, j + 1 < plan.h ? s + plan.w : -1, j > 0 ? s - plan.w : -1]
    for (const n of nb) {
      if (n < 0 || came[n] >= 0 || !passable(n) || !canStep(plan, s, n)) continue
      came[n] = s
      q.push(n)
    }
  }
  if (came[b] < 0) return avoid && !opts.strict ? navPath(plan, from, to, { ...opts, avoidProps: false }) : null
  const squares: number[] = [b]
  for (let s = b; s !== a; s = came[s]) squares.push(came[s])
  squares.reverse()

  // String-pull: keep the farthest square still in straight-line reach.
  const pts = [{ x: from.x, z: from.z }]
  let anchor = { x: from.x, z: from.z }
  let k = 0
  while (k < squares.length - 1) {
    let far = k + 1
    for (let m = squares.length - 1; m > k + 1; m--) {
      const target = m === squares.length - 1 ? to : squareCenter(plan, squares[m])
      if (lineClear(plan, anchor, target, passable)) {
        far = m
        break
      }
    }
    const p = far === squares.length - 1 ? { x: to.x, z: to.z } : squareCenter(plan, squares[far])
    pts.push(p)
    anchor = p
    k = far
  }
  if (pts.length === 1) pts.push({ x: to.x, z: to.z })
  return pts
}

function lineClear(
  plan: RoomPlan,
  p: { x: number; z: number },
  q: { x: number; z: number },
  passable: (s: number) => boolean,
): boolean {
  const len = detHypot(q.x - p.x, q.z - p.z)
  const n = Math.max(1, Math.ceil(len / (plan.size * 0.25)))
  let prev = squareAt(plan, p.x, p.z)
  for (let k = 1; k <= n; k++) {
    const x = p.x + ((q.x - p.x) * k) / n
    const z = p.z + ((q.z - p.z) * k) / n
    const s = squareAt(plan, x, z)
    if (s < 0) return false
    if (!clearOfWalls(plan, s, x, z, passable)) return false
    if (s === prev) continue
    if (!passable(s)) return false
    const di = (s % plan.w) - (prev % plan.w)
    const dj = Math.floor(s / plan.w) - Math.floor(prev / plan.w)
    if (Math.abs(di) + Math.abs(dj) === 1) {
      if (!canStep(plan, prev, s)) return false
    } else if (Math.abs(di) === 1 && Math.abs(dj) === 1) {
      const viaX = prev + di
      const viaZ = prev + dj * plan.w
      const okX = passable(viaX) && canStep(plan, prev, viaX) && canStep(plan, viaX, s)
      const okZ = passable(viaZ) && canStep(plan, prev, viaZ) && canStep(plan, viaZ, s)
      if (!okX && !okZ) return false
    } else return false
    prev = s
  }
  return true
}

/** Keeps a body radius off walls, wall ends and blocked squares around the point. */
function clearOfWalls(plan: RoomPlan, s: number, x: number, z: number, passable: (s: number) => boolean): boolean {
  const { w, h, size } = plan
  const i = s % w
  const j = (s - i) / w
  const fx = (x - plan.x0) / size - i
  const fz = (z - plan.z0) / size - j
  const r = NAV_CLEAR / size
  const dx = fx < r ? -1 : fx > 1 - r ? 1 : 0
  const dz = fz < r ? -1 : fz > 1 - r ? 1 : 0
  const open = (from: number, ni: number, nj: number) => {
    if (ni < 0 || nj < 0 || ni >= w || nj >= h) return false
    const n = nj * w + ni
    return passable(n) && canStep(plan, from, n)
  }
  if (dx && !open(s, i + dx, j)) return false
  if (dz && !open(s, i, j + dz)) return false
  if (dx && dz) {
    const sx = j * w + i + dx
    const sz = (j + dz) * w + i
    if (!open(sx, i + dx, j + dz) || !open(sz, i + dx, j + dz)) return false
  }
  return true
}

/** A free square in a room, picked with `rand` (0..1). */
export function pointInRoom(plan: RoomPlan, room: Room, rand: () => number): { x: number; z: number } {
  const free = room.squares.filter((s) => !plan.blocked[s])
  const list = free.length ? free : room.squares
  return squareCenter(plan, list[Math.floor(rand() * list.length) % list.length])
}

/** Room outline as axis-aligned boundary edges (world space) — for debug drawing / sim polygons. */
export function roomEdges(plan: RoomPlan, room: Room): [number, number, number, number][] {
  const out: [number, number, number, number][] = []
  const { w, h, x0, z0, size } = plan
  const inRoom = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && plan.grid[j * w + i] === room.id
  for (const s of room.squares) {
    const i = s % w
    const j = (s - i) / w
    const ax = x0 + i * size
    const az = z0 + j * size
    if (!inRoom(i, j - 1)) out.push([ax, az, ax + size, az])
    if (!inRoom(i, j + 1)) out.push([ax, az + size, ax + size, az + size])
    if (!inRoom(i - 1, j)) out.push([ax, az, ax, az + size])
    if (!inRoom(i + 1, j)) out.push([ax + size, az, ax + size, az + size])
  }
  return out
}
