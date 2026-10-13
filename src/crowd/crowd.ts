import { SpatialHash } from './spatialHash'
import { AgentState, type Door, type Vec2, type Wall, type Waypoint } from './types'

/**
 * Lightweight pedestrian steering for the terminal crowd.
 *
 * Model: Helbing-style social force (goal drive + exponential repulsion from
 * people and walls) with an RVO-flavoured anticipation term — if someone is
 * on a collision course within `horizon` seconds, the walker sidesteps early
 * (always to its right, so counter-flows lane up instead of dancing).
 *
 * Queue-aware: people standing in a queue line are heavy, near-immovable
 * obstacles with an extra-wide personal space. Walkers route around the line
 * rather than through it, and queuers spring to evenly spaced slots along the
 * queue polyline, so lines read as lines, not blobs.
 *
 * Doorways meter flow with a token bucket (width × 1.3 p/m/s), so a narrow
 * door in a player layout produces honest, emergent back-ups.
 */
export interface CrowdOptions {
  /** Neighbour search radius, metres. */
  neighbourRadius?: number
  /** Social-force strength (m/s²) and range (m). */
  repulseA?: number
  repulseB?: number
  wallA?: number
  wallB?: number
  /** Relaxation time toward preferred velocity, seconds. */
  tau?: number
  /** Anticipation horizon for sidestepping, seconds. */
  horizon?: number
  /** Extra clearance walkers keep from queuers, metres. */
  queueClearance?: number
  /** Distance to count a waypoint reached, metres. */
  arriveRadius?: number
}

export interface AgentSpec {
  pos: Vec2
  route: Waypoint[]
  radius?: number
  /** Preferred walking speed m/s (≈1.34 adult, 1.0 family, 1.6 rushing). */
  speed?: number
}

interface QueueLine {
  id: string
  /** Polyline from the service point (index 0) backwards. */
  path: Vec2[]
  spacing: number
  members: number[]
}

const DEFAULTS: Required<CrowdOptions> = {
  neighbourRadius: 1.6,
  repulseA: 2.1,
  repulseB: 0.3,
  wallA: 5,
  wallB: 0.12,
  tau: 0.5,
  horizon: 1.8,
  queueClearance: 0.35,
  arriveRadius: 0.45,
}

export class Crowd {
  readonly opt: Required<CrowdOptions>
  n = 0
  cap: number
  x: Float32Array
  z: Float32Array
  vx: Float32Array
  vz: Float32Array
  radius: Float32Array
  speed: Float32Array
  state: Uint8Array
  alive: Uint8Array
  routes: Waypoint[][] = []
  leg: Int32Array
  /** Queue index (-1 none) and slot for Queued agents. */
  queueOf: Int32Array
  walls: Wall[] = []
  private doors = new Map<string, Door & { tokens: number; rate: number; passed: number }>()
  private queues: QueueLine[] = []
  private queueIdx = new Map<string, number>()
  private hash: SpatialHash
  private free: number[] = []
  private doorPass: Uint8Array
  private stampGen = 1

  constructor(opts: CrowdOptions = {}, capacity = 1024) {
    this.opt = { ...DEFAULTS, ...opts }
    this.cap = capacity
    this.x = new Float32Array(capacity)
    this.z = new Float32Array(capacity)
    this.vx = new Float32Array(capacity)
    this.vz = new Float32Array(capacity)
    this.radius = new Float32Array(capacity)
    this.speed = new Float32Array(capacity)
    this.state = new Uint8Array(capacity)
    this.alive = new Uint8Array(capacity)
    this.leg = new Int32Array(capacity)
    this.queueOf = new Int32Array(capacity).fill(-1)
    this.doorPass = new Uint8Array(capacity)
    this.hash = new SpatialHash(this.opt.neighbourRadius * 0.75)
  }

  private grow() {
    const c = this.cap * 2
    const g = <T extends Float32Array | Uint8Array | Int32Array | Uint32Array>(a: T, fill = 0): T => {
      const b = new (a.constructor as new (n: number) => T)(c)
      b.set(a)
      if (fill) b.fill(fill as never, a.length)
      return b
    }
    this.x = g(this.x)
    this.z = g(this.z)
    this.vx = g(this.vx)
    this.vz = g(this.vz)
    this.radius = g(this.radius)
    this.speed = g(this.speed)
    this.state = g(this.state)
    this.alive = g(this.alive)
    this.leg = g(this.leg)
    this.queueOf = g(this.queueOf, -1)
    this.doorPass = g(this.doorPass)
    this.cap = c
  }

  // ── setup ────────────────────────────────────────────────────────────────

  addWalls(walls: Wall[]) {
    this.walls.push(...walls)
  }

