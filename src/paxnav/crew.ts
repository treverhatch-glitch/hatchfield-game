/**
 * Terminal crew walking staff routes on the passengers' nav grid: check-in
 * agents, screeners, gate agents and shop staff walk in from a staff entry
 * (the curb before security, a jet bridge door after it), step behind their
 * desk or into their lane, and at shift change a relief walks in before the
 * one on duty walks out. Cleaners loop the toilet blocks.
 *
 * Same rules as passengers: cell to cell on shared flow fields, no walls,
 * desks or roofs crossed. The one short step off the grid is from the floor
 * cell beside a desk to the desk tile's own edge cell, across an open edge.
 * Pure and deterministic; nothing here rolls dice.
 */
import { edgeBetween, edgeKey } from '../terminalbuild/grid.ts'
import { EQUIP_SPEC } from '../terminalbuild/config.ts'
import type { EquipKind } from '../terminalbuild/types.ts'
import { CREW_TUNING } from './config.ts'
import { computeField, type Field } from './field.ts'
import { apronCells, type Facility, type FacilitySet } from './facilities.ts'
import { AIR, LANE, PRE, cellAt, cellX, cellZ, cellsOfTile, tileOfCell, type NavGrid } from './grid.ts'

export type CrewRole = 'agent' | 'screener' | 'gate' | 'retail' | 'cleaner'

const ROLE_OF: Partial<Record<EquipKind, CrewRole>> = {
  checkin_desk: 'agent',
  security_lane: 'screener',
  gate_desk: 'gate',
  shop_counter: 'retail',
}

/** Crew walk either side of security; walls and lanes still decide where. */
const CREW_LAYER = PRE | AIR

export type CrewPhase =
  /** Walking from the entry to the post's floor cell. */
  | 'in'
  /** Stepping from that floor cell behind the desk. */
  | 'step'
  /** On duty. */
  | 'post'
  /** Stepping back out from behind the desk. */
  | 'unstep'
  /** Walking to the nearest entry to leave. */
  | 'out'
  /** Cleaner walking to the next toilet block. */
  | 'clean'
  /** Cleaner at a toilet block. */
  | 'dwell'

export interface CrewPost {
  id: string
  facility: string
  role: CrewRole
  /** Floor cell the crew walks to. */
  approach: number
  /** Where they stand on duty, terminal metres. */
  x: number
  z: number
  /** Faces the service cell. */
  yaw: number
  airside: boolean
}

export interface CrewPose {
  id: string
  role: CrewRole
  x: number
  z: number
  yaw: number
  phase: CrewPhase
  post: string | null
}

interface Member {
  id: string
  role: CrewRole
  cell: number
  x: number
  z: number
  yaw: number
  phase: CrewPhase
  post: string | null
  dwell: number
  loopI: number
  airside: boolean
  /** Stepping out from behind a desk to walk to the post's new spot, not to leave. */
  relocate: boolean
  dead: boolean
}

interface PostState {
  post: CrewPost
  onDuty: Member | null
  inbound: Member | null
  relieveAt: number
}

export interface CrewOptions {
  shiftSec?: number
}

const EPS = 1e-4

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Every facility's line and service cells: crew posts stay off them. */
function busyCells(set: FacilitySet): Set<number> {
  const busy = new Set<number>()
  for (const f of set.list) for (const c of f.line) busy.add(c)
  return busy
}

