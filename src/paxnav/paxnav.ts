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
 *
 * With `guests: true` every passenger is also a guest (src/paxnav/guests.ts):
 * seeded traits set their pace, patience and taste; needs rise and pick the
 * optional stops; first-timers get lost where signage is thin; thoughts move
 * satisfaction; families walk as one group; long lines make people leave or
 * complain; and a missed flight sends them to a rebooking desk. All of that
 * runs on each guest's staggered think step, not per frame.
 */
import { SERVICE_POINT_TUNING } from '../servicepoints/config.ts'
import { BUILD_TUNING } from '../terminalbuild/config.ts'
import type { BuildLayout, EquipKind } from '../terminalbuild/types.ts'
import { createPaxRng, type PaxRng } from '../pax/rng.ts'
import { NEED_STOPS, PAXNAV_TUNING, REBOOK_KIT, STOP_KIT, type StopKind } from './config.ts'
import {
  GUEST_TUNING,
  NEED_KEYS,
  type AmenityStop,
  type DecayNeed,
  type GuestFlag,
  type GuestPurpose,
  type GuestTrait,
  type NeedKey,
  type ThoughtKey,
} from './guestConfig.ts'
import {
  NEED_INDEX,
  NO_SIGNAGE,
  amenityScore,
  anxietyFrom,
  buildSignField,
  decayNeeds,
  hashId,
  need,
  patienceNow,
  relieve,
  rnd,
  rollMind,
  think,
  type Activity,
  type GuestThought,
  type Mind,
  type SignField,
  type Signage,
} from './guests.ts'
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
  /**
   * Stops wanted after security. Rolled from `needShare` when unset; with
   * guests on, unset means their needs pick stops as they go.
   */
  needs?: NeedStop[]
  /** Guests: why they fly. Rolled from the id when unset. */
  purpose?: GuestPurpose
  /** Guests: traits they have for sure (more may be rolled). */
  flags?: GuestFlag[]
  /** Guests: walk with this passenger's group (family, party). Ignored when the leader is gone, full, or a follower. */
  groupOf?: string
  /** Guests: starting need levels (0–1) instead of the rolled ones. */
  startNeeds?: Partial<Record<DecayNeed, number>>
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
  /** Guests: lost, wandering a few cells before getting their bearings. */
  | 'lost'
  /** Guests: walking with their group's leader. */
  | 'follow'

export interface PaxEvent {
  /** `rebooked`: a guest who missed their flight finished at the rebooking desk and left. */
  kind: 'boarded' | 'missed' | 'stuck' | 'rebooked'
  id: string
  at: number
}

/** Everything the guest card shows about one passenger. */
export interface GuestCard {
  id: string
  purpose: GuestPurpose
  traits: GuestTrait[]
  /** 0 (fine) to 1 (urgent). */
  needs: Record<NeedKey, number>
  /** 0–100. */
  satisfaction: number
  spent: number
  /** Oldest first. */
  thoughts: GuestThought[]
  phase: PaxPhase
  /** Next stop they are making. */
  stop: StopKind | null
  facility: string | null
  airside: boolean
  lost: boolean
  rebooking: boolean
  /** Seconds in their current line, 0 when not in one. */
  waitedSec: number
  /** Group leader's id (themselves when leading), null when alone. */
  leader: string | null
  group: string[]
  lostTimes: number
  complaints: number
  /** Walking pace on open floor, m/s (a group walks at its slowest member's). */
  speedMps: number
}

/** Guest feedback since the last drain, for satisfaction and reputation. */
export interface GuestFeedback {
  /** Sum of satisfaction changes from thoughts. */
  satDelta: number
  missed: number
  rebooked: number
  complaints: number
  leftQueue: number
  lost: number
  outOfStock: number
  /** Cash spent at counters. */
  spent: number
}

const noFeedback = (): GuestFeedback => ({
  satDelta: 0,
  missed: 0,
  rebooked: 0,
  complaints: 0,
  leftQueue: 0,
  lost: 0,
  outOfStock: 0,
  spent: 0,
})

/** `writeFlags` bits per walker. */
export const WALKER_LOST = 1
export const WALKER_REBOOK = 2
export const WALKER_UNHAPPY = 4

/** One finished wait in a line: from joining it to stepping up to the desk. */
export interface PaxWait {
  id: string
  facility: string
  kind: EquipKind
  waitSec: number
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
  /** Guests: lost (or walking with a lost leader). Shows a thought bubble. */
  lost: boolean
  /** Guests: missed their flight, on the way to (or at) a rebooking desk. */
  rebooking: boolean
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
  /** A clerk or officer is working this point. */
  staffed: boolean
  /** Staffed, and someone is in line or at the desk. */
  inUse: boolean
  /** Seconds to serve one passenger at this point, on the walk's clock. */
  serviceSec: number
  served: number
  /** Guests who gave up on this line. */
  leftQueue: number
  /** Shop counters with guests on: units on the shelf. Null for other kit. */
  stock: number | null
  /** Marked line, service point first, terminal metres. */
  line: { x: number; z: number }[]
}

