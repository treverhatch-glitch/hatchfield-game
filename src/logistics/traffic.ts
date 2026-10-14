/**
 * Apron traffic: deterministic reservation and avoidance for service vehicles.
 *
 * - Every vehicle has a footprint (an oriented capsule from its real length and
 *   width). No body ever moves into overlap with another.
 * - Parking is reserved: a vehicle reserves a free slot at its destination
 *   (stand, depot, farm, kitchen...) when it sets off and drives into it at the
 *   end of its route. Stationary vehicles therefore never share a spot.
 * - Drivers keep right (lane offset), follow at a gap, and yield: movers are
 *   stepped in a fixed priority order (earlier departure first, then id), each
 *   taking the furthest advance that stays clear of everyone. A blocked vehicle
 *   waits; its arrival (phaseEnd) slips by the time it waited.
 * - Gridlock fallback: a vehicle that has waited more than `deadlockMinutes`
 *   skips forward along its own route to the next clear spot (never into
 *   overlap). Counted in `stats.unjams` so tests can watch it.
 *
 * All units are metres and sim minutes. Pure TS, no randomness, so the same
 * inputs give the same traffic.
 */
import type { RoadGraph } from './roads'
import type { VehicleType } from './types'

export interface TrafficConfig {
  /** Sim minutes per traffic step while anything is driving. */
  stepMinutes: number
  /** Clear gap kept between footprints, metres. */
  gapM: number
  /** Drive this far right of the road centre line, metres. */
  laneM: number
  deadlockMinutes: number
}

export const DEFAULT_TRAFFIC: TrafficConfig = { stepMinutes: 0.04, gapM: 1.2, laneM: 3.2, deadlockMinutes: 1.5 }

/** Real footprint, metres (length, width). Matches the render models. */
export const FOOTPRINT: Record<VehicleType, readonly [number, number]> = {
  fuel_truck: [10, 2.5],
  heavy_fuel_truck: [12, 2.6],
  hydrant_dispenser: [6.2, 2.4],
  catering_truck: [8.6, 2.5],
  highlift_catering: [9.4, 2.6],
  baggage_tug: [9.6, 1.6],
  heavy_baggage_tug: [11, 1.8],
  pushback_tug: [7.8, 3.2],
  heavy_tug: [9, 3.5],
  gpu: [3.4, 1.6],
  pax_bus: [14, 3],
  belt_loader: [7.6, 2.1],
  uld_loader: [9, 3.4],
  main_deck_loader: [11, 3.6],
}

export interface Body {
  id: string
  x: number
  y: number
  heading: number
  /** Capsule half-segment along the heading, and radius. */
  half: number
  r: number
}

interface Track {
  pts: { x: number; y: number }[]
  cum: number[]
  dist: number
  len: number
  speed: number
  start: number
  waited: number
  dest: string
}

interface Slot {
  node: string
  x: number
  y: number
  heading: number
}

export interface TrafficVehicle {
  id: string
  type: VehicleType
  node: string
  phase: string
  phaseEnd: number
  route?: string[] | null
}

const DRIVING = new Set(['to_source', 'to_stand', 'to_dropoff'])

function capsule(type: VehicleType, gap: number): { half: number; r: number } {
  const [L, W] = FOOTPRINT[type]
  return { half: Math.max(0, (L - W) / 2), r: W / 2 + gap / 2 }
}

