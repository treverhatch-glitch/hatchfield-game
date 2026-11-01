/**
 * Arriving passengers on the hall's nav grid: jet bridge door -> toilet /
 * shop if they need one -> bag claim (if they have a bag and the hall has a
 * belt) or the exit -> curb door, then gone.
 *
 * Glue only. It reads the same build layout the departures walk, through the
 * paxnav building blocks (nav grid, flow fields, facility lines, jet bridge
 * cells), and never changes `src/paxnav`. The arrivals' grid is the
 * departures' layout with the arrival rules from `terminalbuild` applied:
 *
 * - exit doors open (one way: arrivals only cross them airside -> landside);
 * - security lanes are closed (nobody walks back through screening);
 * - the prefab claim hall is floor, and its belts are solid kit.
 *
 * Arrivals walk the airside layer (AIR) until they reach a claim spot or an
 * exit, then the landside layer (PRE) to the curb. They queue behind the
 * departures at the same toilets and shop counters, on the same marked line.
 */
import { createPaxRng, type PaxRng } from '../pax/rng.ts'
import {
  AIR,
  ARR,
  LANE,
  PAXNAV_TUNING,
  PRE,
  apronCells,
  arrivalsDoorCells,
  boardingTargets,
  buildFacilities,
  buildNavGrid,
  cellAt,
  cellX,
  cellZ,
  claimZoneKeys,
  computeField,
  deplaneDelay,
  facilityPenalty,
  freshJourney,
  moveOpen,
  noteStage,
  paintSterileArrivals,
  stepOpen,
  sterileHall,
  tileOfCell,
  type BoardMethod,
  type Facility,
  type FacilitySet,
  type Field,
  type NavGrid,
  type PaxNav,
  type StageTrace,
} from '../paxnav/index.ts'
import { BUILD_TUNING, ZONE_SIDE } from '../terminalbuild/config.ts'
import type { BuildLayout, Equip, Tile } from '../terminalbuild/types.ts'
import { HALL_ARRIVAL_TUNING } from './hallNavData.ts'
import { detAtan2, detHypot, sq } from './detMath.ts'

/** Floor of a prefab claim hall, and its solid belts (carousel, bag hall kit). */
export interface ClaimHall {
  tiles: Tile[]
  /** Solid kit. Nobody walks on it. */
  solid: Tile[]
  /** Claim belts people wait beside. */
  belts: Tile[]
}

export type ArrivalStop = 'toilet' | 'shop' | 'passport' | 'claim' | 'exit' | 'curb'

export type ArrivalPhase = 'deplane' | 'walk' | 'queue' | 'service' | 'claim' | 'exit' | 'curb' | 'stuck'

export interface ArrivalSpec {
  id: string
  /** Gate room id. Unknown ids fall back to any jet bridge. */
  gate: string
  /** Collects a checked bag at the claim belt. Rolled when unset. */
  bags?: boolean
  /** Stops before the claim / exit. Rolled when unset. */
  needs?: ('toilet' | 'shop')[]
  /** International arrival: queue at passport before claim. Never skipped. */
  intl?: boolean
  /** Own bag's place in the claim sequence. Unset keeps the timed wait. */
  bagSeq?: number
  flightId?: string
  /** How they left the aircraft. Unset keeps the jet-bridge spawn. */
  boardMethod?: BoardMethod
  deplaneIndex?: number
  busCapacity?: number
}

export interface ArrivalEvent {
  kind: 'left' | 'stuck'
  id: string
  /** Nav cell they were on: the curb cell they left from, or where they got stuck. */
  cell: number
}

interface Arrival {
  id: string
  cell: number
  x: number
  z: number
  ox: number
  oz: number
  yaw: number
  speed: number
  layer: number
  stops: ArrivalStop[]
  gate: string
  phase: ArrivalPhase
  fac: Facility | null
  /** Metres from the service point while on the marked line; -1 off it. */
  lineS: number
  serviceLeft: number
  claimLeft: number
  /** Claim spot taken, -1 none. */
  spot: number
  path: number[] | null
  pathI: number
  retryAt: number
  stuckSaid: boolean
  dead: boolean
  flightId: string
  intl: boolean
  bagSeq: number | null
  trace: StageTrace
  deplaneLeft: number
  method: BoardMethod | null
  /** Stepped on a security lane or a security-zone cell. */
  sawSecurity: boolean
}

