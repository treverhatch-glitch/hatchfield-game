/**
 * Terminal interior plan: which cells are check-in, security, shops, or gates, and
 * where every instanced prop and person goes. Pure data, deterministic per layout.
 */
import { DIR_VEC, type Dir, type TerminalInfo } from './layout'
import { rng } from './raster'
import { CELL, cellX, cellZ } from './view'

export type Zone = 'checkin' | 'security' | 'shops' | 'gate'

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
  | 'planter'
  | 'light'

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
  ax: number
  az: number
  bx: number
  bz: number
  speed: number
  phase: number
  tint: number
  /** Pulls a roller case. */
  bag: boolean
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
}

export function zoneFor(depth: number, depthN: number, along: number, alongN: number): Zone {
  if (depthN === 1) return along % 2 === 0 ? 'checkin' : 'gate'
  if (depth === 0) return 'checkin'
  if (depth === depthN - 1) return 'gate'
  const mid = Math.floor((alongN - 1) / 2)
  return along === mid ? 'security' : 'shops'
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
  const plan: TerminalPlan = { zones: [], props: [], people: [], walkers: [] }
  const paxTint = () => Math.floor(rand() * 8)

  for (const cell of t.cluster.cells) {
    const depth = proj(cell.c, cell.r) - minP
    const along = projB(cell.c, cell.r) - minB
    const zone = zoneFor(depth, depthN, along, alongN)
    plan.zones.push({ c: cell.c, r: cell.r, zone })
    const cx = cellX(cell.c)
    const cz = cellZ(cell.r)
    const at = (u: number, v: number) => ({ x: cx + u * bx + v * ax, z: cz + u * bz + v * az })
    const prop = (kind: PropKind, u: number, v: number, yaw = yawAir, tint?: number) =>
      plan.props.push({ kind, ...at(u, v), yaw, tint })
    const person = (role: PersonRole, u: number, v: number, yaw = yawAir) =>
      plan.people.push({ role, ...at(u, v), yaw, tint: role === 'staff' ? 0 : paxTint() })

    // Tucked under the roof rim so they light the hall without blocking the skylight view.
    prop('light', -1.2, -2.8, yawAir)
    prop('light', 1.2, 2.8, yawAir)

    if (zone === 'checkin') {
      const slots = density >= 1 ? [-1.95, -0.65, 0.65, 1.95] : [-0.9, 0.9]
      for (const u of slots) {
        prop('counter', u, 0.35, yawAir + Math.PI)
        prop('monitor', u, 0.28, yawAir + Math.PI)
        // Staffed desk faces the landside queue.
        person('staff', u, 0.85, yawAir + Math.PI)
        if (rand() < 0.75) person('pax', u + (rand() - 0.5) * 0.3, -0.35, yawAir)
        if (rand() < 0.45) person('pax', u + (rand() - 0.5) * 0.4, -0.95, yawAir)
      }
      prop('belt', 0, 1.3, yawAir)
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
        if (rand() < 0.6) person('seated', 1.1, v, yawAir + Math.PI / 2)
        if (rand() < 0.4) person('seated', 1.9, v, yawAir - Math.PI / 2)
      }
      prop('planter', 2.5, -2.4)
      prop('planter', -2.5, -2.4)
    } else {
      const rows = density >= 1 ? [-1.5, -0.6, 0.3] : [-1, 0.2]
      for (const v of rows) {
        for (const u of [-1.6, 0, 1.6]) {
          prop('bench', u, v, yawAir + Math.PI)
          for (const k of [-0.45, 0, 0.45]) {
            if (rand() < 0.38) person('seated', u + k, v - 0.05, yawAir)
          }
        }
      }
      prop('podium', 1.8, 1.65, yawAir + Math.PI)
      person('staff', 1.8, 2.05, yawAir + Math.PI)
      prop('board', -1.9, 1.95, yawAir + Math.PI)
      prop('planter', -2.5, -2.4)
    }
  }

  // Ambient walkers: an aisle per depth row along the facade + a cross aisle landside → airside.
  const perCell = opts.walkersPerCell ?? 1
  if (perCell > 0) {
    const cells = t.cluster.cells.length
    const n = Math.round(cells * perCell * 2.5)
    const u0 = (minB - 0.5) * CELL + 0.6
    const u1 = (maxB + 0.5) * CELL - 0.6
    const v0 = (minP - 0.5) * CELL + 0.6
    const v1 = (maxP + 0.5) * CELL - 0.6
    // A and B are orthonormal, so world = u·B + v·A (+ grid origin).
    const toWorld = (u: number, v: number) => ({
      x: u * bx + v * ax + cellX(0),
      z: u * bz + v * az + cellZ(0),
    })
    for (let i = 0; i < n; i++) {
      const cross = i % 3 === 2
      let a: { x: number; z: number }
      let b: { x: number; z: number }
      if (cross) {
        const u = u0 + rand() * (u1 - u0)
        a = toWorld(u, v0)
        b = toWorld(u, v1)
      } else {
        const row = Math.floor(rand() * depthN)
        const v = (minP + row) * CELL - CELL * 0.41 + (rand() - 0.5) * 0.4
        a = toWorld(u0, v)
        b = toWorld(u1, v)
      }
      plan.walkers.push({
        ax: a.x,
        az: a.z,
        bx: b.x,
        bz: b.z,
        speed: 0.55 + rand() * 0.5,
        phase: rand(),
        tint: paxTint(),
        bag: rand() < 0.7,
      })
    }
  }
  return plan
}

/** Ping-pong position along a walker's aisle at time `t` seconds. */
export function walkerAt(w: Walker, t: number): { x: number; z: number; yaw: number } {
  const len = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1
  const s = (w.phase * 2 + (t * w.speed) / len) % 2
  const k = s < 1 ? s : 2 - s
  const dir = s < 1 ? 1 : -1
  return {
    x: w.ax + (w.bx - w.ax) * k,
    z: w.az + (w.bz - w.az) * k,
    yaw: Math.atan2((w.bx - w.ax) * dir, (w.bz - w.az) * dir),
  }
}

export const DIR_NAMES: Record<Dir, string> = { n: 'north', s: 'south', e: 'east', w: 'west' }