interface QueueState {
  kind: EquipKind
  queue: Agent[]
  incoming: number
  served: number
  waits: number[]
  left: number
  stock: number
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
  /** Guest mind; null with guests off, and on followers (they share the leader's). */
  m: Mind | null
  /** Optional stops were given at spawn: needs do not add more. */
  fixedNeeds: boolean
  /** Missed the flight; heading for a rebooking desk. */
  rebook: boolean
  /** Out-of-stock visit at the current counter. */
  oos: boolean
  /** Wait at the line just served, seconds. */
  lastWait: number
  /** Group: the leader this follower walks behind. */
  lead: Agent | null
  /** Group: followers (leader only). */
  group: Agent[] | null
  /** Group leader's recent path: x, z, cell, layer per point (ring). */
  trail: Float32Array | null
  trailHead: number
  trailN: number
}

const EPS = 1e-4
const TRAIL_STRIDE = 4

export interface PaxNavOptions {
  seed?: number
  /** Metres per build tile. Defaults to the build tools' tile. */
  tileMetres?: number
  /** Passengers are guests with traits, needs, thoughts and groups. Off: plain walkers. */
  guests?: boolean
  /** Wayfinding signs and departure boards (guests only). */
  signage?: Signage
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
  private waitLog: PaxWait[] = []
  private rng: PaxRng
  private tileM: number
  private now = 0
  private gateIds: string[] = []
  private seed: number
  /** Guests on: traits, needs, thoughts, groups. */
  readonly guests: boolean
  private signage: Signage
  private signs!: SignField
  /** Bodies per nav cell, recounted each tick (guests only). */
  private dens = new Uint16Array(0)
  private fb = noFeedback()
  /** Bumped on every `setLayout`. */
  revision = 0

  constructor(layout: BuildLayout, opts: PaxNavOptions = {}) {
    this.seed = opts.seed ?? 1
    this.rng = createPaxRng(this.seed)
    this.tileM = opts.tileMetres ?? BUILD_TUNING.tileMetres
    this.guests = opts.guests === true
    this.signage = opts.signage ?? NO_SIGNAGE
    this.rebuild(layout)
    this.ensureStates()
  }

  /** Wayfinding signs and departure boards changed. Cheap enough to call on any edit. */
  setSignage(s: Signage): void {
    this.signage = s
    this.signs = buildSignField(this.grid, s)
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
      if (a.dead || a.lead) continue
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
      if (a.dead || a.lead) continue
      // The old trail may run through new walls: the group closes up on the leader.
      if (a.group) {
        this.resetTrail(a)
        for (const f of a.group) this.snapFollower(f, a)
      }
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
    this.signs = buildSignField(this.grid, this.signage)
    this.dens = new Uint16Array(this.grid.gw * this.grid.gh)
    this.revision++
  }

  private ensureStates() {
    for (const f of this.fac.list) {
      if (!this.states.has(f.id)) {
        this.states.set(f.id, {
          kind: f.kind,
          queue: [],
          incoming: 0,
          served: 0,
          waits: [],
          left: 0,
          stock: GUEST_TUNING.stockCap,
        })
      }
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
    const lead = this.guests && spec.groupOf ? this.byId.get(spec.groupOf) : undefined
    if (lead && !lead.lead && !lead.rebook && (lead.group?.length ?? 0) + 1 < GUEST_TUNING.groupMax) {
      this.spawnFollower(spec, lead)
      return true
    }
    const r = this.rng
    const cell = g.spawns[Math.floor(r.next() * g.spawns.length) % g.spawns.length]
    const lat = Math.min(PAXNAV_TUNING.lateralM, g.cellM * 0.45)
    const ox = (r.next() * 2 - 1) * lat
    const oz = (r.next() * 2 - 1) * lat
    const bags = spec.bags ?? r.next() < PAXNAV_TUNING.checkinShare
    // Guests pick their optional stops from their needs on the way, unless told.
    const needs = spec.needs ?? (this.guests ? [] : NEED_STOPS.filter((n) => r.next() < PAXNAV_TUNING.needShare[n]))
    let speed = PAXNAV_TUNING.walkMps * (1 + (r.next() * 2 - 1) * PAXNAV_TUNING.walkSpread)
    const m = this.guests ? rollMind(spec.id, this.seed, this.now, { purpose: spec.purpose, flags: spec.flags }) : null
    if (m) {
      speed *= m.fx.speed
      for (const [k, v] of Object.entries(spec.startNeeds ?? {}) as [DecayNeed, number][]) {
        if (Number.isFinite(v)) m.needs[NEED_INDEX[k]] = Math.max(0, Math.min(1, v))
      }
    }
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
      m,
      fixedNeeds: spec.needs !== undefined,
      rebook: false,
      oos: false,
      lastWait: 0,
      lead: null,
      group: null,
      trail: null,
      trailHead: 0,
      trailN: 0,
    }
    this.agents.push(a)
    this.byId.set(a.id, a)
    this.plan(a)
    return true
  }