  addDoor(d: Door) {
    const w = Math.hypot(d.bx - d.ax, d.bz - d.az)
    const rate = w * (d.flowPerMeter ?? 1.3)
    this.doors.set(d.id, { ...d, tokens: 1, rate, passed: 0 })
  }

  doorPassed(id: string): number {
    return this.doors.get(id)?.passed ?? 0
  }

  addQueue(id: string, path: Vec2[], spacing = 0.65): void {
    this.queueIdx.set(id, this.queues.length)
    this.queues.push({ id, path, spacing, members: [] })
  }

  queueLength(id: string): number {
    const q = this.queues[this.queueIdx.get(id) ?? -1]
    return q ? q.members.length : 0
  }

  /** Slot position `k` places back from the service point along the polyline. */
  slotPos(id: string, k: number): Vec2 {
    const q = this.queues[this.queueIdx.get(id)!]
    let d = k * q.spacing
    for (let s = 0; s < q.path.length - 1; s++) {
      const a = q.path[s]
      const b = q.path[s + 1]
      const L = Math.hypot(b.x - a.x, b.z - a.z)
      if (d <= L || s === q.path.length - 2) {
        const t = L > 0 ? Math.min(d / L, s === q.path.length - 2 ? Infinity : 1) : 0
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
      }
      d -= L
    }
    return { ...q.path[0] }
  }

  addAgent(spec: AgentSpec): number {
    let i: number
    if (this.free.length) i = this.free.pop()!
    else {
      if (this.n >= this.cap) this.grow()
      i = this.n++
    }
    this.x[i] = spec.pos.x
    this.z[i] = spec.pos.z
    this.vx[i] = 0
    this.vz[i] = 0
    this.radius[i] = spec.radius ?? 0.25
    this.speed[i] = spec.speed ?? 1.34
    this.state[i] = spec.route.length ? AgentState.Walking : AgentState.Arrived
    this.alive[i] = 1
    this.routes[i] = spec.route
    this.leg[i] = 0
    this.queueOf[i] = -1
    this.doorPass[i] = 0
    return i
  }

  removeAgent(i: number) {
    if (!this.alive[i]) return
    this.leaveQueue(i)
    this.alive[i] = 0
    this.free.push(i)
  }

  /** Drop a queue slot and walk `route`. */
  release(i: number, route: Waypoint[]) {
    if (!this.alive[i]) return
    this.leaveQueue(i)
    this.setRoute(i, route)
  }

  setRoute(i: number, route: Waypoint[]) {
    this.routes[i] = route
    this.leg[i] = 0
    if (this.state[i] !== AgentState.Queued) {
      this.state[i] = route.length ? AgentState.Walking : AgentState.Arrived
    }
  }

  /** Put agent at the tail of a queue line. It walks to its slot with avoidance. */
  joinQueue(i: number, id: string) {
    const qi = this.queueIdx.get(id)
    if (qi == null) throw new Error(`no queue ${id}`)
    this.leaveQueue(i)
    this.queues[qi].members.push(i)
    this.queueOf[i] = qi
    this.state[i] = AgentState.Queued
  }

  /** Service point takes the head of the line; it resumes `route`. Returns agent or -1. */
  serveHead(id: string, route: Waypoint[]): number {
    const q = this.queues[this.queueIdx.get(id) ?? -1]
    if (!q || !q.members.length) return -1
    const i = q.members.shift()!
    this.queueOf[i] = -1
    this.state[i] = AgentState.Walking
    this.setRoute(i, route)
    return i
  }

  private leaveQueue(i: number) {
    const qi = this.queueOf[i]
    if (qi < 0) return
    const m = this.queues[qi].members
    const k = m.indexOf(i)
    if (k >= 0) m.splice(k, 1)
    this.queueOf[i] = -1
  }

  // ── tick ─────────────────────────────────────────────────────────────────

