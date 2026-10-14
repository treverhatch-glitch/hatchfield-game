/**
 * Departing passengers walking a built terminal: curb -> check-in / bag drop
 * -> security -> toilet / food / shop as needed -> gate seating -> boarding
 * desk -> jet bridge. Pure and deterministic; no DOM, Three, or React.
 *
 * Movement is cell to cell on the nav grid along shared flow fields, so
 * nobody walks through a wall, a desk, a belt, or over a roof, and a tick is
 * O(1) per passenger. Each desk, lane, counter and boarding desk serves one
 * person at a time; everyone else stands in its marked line at
 * `queueSpacingM`. Queues come only from the kit the player built and where
 * they put it. Change the layout with `setLayout` and every route re-plans.
 *
 * Coordinates are terminal metres: x east, z south, tile (0,0) at 0,0, and
 * passengers always stand on the floor (y = 0).
 */
import { BUILD_TUNING } from '../terminalbuild/config.ts'
import type { BuildLayout, EquipKind } from '../terminalbuild/types.ts'
import { createPaxRng, type PaxRng } from '../pax/rng.ts'
import { NEED_STOPS, PAXNAV_TUNING, STOP_KIT, type StopKind } from './config.ts'
import { computeField, type Field } from './field.ts'
import {
  apronCells,
  buildFacilities,
  facilityPenalty,
  seatCells,
  type Facility,
  type FacilitySet,
} from './facilities.ts'
import { AIR, PRE, buildNavGrid, cellAt, cellX, cellZ, gridBounds, moveOpen, type NavGrid } from './grid.ts'

export type NeedStop = (typeof NEED_STOPS)[number]

export interface SpawnSpec {
  id: string
  /** Gate room id. Unknown ids fall back to the first gate room. */
  gate: string
  /** Departure, in the same seconds as `tick`'s clock. */
  departAt: number
  /** Has a bag to drop at check-in. Rolled from `checkinShare` when unset. */
  bags?: boolean
  /** Stops wanted after security. Rolled from `needShare` when unset. */
  needs?: NeedStop[]
}

export type PaxPhase =
  /** Walking to a facility, not in its line yet. */
  | 'walk'
  /** Standing in a facility's line. */
  | 'queue'
  /** Being served at the head of the line. */
  | 'service'
  /** Walking to a seat at the gate. */
  | 'seat'
  /** Waiting at the gate for boarding. */
  | 'seated'
  /** Through the boarding desk, walking to the jet bridge. */
  | 'board'
  /** No way to the next stop the passenger cannot skip (security or gate). Retries, and re-plans on any edit. */
  | 'stuck'

export interface PaxEvent {
  kind: 'boarded' | 'missed' | 'stuck'
  id: string
  at: number
}

export interface PaxPose {
  id: string
  x: number
  /** Always 0: on the floor. */
  y: number
  z: number
  yaw: number
  phase: PaxPhase
  /** Equipment id of the facility the passenger is heading to or queued at. */
  facility: string | null
  /** Place in line (0 = being served), -1 when not in a line. */
  place: number
  /** Past security. */
  airside: boolean
}

export interface FacilityMetrics {
  id: string
  kind: EquipKind
  roomId: string | null
  /** People standing in line, not counting the one being served. */
  queueLength: number
  /** Someone is at the desk right now. */
  serving: boolean
  /** On their way and committed to this facility. */
  incoming: number
  /** Mean wait (line join to service start) of the last `waitWindow` served. */
  avgWaitSec: number
  /** How long the person at the front of the line has waited so far. */
  longestWaitSec: number
  /** What someone joining now would wait, at the current service rate. */
  estWaitSec: number
  served: number
  /** Marked line, service point first, terminal metres. */
  line: { x: number; z: number }[]
}

interface QueueState {
  kind: EquipKind
  queue: Agent[]
  incoming: number
  served: number
  waits: number[]
}

