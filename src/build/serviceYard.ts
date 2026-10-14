/**
 * Service yard: assigns vehicles to a specific building's service points,
 * queues them in slots when every point is busy, drives the final approach,
 * holds them through a visible action, then rolls them out the exit lane.
 *
 * Pure sim (no three.js). Throughput is bounded by the number of points, so a
 * one-hose farm visibly backs up fuel trucks where a two-hose farm does not.
 */
import type { Tile, Vec } from '../game/types'
import type { Lot } from './footprints'
import { worldPoints, type ServiceAction, type VehicleKind, type WorldSpec } from './servicePoints'

export type YardPhase = 'queue' | 'approach' | 'work' | 'exit'

export interface YardJob {
  vehicleId: string
  kind: VehicleKind
  key: string
  point: number
  phase: YardPhase
  /** Seconds into the current phase. */
  t: number
  work: number
  from: { c: number; r: number }
  action: ServiceAction | null
  /** Current pose. */
  c: number
  r: number
  heading: number
  /** 0..1 progress through the work phase (drives hose/lift/door animation). */
  progress: number
}

interface Site {
  key: string
  tile: Tile
  anchor: Vec
  spec: WorldSpec
  occ: (string | null)[]
  queue: string[]
  served: number
}

const APPROACH_SEC = 1.3
const EXIT_SEC = 1.0

export interface YardBuilding {
  key: string
  tile: Tile
  anchor: Vec
  lot?: Lot | null
}

export class ServiceYard {
  private sites = new Map<string, Site>()
  private jobs = new Map<string, YardJob>()
  private sig = ''

  /** Rebuild the building list (cheap when unchanged). Jobs at removed buildings are dropped. */
  sync(buildings: readonly YardBuilding[]) {
    const sig = buildings.map((b) => `${b.key}:${b.tile}:${b.lot ? `${b.lot.w}${b.lot.d}${b.lot.dir.c}${b.lot.dir.r}` : ''}`).join('|')
    if (sig === this.sig) return
    this.sig = sig
    const next = new Map<string, Site>()
    for (const b of buildings) {
      const spec = worldPoints(b.tile, b.anchor, b.lot)
      if (!spec || !spec.points.length) continue
      const old = this.sites.get(b.key)
      next.set(b.key, {
        key: b.key,
        tile: b.tile,
        anchor: b.anchor,
        spec,
        occ: old && old.occ.length === spec.points.length ? old.occ : spec.points.map(() => null),
        queue: old?.queue ?? [],
        served: old?.served ?? 0,
      })
    }
    this.sites = next
    for (const [id, j] of this.jobs) if (!this.sites.has(j.key)) this.jobs.delete(id)
  }

  /** Does this building take this vehicle kind? */
  serves(key: string, kind: VehicleKind): boolean {
    return Boolean(this.sites.get(key)?.spec.serves.includes(kind))
  }

  /**
   * A vehicle reached a building. The yard takes control: it docks at a free
   * point or joins the queue. Returns false when the building has no points for it.
   */
  arrive(vehicleId: string, kind: VehicleKind, key: string, at: { c: number; r: number }, workSec: number): boolean {
    const site = this.sites.get(key)
    if (!site || !site.spec.serves.includes(kind)) return false
    if (this.jobs.has(vehicleId)) return true
    const job: YardJob = {
      vehicleId, kind, key, point: -1, phase: 'queue', t: 0, work: Math.max(0.2, workSec),
      from: { ...at }, action: null, c: at.c, r: at.r, heading: 0, progress: 0,
    }
    this.jobs.set(vehicleId, job)
    site.queue.push(vehicleId)
    this.admit(site)
    return true
  }

  /** Start a vehicle already inside the building (fire tender in its bay) on its way out. */
  depart(vehicleId: string, kind: VehicleKind, key: string): YardJob | null {
    const site = this.sites.get(key)
    if (!site || !site.spec.serves.includes(kind)) return null
    let idx = site.occ.findIndex((o) => o == null)
    if (idx < 0) idx = 0
    const p = site.spec.points[idx]!
    site.occ[idx] = vehicleId
    const job: YardJob = {
      vehicleId, kind, key, point: idx, phase: 'exit', t: 0, work: 0,
      from: { c: p.c, r: p.r }, action: p.action, c: p.c, r: p.r, heading: p.heading, progress: 1,
    }
    this.jobs.set(vehicleId, job)
    return job
  }