const EPS = 1e-4
const NEED_KIT = { toilet: 'toilet', shop: 'shop_counter' } as const

/** The departures' layout with the arrival rules: exits open, claim hall floor, belts solid. */
export function arrivalLayout(dep: BuildLayout, claim: ClaimHall | null): BuildLayout {
  const zones = dep.zones.map((row) => row.slice())
  const equipment: Equip[] = dep.equipment.slice()
  if (claim) {
    // Either side of security: the claim hall joins the gates to the curb side.
    for (const t of claim.tiles) if (zones[t.y]?.[t.x] !== undefined) zones[t.y][t.x] = 'retail'
    claim.solid.forEach((t, i) => equipment.push({ id: `claim-solid-${i}`, kind: 'bag_belt', x: t.x, y: t.y, wear: 0 }))
  }
  return {
    ...dep,
    zones,
    equipment,
    doors: dep.doors.map((d) => (d.kind === 'exit' ? { ...d, kind: 'public' as const } : d)),
  }
}

export class HallArrivals {
  private grid: NavGrid | null = null
  private dep: FacilitySet | null = null
  private depGrid: NavGrid | null = null
  private fields = new Map<string, Field>()
  private curb: Field | null = null
  private exitField: Field | null = null
  /** Exit inside face -> landside cell across the exit door. */
  private handoff = new Map<number, number>()
  private spots = new Set<number>()
  /** People standing on each claim spot. */
  private spotTaken = new Map<number, number>()
  private claimField: Field | null = null
  /** Arrivals standing in each facility's line, in order. Placed behind the departures there. */
  private lines = new Map<string, Arrival[]>()
  private depOcc = new Map<string, { occ: number; serving: boolean }>()
  private occStale = true
  private agents: Arrival[] = []
  private byId = new Map<string, Arrival>()
  private events: ArrivalEvent[] = []
  private rng: PaxRng
  private now = 0
  private tileM: number
  private gateIds: string[] = []
  private layoutKey: BuildLayout | null = null
  private claimKey: ClaimHall | null = null
  /** ARR on a sterile claim hall, AIR on the legacy prefab. */
  private side = AIR
  private sterile = false
  private passports: Facility[] = []
  private claimReleased = new Map<string, number>()
  private journeys = new Map<string, StageTrace>()
  left = 0

  constructor(seed: number = HALL_ARRIVAL_TUNING.seed, tileM?: number) {
    this.rng = createPaxRng(seed)
    this.tileM = tileM ?? BUILD_TUNING.tileMetres
  }

  get count(): number {
    return this.agents.length
  }

  /** Arrivals standing at a claim belt right now. */
  claimWaiting(): number {
    let n = 0
    for (const a of this.agents) if (a.phase === 'claim') n++
    return n
  }

  /** The arrivals' nav grid (tests, debug). */
  get nav(): NavGrid | null {
    return this.grid
  }

  // ---------------------------------------------------------------- layout