interface Agent {
  id: string
  cell: number
  x: number
  z: number
  ox: number
  oz: number
  yaw: number
  speed: number
  layer: number
  stops: StopKind[]
  gate: string
  departAt: number
  phase: PaxPhase
  fac: Facility | null
  joined: boolean
  place: number
  joinedAt: number
  serviceLeft: number
  path: number[] | null
  pathI: number
  /** Metres from the service point while standing in the marked line; -1 off it. */
  lineS: number
  seat: number
  retryAt: number
  stuckSaid: boolean
  dead: boolean
}

const EPS = 1e-4

export interface PaxNavOptions {
  seed?: number
  /** Metres per build tile. Defaults to the build tools' tile. */
  tileMetres?: number
}

export class PaxNav {
  private grid!: NavGrid
  private fac!: FacilitySet
  private fields = new Map<string, Field>()
  private states = new Map<string, QueueState>()
  private seatTaken = new Set<number>()
  private agents: Agent[] = []
  private byId = new Map<string, Agent>()
  private events: PaxEvent[] = []
  private rng: PaxRng
  private tileM: number
  private now = 0
  private gateIds: string[] = []
  /** Bumped on every `setLayout`. */
  revision = 0

  constructor(layout: BuildLayout, opts: PaxNavOptions = {}) {
    this.rng = createPaxRng(opts.seed ?? 1)
    this.tileM = opts.tileMetres ?? BUILD_TUNING.tileMetres
    this.rebuild(layout)
    this.ensureStates()
  }

  // ---------------------------------------------------------------- layout

  /** The layout changed: rebuild the grid and facilities, re-plan every passenger. */
  setLayout(layout: BuildLayout): void {
    if (layout === this.grid.layout) return
    const old = this.agents
    this.rebuild(layout)
    const g = this.grid
    // Queues carry over for kit that is still there, in the same order.
    const keep = new Map<string, QueueState>()
    for (const f of this.fac.list) {
      const st = this.states.get(f.id)
      if (st && st.kind === f.kind) {
        st.queue = st.queue.filter((a) => !a.dead)
        st.incoming = 0
        keep.set(f.id, st)
      }
    }
    this.states = keep
    this.ensureStates()
    this.seatTaken.clear()
    for (const a of old) {
      if (a.dead) continue
      a.path = null
      a.seat = -1
      a.lineS = -1
      let c = cellAt(g, a.x, a.z)
      if (c < 0 || !(g.mask[c] & a.layer)) {
        // An edit took the floor from under them: step to the nearest spot still walkable.
        c = this.nearestCell(a.x, a.z, a.layer)
        if (c < 0) {
          const st = a.fac ? this.states.get(a.fac.id) : undefined
          if (st) st.queue = st.queue.filter((o) => o !== a)
          a.fac = null
          a.joined = false
          this.stick(a)
          continue
        }
        a.x = cellX(g, c)
        a.z = cellZ(g, c)
      }
      a.cell = c
      const f = a.fac ? this.fac.byId.get(a.fac.id) : undefined
      const st = f ? this.states.get(f.id) : undefined
      if (f && st && f.layer === a.layer && Number.isFinite(this.facField(f).dist[c])) {
        a.fac = f
        if (!a.joined) st.incoming++
        else if (!st.queue.includes(a)) {
          a.joined = false
          st.incoming++
        }
        const idx = f.lineIdx.get(c)
        if (a.joined && idx !== undefined) {
          a.lineS = idx * g.cellM
          a.x = cellX(g, c)
          a.z = cellZ(g, c)
        }
      } else {
        // Their facility is gone or walled off: out of its line, pick again below.
        if (st) st.queue = st.queue.filter((o) => o !== a)
        a.fac = null
        a.joined = false
      }
    }
    for (const st of this.states.values()) st.queue.forEach((a, i) => (a.place = i))
    for (const a of old) {
      if (a.dead) continue
      a.retryAt = this.now
      if (a.phase === 'service' && a.fac && a.place === 0) continue
      if (a.phase === 'seat' || a.phase === 'seated') a.phase = 'seat'
      else if (a.phase === 'board') continue
      else if (!a.fac) this.plan(a)
      else if (!a.joined) a.phase = 'walk'
      else if (a.phase === 'service') a.phase = 'queue'
    }
  }