/** Staff posts for one piece of kit: behind a desk, or in the far corners of a lane. */
function postsFor(g: NavGrid, f: Facility, busy: Set<number>, n: number): CrewPost[] {
  const eq = g.layout.equipment.find((e) => e.id === f.id)
  const role = ROLE_OF[f.kind]
  if (!eq || !role || n <= 0) return []
  const sx = cellX(g, f.service)
  const sz = cellZ(g, f.service)
  const own = cellsOfTile(g, eq)
  const ownSet = new Set(own)
  const picks: { approach: number; stand: number; score: number }[] = []
  if (EQUIP_SPEC[eq.kind].walkThrough) {
    // Lane: stand in the lane tile, off the walk through it.
    for (const c of own) {
      if (busy.has(c) || !(g.mask[c] & CREW_LAYER)) continue
      picks.push({ approach: c, stand: c, score: -Math.hypot(cellX(g, c) - sx, cellZ(g, c) - sz) })
    }
  } else {
    // Desk: from a free floor cell next to it, one step onto the desk tile's edge.
    for (const d of own) {
      for (const s of [1, -1, g.gw, -g.gw]) {
        const a = d + s
        if (a < 0 || a >= g.mask.length || ownSet.has(a)) continue
        if (Math.abs(s) === 1 && Math.floor(a / g.gw) !== Math.floor(d / g.gw)) continue
        if (!(g.mask[a] & CREW_LAYER) || g.mask[a] & LANE || busy.has(a)) continue
        const key = edgeKey(edgeBetween(tileOfCell(g, d), tileOfCell(g, a)))
        if (g.ix.walls.has(key) || g.ix.doors.has(key)) continue
        // Behind the desk: as far from the passenger's side as the floor allows.
        picks.push({ approach: a, stand: d, score: -Math.hypot(cellX(g, d) - sx, cellZ(g, d) - sz) })
      }
    }
  }
  picks.sort((p, q) => p.score - q.score || p.stand - q.stand)
  const out: CrewPost[] = []
  const used = new Set<number>()
  for (const p of picks) {
    if (out.length >= n) break
    if (used.has(p.stand)) continue
    used.add(p.stand)
    const x = cellX(g, p.stand)
    const z = cellZ(g, p.stand)
    out.push({
      id: `${f.id}#${out.length}`,
      facility: f.id,
      role,
      approach: p.approach,
      x,
      z,
      yaw: Math.atan2(sx - x, sz - z),
      airside: f.layer === AIR,
    })
  }
  return out
}

/** Floor beside each toilet block's line head, for the cleaners' loop. */
function cleanStops(g: NavGrid, set: FacilitySet, busy: Set<number>): number[] {
  const out: number[] = []
  for (const f of set.list) {
    if (f.kind !== 'toilet') continue
    let pick = f.service
    for (const s of [1, -1, g.gw, -g.gw]) {
      const c = f.service + s
      if (c < 0 || c >= g.mask.length || busy.has(c) || !(g.mask[c] & AIR)) continue
      if (Math.abs(s) === 1 && Math.floor(c / g.gw) !== Math.floor(f.service / g.gw)) continue
      pick = c
      break
    }
    out.push(pick)
  }
  return out
}

export class CrewNav {
  private grid: NavGrid | null = null
  private fac: FacilitySet | null = null
  private fields = new Map<string, Field>()
  private posts = new Map<string, PostState>()
  private crew: Member[] = []
  private stops: number[] = []
  private cleaners = 0
  private seq = 0
  private now = 0
  private shiftSec: number
  private preEntry: number[] = []
  private airEntry: number[] = []
  /** Bumps whenever someone joins or leaves, so a renderer can re-read ids and roles. */
  rev = 0

  constructor(opts: CrewOptions = {}) {
    this.shiftSec = opts.shiftSec ?? CREW_TUNING.shiftSec
  }

  get count(): number {
    return this.crew.length
  }

  /** Posts on the current layout. */
  get postList(): CrewPost[] {
    return [...this.posts.values()].map((p) => p.post)
  }