/** Squared distance between segments p1q1 and p2q2 (2D). */
function segSeg2(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const ux = bx - ax, uy = by - ay, vx = dx - cx, vy = dy - cy, wx = ax - cx, wy = ay - cy
  const a = ux * ux + uy * uy, b = ux * vx + uy * vy, c = vx * vx + vy * vy, d = ux * wx + uy * wy, e = vx * wx + vy * wy
  const D = a * c - b * b
  let sN: number, sD = D, tN: number, tD = D
  if (D < 1e-9) {
    sN = 0
    sD = 1
    tN = e
    tD = c
  } else {
    sN = b * e - c * d
    tN = a * e - b * d
    if (sN < 0) {
      sN = 0
      tN = e
      tD = c
    } else if (sN > sD) {
      sN = sD
      tN = e + b
      tD = c
    }
  }
  if (tN < 0) {
    tN = 0
    if (-d < 0) sN = 0
    else if (-d > a) sN = sD
    else {
      sN = -d
      sD = a
    }
  } else if (tN > tD) {
    tN = tD
    if (-d + b < 0) sN = 0
    else if (-d + b > a) sN = sD
    else {
      sN = -d + b
      sD = a
    }
  }
  const sc = Math.abs(sN) < 1e-9 ? 0 : sN / sD
  const tc = Math.abs(tN) < 1e-9 ? 0 : tN / tD
  const px = wx + sc * ux - tc * vx
  const py = wy + sc * uy - tc * vy
  return px * px + py * py
}

/** Clear distance between two capsules (negative = overlap). */
export function clearance(a: Body, b: Body): number {
  const ca = Math.cos(a.heading), sa = Math.sin(a.heading), cb = Math.cos(b.heading), sb = Math.sin(b.heading)
  const d2 = segSeg2(
    a.x - ca * a.half, a.y - sa * a.half, a.x + ca * a.half, a.y + sa * a.half,
    b.x - cb * b.half, b.y - sb * b.half, b.x + cb * b.half, b.y + sb * b.half,
  )
  return Math.sqrt(d2) - a.r - b.r
}

export class ApronTraffic {
  readonly cfg: TrafficConfig
  readonly stats = { waits: 0, unjams: 0, reparks: 0, steps: 0 }
  private tracks = new Map<string, Track>()
  private slots = new Map<string, Slot>()
  private bodies = new Map<string, Body>()
  private readonly mpu: number
  private readonly roads: RoadGraph

  constructor(
    roads: RoadGraph,
    edges: readonly { a: string; b: string; length?: number }[],
    cfg: Partial<TrafficConfig> = {},
  ) {
    this.roads = roads
    this.cfg = { ...DEFAULT_TRAFFIC, ...cfg }
    // Node coordinates may be cells (game) or metres (tests): scale from the first measured edge.
    let mpu = 1
    for (const e of edges) {
      const a = roads.at(e.a)
      const b = roads.at(e.b)
      if (!a || !b || e.length === undefined) continue
      const h = Math.hypot(a.x - b.x, a.y - b.y)
      if (h > 1e-6) {
        mpu = e.length / h
        break
      }
    }
    this.mpu = mpu
  }

  /** Metres per node-coordinate unit. */
  get metresPerUnit(): number {
    return this.mpu
  }

  private nodeM(id: string): { x: number; y: number } {
    const n = this.roads.at(id)
    return { x: (n?.x ?? 0) * this.mpu, y: (n?.y ?? 0) * this.mpu }
  }