  /** Read the hall. Same layout object and claim hall: nothing to do. Everyone re-plans otherwise. */
  setLayout(dep: BuildLayout, claim: ClaimHall | null) {
    if (dep === this.layoutKey && claim === this.claimKey) return
    this.layoutKey = dep
    this.claimKey = claim
    const g =buildNavGrid(arrivalLayout(dep, claim), this.tileM)
    // Arrival rules on top of the departures' layers: no lanes, and the
    // security floor is never a way out to the curb side.
    const mask = g.mask
    for (let c = 0; c < mask.length; c++) {
      if (mask[c] & LANE) {
        mask[c] = 0
        continue
      }
      const t = tileOfCell(g, c)
      const z = g.layout.zones[t.y]?.[t.x]
      if (z && ZONE_SIDE[z] === 'security') mask[c] &= ~PRE
    }
    this.sterile = sterileHall(dep)
    this.side = this.sterile ? ARR : AIR
    if (this.sterile) paintSterileArrivals(g, claimZoneKeys(dep))
    this.grid = g
    this.depGrid = buildNavGrid(dep, this.tileM)
    this.dep = buildFacilities(this.depGrid)
    this.fields.clear()
    this.gateIds = dep.rooms.filter((r) => r.kind === 'gate').map((r) => r.id)
    this.curb = computeField(g, g.spawns, PRE, this.dep.basePenalty)
    this.handoff.clear()
    const exits: number[] = []
    const n4 = [1, -1, g.gw, -g.gw]
    for (let c = 0; c < mask.length; c++) {
      if (!(mask[c] & this.side)) continue
      if (mask[c] & PRE) {
        if (Number.isFinite(this.curb.dist[c])) exits.push(c)
        continue
      }
      for (const s of n4) {
        const n = c + s
        if (n < 0 || n >= mask.length || mask[n] & this.side || !(mask[n] & PRE)) continue
        if (Math.abs(s) === 1 && Math.floor(n / g.gw) !== Math.floor(c / g.gw)) continue
        if (!stepOpen(g, c, n) || !Number.isFinite(this.curb.dist[n])) continue
        exits.push(c)
        this.handoff.set(c, n)
        break
      }
    }
    this.exitField = computeField(g, exits, this.side, this.dep.basePenalty)
    this.spots = this.claimSpots(g, claim)
    this.claimField = this.spots.size ? computeField(g, [...this.spots], this.side, this.dep.basePenalty) : null
    this.passports = buildFacilities(g).list.filter((f) => f.kind === 'passport_booth')
    this.spotTaken.clear()
    this.lines.clear()
    this.occStale = true
    // Everyone re-plans from where they stand.
    for (const a of this.agents) {
      a.fac = null
      a.lineS = -1
      a.spot = -1
      a.path = null
      let c = cellAt(g, a.x, a.z)
      if (c < 0 || !(mask[c] & a.layer)) {
        // An edit took the floor from under them: step to the nearest spot still walkable.
        c = this.nearestCell(a.x, a.z, a.layer)
        if (c < 0) {
          this.stick(a)
          continue
        }
        a.x = cellX(g, c)
        a.z = cellZ(g, c)
      }
      a.cell = c
      if (a.phase === 'claim' && a.claimLeft > 0 && this.spots.has(c)) {
        a.spot = c
        this.takeSpot(c)
        continue
      }
      this.plan(a)
    }
  }

  /** Claim-hall floor within reach of a belt, on the airside walk. */
  private claimSpots(g: NavGrid, claim: ClaimHall | null): Set<number> {
    const out = new Set<number>()
    if (!claim?.belts.length) return out
    const belt = new Set<number>()
    for (const t of claim.belts) {
      const ox = (t.x + g.margin) * g.k
      const oy = (t.y + g.margin) * g.k
      for (let y = 0; y < g.k; y++) for (let x = 0; x < g.k; x++) belt.add((oy + y) * g.gw + ox + x)
    }
    const floor = new Set(claim.tiles.map((t) => `${t.x},${t.y}`))
    const reach = HALL_ARRIVAL_TUNING.claimReachCells
    for (let c = 0; c < g.mask.length; c++) {
      if (this.sterile) {
        if (!(g.mask[c] & ARR)) continue
      } else if (!(g.mask[c] & AIR) || !(g.mask[c] & PRE)) continue
      const t = tileOfCell(g, c)
      if (!floor.has(`${t.x},${t.y}`)) continue
      const cx = c % g.gw
      const cy = Math.floor(c / g.gw)
      let near = false
      for (let dy = -reach; dy <= reach && !near; dy++) {
        for (let dx = -reach; dx <= reach && !near; dx++) {
          const x = cx + dx
          const y = cy + dy
          if (x >= 0 && y >= 0 && x < g.gw && y < g.gh && belt.has(y * g.gw + x)) near = true
        }
      }
      if (near) out.add(c)
    }
    return out
  }