  /**
   * Read a (new) layout. The first read starts everyone at their posts; later
   * reads keep the crew whose post is still there, walk new staff in from an
   * entry, and walk staff whose kit is gone out.
   */
  setGrid(g: NavGrid, set: FacilitySet): void {
    if (g === this.grid && set === this.fac) return
    const first = this.grid === null
    this.grid = g
    this.fac = set
    this.fields.clear()
    this.preEntry = g.spawns.slice()
    const apron = apronCells(g, '')
    this.airEntry = apron.length ? apron : this.preEntry

    const busy = busyCells(set)
    const next = new Map<string, PostState>()
    for (const f of set.list) {
      const n = CREW_TUNING.perPost[f.kind] ?? 0
      for (const post of postsFor(g, f, busy, n)) {
        const old = this.posts.get(post.id)
        next.set(post.id, {
          post,
          onDuty: old?.onDuty ?? null,
          inbound: old?.inbound ?? null,
          relieveAt: old?.relieveAt ?? this.now + this.stagger(post.id),
        })
      }
    }
    // Staff whose kit is gone walk out.
    for (const [id, st] of this.posts) {
      if (next.has(id)) continue
      for (const m of [st.onDuty, st.inbound]) if (m) this.leave(m)
    }
    this.posts = next
    // Everyone left standing must be on walkable floor (or on their own desk edge).
    for (const m of this.crew) {
      if (m.dead) continue
      const st = m.post ? this.posts.get(m.post) : undefined
      const atDesk = st && (m.phase === 'post' || m.phase === 'step' || m.phase === 'unstep')
      if (atDesk) {
        const p = st.post
        const moved = Math.hypot(m.x - p.x, m.z - p.z) > EPS || m.cell !== p.approach
        if (!moved) continue
        if (g.mask[m.cell] & CREW_LAYER) {
          // The post moved: step back out to the floor and walk to the new one.
          m.phase = 'unstep'
          m.relocate = true
          continue
        }
      }
      const c = cellAt(g, m.x, m.z)
      if (c >= 0 && g.mask[c] & CREW_LAYER) {
        m.cell = c
        continue
      }
      const near = this.nearestCell(m.x, m.z)
      if (near < 0) {
        m.dead = true
        continue
      }
      m.cell = near
      m.x = cellX(g, near)
      m.z = cellZ(g, near)
      if (m.phase === 'unstep' || m.phase === 'post' || m.phase === 'step') m.phase = m.relocate || st ? 'in' : 'out'
      m.relocate = false
    }
    for (const st of this.posts.values()) {
      if (st.onDuty?.dead) st.onDuty = null
      if (st.inbound?.dead) st.inbound = null
      if (st.onDuty || st.inbound) continue
      if (first) st.onDuty = this.spawnAtPost(st.post)
      else st.inbound = this.spawnAtEntry(st.post.role, st.post.id, st.post.airside)
    }

    // Cleaners.
    this.stops = cleanStops(g, set, busy)
    const want = this.stops.length ? Math.ceil(this.stops.length / CREW_TUNING.toiletsPerCleaner) : 0
    const cleaners = this.crew.filter((m) => m.role === 'cleaner' && !m.dead && m.phase !== 'out')
    for (let i = want; i < cleaners.length; i++) this.leave(cleaners[i])
    for (let i = cleaners.length; i < want; i++) {
      const m = this.spawnAtEntry('cleaner', null, true)
      if (!m) break
      m.phase = 'clean'
      m.loopI = Math.floor((i * this.stops.length) / want)
    }
    for (const m of cleaners.slice(0, want)) {
      m.loopI %= this.stops.length
      if (m.phase === 'dwell') m.phase = 'clean'
    }
    this.cleaners = want
    this.sweep()
  }

  private sweep() {
    if (!this.crew.some((m) => m.dead)) return
    this.crew = this.crew.filter((m) => !m.dead)
    this.rev++
  }

  private stagger(id: string): number {
    return this.shiftSec * ((hashStr(id) % 1000) / 1000) + this.shiftSec * 0.5
  }