  /** Reserve a free parking slot at `node` for this vehicle (sticky until it drives off). */
  reserveSlot(v: TrafficVehicle, node: string, heading = 0): Slot {
    this.slots.delete(v.id)
    const c = this.nodeM(node)
    const me = capsule(v.type, this.cfg.gapM)
    const taken: Body[] = []
    for (const [id, s] of this.slots) {
      const other = this.bodies.get(id)
      if (s.node !== node || !other) continue
      taken.push({ ...other, x: s.x, y: s.y, heading: s.heading })
    }
    // Also anyone physically there right now (a truck still pulling out of its old slot).
    for (const b of this.bodies.values()) if (b.id !== v.id && Math.hypot(b.x - c.x, b.y - c.y) < 150) taken.push(b)
    // Rings of candidates around the node in the approach frame (u along the approach heading,
    // w across it). Slots short of / beside the node come first so later arrivals do not have
    // to drive through vehicles already parked beyond them.
    const cu = Math.cos(heading), su = Math.sin(heading)
    const [L, W] = FOOTPRINT[v.type]
    const stepX = 15
    const stepY = Math.max(4.5, W + this.cfg.gapM + 1.4)
    let best: Slot | null = null
    for (let ring = 0; ring < 14 && !best; ring++) {
      const cands: [number, number][] = []
      for (let i = -ring; i <= ring; i++) {
        for (let j = -ring; j <= ring; j++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue
          cands.push([i * stepX, j * stepY])
        }
      }
      // Deterministic order: not past the node first, then nearest, then by angle.
      const key = (p: [number, number]) => (p[0] > 0 ? 1e6 : 0) + p[0] * p[0] + p[1] * p[1]
      cands.sort((p, q) => key(p) - key(q) || Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]))
      for (const [du, dw] of cands) {
        const body: Body = { id: v.id, x: c.x + du * cu - dw * su, y: c.y + du * su + dw * cu, heading, ...me }
        if (taken.every((t) => clearance(body, t) >= 0)) {
          best = { node, x: body.x, y: body.y, heading }
          break
        }
      }
    }
    void L
    const slot = best ?? { node, x: c.x, y: c.y, heading }
    this.slots.set(v.id, slot)
    return slot
  }

  /** Vehicle sets off: build its lane-offset track from where it stands to a reserved slot at the end. */
  begin(v: TrafficVehicle, dest: string, now: number, speedMpm: number): number {
    const here = this.bodies.get(v.id) ?? this.place(v)
    const route = v.route ?? []
    const raw: { x: number; y: number }[] = route.slice(1).map((id) => this.nodeM(id))
    const off: { x: number; y: number }[] = [{ x: here.x, y: here.y }]
    for (let i = 0; i < raw.length; i++) {
      const prev = i === 0 ? off[0] : raw[i - 1]
      const p = raw[i]
      const dx = p.x - prev.x
      const dy = p.y - prev.y
      const l = Math.hypot(dx, dy)
      if (l < 1e-6) continue
      // keep right: right of travel direction in a y-down plan is (−dy, dx)/l
      const nx = -dy / l
      const ny = dx / l
      if (i < raw.length - 1) off.push({ x: p.x + nx * this.cfg.laneM, y: p.y + ny * this.cfg.laneM })
    }
    this.slots.delete(v.id)
    const last = off[off.length - 1]
    const end = raw.length ? raw[raw.length - 1] : this.nodeM(dest)
    const approach = Math.hypot(end.x - last.x, end.y - last.y) > 1e-6 ? Math.atan2(end.y - last.y, end.x - last.x) : here.heading
    const slot = this.reserveSlot(v, dest, approach)
    off.push({ x: slot.x, y: slot.y })
    const cum = [0]
    for (let i = 1; i < off.length; i++) cum.push(cum[i - 1] + Math.hypot(off[i].x - off[i - 1].x, off[i].y - off[i - 1].y))
    const len = cum[cum.length - 1]
    this.tracks.set(v.id, { pts: off, cum, dist: 0, len, speed: Math.max(1, speedMpm), start: now, waited: 0, dest })
    return len / Math.max(1, speedMpm)
  }

  /** Current body of a vehicle (creates a parked one at its node if new). */
  place(v: TrafficVehicle): Body {
    let b = this.bodies.get(v.id)
    if (b) return b
    const slot = this.slots.get(v.id) ?? this.reserveSlot(v, v.node)
    b = { id: v.id, x: slot.x, y: slot.y, heading: slot.heading, ...capsule(v.type, this.cfg.gapM) }
    this.bodies.set(v.id, b)
    return b
  }

  driving(): boolean {
    return this.tracks.size > 0
  }

  private at(t: Track, d: number, out: { x: number; y: number; heading: number }) {
    const pts = t.pts
    if (pts.length < 2) {
      out.x = pts[0]?.x ?? 0
      out.y = pts[0]?.y ?? 0
      return out
    }
    let i = 1
    while (i < t.cum.length - 1 && t.cum[i] < d) i++
    const a = pts[i - 1]
    const b = pts[i]
    const seg = t.cum[i] - t.cum[i - 1]
    const k = seg > 1e-9 ? Math.min(1, Math.max(0, (d - t.cum[i - 1]) / seg)) : 1
    out.x = a.x + (b.x - a.x) * k
    out.y = a.y + (b.y - a.y) * k
    if (seg > 1e-9) out.heading = Math.atan2(b.y - a.y, b.x - a.x)
    return out
  }

  /** Lookahead along our own track for crossing traffic we must give way to. */
  private mustYield(id: string, t: Track, from: number, b: Body, myRank: number, rank: Map<string, number>, probe: { x: number; y: number; heading: number }): boolean {
    const reach = (b.half + b.r) * 2 + 4
    const stop = Math.min(t.len, from + reach)
    const ox = b.x, oy = b.y, oh = b.heading
    let hit = false
    for (let d = from; d <= stop + 1e-6 && !hit; d += 2) {
      probe.heading = oh
      this.at(t, d, probe)
      b.x = probe.x
      b.y = probe.y
      b.heading = probe.heading
      for (const o of this.bodies.values()) {
        if (o.id === id) continue
        const r = rank.get(o.id)
        let dh = Math.abs(o.heading - probe.heading) % (Math.PI * 2)
        if (dh > Math.PI) dh = Math.PI * 2 - dh
        if (dh < 0.6 || dh > Math.PI - 0.6) continue // following or oncoming: plain spacing handles it
        if (r === undefined) continue // parked across the road: ordinary blocking / re-park handles it
        // o sits on our road ahead. Give way unless we are already on o's road too, in
        // which case the earlier-dispatched vehicle (lower rank) keeps right of way.
        if (clearance(b, o) < 0 && (!this.inPathOf(o, ox, oy, oh, b) || r < myRank)) {
          hit = true
          break
        }
      }
    }
    b.x = ox
    b.y = oy
    b.heading = oh
    return hit
  }

  /**
   * True when our current body (at ox, oy, oh) already sits on the road just ahead of `o`:
   * we are committed to the junction, so we clear it rather than yield (o waits for us).
   */
  private inPathOf(o: Body, ox: number, oy: number, oh: number, me: Body): boolean {
    const ot = this.tracks.get(o.id)
    if (!ot) return false
    const cur: Body = { ...me, x: ox, y: oy, heading: oh }
    const ghost: Body = { ...o }
    const p = { x: 0, y: 0, heading: o.heading }
    const reach = (o.half + o.r) * 2 + 4
    for (let d = ot.dist; d <= Math.min(ot.len, ot.dist + reach) + 1e-6; d += 2) {
      this.at(ot, d, p)
      ghost.x = p.x
      ghost.y = p.y
      ghost.heading = p.heading
      if (clearance(cur, ghost) < 0) return true
    }
    return false
  }

  private clearOf(b: Body): boolean {
    const rb = b.half + b.r
    for (const o of this.bodies.values()) {
      if (o.id === b.id) continue
      // broad phase: bounding circles apart -> clear
      const reach = rb + o.half + o.r
      const dx = o.x - b.x, dy = o.y - b.y
      if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue
      if (clearance(b, o) < -1e-6) return false
    }
    return true
  }

  /**
   * Advance every driving vehicle by `dt` minutes ending at sim time `end`.
   * Updates each driving vehicle's phaseEnd (arrival when its track is done).
   */
  step(vehicles: readonly TrafficVehicle[], dt: number, end: number) {
    for (const v of vehicles) this.place(v)
    // Drop tracks of vehicles that stopped driving (arrived / broke down / reassigned).
    for (const v of vehicles) {
      const t = this.tracks.get(v.id)
      if (t && !DRIVING.has(v.phase)) {
        this.tracks.delete(v.id)
        const b = this.bodies.get(v.id)!
        const s = this.slots.get(v.id)
        if (s && t.dist >= t.len - 1e-6) {
          b.x = s.x
          b.y = s.y
          b.heading = s.heading
        }
      }
    }
    if (!(dt > 0)) return
    this.stats.steps++
    const movers = vehicles
      .filter((v) => this.tracks.has(v.id))
      .sort((a, b) => this.tracks.get(a.id)!.start - this.tracks.get(b.id)!.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const probe = { x: 0, y: 0, heading: 0 }
    const rank = new Map<string, number>()
    movers.forEach((v, i) => rank.set(v.id, i))
    for (const v of movers) {
      const t = this.tracks.get(v.id)!
      const b = this.bodies.get(v.id)!
      const want = Math.min(t.len, t.dist + t.speed * dt)
      const ox = b.x, oy = b.y, oh = b.heading
      let moved = false
      // Yield before entering a conflict: if the road just ahead is occupied by a crossing
      // vehicle with right of way (parked, or an earlier-dispatched mover), stop short of it
      // instead of nosing into the junction and locking it.
      const yieldNow = this.mustYield(v.id, t, want, b, rank.get(v.id)!, rank, probe)
      for (const f of yieldNow ? [] : [1, 0.6, 0.3, 0.12]) {
        const d = t.dist + (want - t.dist) * f
        if (d <= t.dist + 1e-6) break
        probe.heading = oh
        this.at(t, d, probe)
        b.x = probe.x
        b.y = probe.y
        b.heading = probe.heading
        if (this.clearOf(b)) {
          t.dist = d
          moved = true
          break
        }
      }
      if (!moved) {
        b.x = ox
        b.y = oy
        b.heading = oh
        t.waited += dt
        this.stats.waits++
        if (t.waited > this.cfg.deadlockMinutes) {
          // Gridlock: hop forward along our own route to the next clear spot.
          for (let d = t.dist + 1, stop = Math.min(t.len, t.dist + 60); d <= stop + 1e-6; d += 1) {
            probe.heading = oh
            this.at(t, d, probe)
            b.x = probe.x
            b.y = probe.y
            b.heading = probe.heading
            if (this.clearOf(b)) {
              t.dist = d
              moved = true
              this.stats.unjams++
              break
            }
          }
          if (!moved && t.waited > this.cfg.deadlockMinutes * 2) {
            // Still boxed in (someone is parked across our slot or the road is shut):
            // re-reserve a clear slot at the destination and pull in there.
            const slot = this.reserveSlot(v, t.dest, b.heading)
            b.x = slot.x
            b.y = slot.y
            b.heading = slot.heading
            if (this.clearOf(b)) {
              t.dist = t.len
              moved = true
              this.stats.reparks++
            }
          }
          if (!moved) {
            b.x = ox
            b.y = oy
            b.heading = oh
          }
        }
      }
      if (moved) t.waited = 0
      const remaining = t.len - t.dist
      ;(v as { phaseEnd: number }).phaseEnd = remaining <= 1e-6 ? end : end + Math.max(remaining / t.speed, 1e-4)
    }
  }

  /** True while this vehicle is held up behind someone. */
  waiting(id: string): boolean {
    return (this.tracks.get(id)?.waited ?? 0) > 0
  }

  /** Pose in node units for poses(). Null when the vehicle is unknown. */
  pose(id: string): { x: number; y: number; heading: number } | null {
    const b = this.bodies.get(id)
    if (!b) return null
    return { x: b.x / this.mpu, y: b.y / this.mpu, heading: b.heading }
  }

  /** Every pair of footprints closer than zero clearance (should always be empty). */
  overlaps(): [string, string][] {
    const out: [string, string][] = []
    const list = [...this.bodies.values()]
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (clearance(list[i], list[j]) < -1e-3) out.push([list[i].id, list[j].id])
    return out
  }

  bodyList(): readonly Body[] {
    return [...this.bodies.values()]
  }
}