  step(dt: number) {
    const o = this.opt
    const n = this.n
    for (const d of this.doors.values()) d.tokens = Math.min(1, d.tokens + d.rate * dt)
    // Arrived agents are handed back to the sim and stop occupying space.
    if (this.active.length < n) this.active = new Uint8Array(this.cap)
    for (let i = 0; i < n; i++) this.active[i] = this.alive[i] && this.state[i] !== AgentState.Arrived ? 1 : 0
    this.hash.build(this.x, this.z, n, this.active)

    // Queue slot targets.
    const tx = new Float32Array(n)
    const tz = new Float32Array(n)
    const hasT = new Uint8Array(n)
    for (const q of this.queues) {
      for (let k = 0; k < q.members.length; k++) {
        const i = q.members[k]
        const p = this.slotPos(q.id, k)
        tx[i] = p.x
        tz[i] = p.z
        hasT[i] = 1
      }
    }

    const ax = new Float32Array(n)
    const az = new Float32Array(n)
    const R = o.neighbourRadius

    for (let i = 0; i < n; i++) {
      if (!this.alive[i] || this.state[i] === AgentState.Arrived) continue
      const xi = this.x[i]
      const zi = this.z[i]
      let gx = 0
      let gz = 0
      let want = this.speed[i]
      const st = this.state[i]

      if (st === AgentState.Queued && hasT[i]) {
        gx = tx[i] - xi
        gz = tz[i] - zi
        const d = Math.hypot(gx, gz)
        // Arrive: slow into the slot, shuffle forward when the line moves.
        want = Math.min(this.speed[i] * 0.8, d * 1.5)
        if (d > 1e-4) {
          gx /= d
          gz /= d
        }
      } else {
        const route = this.routes[i]
        let wp = route[this.leg[i]]
        let d = Math.hypot(wp.x - xi, wp.z - zi)
        while (d < o.arriveRadius) {
          if (wp.doorId) this.doorPass[i] = 0
          this.leg[i]++
          if (this.leg[i] >= route.length) {
            this.state[i] = AgentState.Arrived
            this.vx[i] = 0
            this.vz[i] = 0
            break
          }
          wp = route[this.leg[i]]
          d = Math.hypot(wp.x - xi, wp.z - zi)
        }
        if (this.state[i] === AgentState.Arrived) continue
        // Door metering: near a door waypoint, take a throughput token or wait.
        if (wp.doorId && !this.doorPass[i]) {
          const door = this.doors.get(wp.doorId)
          if (door) {
            const dd = Math.hypot((door.ax + door.bx) / 2 - xi, (door.az + door.bz) / 2 - zi)
            if (dd < 1.2) {
              if (door.tokens >= 1) {
                door.tokens -= 1
                door.passed++
                this.doorPass[i] = 1
                this.state[i] = AgentState.Walking
              } else {
                this.state[i] = AgentState.DoorWait
                want = 0
              }
            }
          }
        }
        gx = wp.x - xi
        gz = wp.z - zi
        const dl = Math.hypot(gx, gz) || 1
        gx /= dl
        gz /= dl
      }

      // Goal drive.
      let fx = (gx * want - this.vx[i]) / o.tau
      let fz = (gz * want - this.vz[i]) / o.tau

      // Neighbours.
      const gen = ++this.stampGen
      const ri = this.radius[i]
      const myQueued = st === AgentState.Queued
      const vxi = this.vx[i]
      const vzi = this.vz[i]
      let sideX = 0
      let sideZ = 0
      let soonest = Infinity
      this.hash.query(xi, zi, R, (j) => {
        if (j === i) return
        if (this.lastSeen(j) === gen) return
        this.markSeen(j, gen)
        let dx = xi - this.x[j]
        let dz = zi - this.z[j]
        let dist = Math.hypot(dx, dz)
        if (dist > R) return
        if (dist < 1e-5) {
          dx = ((i * 7919) % 13) / 13 - 0.5
          dz = ((i * 104729) % 17) / 17 - 0.5
          dist = Math.hypot(dx, dz)
        }
        const nx = dx / dist
        const nz = dz / dist
        const jQueued = this.state[j] === AgentState.Queued
        // Walkers give queue lines extra room; queuers barely react to walkers.
        let rr = ri + this.radius[j]
        let A = o.repulseA
        if (jQueued && !myQueued) {
          rr += o.queueClearance
          A *= 2.5
        } else if (myQueued && !jQueued) {
          A *= 0.15
        } else if (myQueued && jQueued) {
          // Same line: keep apart along the line only lightly; slots do the rest.
          A *= 0.6
        }
        // Anisotropy: people ahead matter more than people behind.
        const cosv = vxi * -nx + vzi * -nz
        const sp = Math.hypot(vxi, vzi) || 1
        const lam = 0.35 + 0.65 * (1 + cosv / sp) * 0.5
        const mag = A * Math.exp((rr - dist) / o.repulseB) * lam
        fx += nx * mag
        fz += nz * mag

        // RVO-ish anticipation: time to closest approach.
        if (!myQueued) {
          const rvx = vxi - this.vx[j]
          const rvz = vzi - this.vz[j]
          const rv2 = rvx * rvx + rvz * rvz
          if (rv2 > 1e-4) {
            const t = (dx * -rvx + dz * -rvz) / rv2 // >0 when approaching
            if (t > 0 && t < o.horizon && t < soonest) {
              // Miss distance at closest approach.
              const px = dx + rvx * t
              const pz = dz + rvz * t
              if (Math.hypot(px, pz) < rr + 0.25) {
                soonest = t
                // Sidestep to own right of heading (heading=(vx,vz) → right=(vz,-vx)).
                const h = Math.hypot(vxi, vzi) || 1
                sideX = vzi / h
                sideZ = -vxi / h
              }
            }
          }
        }
      })
      if (soonest < Infinity) {
        const k = (1 - soonest / o.horizon) * 1.6 * this.speed[i]
        fx += sideX * k / o.tau
        fz += sideZ * k / o.tau
      }

      // Walls.
      for (const w of this.walls) {
        const c = closestOnSeg(xi, zi, w)
        let dx = xi - c.x
        let dz = zi - c.z
        const dist = Math.hypot(dx, dz)
        if (dist > 1.0 || dist < 1e-6) continue
        dx /= dist
        dz /= dist
        const mag = o.wallA * Math.exp((ri - dist) / o.wallB)
        fx += dx * mag
        fz += dz * mag
      }
      ax[i] = fx
      az[i] = fz
    }

    // Integrate.
    for (let i = 0; i < n; i++) {
      if (!this.alive[i] || this.state[i] === AgentState.Arrived) continue
      let vx = this.vx[i] + ax[i] * dt
      let vz = this.vz[i] + az[i] * dt
      const vmax = this.speed[i] * 1.3
      const v = Math.hypot(vx, vz)
      if (v > vmax) {
        vx *= vmax / v
        vz *= vmax / v
      }
      this.vx[i] = vx
      this.vz[i] = vz
      const nx = this.x[i] + vx * dt
      const nz = this.z[i] + vz * dt
      // Hard wall constraint: never tunnel through a wall segment.
      if (!this.crossesWall(this.x[i], this.z[i], nx, nz)) {
        this.x[i] = nx
        this.z[i] = nz
      } else {
        this.vx[i] *= 0.2
        this.vz[i] *= 0.2
      }
    }
    this.resolveOverlaps()
  }