  /** A group member: walks behind the leader on the leader's own path, at the slowest member's pace. */
  private spawnFollower(spec: SpawnSpec, lead: Agent) {
    const m = rollMind(spec.id, this.seed, this.now, { purpose: spec.purpose ?? lead.m?.purpose, flags: spec.flags })
    const speed = PAXNAV_TUNING.walkMps * m.fx.speed
    const lat = Math.min(PAXNAV_TUNING.lateralM, this.grid.cellM * 0.45)
    const st = { rs: hashId(spec.id) }
    const f: Agent = {
      ...lead,
      id: spec.id,
      ox: (rnd(st) * 2 - 1) * lat,
      oz: (rnd(st) * 2 - 1) * lat,
      speed,
      stops: [],
      phase: 'follow',
      fac: null,
      joined: false,
      place: -1,
      path: null,
      lineS: -1,
      seat: -1,
      // Their own traits for the card; needs and thoughts are the leader's.
      m,
      lead,
      group: null,
      trail: null,
      trailN: 0,
    }
    if (!lead.group) {
      lead.group = []
      lead.trail = new Float32Array(GUEST_TUNING.trailLen * TRAIL_STRIDE)
      this.resetTrail(lead)
    }
    lead.group.push(f)
    // The group walks at its slowest member's pace.
    lead.speed = Math.min(lead.speed, speed)
    this.snapFollower(f, lead)
    this.agents.push(f)
    this.byId.set(f.id, f)
  }

  // ---------------------------------------------------------------- groups

  private resetTrail(a: Agent) {
    if (!a.trail) return
    a.trailHead = 0
    a.trailN = 0
    this.pushTrail(a)
  }

  private pushTrail(a: Agent) {
    const t = a.trail!
    const L = GUEST_TUNING.trailLen
    a.trailHead = (a.trailHead + 1) % L
    const o = a.trailHead * TRAIL_STRIDE
    const c = cellAt(this.grid, a.x, a.z)
    t[o] = a.x
    t[o + 1] = a.z
    // The cell the point is on (mid-step that can be the next cell, not `a.cell`).
    t[o + 2] = c >= 0 ? c : a.cell
    t[o + 3] = a.layer
    a.trailN = Math.min(L, a.trailN + 1)
  }

  /** Leader: drop a trail point after moving a little or onto a new cell. */
  private recordTrail(a: Agent) {
    const t = a.trail!
    const o = a.trailHead * TRAIL_STRIDE
    const c = cellAt(this.grid, a.x, a.z)
    if (t[o + 2] !== c || t[o + 3] !== a.layer || Math.hypot(t[o] - a.x, t[o + 1] - a.z) >= GUEST_TUNING.trailStepM) {
      this.pushTrail(a)
    }
  }

  /** Stand the follower on the leader's trail, `gap` metres per place behind. */
  private snapFollower(f: Agent, lead: Agent) {
    const t = lead.trail!
    const L = GUEST_TUNING.trailLen
    const want = (lead.group!.indexOf(f) + 1) * GUEST_TUNING.groupGapM
    let px = lead.x
    let pz = lead.z
    let acc = 0
    let o = lead.trailHead * TRAIL_STRIDE
    for (let j = 0; j < lead.trailN; j++) {
      o = ((lead.trailHead - j + L) % L) * TRAIL_STRIDE
      acc += Math.hypot(t[o] - px, t[o + 1] - pz)
      px = t[o]
      pz = t[o + 1]
      if (acc >= want) break
    }
    const cell = t[o + 2]
    const g = this.grid
    // Own sideways offset when it keeps them on the same cell; otherwise right on the path.
    let x = t[o] + f.ox * 0.5
    let z = t[o + 1] + f.oz * 0.5
    if (cellAt(g, x, z) !== cell) {
      x = t[o]
      z = t[o + 1]
    }
    const dx = x - f.x
    const dz = z - f.z
    if (dx * dx + dz * dz > 1e-6) f.yaw = Math.atan2(dx, dz)
    f.x = x
    f.z = z
    f.cell = cell
    f.layer = t[o + 3]
    f.rebook = lead.rebook
  }

  // ---------------------------------------------------------------- planning