  private rebuild(layout: BuildLayout) {
    this.grid = buildNavGrid(layout, this.tileM)
    this.fac = buildFacilities(this.grid)
    this.fields.clear()
    this.gateIds = layout.rooms.filter((r) => r.kind === 'gate').map((r) => r.id)
    this.revision++
  }

  private ensureStates() {
    for (const f of this.fac.list) {
      if (!this.states.has(f.id)) this.states.set(f.id, { kind: f.kind, queue: [], incoming: 0, served: 0, waits: [] })
    }
  }

  /** Nearest cell on a layer by straight-line distance (used only when an edit removes the floor underfoot). */
  private nearestCell(x: number, z: number, layer: number): number {
    const g = this.grid
    let best = -1
    let bestD = Infinity
    for (let c = 0; c < g.mask.length; c++) {
      if (!(g.mask[c] & layer)) continue
      const d = (cellX(g, c) - x) ** 2 + (cellZ(g, c) - z) ** 2
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return best
  }

  // ---------------------------------------------------------------- fields

  private field(key: string, make: () => Field): Field {
    let f = this.fields.get(key)
    if (!f) {
      f = make()
      this.fields.set(key, f)
    }
    return f
  }

  private facField(f: Facility): Field {
    return this.field(`f:${f.id}`, () => {
      const pen = facilityPenalty(this.grid, this.fac, f)
      const field = computeField(this.grid, [f.service], f.layer, pen)
      // Down the line, cell by cell, whatever the costs say.
      for (let i = 1; i < f.line.length; i++) field.next[f.line[i]] = f.line[i - 1]
      return field
    })
  }

  private seatField(room: string): Field {
    return this.field(`s:${room}`, () =>
      computeField(this.grid, seatCells(this.grid, this.fac, room), AIR, this.fac.basePenalty),
    )
  }

  private apronField(room: string): Field {
    return this.field(`a:${room}`, () => computeField(this.grid, apronCells(this.grid, room), AIR, this.fac.basePenalty))
  }

  // ---------------------------------------------------------------- spawn

  /**
   * A passenger steps out of a car or bus on the road edge of a curb door's
   * pavement. Returns false (and adds nobody) when the terminal has no curb door.
   */
  spawn(spec: SpawnSpec): boolean {
    const g = this.grid
    if (!g.spawns.length || this.byId.has(spec.id)) return false
    const r = this.rng
    const cell = g.spawns[Math.floor(r.next() * g.spawns.length) % g.spawns.length]
    const lat = Math.min(PAXNAV_TUNING.lateralM, g.cellM * 0.45)
    const ox = (r.next() * 2 - 1) * lat
    const oz = (r.next() * 2 - 1) * lat
    const bags = spec.bags ?? r.next() < PAXNAV_TUNING.checkinShare
    const needs = spec.needs ?? NEED_STOPS.filter((n) => r.next() < PAXNAV_TUNING.needShare[n])
    const speed = PAXNAV_TUNING.walkMps * (1 + (r.next() * 2 - 1) * PAXNAV_TUNING.walkSpread)
    const stops: StopKind[] = [...(bags ? (['checkin'] as const) : []), 'security', ...needs, 'gate']
    const gate = this.gateIds.includes(spec.gate) ? spec.gate : (this.gateIds[0] ?? spec.gate)
    const a: Agent = {
      id: spec.id,
      cell,
      x: cellX(g, cell) + ox,
      z: cellZ(g, cell) + oz,
      ox,
      oz,
      yaw: 0,
      speed,
      layer: PRE,
      stops,
      gate,
      departAt: spec.departAt,
      phase: 'walk',
      fac: null,
      joined: false,
      place: -1,
      joinedAt: 0,
      serviceLeft: 0,
      path: null,
      pathI: 0,
      lineS: -1,
      seat: -1,
      retryAt: 0,
      stuckSaid: false,
      dead: false,
    }
    this.agents.push(a)
    this.byId.set(a.id, a)
    this.plan(a)
    return true
  }

  // ---------------------------------------------------------------- planning

  private boardOpen(a: Agent) {
    return a.departAt - PAXNAV_TUNING.boardLeadSec
  }

  private state(f: Facility): QueueState {
    return this.states.get(f.id)!
  }

  /** Pick the facility that gets this passenger served soonest: walk time plus the line ahead. */
  private choose(a: Agent, kit: EquipKind, room: string | null): Facility | null {
    let best: Facility | null = null
    let bestT = Infinity
    for (const f of this.fac.list) {
      if (f.kind !== kit || f.layer !== a.layer || (room && f.roomId !== room)) continue
      const d = this.facField(f).dist[a.cell]
      if (!Number.isFinite(d)) continue
      const st = this.state(f)
      const t = (d * this.grid.cellM) / a.speed + (st.queue.length + st.incoming) * f.serviceSec
      if (t < bestT) {
        bestT = t
        best = f
      }
    }
    return best
  }

  /** Work out where to go next from the head of `stops`. */
  private plan(a: Agent): void {
    a.fac = null
    a.joined = false
    a.place = -1
    a.lineS = -1
    a.path = null
    while (a.stops.length) {
      const s = a.stops[0]
      const open = this.boardOpen(a)
      if ((NEED_STOPS as readonly string[]).includes(s) && this.now + PAXNAV_TUNING.needSlackSec > open) {
        a.stops.shift()
        continue
      }
      if (s === 'gate' && this.now < open) {
        // Early: wait at the gate seats until boarding opens.
        a.seat = -1
        if (Number.isFinite(this.seatField(a.gate).dist[a.cell])) {
          a.phase = 'seat'
          return
        }
        this.stick(a)
        return
      }
      const f = this.choose(a, STOP_KIT[s], s === 'gate' ? a.gate : null)
      if (f) {
        a.fac = f
        this.state(f).incoming++
        a.phase = 'walk'
        return
      }
      // Check-in and the optional stops can be skipped; security and the gate cannot.
      if (s !== 'security' && s !== 'gate') {
        a.stops.shift()
        continue
      }
      this.stick(a)
      return
    }
  }

  private stick(a: Agent) {
    a.phase = 'stuck'
    a.retryAt = this.now + PAXNAV_TUNING.retrySec
    if (!a.stuckSaid) {
      a.stuckSaid = true
      this.events.push({ kind: 'stuck', id: a.id, at: this.now })
    }
  }

  private leaveFacility(a: Agent) {
    const f = a.fac
    if (!f) return
    const st = this.state(f)
    if (a.joined) {
      const i = st.queue.indexOf(a)
      if (i >= 0) {
        st.queue.splice(i, 1)
        for (let j = i; j < st.queue.length; j++) st.queue[j].place = j
      }
    } else st.incoming = Math.max(0, st.incoming - 1)
    a.fac = null
    a.joined = false
    a.place = -1
    a.lineS = -1
  }

  private remove(a: Agent, kind: PaxEvent['kind'] | null) {
    this.leaveFacility(a)
    if (a.seat >= 0) this.seatTaken.delete(a.seat)
    a.dead = true
    this.byId.delete(a.id)
    if (kind) this.events.push({ kind, id: a.id, at: this.now })
  }

  // ---------------------------------------------------------------- tick

  /** Advance everyone by `dt` seconds; `now` is the clock departures are measured on. */
  tick(dt: number, now: number): void {
    this.now = now
    if (!(dt > 0)) return
    const close = PAXNAV_TUNING.gateCloseSec
    for (const a of this.agents) {
      if (a.dead) continue
      if (a.phase !== 'board' && now >= a.departAt - close) {
        this.remove(a, 'missed')
        continue
      }
      switch (a.phase) {
        case 'walk':
        case 'queue':
          this.stepFacility(a, dt)
          break
        case 'service':
          a.serviceLeft -= dt
          if (a.serviceLeft <= 0) this.finishService(a)
          break
        case 'seat':
          this.stepSeat(a, dt)
          break
        case 'seated':
          if (now >= this.boardOpen(a)) {
            if (a.seat >= 0) this.seatTaken.delete(a.seat)
            a.seat = -1
            this.plan(a)
          }
          break
        case 'board':
          this.stepBoard(a, dt)
          break
        case 'stuck':
          if (now >= a.retryAt) {
            a.phase = 'walk'
            this.plan(a)
          }
          break
      }
    }
    if (this.agents.some((a) => a.dead)) this.agents = this.agents.filter((a) => !a.dead)
  }

  /** Queue distance (metres to the service point) of a cell for facility f. */
  private queueDist(f: Facility, F: Field, c: number): number {
    const i = f.lineIdx.get(c)
    if (i !== undefined) return i * this.grid.cellM
    const tail = f.line[f.line.length - 1]
    return f.line.length * this.grid.cellM + Math.max(0, F.dist[c] - F.dist[tail]) * this.grid.cellM
  }

  private stepFacility(a: Agent, dt: number) {
    const f = a.fac
    if (!f) {
      this.plan(a)
      return
    }
    const g = this.grid
    const F = this.facField(f)
    const st = this.state(f)
    const spacing = PAXNAV_TUNING.queueSpacingM
    let budget = a.speed * dt
    if (a.lineS >= 0) {
      this.stepLine(a, f, budget)
      return
    }
    for (let hop = 0; hop < PAXNAV_TUNING.maxHopsPerTick && budget > EPS; hop++) {
      if (a.joined) {
        const idx = f.lineIdx.get(a.cell)
        if (idx !== undefined && Math.hypot(cellX(g, a.cell) - a.x, cellZ(g, a.cell) - a.z) < 1e-3) {
          a.lineS = idx * g.cellM
          this.stepLine(a, f, budget)
          return
        }
      }
      const nxt = F.next[a.cell]
      if (nxt < 0 && a.cell !== f.service) {
        // The way there is gone (an edit). Pick again.
        this.leaveFacility(a)
        this.plan(a)
        return
      }
      const goal = nxt < 0 ? a.cell : nxt
      const lined = f.lineIdx.has(goal) || a.joined
      const tx = cellX(g, goal) + (lined ? 0 : a.ox)
      const tz = cellZ(g, goal) + (lined ? 0 : a.oz)
      const seg = Math.hypot(tx - a.x, tz - a.z)
      const gi = f.lineIdx.get(goal)
      if (a.joined && gi !== undefined && f.lineIdx.has(a.cell)) {
        // Already walking down the line: from here on, keep to our place on it.
        a.lineS = gi * g.cellM + seg
        this.stepLine(a, f, budget)
        return
      }
      const remaining = this.queueDist(f, F, goal) + seg
      if (!a.joined && (nxt < 0 || remaining <= st.queue.length * spacing + spacing * 0.5)) {
        st.incoming = Math.max(0, st.incoming - 1)
        st.queue.push(a)
        a.place = st.queue.length - 1
        a.joined = true
        a.joinedAt = this.now
        a.phase = 'queue'
        continue
      }
      // Nobody walks past the back of the line, joined or not.
      const hold = (a.joined ? a.place : st.queue.length) * spacing
      const room = remaining - hold
      if (room <= EPS) break
      const step = Math.min(budget, room, seg)
      this.moveToward(a, tx, tz, step, seg)
      budget -= step
      if (step < seg - EPS) break
      a.x = tx
      a.z = tz
      if (nxt >= 0) a.cell = nxt
      const idx = f.lineIdx.get(a.cell)
      if (a.joined && idx !== undefined) {
        // In the line now: shuffle along it to our own place.
        a.lineS = idx * g.cellM
        this.stepLine(a, f, budget)
        return
      }
      if (nxt < 0) break
    }
  }

  /** Slide along the marked line (forward or back) to this passenger's place; serve at the front. */
  private stepLine(a: Agent, f: Facility, budget: number) {
    const g = this.grid
    const st = this.state(f)
    const end = (f.line.length - 1) * g.cellM
    const want = Math.min(a.place * PAXNAV_TUNING.queueSpacingM, end)
    const d = want - a.lineS
    a.lineS += Math.sign(d) * Math.min(Math.abs(d), budget)
    const i = Math.min(f.line.length - 1, Math.floor(a.lineS / g.cellM))
    const t = a.lineS / g.cellM - i
    const c0 = f.line[i]
    const c1 = f.line[Math.min(f.line.length - 1, i + 1)]
    a.x = cellX(g, c0) + (cellX(g, c1) - cellX(g, c0)) * t
    a.z = cellZ(g, c0) + (cellZ(g, c1) - cellZ(g, c0)) * t
    a.cell = f.line[Math.min(f.line.length - 1, Math.round(a.lineS / g.cellM))]
    // Face the desk.
    const ahead = f.line[Math.max(0, i - (t > EPS ? 0 : 1))]
    if (ahead !== c0 || t > EPS) a.yaw = Math.atan2(cellX(g, ahead) - a.x, cellZ(g, ahead) - a.z)
    if (a.place === 0 && a.lineS <= EPS) {
      a.phase = 'service'
      a.serviceLeft = f.serviceSec
      st.waits.push(this.now - a.joinedAt)
      if (st.waits.length > PAXNAV_TUNING.waitWindow) st.waits.shift()
    }
  }

  private moveToward(a: Agent, tx: number, tz: number, step: number, seg: number) {
    if (seg <= EPS) return
    const k = step / seg
    const dx = tx - a.x
    const dz = tz - a.z
    a.x += dx * k
    a.z += dz * k
    a.yaw = Math.atan2(dx, dz)
  }

  private finishService(a: Agent) {
    const f = a.fac!
    const st = this.state(f)
    st.queue.shift()
    for (let i = 0; i < st.queue.length; i++) st.queue[i].place = i
    st.served++
    a.fac = null
    a.joined = false
    a.place = -1
    a.lineS = -1
    a.stops.shift()
    if (f.kind === 'security_lane') a.layer = AIR
    if (f.kind === 'gate_desk') {
      a.phase = 'board'
      return
    }
    this.plan(a)
  }

  /** Follow a field (or an explicit cell path) toward its goal. Returns true on arrival. */
  private follow(a: Agent, F: Field | null, dt: number): boolean | 'lost' {
    const g = this.grid
    let budget = a.speed * dt
    for (let hop = 0; hop < PAXNAV_TUNING.maxHopsPerTick && budget > EPS; hop++) {
      let nxt: number
      if (a.path) {
        nxt = a.pathI < a.path.length ? a.path[a.pathI] : -1
      } else {
        if (!F || !Number.isFinite(F.dist[a.cell])) return 'lost'
        nxt = F.next[a.cell]
      }
      const goal = nxt < 0 ? a.cell : nxt
      const tx = cellX(g, goal) + a.ox
      const tz = cellZ(g, goal) + a.oz
      const seg = Math.hypot(tx - a.x, tz - a.z)
      const step = Math.min(budget, seg)
      this.moveToward(a, tx, tz, step, seg)
      budget -= step
      if (step < seg - EPS) return false
      a.x = tx
      a.z = tz
      if (nxt < 0) return true
      a.cell = nxt
      if (a.path) a.pathI++
    }
    return false
  }

  private stepSeat(a: Agent, dt: number) {
    if (this.now >= this.boardOpen(a)) {
      this.plan(a)
      return
    }
    const F = this.seatField(a.gate)
    const res = this.follow(a, a.path ? null : F, dt)
    if (res === 'lost') {
      this.plan(a)
      if (a.phase === 'seat') this.stick(a)
      return
    }
    if (!res) return
    if (a.path) {
      a.path = null
      a.phase = 'seated'
      return
    }
    // At the seats. Take this spot if it is free, else the nearest free one.
    if (!this.seatTaken.has(a.cell)) {
      a.seat = a.cell
      this.seatTaken.add(a.cell)
      a.phase = 'seated'
      return
    }
    const path = this.pathToFreeSeat(a, F)
    if (path) {
      a.seat = path[path.length - 1]
      this.seatTaken.add(a.seat)
      a.path = path
      a.pathI = 0
    } else a.phase = 'seated' // Every seat taken: stand here.
  }

  /** Breadth-first over the gate floor to the closest free seat cell. */
  private pathToFreeSeat(a: Agent, F: Field): number[] | null {
    const g = this.grid
    const parent = new Map<number, number>([[a.cell, -1]])
    const q = [a.cell]
    for (let i = 0; i < q.length && i < 4096; i++) {
      const u = q[i]
      if (F.dist[u] === 0 && !this.seatTaken.has(u)) {
        const path: number[] = []
        for (let c = u; c !== a.cell; c = parent.get(c)!) path.push(c)
        return path.reverse()
      }
      for (const s of [1, -1, g.gw, -g.gw]) {
        const v = u + s
        if (v < 0 || v >= g.mask.length || parent.has(v)) continue
        if (Math.abs(s) === 1 && Math.floor(v / g.gw) !== Math.floor(u / g.gw)) continue
        if (!moveOpen(g, u, v, AIR)) continue
        parent.set(v, u)
        q.push(v)
      }
    }
    return null
  }

  private stepBoard(a: Agent, dt: number) {
    const res = this.follow(a, this.apronField(a.gate), dt)
    // No jet bridge door: they board from the desk.
    if (res === true || res === 'lost') this.remove(a, 'boarded')
  }

  // ---------------------------------------------------------------- read-outs

  /** Events since the last drain (boarded, missed, stuck). */
  drainEvents(): PaxEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  get count(): number {
    return this.agents.length
  }

  get layout(): BuildLayout {
    return this.grid.layout
  }

  /** The nav grid, for debug overlays and tests. */
  get nav(): NavGrid {
    return this.grid
  }

  /** Walkable area plus the curb margin, terminal metres. Nobody is ever outside it. */
  bounds() {
    return gridBounds(this.grid)
  }

  /** Cell a passenger last stood fully on (debug / tests). */
  cellOf(id: string): number {
    return this.byId.get(id)?.cell ?? -1
  }

  poses(): PaxPose[] {
    return this.agents.map((a) => ({
      id: a.id,
      x: a.x,
      y: 0,
      z: a.z,
      yaw: a.yaw,
      phase: a.phase,
      facility: a.fac?.id ?? null,
      place: a.joined ? a.place : -1,
      airside: a.layer === AIR,
    }))
  }

  /**
   * Packs x, y, z, yaw per passenger into `out` (stride 4) for instanced
   * drawing without allocating. Returns how many were written.
   */
  writePoses(out: Float32Array): number {
    const n = Math.min(this.agents.length, Math.floor(out.length / 4))
    for (let i = 0; i < n; i++) {
      const a = this.agents[i]
      out[i * 4] = a.x
      out[i * 4 + 1] = 0
      out[i * 4 + 2] = a.z
      out[i * 4 + 3] = a.yaw
    }
    return n
  }

  metrics(): FacilityMetrics[] {
    const g = this.grid
    return this.fac.list.map((f) => {
      const st = this.state(f)
      const serving = st.queue[0]?.phase === 'service'
      const waiting = st.queue.length - (serving ? 1 : 0)
      const front = st.queue[serving ? 1 : 0]
      const left = serving ? Math.max(0, st.queue[0].serviceLeft) : 0
      return {
        id: f.id,
        kind: f.kind,
        roomId: f.roomId,
        queueLength: waiting,
        serving,
        incoming: st.incoming,
        avgWaitSec: st.waits.length ? st.waits.reduce((s, w) => s + w, 0) / st.waits.length : 0,
        longestWaitSec: front?.joined ? this.now - front.joinedAt : 0,
        estWaitSec: left + waiting * f.serviceSec,
        served: st.served,
        line: f.line.map((c) => ({ x: cellX(g, c), z: cellZ(g, c) })),
      }
    })
  }

  metricsFor(id: string): FacilityMetrics | undefined {
    return this.metrics().find((m) => m.id === id)
  }
}