  /** One relaxation pass so bodies never visibly interpenetrate. Queuers are heavy. */
  private resolveOverlaps() {
    const n = this.n
    for (let i = 0; i < n; i++) {
      if (!this.active[i]) continue
      const gen = ++this.stampGen
      this.hash.query(this.x[i], this.z[i], 0.8, (j) => {
        if (j <= i || !this.active[j] || this.lastSeen(j) === gen) return
        this.markSeen(j, gen)
        const dx = this.x[i] - this.x[j]
        const dz = this.z[i] - this.z[j]
        const d = Math.hypot(dx, dz)
        const rr = this.radius[i] + this.radius[j]
        if (d >= rr || d < 1e-6) return
        const qi = this.state[i] === AgentState.Queued ? 0.1 : 1
        const qj = this.state[j] === AgentState.Queued ? 0.1 : 1
        const push = (rr - d) / (qi + qj)
        const nx = dx / d
        const nz = dz / d
        const mx = nx * push * qi
        const mz = nz * push * qi
        if (!this.crossesWall(this.x[i], this.z[i], this.x[i] + mx, this.z[i] + mz)) {
          this.x[i] += mx
          this.z[i] += mz
        }
        const ox = -nx * push * qj
        const oz = -nz * push * qj
        if (!this.crossesWall(this.x[j], this.z[j], this.x[j] + ox, this.z[j] + oz)) {
          this.x[j] += ox
          this.z[j] += oz
        }
      })
    }
  }

  private active = new Uint8Array(0)
  private seen = new Uint32Array(0)
  private lastSeen(j: number) {
    return this.seen.length > j ? this.seen[j] : 0
  }
  private markSeen(j: number, g: number) {
    if (this.seen.length < this.cap) {
      const s = new Uint32Array(this.cap)
      s.set(this.seen)
      this.seen = s
    }
    this.seen[j] = g
  }

  private crossesWall(x0: number, z0: number, x1: number, z1: number): boolean {
    for (const w of this.walls) if (segCross(x0, z0, x1, z1, w.ax, w.az, w.bx, w.bz)) return true
    return false
  }
}

function closestOnSeg(px: number, pz: number, w: Wall): Vec2 {
  const ex = w.bx - w.ax
  const ez = w.bz - w.az
  const L2 = ex * ex + ez * ez || 1
  const t = Math.max(0, Math.min(1, ((px - w.ax) * ex + (pz - w.az) * ez) / L2))
  return { x: w.ax + ex * t, z: w.az + ez * t }
}

function segCross(
  ax: number, az: number, bx: number, bz: number,
  cx: number, cz: number, dx: number, dz: number,
): boolean {
  const o1 = orient(ax, az, bx, bz, cx, cz)
  const o2 = orient(ax, az, bx, bz, dx, dz)
  const o3 = orient(cx, cz, dx, dz, ax, az)
  const o4 = orient(cx, cz, dx, dz, bx, bz)
  return o1 * o2 < 0 && o3 * o4 < 0
}

function orient(ax: number, az: number, bx: number, bz: number, cx: number, cz: number) {
  return Math.sign((bx - ax) * (cz - az) - (bz - az) * (cx - ax))
}