  private boardOpen(a: Agent) {
    return a.departAt - PAXNAV_TUNING.boardLeadSec
  }

  private state(f: Facility): QueueState {
    return this.states.get(f.id)!
  }

  /**
   * Pick the facility that gets this passenger served soonest: walk time plus
   * the line ahead. A closed point is used only when every point of this kind
   * is closed, so the queue still forms where the player can see it.
   */
  private choose(a: Agent, kit: EquipKind, room: string | null, skip: Facility | null = null): Facility | null {
    let best: Facility | null = null
    let bestT = Infinity
    let closed: Facility | null = null
    let closedT = Infinity
    for (const f of this.fac.list) {
      if (f === skip || f.kind !== kit || f.layer !== a.layer || (room && f.roomId !== room)) continue
      const d = this.facField(f).dist[a.cell]
      if (!Number.isFinite(d)) continue
      const st = this.state(f)
      const t = (d * this.grid.cellM) / a.speed + (st.queue.length + st.incoming) * f.serviceSec
      if (!f.staffed) {
        if (t < closedT) {
          closedT = t
          closed = f
        }
        continue
      }
      if (t < bestT) {
        bestT = t
        best = f
      }
    }
    if (!best && closed) {
      best = closed
      bestT = closedT
    }
    this.chosenT = bestT
    return best
  }

  /** Expected seconds to be served at the last facility `choose` returned. */
  private chosenT = Infinity

  private chooseFor(a: Agent, s: StopKind): Facility | null {
    if (s === 'rebook') return this.choose(a, a.layer === AIR ? REBOOK_KIT.air : REBOOK_KIT.pre, null)
    return this.choose(a, STOP_KIT[s], s === 'gate' ? a.gate : null)
  }