  private admit(site: Site) {
    while (site.queue.length) {
      const free = site.occ.findIndex((o) => o == null)
      if (free < 0) break
      const id = site.queue.shift()!
      const job = this.jobs.get(id)
      if (!job) continue
      site.occ[free] = id
      job.point = free
      job.phase = 'approach'
      job.t = 0
      job.from = { c: job.c, r: job.r }
      job.action = site.spec.points[free]!.action
    }
    // Waiting vehicles line up in slots.
    site.queue.forEach((id, i) => {
      const job = this.jobs.get(id)
      const slot = site.spec.queue[Math.min(i, site.spec.queue.length - 1)] ?? site.spec.approach
      if (job) {
        job.c = slot.c
        job.r = slot.r
        job.heading = Math.atan2(site.spec.points[0]!.r - slot.r, site.spec.points[0]!.c - slot.c)
      }
    })
  }

  job(vehicleId: string): YardJob | undefined {
    return this.jobs.get(vehicleId)
  }

  /** Advance one vehicle. Returns 'hold' while the yard owns it, 'released' the tick it leaves, null if not ours. */
  step(vehicleId: string, dt: number): 'hold' | 'released' | null {
    const job = this.jobs.get(vehicleId)
    if (!job) return null
    const site = this.sites.get(job.key)
    if (!site) {
      this.jobs.delete(vehicleId)
      return 'released'
    }
    job.t += dt
    if (job.phase === 'queue') return 'hold'
    const p = site.spec.points[job.point]!
    if (job.phase === 'approach') {
      const k = Math.min(1, job.t / APPROACH_SEC)
      const e = k * k * (3 - 2 * k)
      // Back-in docks: swing past the dock, then reverse onto the bumpers.
      job.c = job.from.c + (p.c - job.from.c) * e
      job.r = job.from.r + (p.r - job.from.r) * e
      const move = Math.atan2(p.r - job.from.r, p.c - job.from.c)
      job.heading = job.action === 'backin' ? (k < 0.5 ? move : p.heading + Math.PI) : k < 0.85 ? move : p.heading
      if (k >= 1) {
        job.phase = 'work'
        job.t = 0
        job.heading = job.action === 'backin' ? p.heading + Math.PI : p.heading
      }
      return 'hold'
    }
    if (job.phase === 'work') {
      job.progress = Math.min(1, job.t / job.work)
      if (job.t >= job.work) {
        job.phase = 'exit'
        job.t = 0
        job.from = { c: job.c, r: job.r }
      }
      return 'hold'
    }
    // exit
    const k = Math.min(1, job.t / EXIT_SEC)
    const to = site.spec.exit
    job.c = job.from.c + (to.c - job.from.c) * k
    job.r = job.from.r + (to.r - job.from.r) * k
    job.heading = Math.atan2(to.r - job.from.r, to.c - job.from.c)
    job.progress = 1 - k
    if (k >= 1) {
      site.occ[job.point] = null
      site.served++
      this.jobs.delete(vehicleId)
      this.admit(site)
      return 'released'
    }
    return 'hold'
  }

  /** Drop a vehicle (despawned / cancelled). */
  forget(vehicleId: string) {
    const job = this.jobs.get(vehicleId)
    if (!job) return
    const site = this.sites.get(job.key)
    if (site) {
      if (job.point >= 0 && site.occ[job.point] === vehicleId) site.occ[job.point] = null
      site.queue = site.queue.filter((id) => id !== vehicleId)
      this.admit(site)
    }
    this.jobs.delete(vehicleId)
  }

  /** Points in use (docked or working) at a building. */
  occupancy(key: string): number {
    return this.sites.get(key)?.occ.filter(Boolean).length ?? 0
  }

  /** Per point: whether its vehicle is inside the work/exit phase (doors open etc). */
  activePoints(key: string): boolean[] {
    const site = this.sites.get(key)
    if (!site) return []
    return site.occ.map((id) => {
      const j = id ? this.jobs.get(id) : undefined
      return Boolean(j && (j.phase === 'work' || j.phase === 'approach' || j.phase === 'exit'))
    })
  }

  queueLength(key: string): number {
    return this.sites.get(key)?.queue.length ?? 0
  }

  served(key: string): number {
    return this.sites.get(key)?.served ?? 0
  }

  allJobs(): YardJob[] {
    return [...this.jobs.values()]
  }

  keys(): string[] {
    return [...this.sites.keys()]
  }

  spec(key: string): WorldSpec | undefined {
    return this.sites.get(key)?.spec
  }

  tileOf(key: string): Tile | undefined {
    return this.sites.get(key)?.tile
  }
}
