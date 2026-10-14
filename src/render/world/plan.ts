/**
 * Terminal interior plan: which cells are check-in, security, shops, or gates, and
 * where every instanced prop and person goes. Pure data, deterministic per layout.
 */
import { DIR_VEC, type Dir, type TerminalInfo } from './layout'
import { rng } from './raster'
import { navPath, planRooms, pointInRoom, type RoomKind, type RoomPlan } from './rooms'
import { CELL, cellX, cellZ } from './view'

/** `backoffice` cells split into staff offices (landside half) and the R&D lab. */
export type Zone = 'checkin' | 'security' | 'shops' | 'gate' | 'backoffice'

export type PropKind =
  | 'counter'
  | 'monitor'
  | 'belt'
  | 'stanchion'
  | 'bench'
  | 'podium'
  | 'board'
  | 'xray'
  | 'arch'
  | 'kiosk'
  | 'awning'
  | 'table'
  | 'stool'
  | 'planter'
  | 'light'
  | 'bin'
  | 'wc'
  | 'bag'

export interface Prop {
  kind: PropKind
  x: number
  z: number
  yaw: number
  /** Optional palette index (kiosk awnings, monitors). */
  tint?: number
}

export type PersonRole = 'staff' | 'pax' | 'seated'

export interface Person {
  role: PersonRole
  x: number
  z: number
  yaw: number
  tint: number
}

export interface Walker {
  /** Route polyline through doorways (world space). */
  pts: { x: number; z: number }[]
  /** Cumulative length at each point. */
  cum: number[]
  speed: number
  phase: number
  tint: number
  /** Pulls a roller case. */
  bag: boolean
  staff?: boolean
}

export interface CellZone {
  c: number
  r: number
  zone: Zone
}

export interface TerminalPlan {
  zones: CellZone[]
  props: Prop[]
  people: Person[]
  walkers: Walker[]
  rooms: RoomPlan
}

export function zoneFor(depth: number, depthN: number, along: number, alongN: number): Zone {
  if (depthN === 1) return along % 2 === 0 ? 'checkin' : 'gate'
  if (depth === 0) return 'checkin'
  if (depth === depthN - 1) return 'gate'
  const mid = Math.floor((alongN - 1) / 2)
  return along === mid ? 'security' : 'shops'
}

/** Same seed the renderer uses, so sim routes block the same props the picture draws. */
export function terminalPlanSeed(index: number): number {
  return 11 + index
}