  /** Work out where to go next from the head of `stops`. */
  private plan(a: Agent): void {
    a.fac = null
    a.joined = false
    a.place = -1
    a.lineS = -1
    a.path = null
    let picked = false
    while (a.stops.length) {
      const s = a.stops[0]
      const open = this.boardOpen(a)
      if ((NEED_STOPS as readonly string[]).includes(s) && this.now + PAXNAV_TUNING.needSlackSec > open) {
        a.stops.shift()
        continue
      }
      if (s === 'gate' && a.m && !a.fixedNeeds && !picked && this.now < open && this.pickAmenity(a)) {
        picked = true
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
      const f = this.chooseFor(a, s)
      if (f) {
        a.fac = f
        this.state(f).incoming++
        a.phase = 'walk'
        return
      }
      if (s === 'rebook') {
        // No desk on their side: the airline rebooks them by phone and they leave.
        this.say(a, 'rebooked')
        this.fb.rebooked += 1 + (a.group?.length ?? 0)
        this.remove(a, 'rebooked')
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

  // ---------------------------------------------------------------- guests

  /** Land a thought on a guest (a follower's land on their leader) and count it. */
  private say(a: Agent, key: ThoughtKey, place?: string) {
    const m = (a.lead ?? a).m
    if (!m) return
    this.fb.satDelta += think(m, key, this.now, place)
  }

  /** Seconds from now until boarding opens, less what the stops still ahead should take. */
  private slack(a: Agent): number {
    const T = GUEST_TUNING
    let left = T.gateWalkSec
    for (const s of a.stops) {
      if (s === 'checkin' || s === 'security') {
        if (a.fac && a.stops[0] === s) {
          const st = this.state(a.fac)
          left += T.stopBaseSec[s] + (a.joined ? a.place : st.queue.length) * a.fac.serviceSec
        } else left += T.stopBaseSec[s]
      } else if (s !== 'gate') left += T.amenityDwellSec
    }
    return this.boardOpen(a) - this.now - left
  }

  /**
   * Needs pick the next optional stop, weighed against the time to boarding.
   * Puts it ahead of the gate and returns true when one wins.
   */
  private pickAmenity(a: Agent): boolean {
    const m = a.m!
    if (a.layer !== AIR || a.rebook) return false
    const slack = this.boardOpen(a) - this.now - GUEST_TUNING.gateWalkSec
    let best: AmenityStop | null = null
    let bestScore: number = GUEST_TUNING.pickMin
    const avoid = m.avoidId && this.now < m.avoidUntil ? (this.fac.byId.get(m.avoidId) ?? null) : null
    for (const s of NEED_STOPS) {
      const f = this.choose(a, STOP_KIT[s], null, avoid)
      if (!f) {
        if (s !== 'shop' && (s === 'toilet' ? need(m, 'bladder') : need(m, 'hunger')) >= GUEST_TUNING.needThought) {
          this.say(a, 'no_amenity', s)
        }
        continue
      }
      const sc = amenityScore(m, s, this.chosenT + GUEST_TUNING.amenityDwellSec, slack, PAXNAV_TUNING.needSlackSec)
      if (sc > bestScore) {
        bestScore = sc
        best = s
      }
    }
    if (!best) return false
    a.stops.unshift(best)
    return true
  }

  /** The guest's staggered think step: needs, anxiety, thoughts, impatience, getting lost, amenities. */
  private thinkStep(a: Agent) {
    const T = GUEST_TUNING
    const m = a.m!
    const now = this.now
    const dt = now - m.lastThink
    m.lastThink = now
    m.thinkAt = now + T.thinkSec
    const crowd = this.dens[a.cell] ?? 0
    const act: Activity =
      a.phase === 'queue' || a.phase === 'service' || a.phase === 'stuck'
        ? 'queue'
        : a.phase === 'seated'
          ? a.seat >= 0
            ? 'seated'
            : 'queue'
          : 'walk'
    if (dt > 0) decayNeeds(m, dt, act, crowd)
    const anx = a.rebook ? 0 : anxietyFrom(m, this.slack(a), this.signs.board[a.cell] === 1)
    if (anx >= T.anxiousThought) this.say(a, 'anxious')
    if (need(m, 'bladder') >= T.needThought) this.say(a, 'need_toilet')
    if (need(m, 'hunger') >= T.needThought) this.say(a, 'hungry')
    if (need(m, 'thirst') >= T.needThought) this.say(a, 'thirsty')
    if (need(m, 'boredom') >= T.needThought) this.say(a, 'bored')
    if (need(m, 'tired') >= T.needThought) this.say(a, 'tired')
    if (crowd >= T.crowdThoughtPax) this.say(a, 'crowded')

    // Impatience in a line.
    if (a.joined && a.phase === 'queue' && a.fac) {
      const f = a.fac
      const wait = now - a.joinedAt
      const p = patienceNow(m)
      if (wait > p * T.queueLongShare && !m.saidLong) {
        m.saidLong = true
        this.say(a, 'queue_long')
      }
      if (wait > p * T.leaveShare) {
        const s = a.stops[0]
        const optional = s === 'toilet' || s === 'food' || s === 'shop'
        if (optional) {
          this.quitLine(a)
          a.stops.shift()
          this.plan(a)
          return
        }
        // Somewhere else would serve them much sooner: walk over there.
        const mine = a.place * f.serviceSec
        const alt = s === 'rebook' ? null : this.choose(a, f.kind, s === 'gate' ? a.gate : null, f)
        if (alt && this.chosenT < mine * 0.7) {
          this.quitLine(a)
          a.fac = alt
          this.state(alt).incoming++
          a.phase = 'walk'
          return
        }
        if (wait > p * T.complainShare && !m.saidComplain) {
          m.saidComplain = true
          m.complaints++
          this.fb.complaints++
          this.say(a, 'complain')
        }
      }
    }

    // Lost: first-timers and the stressed, more so where signs are thin.
    if (a.phase === 'walk' && !a.joined && a.fac) {
      const p = ((T.lostPerMin * T.thinkSec) / 60) * m.fx.lost * (1 + anx) / this.signs.div[a.cell]
      if (rnd(m) < p && this.startWander(a)) return
    }

    // Needs pick an amenity while there is time before boarding.
    if (!a.fixedNeeds && a.stops[0] === 'gate' && (a.phase === 'seat' || a.phase === 'seated') && now < this.boardOpen(a)) {
      if (this.pickAmenity(a)) {
        if (a.seat >= 0) this.seatTaken.delete(a.seat)
        a.seat = -1
        a.path = null
        this.plan(a)
        return
      }
    }
    // Standing at the gate and tired: look for a seat again.
    if (a.phase === 'seated' && a.seat < 0 && need(m, 'tired') > 0.5) a.phase = 'seat'
  }

  /** Give up on a line. */
  private quitLine(a: Agent) {
    const f = a.fac
    if (!f) return
    this.state(f).left++
    this.fb.leftQueue++
    this.say(a, 'left_queue')
    this.stepOffLine(a)
    a.m!.saidLong = false
    a.m!.saidComplain = false
  }

  /**
   * Leave a facility, and if they were standing in its line (between two line
   * cells), settle on the centre of the cell they are actually on so the next
   * walk starts from a cell centre and never cuts a corner.
   */
  private stepOffLine(a: Agent) {
    const inLine = a.lineS >= 0
    this.leaveFacility(a)
    if (!inLine) return
    const g = this.grid
    const c = cellAt(g, a.x, a.z)
    if (c >= 0 && g.mask[c] & a.layer) {
      a.cell = c
      a.x = cellX(g, c)
      a.z = cellZ(g, c)
    }
  }

  /** Wander a few cells off the route (a dead end, a wrong turn, back the way they came). */
  private startWander(a: Agent): boolean {
    const g = this.grid
    const m = a.m!
    const [lo, hi] = GUEST_TUNING.wanderCells
    const want = lo + Math.floor(rnd(m) * (hi - lo + 1))
    const parent = new Map<number, number>([[a.cell, -1]])
    const depth = new Map<number, number>([[a.cell, 0]])
    const q = [a.cell]
    const ring: number[] = []
    for (let i = 0; i < q.length && i < 800; i++) {
      const u = q[i]
      const du = depth.get(u)!
      if (du === want) {
        ring.push(u)
        continue
      }
      for (const s of [1, -1, g.gw, -g.gw]) {
        const v = u + s
        if (v < 0 || v >= g.mask.length || parent.has(v)) continue
        if (Math.abs(s) === 1 && Math.floor(v / g.gw) !== Math.floor(u / g.gw)) continue
        if (!moveOpen(g, u, v, a.layer)) continue
        parent.set(v, u)
        depth.set(v, du + 1)
        q.push(v)
      }
    }
    if (!ring.length) return false
    const end = ring[Math.floor(rnd(m) * ring.length) % ring.length]
    const path: number[] = []
    for (let c = end; c !== a.cell; c = parent.get(c)!) path.push(c)
    // Back to the centre of the cell they last stood on first: they may be mid-step.
    path.push(a.cell)
    a.path = path.reverse()
    a.pathI = 0
    a.phase = 'lost'
    m.lostTimes++
    this.fb.lost++
    this.say(a, 'lost', a.stops[0])
    return true
  }

  private stepLost(a: Agent, dt: number) {
    const res = this.follow(a, null, dt)
    if (res !== true) return
    a.path = null
    if (a.fac) a.phase = 'walk'
    else this.plan(a)
  }

  /** Missed the flight: the group heads for a rebooking desk. */
  private miss(a: Agent) {
    const n = 1 + (a.group?.length ?? 0)
    this.events.push({ kind: 'missed', id: a.id, at: this.now })
    for (const f of a.group ?? []) this.events.push({ kind: 'missed', id: f.id, at: this.now })
    this.fb.missed += n
    this.say(a, 'missed')
    this.stepOffLine(a)
    if (a.seat >= 0) this.seatTaken.delete(a.seat)
    a.seat = -1
    a.path = null
    a.rebook = true
    a.stops = ['rebook']
    a.phase = 'walk'
    this.plan(a)
  }

  /** Bodies per cell for crowd pace and comfort. */
  private countDensity() {
    const d = this.dens
    d.fill(0)
    for (const a of this.agents) if (!a.dead && a.cell >= 0 && a.cell < d.length && d[a.cell] < 65535) d[a.cell]++
  }

  /** Walking pace now: their own speed, slowed where the floor is crowded (they give way). */
  private pace(a: Agent): number {
    if (!this.guests) return a.speed
    const n = this.dens[a.cell] ?? 0
    const T = GUEST_TUNING
    if (n <= T.crowdCellPax) return a.speed
    return a.speed * Math.max(T.crowdMinPace, T.crowdCellPax / n)
  }

  /** Seconds at the desk for this guest: group size, rebooking, and empty shelves. */
  private serviceTime(a: Agent, f: Facility): number {
    a.oos = false
    if (!this.guests) return f.serviceSec
    if (a.rebook) return GUEST_TUNING.rebookSec
    const st = this.state(f)
    if (f.kind === 'shop_counter') {
      if (st.stock < 1) {
        a.oos = true
        return GUEST_TUNING.outOfStockSec
      }
      st.stock -= 1
    }
    const extra = a.group && f.kind !== 'toilet' && f.kind !== 'shop_counter' ? a.group.length * GUEST_TUNING.groupServiceShare : 0
    return f.serviceSec * (1 + extra)
  }

  /** Guest side of finishing at a facility: needs, spending, thoughts. */
  private served(a: Agent, f: Facility, s: StopKind) {
    const m = a.m
    if (!m) return
    const T = GUEST_TUNING
    m.saidLong = false
    m.saidComplain = false
    if ((s === 'checkin' || s === 'security') && a.lastWait < T.quickSec) this.say(a, 'quick')
    if (s === 'toilet') {
      relieve(m, 'toilet')
      this.say(a, 'relief')
    } else if (s === 'food' || s === 'shop') {
      if (a.oos) {
        this.fb.outOfStock++
        this.say(a, 'out_of_stock')
        m.avoidId = f.id
        m.avoidUntil = this.now + T.outOfStockAvoidSec
        return
      }
      relieve(m, s)
      const cash = Math.round(T.spend[s] * m.fx.spend * (0.6 + rnd(m) * 0.8))
      m.spent += cash
      this.fb.spent += cash
      this.say(a, s === 'food' ? 'tasty' : 'good_buy')
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
    // The group goes with the leader.
    for (const f of a.group ?? []) {
      if (f.dead) continue
      f.dead = true
      this.byId.delete(f.id)
      if (kind) this.events.push({ kind, id: f.id, at: this.now })
    }
  }

  // ---------------------------------------------------------------- tick

  /** Advance everyone by `dt` seconds; `now` is the clock departures are measured on. */
  tick(dt: number, now: number): void {
    this.now = now
    if (!(dt > 0)) return
    const close = PAXNAV_TUNING.gateCloseSec
    const guests = this.guests
    if (guests) {
      this.countDensity()
      this.restock(dt)
    }
    for (const a of this.agents) {
      if (a.dead) continue
      if (a.lead) {
        // Followers move after their leader (who is earlier in the list).
        this.snapFollower(a, a.lead)
        continue
      }
      if (a.phase !== 'board' && !a.rebook && now >= a.departAt - close) {
        if (guests) this.miss(a)
        else this.remove(a, 'missed')
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
        case 'lost':
          this.stepLost(a, dt)
          break
      }
      if (a.dead || !a.m) continue
      if (now >= a.m.thinkAt) this.thinkStep(a)
      if (a.trail && !a.dead) this.recordTrail(a)
    }
    if (this.agents.some((a) => a.dead)) this.agents = this.agents.filter((a) => !a.dead)
  }

  private restock(dt: number) {
    const add = (GUEST_TUNING.restockPerHour * dt) / 3600
    for (const st of this.states.values()) {
      if (st.kind === 'shop_counter' && st.stock < GUEST_TUNING.stockCap) st.stock = Math.min(GUEST_TUNING.stockCap, st.stock + add)
    }
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
    let budget = (a.lineS >= 0 || a.joined ? a.speed : this.pace(a)) * dt
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
      // Nobody at the point: the passenger stays at the head of the line.
      if (!f.staffed) {
        a.phase = 'queue'
        return
      }
      a.phase = 'service'
      a.serviceLeft = this.serviceTime(a, f)
      a.lastWait = this.now - a.joinedAt
      st.waits.push(a.lastWait)
      this.waitLog.push({ id: a.id, facility: f.id, kind: f.kind, waitSec: a.lastWait })
      // Nobody draining: keep the newest only.
      if (this.waitLog.length > PAXNAV_TUNING.waitLogCap) this.waitLog.splice(0, this.waitLog.length >> 1)
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
    const s = a.stops.shift()
    if (s === 'rebook') {
      this.say(a, 'rebooked')
      this.fb.rebooked += 1 + (a.group?.length ?? 0)
      this.remove(a, 'rebooked')
      return
    }
    if (s) this.served(a, f, s)
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
    let budget = this.pace(a) * dt
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
      this.say(a, 'nice_seats')
      return
    }
    // At the seats. Take this spot if it is free, else the nearest free one.
    if (!this.seatTaken.has(a.cell)) {
      a.seat = a.cell
      this.seatTaken.add(a.cell)
      a.phase = 'seated'
      this.say(a, 'nice_seats')
      return
    }
    const path = this.pathToFreeSeat(a, F)
    if (path) {
      a.seat = path[path.length - 1]
      this.seatTaken.add(a.seat)
      a.path = path
      a.pathI = 0
    } else {
      // Every seat taken: stand here.
      a.phase = 'seated'
      this.say(a, 'no_seats')
    }
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

  /** Waits that ended (someone reached the desk) since the last drain. */
  drainWaits(): PaxWait[] {
    const out = this.waitLog
    this.waitLog = []
    return out
  }

  get count(): number {
    return this.agents.length
  }

  /** Service points and lines on the current layout (crew posts, overlays). */
  get facilities(): FacilitySet {
    return this.fac
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
      lost: (a.lead ?? a).phase === 'lost',
      rebooking: a.rebook,
    }))
  }

  /** Bits per walker in pose order (WALKER_LOST, WALKER_REBOOK, WALKER_UNHAPPY), for bubbles. No allocation. */
  writeFlags(out: Uint8Array, offset = 0): number {
    const n = Math.min(this.agents.length, out.length - offset)
    for (let i = 0; i < n; i++) {
      const a = this.agents[i]
      const lead = a.lead ?? a
      let b = 0
      if (lead.phase === 'lost') b |= WALKER_LOST
      if (lead.rebook) b |= WALKER_REBOOK
      if (lead.m && lead.m.sat < 35) b |= WALKER_UNHAPPY
      out[offset + i] = b
    }
    return n
  }

  /** Is this passenger still walking? */
  has(id: string): boolean {
    return this.byId.has(id)
  }

  /** Guest card for one passenger; null for plain walkers and unknown ids. */
  guest(id: string): GuestCard | null {
    const a = this.byId.get(id)
    if (!a || !a.m) return null
    const lead = a.lead ?? a
    const mind = lead.m ?? a.m
    const needs = {} as Record<NeedKey, number>
    NEED_KEYS.forEach((k, i) => (needs[k] = mind.needs[i]))
    const group = lead.group ? [lead.id, ...lead.group.filter((f) => !f.dead).map((f) => f.id)] : []
    return {
      id: a.id,
      purpose: a.m.purpose,
      traits: [...a.m.traits],
      needs,
      satisfaction: mind.sat,
      spent: mind.spent,
      thoughts: mind.thoughts.map((t) => ({ ...t })),
      phase: a.phase,
      stop: lead.stops[0] ?? null,
      facility: lead.fac?.id ?? null,
      airside: a.layer === AIR,
      lost: lead.phase === 'lost',
      rebooking: lead.rebook,
      waitedSec: lead.joined ? this.now - lead.joinedAt : 0,
      leader: group.length ? lead.id : null,
      group,
      lostTimes: mind.lostTimes,
      complaints: mind.complaints,
      speedMps: lead.speed,
    }
  }

  /** Nearest walker to a floor point within `maxM` metres (click to inspect), else null. */
  pick(x: number, z: number, maxM = 1): string | null {
    let best: string | null = null
    let bestD = maxM * maxM
    for (const a of this.agents) {
      const d = (a.x - x) ** 2 + (a.z - z) ** 2
      if (d <= bestD) {
        bestD = d
        best = a.id
      }
    }
    return best
  }

  /** Guest feedback since the last drain: satisfaction moved, misses, complaints, spend. */
  drainFeedback(): GuestFeedback {
    const out = this.fb
    this.fb = noFeedback()
    return out
  }

  /** Mean satisfaction (0–100) of the guests walking now, and how many. Followers count with their leader's mood. */
  satisfaction(): { avg: number; count: number } {
    let sum = 0
    let n = 0
    for (const a of this.agents) {
      const m = (a.lead ?? a).m
      if (!m) continue
      sum += m.sat
      n++
    }
    return { avg: n ? sum / n : 0, count: n }
  }

  /**
   * Change a shop counter's shelf: positive is a restock run, negative takes
   * stock away (a missed delivery). Returns the new stock, or null for other kit.
   */
  addStock(id: string, units: number): number | null {
    const st = this.states.get(id)
    if (!st || st.kind !== 'shop_counter' || !Number.isFinite(units)) return null
    st.stock = Math.max(0, Math.min(GUEST_TUNING.stockCap, st.stock + units))
    return st.stock
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
      const held = waiting > 0 || serving || st.incoming > 0
      return {
        id: f.id,
        kind: f.kind,
        roomId: f.roomId,
        queueLength: waiting,
        serving,
        incoming: st.incoming,
        avgWaitSec: st.waits.length ? st.waits.reduce((s, w) => s + w, 0) / st.waits.length : 0,
        longestWaitSec: front?.joined ? this.now - front.joinedAt : 0,
        estWaitSec: f.staffed ? left + waiting * f.serviceSec : held ? SERVICE_POINT_TUNING.unstaffedWaitSec : 0,
        staffed: f.staffed,
        inUse: f.staffed && (serving || waiting > 0),
        serviceSec: f.serviceSec,
        served: st.served,
        leftQueue: st.left,
        stock: this.guests && f.kind === 'shop_counter' ? Math.floor(st.stock) : null,
        line: f.line.map((c) => ({ x: cellX(g, c), z: cellZ(g, c) })),
      }
    })
  }

  metricsFor(id: string): FacilityMetrics | undefined {
    return this.metrics().find((m) => m.id === id)
  }

  /**
   * Which points are staffed. `null` opens every point. A set opens only
   * those ids; the rest keep their queue and do not serve. Layout changes
   * rebuild the points open, so the caller sets this again after `setLayout`.
   */
  setStaffing(open: ReadonlySet<string> | null): void {
    for (const f of this.fac.list) {
      if (f.kind !== 'checkin_desk' && f.kind !== 'security_lane') continue
      f.staffed = open ? open.has(f.id) : true
    }
  }

  /**
   * One byte per passenger in pose order: 2 being served, 1 in a queue, 0 otherwise.
   * The renderer reads this for the serve animation. Returns how many were written.
   */
  writePhases(out: Uint8Array): number {
    const n = Math.min(this.agents.length, out.length)
    for (let i = 0; i < n; i++) {
      const phase = this.agents[i].phase
      out[i] = phase === 'service' ? 2 : phase === 'queue' ? 1 : 0
    }
    return n
  }
}