  private nearestCell(x: number, z: number): number {
    const g = this.grid!
    let best = -1
    let bestD = Infinity
    for (let c = 0; c < g.mask.length; c++) {
      if (!(g.mask[c] & CREW_LAYER)) continue
      const d = (cellX(g, c) - x) ** 2 + (cellZ(g, c) - z) ** 2
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return best
  }

  private member(role: CrewRole, post: string | null, cell: number, airside: boolean): Member {
    const g = this.grid!
    const m: Member = {
      id: `crew:${role}:${this.seq++}`,
      role,
      cell,
      x: cellX(g, cell),
      z: cellZ(g, cell),
      yaw: 0,
      phase: 'in',
      post,
      dwell: 0,
      loopI: 0,
      airside,
      relocate: false,
      dead: false,
    }
    this.crew.push(m)
    this.rev++
    return m
  }

  private spawnAtPost(p: CrewPost): Member {
    const m = this.member(p.role, p.id, p.approach, p.airside)
    m.x = p.x
    m.z = p.z
    m.yaw = p.yaw
    m.phase = 'post'
    return m
  }

  /** A crew member steps in at a staff entry; null when the terminal has none. */
  private spawnAtEntry(role: CrewRole, post: string | null, airside: boolean): Member | null {
    const list = airside ? this.airEntry : this.preEntry
    const pool = list.length ? list : this.preEntry.length ? this.preEntry : this.airEntry
    if (!pool.length) return null
    return this.member(role, post, pool[(hashStr(`${role}:${this.seq}`) >>> 3) % pool.length], airside)
  }

  private leave(m: Member) {
    if (m.dead) return
    m.relocate = false
    if (m.phase === 'post' || m.phase === 'step') m.phase = 'unstep'
    else if (m.phase !== 'unstep') m.phase = 'out'
  }

  private field(key: string, goals: () => number[]): Field {
    let f = this.fields.get(key)
    if (!f) {
      f = computeField(this.grid!, goals(), CREW_LAYER, this.fac!.basePenalty)
      this.fields.set(key, f)
    }
    return f
  }

  private exitField(m: Member): Field {
    // Leave by the side they work on; either entry if that side has none they can reach.
    const own = this.field(m.airside ? 'x:air' : 'x:pre', () => (m.airside ? this.airEntry : this.preEntry))
    if (Number.isFinite(own.dist[m.cell])) return own
    return this.field('x:any', () => [...this.preEntry, ...this.airEntry])
  }

  /** Walk toward the goal of `F`; true on arrival, 'lost' when it cannot be reached. */
  private follow(m: Member, F: Field, dt: number): boolean | 'lost' {
    const g = this.grid!
    if (!Number.isFinite(F.dist[m.cell])) return 'lost'
    let budget = CREW_TUNING.walkMps * dt
    for (let hop = 0; hop < 12 && budget > EPS; hop++) {
      const nxt = F.next[m.cell]
      const goal = nxt < 0 ? m.cell : nxt
      const tx = cellX(g, goal)
      const tz = cellZ(g, goal)
      const seg = Math.hypot(tx - m.x, tz - m.z)
      const step = Math.min(budget, seg)
      this.moveToward(m, tx, tz, step, seg)
      budget -= step
      if (step < seg - EPS) return false
      m.x = tx
      m.z = tz
      if (nxt < 0) return true
      m.cell = nxt
    }
    return false
  }

  private moveToward(m: Member, tx: number, tz: number, step: number, seg: number) {
    if (seg <= EPS) return
    const k = step / seg
    const dx = tx - m.x
    const dz = tz - m.z
    m.x += dx * k
    m.z += dz * k
    m.yaw = Math.atan2(dx, dz)
  }

  /** Straight walk to a point (the one step behind a desk). True on arrival. */
  private slide(m: Member, tx: number, tz: number, dt: number): boolean {
    const seg = Math.hypot(tx - m.x, tz - m.z)
    const step = Math.min(CREW_TUNING.walkMps * dt, seg)
    this.moveToward(m, tx, tz, step, seg)
    if (step < seg - EPS) return false
    m.x = tx
    m.z = tz
    return true
  }

  tick(dt: number, now: number): void {
    this.now = now
    if (!(dt > 0) || !this.grid) return
    const g = this.grid
    // Shift change: a relief walks in; the one on duty leaves once they arrive.
    for (const st of this.posts.values()) {
      if (now < st.relieveAt) continue
      st.relieveAt = now + this.shiftSec
      if (!st.inbound) st.inbound = this.spawnAtEntry(st.post.role, st.post.id, st.post.airside)
    }
    for (const m of this.crew) {
      if (m.dead) continue
      const st = m.post ? this.posts.get(m.post) : undefined
      switch (m.phase) {
        case 'in': {
          if (!st) {
            m.phase = 'out'
            break
          }
          const p = st.post
          const res = this.follow(m, this.field(`p:${p.approach}`, () => [p.approach]), dt)
          if (res === 'lost') {
            // Walled off from the post: give up and go home.
            if (st.inbound === m) st.inbound = null
            m.phase = 'out'
          } else if (res) m.phase = 'step'
          break
        }
        case 'step': {
          if (!st) {
            m.phase = 'unstep'
            break
          }
          if (this.slide(m, st.post.x, st.post.z, dt)) {
            m.phase = 'post'
            m.yaw = st.post.yaw
            if (st.inbound === m) {
              if (st.onDuty && st.onDuty !== m) this.leave(st.onDuty)
              st.onDuty = m
              st.inbound = null
            }
          }
          break
        }
        case 'post':
          if (!st) this.leave(m)
          break
        case 'unstep': {
          if (this.slide(m, cellX(g, m.cell), cellZ(g, m.cell), dt)) {
            if (m.relocate && st && (st.onDuty === m || st.inbound === m)) {
              m.phase = 'in'
            } else {
              m.phase = 'out'
              if (st?.onDuty === m) st.onDuty = null
            }
            m.relocate = false
          }
          break
        }
        case 'out': {
          if (st?.onDuty === m) st.onDuty = null
          if (st?.inbound === m) st.inbound = null
          const res = this.follow(m, this.exitField(m), dt)
          if (res === true || res === 'lost') m.dead = true
          break
        }
        case 'clean': {
          if (!this.stops.length) {
            m.phase = 'out'
            break
          }
          const at = this.stops[m.loopI % this.stops.length]
          const res = this.follow(m, this.field(`c:${at}`, () => [at]), dt)
          if (res === true) {
            m.phase = 'dwell'
            m.dwell = CREW_TUNING.cleanSec
          } else if (res === 'lost') m.loopI++
          break
        }
        case 'dwell':
          m.dwell -= dt
          if (m.dwell <= 0) {
            m.loopI = (m.loopI + 1) % Math.max(1, this.stops.length)
            m.phase = 'clean'
          }
          break
      }
    }
    this.sweep()
  }

  /** Cleaners wanted on the current layout. */
  get cleanerCount(): number {
    return this.cleaners
  }

  idAt(i: number): string {
    return this.crew[i]?.id ?? ''
  }

  roleAt(i: number): CrewRole | null {
    return this.crew[i]?.role ?? null
  }

  poses(): CrewPose[] {
    return this.crew.map((m) => ({ id: m.id, role: m.role, x: m.x, z: m.z, yaw: m.yaw, phase: m.phase, post: m.post }))
  }

  /** x, y(=0), z, yaw per crew member from slot `offset` (stride 4). Returns how many were written. */
  writePoses(out: Float32Array, offset = 0): number {
    const n = Math.max(0, Math.min(this.crew.length, Math.floor(out.length / 4) - offset))
    for (let i = 0; i < n; i++) {
      const m = this.crew[i]
      const o = (offset + i) * 4
      out[o] = m.x
      out[o + 1] = 0
      out[o + 2] = m.z
      out[o + 3] = m.yaw
    }
    return n
  }
}