  private nearestCell(x: number, z: number, layer: number): number {
    const g = this.grid!
    let best = -1
    let bestD = Infinity
    for (let c = 0; c < g.mask.length; c++) {
      if (!(g.mask[c] & layer)) continue
      const d = sq(cellX(g, c) - x) + sq(cellZ(g, c) - z)
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return best
  }

  private facField(f: Facility): Field {
    let F = this.fields.get(f.id)
    if (!F) {
      F = computeField(this.grid!, [f.service], f.layer, facilityPenalty(this.depGrid!, this.dep!, f))
      // Down the line cell by cell, as the departures do.
      for (let i = 1; i < f.line.length; i++) if (this.grid!.mask[f.line[i]] & f.layer) F.next[f.line[i]] = f.line[i - 1]
      this.fields.set(f.id, F)
    }
    return F
  }

  // ---------------------------------------------------------------- spawn

  /**
   * Step off the aircraft at the inside face of the gate room's jet bridge
   * door. Returns false (and adds nobody) when there is no jet bridge or no
   * way from it to a curb door.
   */
  spawn(spec: ArrivalSpec): boolean {
    const g = this.grid
    if (!g || this.byId.has(spec.id)) return false
    const gate = this.gateIds.includes(spec.gate) ? spec.gate : (this.gateIds[0] ?? spec.gate)
    const out = this.exitField!
    const reachable = (cells: number[]) => cells.filter((c) => Number.isFinite(out.dist[c]))
    // Stairs and a bus come in through the arrivals door. A bridge uses the
    // bridge socket. No method keeps the jet-bridge cells the prefab tests pin.
    let ok: number[] = []
    if (spec.boardMethod === 'bridge') ok = reachable(boardingTargets(g, gate, 'bridge'))
    else if (spec.boardMethod === 'stairs' || spec.boardMethod === 'bus') {
      ok = this.sterile ? reachable(arrivalsDoorCells(g)) : reachable(boardingTargets(g, gate, spec.boardMethod))
    }
    if (!ok.length && !spec.boardMethod) {
      ok = reachable(apronCells(g, gate))
      if (!ok.length) ok = reachable(apronCells(g, ''))
    }
    if (!ok.length) ok = reachable(arrivalsDoorCells(g))
    if (!ok.length) {
      ok = reachable(apronCells(g, gate))
      if (!ok.length) ok = reachable(apronCells(g, ''))
    }
    if (!ok.length) return false
    const r = this.rng
    const T = HALL_ARRIVAL_TUNING
    const cell = ok[Math.floor(r.next() * ok.length) % ok.length]
    const lat = Math.min(PAXNAV_TUNING.lateralM, g.cellM * 0.45)
    const ox = (r.next() * 2 - 1) * lat
    const oz = (r.next() * 2 - 1) * lat
    const bags = spec.bags ?? r.next() < T.bagShare
    const needs = spec.needs ?? (['toilet', 'shop'] as const).filter((n) => r.next() < T.needShare[n])
    const intl = spec.intl === true
    const journey = freshJourney({ intl, bags, needs })
    const method = spec.boardMethod ?? null
    const deplaneLeft = method ? deplaneDelay(method, spec.deplaneIndex ?? 0, spec.busCapacity) : 0
    const speed = PAXNAV_TUNING.walkMps * (1 + (r.next() * 2 - 1) * PAXNAV_TUNING.walkSpread)
    const a: Arrival = {
      id: spec.id,
      cell,
      // On the floor at the door; the sideways offset settles in on the first step.
      x: cellX(g, cell),
      z: cellZ(g, cell),
      ox,
      oz,
      yaw: 0,
      speed,
      layer: this.side,
      stops: journey.stops,
      gate,
      phase: deplaneLeft > 0 ? 'deplane' : 'walk',
      fac: null,
      lineS: -1,
      serviceLeft: 0,
      claimLeft: T.claimWaitSec[0] + r.next() * (T.claimWaitSec[1] - T.claimWaitSec[0]),
      spot: -1,
      path: null,
      pathI: 0,
      retryAt: 0,
      stuckSaid: false,
      dead: false,
      flightId: spec.flightId ?? '',
      intl,
      bagSeq: spec.bagSeq ?? null,
      trace: journey.trace,
      deplaneLeft,
      method,
      sawSecurity: false,
    }
    this.agents.push(a)
    this.byId.set(a.id, a)
    if (a.phase !== 'deplane') this.plan(a)
    return true
  }

  /** How many of this flight's bags are on the carousel. Arrivals with a sequence wait for theirs. */
  setClaimReleased(flightId: string, n: number) {
    this.claimReleased.set(flightId, n)
  }

  // ---------------------------------------------------------------- planning

  private plan(a: Arrival) {
    this.leaveLine(a)
    a.path = null
    const g = this.grid!
    while (a.stops.length) {
      const s = a.stops[0]
      if (s === 'toilet' || s === 'shop') {
        const f = a.layer === this.side ? this.choose(a, NEED_KIT[s]) : null
        if (f) {
          a.fac = f
          a.phase = 'walk'
          return
        }
        a.stops.shift()
        continue
      }
      if (s === 'passport') {
        const f = this.choosePass(a)
        if (f) {
          a.fac = f
          a.phase = 'walk'
          return
        }
        // An international arrival never skips passport.
        this.stick(a)
        return
      }
      if (s === 'claim') {
        if (a.layer === this.side && this.claimField && Number.isFinite(this.claimField.dist[a.cell])) {
          a.phase = 'claim'
          noteStage(a.trace, 'CLAIM')
          return
        }
        a.stops.shift()
        continue
      }
      if (s === 'exit') {
        if (a.layer === PRE) {
          a.stops.shift()
          continue
        }
        // Already somewhere with a way to the curb (the claim hall): cross over here.
        if (g.mask[a.cell] & PRE && Number.isFinite(this.curb!.dist[a.cell])) {
          a.layer = PRE
          a.stops.shift()
          continue
        }
        if (Number.isFinite(this.exitField!.dist[a.cell])) {
          a.phase = 'exit'
          noteStage(a.trace, 'EXIT')
          return
        }
        this.stick(a)
        return
      }
      // curb
      if (a.layer === PRE && Number.isFinite(this.curb!.dist[a.cell])) {
        a.phase = 'curb'
        noteStage(a.trace, 'LANDSIDE_FREE')
        return
      }
      this.stick(a)
      return
    }
    this.remove(a)
  }

  private stick(a: Arrival) {
    a.phase = 'stuck'
    a.retryAt = this.now + PAXNAV_TUNING.retrySec
    if (!a.stuckSaid) {
      a.stuckSaid = true
      this.events.push({ kind: 'stuck', id: a.id, cell: a.cell })
    }
  }

  private remove(a: Arrival) {
    this.leaveLine(a)
    if (a.spot >= 0) this.freeSpot(a.spot)
    noteStage(a.trace, 'CURB_OUT')
    if (!a.trace.hit.includes('LANDSIDE_FREE') && !a.trace.skips.some((s) => s.stage === 'LANDSIDE_FREE')) {
      noteStage(a.trace, 'LANDSIDE_FREE', 'no need')
    }
    a.dead = true
    this.byId.delete(a.id)
    this.journeys.set(a.id, a.trace)
    this.left++
    this.events.push({ kind: 'left', id: a.id, cell: a.cell })
  }

  private choosePass(a: Arrival): Facility | null {
    let best: Facility | null = null
    let bestT = Infinity
    for (const f of this.passports) {
      if (!f.staffed && this.passports.some((p) => p.staffed)) continue
      const d = this.facField(f).dist[a.cell]
      if (!Number.isFinite(d)) continue
      const t = (d * this.grid!.cellM) / a.speed + (this.lines.get(f.id)?.length ?? 0) * f.serviceSec
      if (!f.staffed) continue
      if (t < bestT) {
        bestT = t
        best = f
      }
    }
    return best
  }

  /** Toilet / shop with the soonest service: walk plus everyone ahead, departures included. */
  private choose(a: Arrival, kind: string): Facility | null {
    let best: Facility | null = null
    let bestT = Infinity
    for (const f of this.dep!.list) {
      if (f.kind !== kind || f.layer !== a.layer) continue
      const d = this.facField(f).dist[a.cell]
      if (!Number.isFinite(d)) continue
      const t = (d * this.grid!.cellM) / a.speed + (this.ahead(f) + (this.lines.get(f.id)?.length ?? 0)) * f.serviceSec
      if (t < bestT) {
        bestT = t
        best = f
      }
    }
    return best
  }

  private leaveLine(a: Arrival) {
    if (a.fac) {
      const q = this.lines.get(a.fac.id)
      const i = q ? q.indexOf(a) : -1
      if (i >= 0) q!.splice(i, 1)
    }
    a.fac = null
    a.lineS = -1
  }

  // ---------------------------------------------------------------- departures' queues

  private depNav: PaxNav | null = null

  /** People in the departures' line at `f`, including the one at the desk. */
  private ahead(f: Facility): number {
    return this.occ(f).occ
  }

  private occ(f: Facility): { occ: number; serving: boolean } {
    if (this.occStale) {
      this.occStale = false
      this.depOcc.clear()
      for (const m of this.depNav?.metrics() ?? []) {
        this.depOcc.set(m.id, { occ: m.queueLength + (m.serving ? 1 : 0), serving: m.serving })
      }
    }
    return this.depOcc.get(f.id) ?? { occ: 0, serving: false }
  }

  // ---------------------------------------------------------------- tick

  /** Advance by `dt` nav seconds. `dep` is the hall's departures walk, read for shared queues. */
  tick(dt: number, now: number, dep: PaxNav | null) {
    this.now = now
    this.depNav = dep
    this.occStale = true
    if (!(dt > 0) || !this.grid) return
    for (const a of this.agents) {
      if (a.dead) continue
      switch (a.phase) {
        case 'deplane':
          a.deplaneLeft -= dt
          if (a.deplaneLeft <= 0) {
            a.phase = 'walk'
            this.plan(a)
          }
          break
        case 'walk':
          this.noteSecurity(a)
          this.stepWalk(a, dt)
          break
        case 'queue':
          this.stepLine(a, dt)
          break
        case 'service':
          a.serviceLeft -= dt
          if (a.serviceLeft <= 0) {
            const done = a.stops.shift()
            if (done === 'passport') noteStage(a.trace, 'PASSPORT')
            this.plan(a)
          }
          break
        case 'claim':
          this.stepClaim(a, dt)
          break
        case 'exit':
          this.stepExit(a, dt)
          break
        case 'curb':
          if (this.follow(a, this.curb!, dt) === true) {
            a.stops.shift()
            this.remove(a)
          }
          break
        case 'stuck':
          if (now >= a.retryAt) this.plan(a)
          break
      }
    }
    if (this.agents.some((a) => a.dead)) this.agents = this.agents.filter((a) => !a.dead)
  }

  /** Walk to the facility; step onto its marked line at the tail. */
  private stepWalk(a: Arrival, dt: number) {
    const f = a.fac
    if (!f) return this.plan(a)
    const F = this.facField(f)
    if (f.lineIdx.has(a.cell) || a.cell === f.service) return this.joinLine(a, f, dt)
    const res = this.follow(a, F, dt, (c) => f.lineIdx.has(c))
    if (res === 'lost') return this.plan(a)
    if (f.lineIdx.has(a.cell)) this.joinLine(a, f, 0)
  }

  private joinLine(a: Arrival, f: Facility, dt: number) {
    let q = this.lines.get(f.id)
    if (!q) this.lines.set(f.id, (q = []))
    if (!q.includes(a)) q.push(a)
    a.lineS = (f.lineIdx.get(a.cell) ?? 0) * this.grid!.cellM
    a.phase = 'queue'
    this.stepLine(a, dt)
  }

  /** Slide along the line to our place behind the departures; served at the front. */
  private stepLine(a: Arrival, dt: number) {
    const f = a.fac
    if (!f) return this.plan(a)
    const g = this.grid!
    const q = this.lines.get(f.id) ?? []
    const o = this.occ(f)
    const place = o.occ + Math.max(0, q.indexOf(a))
    const end = (f.line.length - 1) * g.cellM
    const want = Math.min(place * PAXNAV_TUNING.queueSpacingM, end)
    const d = want - a.lineS
    a.lineS += Math.sign(d) * Math.min(Math.abs(d), a.speed * dt)
    const i = Math.min(f.line.length - 1, Math.floor(a.lineS / g.cellM + EPS))
    const t = Math.max(0, a.lineS / g.cellM - i)
    const c0 = f.line[i]
    const c1 = f.line[Math.min(f.line.length - 1, i + 1)]
    a.x = cellX(g, c0) + (cellX(g, c1) - cellX(g, c0)) * t
    a.z = cellZ(g, c0) + (cellZ(g, c1) - cellZ(g, c0)) * t
    a.cell = f.line[Math.min(f.line.length - 1, Math.round(a.lineS / g.cellM))]
    const ahead = f.line[Math.max(0, i - (t > EPS ? 0 : 1))]
    if (ahead !== c0 || t > EPS) a.yaw = detAtan2(cellX(g, ahead) - a.x, cellZ(g, ahead) - a.z)
    if (place === 0 && a.lineS <= EPS && !o.serving) {
      a.phase = 'service'
      a.serviceLeft = f.serviceSec
    }
  }

  private stepClaim(a: Arrival, dt: number) {
    if (a.spot >= 0 && a.cell === a.spot && !a.path) {
      // At the belt, waiting for the bag.
      if (a.bagSeq != null) {
        const released = this.claimReleased.get(a.flightId) ?? 0
        if (released < a.bagSeq) return
      } else {
        a.claimLeft -= dt
        if (a.claimLeft > 0) return
      }
      this.freeSpot(a.spot)
      a.spot = -1
      a.stops.shift()
      this.plan(a)
      return
    }
    const res = this.follow(a, a.path ? null : this.claimField, dt)
    if (res === 'lost') {
      a.stops.shift()
      return this.plan(a)
    }
    if (res !== true) return
    if (a.path) {
      a.path = null
      return
    }
    if (!this.spotTaken.get(a.cell)) {
      a.spot = a.cell
      this.takeSpot(a.cell)
      return
    }
    const path = this.pathToFreeSpot(a.cell)
    if (path) {
      a.spot = path[path.length - 1]
      this.takeSpot(a.spot)
      a.path = path
      a.pathI = 0
    } else {
      // Every spot taken: wait here.
      a.spot = a.cell
      this.takeSpot(a.cell)
    }
  }

  private takeSpot(c: number) {
    this.spotTaken.set(c, (this.spotTaken.get(c) ?? 0) + 1)
  }

  private freeSpot(c: number) {
    const n = (this.spotTaken.get(c) ?? 0) - 1
    if (n > 0) this.spotTaken.set(c, n)
    else this.spotTaken.delete(c)
  }

  /** Breadth-first over the claim floor to the nearest free spot. */
  private pathToFreeSpot(from: number): number[] | null {
    const g = this.grid!
    const parent = new Map<number, number>([[from, -1]])
    const q = [from]
    for (let i = 0; i < q.length && i < 4096; i++) {
      const u = q[i]
      if (this.spots.has(u) && !this.spotTaken.get(u)) {
        const path: number[] = []
        for (let c = u; c !== from; c = parent.get(c)!) path.push(c)
        return path.reverse()
      }
      for (const s of [1, -1, g.gw, -g.gw]) {
        const v = u + s
        if (v < 0 || v >= g.mask.length || parent.has(v) || !this.spots.has(v)) continue
        if (Math.abs(s) === 1 && Math.floor(v / g.gw) !== Math.floor(u / g.gw)) continue
        if (!moveOpen(g, u, v, this.side)) continue
        parent.set(v, u)
        q.push(v)
      }
    }
    return null
  }

  private stepExit(a: Arrival, dt: number) {
    const res = this.follow(a, a.path ? null : this.exitField, dt)
    if (res === 'lost') return this.plan(a)
    if (res !== true) return
    if (a.path) {
      // Through the exit door: landside from here.
      a.path = null
      a.layer = PRE
      a.stops.shift()
      return this.plan(a)
    }
    const g = this.grid!
    if (g.mask[a.cell] & PRE) {
      a.layer = PRE
      a.stops.shift()
      return this.plan(a)
    }
    const across = this.handoff.get(a.cell)
    if (across === undefined) return this.plan(a)
    a.path = [across]
    a.pathI = 0
  }

  /** Follow a field (or an explicit path) toward its goal. True on arrival. `stopAt` ends the walk early on a cell. */
  private follow(a: Arrival, F: Field | null, dt: number, stopAt?: (c: number) => boolean): boolean | 'lost' {
    const g = this.grid!
    let budget = a.speed * dt
    for (let hop = 0; hop < PAXNAV_TUNING.maxHopsPerTick && budget > EPS; hop++) {
      let nxt: number
      if (a.path) nxt = a.pathI < a.path.length ? a.path[a.pathI] : -1
      else {
        if (!F || !Number.isFinite(F.dist[a.cell])) return 'lost'
        nxt = F.next[a.cell]
      }
      const goal = nxt < 0 ? a.cell : nxt
      const lined = stopAt?.(goal) ?? false
      const tx = cellX(g, goal) + (lined ? 0 : a.ox)
      const tz = cellZ(g, goal) + (lined ? 0 : a.oz)
      const dx = tx - a.x
      const dz = tz - a.z
      const seg = detHypot(dx, dz)
      const step = Math.min(budget, seg)
      if (seg > EPS) {
        a.x += (dx * step) / seg
        a.z += (dz * step) / seg
        a.yaw = detAtan2(dx, dz)
      }
      budget -= step
      if (step < seg - EPS) return false
      a.x = tx
      a.z = tz
      if (nxt < 0) return true
      a.cell = nxt
      if (a.path) a.pathI++
      if (lined) return false
    }
    return false
  }

  // ---------------------------------------------------------------- read-outs

  drainEvents(): ArrivalEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  cellOf(id: string): number {
    return this.byId.get(id)?.cell ?? -1
  }

  /** Stages this arrival hit or skipped. Readable after they leave. */
  journey(id: string): StageTrace | null {
    return this.byId.get(id)?.trace ?? this.journeys.get(id) ?? null
  }

  /** Current stop, for the hall card. */
  stopOf(id: string): ArrivalStop | null {
    const a = this.byId.get(id)
    if (!a) return null
    if (a.phase === 'deplane') return null
    return a.stops[0] ?? null
  }

  has(id: string): boolean {
    return this.byId.has(id)
  }

  private noteSecurity(a: Arrival) {
    const g = this.grid
    if (!g) return
    if (g.mask[a.cell] & LANE) a.sawSecurity = true
    const t = tileOfCell(g, a.cell)
    const z = g.layout.zones[t.y]?.[t.x]
    if (z && ZONE_SIDE[z] === 'security') a.sawSecurity = true
  }

  /** Layer an arrival walks now: AIR before the claim / exit, PRE after. */
  layerOf(id: string): number {
    return this.byId.get(id)?.layer ?? 0
  }

  phaseOf(id: string): ArrivalPhase | null {
    return this.byId.get(id)?.phase ?? null
  }

  /** Id of the i-th arrival in pose order. */
  idAt(i: number): string {
    return this.agents[i]?.id ?? ''
  }

  /** Arrival nearest a layout-metre point, within `maxM`. */
  pick(x: number, z: number, maxM = 1): string | null {
    let best: string | null = null
    let bestD = maxM * maxM
    for (const a of this.agents) {
      const d = sq(a.x - x) + sq(a.z - z)
      if (d > bestD) continue
      bestD = d
      best = a.id
    }
    return best
  }

  /** x, y(=0), z, yaw per arrival into `out` (stride 4) from slot `from`. Returns how many were written. */
  writePoses(out: Float32Array, from = 0): number {
    const n = Math.max(0, Math.min(this.agents.length, Math.floor(out.length / 4) - from))
    for (let i = 0; i < n; i++) {
      const a = this.agents[i]
      const o = (from + i) * 4
      out[o] = a.x
      out[o + 1] = 0
      out[o + 2] = a.z
      out[o + 3] = a.yaw
    }
    return n
  }

  /** Poses with ids (tests, debug). Allocates. */
  poses(): { id: string; x: number; z: number; cell: number; layer: number; phase: ArrivalPhase; facility: string | null }[] {
    return this.agents.map((a) => ({ id: a.id, x: a.x, z: a.z, cell: a.cell, layer: a.layer, phase: a.phase, facility: a.fac?.id ?? null }))
  }

  /** Claim spots (debug, tests). */
  get claimCells(): ReadonlySet<number> {
    return this.spots
  }
}