export function planTerminal(
  t: TerminalInfo,
  opts: { density?: number; walkersPerCell?: number; seed?: number } = {},
): TerminalPlan {
  const density = opts.density ?? 1
  const rand = rng((opts.seed ?? 7) + t.cluster.minC * 131 + t.cluster.minR * 17)
  const A = DIR_VEC[t.airside]
  // Local frame: v toward airside, u along the facade.
  const ax = A.dc
  const az = A.dr
  const bx = -az
  const bz = ax
  const yawAir = Math.atan2(ax, az)
  const proj = (c: number, r: number) => c * A.dc + r * A.dr
  const projB = (c: number, r: number) => c * bx + r * bz
  let minP = Infinity
  let maxP = -Infinity
  let minB = Infinity
  let maxB = -Infinity
  for (const p of t.cluster.cells) {
    minP = Math.min(minP, proj(p.c, p.r))
    maxP = Math.max(maxP, proj(p.c, p.r))
    minB = Math.min(minB, projB(p.c, p.r))
    maxB = Math.max(maxB, projB(p.c, p.r))
  }
  const depthN = maxP - minP + 1
  const alongN = maxB - minB + 1
  const props: Prop[] = []
  const people: Person[] = []
  const zones: CellZone[] = []
  const paxTint = () => Math.floor(rand() * 8)

  const depthOf = (c: number, r: number) => proj(c, r) - minP
  const alongOf = (c: number, r: number) => projB(c, r) - minB
  for (const cell of t.cluster.cells) {
    zones.push({ c: cell.c, r: cell.r, zone: zoneFor(depthOf(cell.c, cell.r), depthN, alongOf(cell.c, cell.r), alongN) })
  }
  // One shop cell per terminal becomes back-of-house (offices + R&D lab) when there are spares.
  const shopCells = zones.filter((z) => z.zone === 'shops' && depthOf(z.c, z.r) === 1)
  if (shopCells.length >= 2) {
    shopCells.reduce((best, z) => (alongOf(z.c, z.r) > alongOf(best.c, best.r) ? z : best)).zone = 'backoffice'
  }
  const zoneAt = new Map(zones.map((z) => [`${z.c},${z.r}`, z.zone]))
  let wcPlaced = false

  for (const { c, r, zone } of zones) {
    const cx = cellX(c)
    const cz = cellZ(r)
    // Offsets were composed for a 6.2-unit bay. Stretch them across the real cell.
    const bay = CELL / 6.2
    const at = (u: number, v: number) => ({ x: cx + u * bay * bx + v * bay * ax, z: cz + u * bay * bz + v * bay * az })
    const prop = (kind: PropKind, u: number, v: number, yaw = yawAir, tint?: number) =>
      props.push({ kind, ...at(u, v), yaw, tint })
    const person = (role: PersonRole, u: number, v: number, yaw = yawAir) =>
      people.push({ role, ...at(u, v), yaw, tint: role === 'staff' ? 0 : paxTint() })

    // Tucked under the roof rim so they light the hall without blocking the skylight view.
    prop('light', -1.2, -2.8, yawAir)
    prop('light', 1.2, 2.8, yawAir)

    if (zone === 'checkin') {
      // The hall in front of security keeps a clear central lane to the screening doorway.
      const facesSecurity = zoneAt.get(`${c + A.dc},${r + A.dr}`) === 'security'
      const slots = facesSecurity
        ? density >= 1
          ? [-2.3, -1.15, 1.15, 2.3]
          : [-1.6, 1.6]
        : density >= 1
          ? [-1.95, -0.65, 0.65, 1.95]
          : [-0.9, 0.9]
      for (const u of slots) {
        prop('counter', u, 0.35, yawAir + Math.PI)
        prop('monitor', u, 0.28, yawAir + Math.PI)
        // Staffed desk faces the landside queue.
        person('staff', u, 0.85, yawAir + Math.PI)
        if (rand() < 0.75) person('pax', u + (rand() - 0.5) * 0.3, -0.35, yawAir)
        if (rand() < 0.45) person('pax', u + (rand() - 0.5) * 0.4, -0.95, yawAir)
      }
      if (!facesSecurity) prop('belt', 0, 1.3, yawAir)
      if (!wcPlaced) {
        prop('wc', -2.5, 2.25, yawAir)
        wcPlaced = true
      }
      for (const u of slots) {
        if (rand() < 0.4) prop('bag', u + 0.42, 1.15, yawAir)
      }
      prop('bin', 2.45, 2.15)
      for (const u of [-2.3, -1.3, -0.3, 0.7, 1.7]) prop('stanchion', u, -1.55)
      for (const u of [-1.8, -0.8, 0.2, 1.2, 2.2]) prop('stanchion', u, -2.15)
      prop('board', 0, -2.55, yawAir + Math.PI)
    } else if (zone === 'security') {
      const lanes = density >= 1 ? [-1.2, 1.2] : [0]
      for (const u of lanes) {
        prop('xray', u - 0.45, 0, yawAir)
        prop('arch', u + 0.55, 0.15, yawAir)
        person('staff', u + 0.05, 0.9, yawAir + Math.PI)
        person('staff', u - 1.0, -0.4, yawAir + Math.PI / 2)
        person('pax', u + 0.55, -0.9, yawAir)
        if (rand() < 0.7) person('pax', u + 0.5, -1.6, yawAir)
        if (rand() < 0.5) person('pax', u + 0.6, -2.2, yawAir)
      }
      prop('planter', -2.4, 2.3)
      prop('planter', 2.4, 2.3)
    } else if (zone === 'shops') {
      const tint = Math.floor(rand() * 4)
      prop('kiosk', -1.3, 0.4, yawAir + Math.PI / 2, tint)
      prop('awning', -0.55, 0.4, yawAir + Math.PI / 2, tint)
      person('staff', -1.55, 0.4, yawAir + Math.PI / 2)
      if (rand() < 0.8) person('pax', -0.1, 0.2, yawAir - Math.PI / 2)
      const tables = density >= 1 ? [-1.4, 0, 1.4] : [0]
      for (const v of tables) {
        prop('table', 1.5, v, yawAir)
        prop('stool', 1.05, v, yawAir)
        prop('stool', 1.95, v, yawAir)
        if (rand() < 0.6) person('seated', 1.05, v, yawAir + Math.PI / 2)
        if (rand() < 0.4) person('seated', 1.95, v, yawAir - Math.PI / 2)
      }
      prop('planter', 2.5, -2.4)
      prop('planter', -2.5, -2.4)
      prop('bin', 2.4, 2.3)
      prop('bag', 0.2, 1.7, yawAir)
    } else if (zone === 'backoffice') {
      // Landside half: staff offices.
      for (const u of density >= 1 ? [-1.5, 0, 1.5] : [-0.8, 0.8]) {
        prop('counter', u, -1.7, yawAir)
        prop('monitor', u, -1.62, yawAir)
        prop('stool', u, -1.15, yawAir)
        person('staff', u, -1.2, yawAir + Math.PI)
      }
      prop('planter', 2.5, -2.6)
      // Airside half: R&D lab benches, a test rig and the chalkboard.
      prop('counter', -1.4, 1.2, yawAir)
      prop('counter', -0.2, 1.2, yawAir)
      prop('monitor', -1.4, 1.28, yawAir)
      person('staff', -1.0, 0.7, yawAir)
      prop('xray', 1.6, 1.4, yawAir + Math.PI / 2)
      person('staff', 1.0, 1.6, yawAir - Math.PI / 2)
      prop('board', -0.6, 2.6, yawAir + Math.PI)
    } else {
      // Holdroom seating sits airside of the concourse strip.
      const rows = density >= 1 ? [-0.35, 0.55, 1.45] : [-0.2, 0.9]
      for (const v of rows) {
        for (const u of [-1.6, 0, 1.6]) {
          // Backrest on the landside so seated passengers look out at the gate.
          prop('bench', u, v, yawAir)
          for (const k of [-0.45, 0, 0.45]) {
            if (rand() < 0.38) person('seated', u + k, v + 0.03, yawAir)
          }
        }
      }
      prop('podium', 1.8, 2.3, yawAir + Math.PI)
      person('staff', 1.8, 2.65, yawAir + Math.PI)
      prop('board', -1.9, 2.3, yawAir + Math.PI)
      prop('planter', -2.5, -2.4)
      prop('bin', 2.45, -2.3)
      prop('bag', -2.15, 1.9, yawAir)
    }
  }

  const rooms = planRooms(t, zones, props, depthN === 1)
  const plan: TerminalPlan = { zones, props, people, walkers: [], rooms }

  // Crowd routes follow the passenger flow and go through doorways, never through walls.
  const perCell = opts.walkersPerCell ?? 1
  if (perCell > 0) {
    const n = Math.round(t.cluster.cells.length * perCell * 2.5)
    const byKind = (k: RoomKind) => rooms.rooms.filter((r) => r.kind === k)
    const flows = (
      [
        ['checkin', 'security'],
        ['checkin', 'checkin'],
        ['security', 'airside'],
        ['airside', 'gate'],
        ['airside', 'shops'],
        ['shops', 'gate'],
        ['gate', 'gate'],
        ['checkin', 'gate'],
      ] as [RoomKind, RoomKind][]
    ).filter(([p, q]) => byKind(p).length && byKind(q).length)
    const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length) % list.length]
    const route = (from: RoomKind, to: RoomKind, staff: boolean) => {
      for (let tries = 0; tries < 6; tries++) {
        const a = pointInRoom(rooms, pick(byKind(from)), rand)
        const b = pointInRoom(rooms, pick(byKind(to)), rand)
        const pts = navPath(rooms, a, b, { staff, strict: true })
        if (pts && Math.hypot(b.x - a.x, b.z - a.z) > 1.5) return pts
      }
      return null
    }
    for (let i = 0; i < n && flows.length; i++) {
      const [from, to] = flows[i % flows.length]
      const pts = route(from, to, false)
      if (!pts || pts.length < 2) continue
      plan.walkers.push(makeWalker(pts, 0.55 + rand() * 0.5, rand(), paxTint(), rand() < 0.7))
    }
    if (byKind('office').length && byKind('lab').length) {
      for (const [from, to] of [['office', 'lab'], ['office', 'checkin']] as [RoomKind, RoomKind][]) {
        const pts = route(from, to, true)
        if (pts && pts.length >= 2) plan.walkers.push({ ...makeWalker(pts, 0.6, rand(), 0, false), staff: true })
      }
    }
  }
  return plan
}

export function makeWalker(pts: { x: number; z: number }[], speed: number, phase: number, tint: number, bag: boolean): Walker {
  const cum = [0]
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z))
  return { pts, cum, speed, phase, tint, bag }
}

/** Ping-pong position along a walker's route at time `t` seconds. */
export function walkerAt(w: Walker, t: number): { x: number; z: number; yaw: number } {
  const len = w.cum[w.cum.length - 1] || 1
  const s = (w.phase * 2 + (t * w.speed) / len) % 2
  const d = (s < 1 ? s : 2 - s) * len
  const dir = s < 1 ? 1 : -1
  let k = 1
  while (k < w.cum.length - 1 && w.cum[k] < d) k++
  const p = w.pts[k - 1]
  const q = w.pts[k]
  const seg = w.cum[k] - w.cum[k - 1] || 1
  const f = Math.min(1, Math.max(0, (d - w.cum[k - 1]) / seg))
  return {
    x: p.x + (q.x - p.x) * f,
    z: p.z + (q.z - p.z) * f,
    yaw: Math.atan2((q.x - p.x) * dir, (q.z - p.z) * dir),
  }
}

export const DIR_NAMES: Record<Dir, string> = { n: 'north', s: 'south', e: 'east', w: 'west' }
