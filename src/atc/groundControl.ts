/**
 * Ground traffic control — segment reservations for aircraft on the airfield.
 *
 * Pure: no three.js, no Game. The sim (or the headless stress harness) feeds it
 * routes as cell keys and asks how far each aircraft may move.
 *
 * Model
 * - Every taxi / stand cell is a node with a FIFO reservation queue. A route is
 *   enqueued on all of its ground cells at once when the aircraft is cleared
 *   (pushback, landing clearance, hangar tow). An aircraft may only roll into a
 *   cell when it is at the head of that cell's queue, and it gives the cell up
 *   once it has fully rolled past it. So two aircraft never share a cell, and
 *   head-on lanes are safe: whoever was cleared first goes first through every
 *   cell the two routes share, in either direction.
 * - Runway cells are not queued. Each runway is one exclusive lock. A lock is
 *   granted once per tick by right of way: arrivals on short final, then aircraft
 *   vacating, then departures, then taxi crossings. A lock is only granted when
 *   the holder already heads every queue on the far side of the runway (up to
 *   its next runway or route end), so the runway holder can never be stopped by
 *   anyone and always clears the runway. Departures wait at the hold line while
 *   an arrival is inside the final window. A departure that is only lined up,
 *   and not sitting on the arrival's exit, does not take the runway.
 * - Queue waits only ever point at earlier clearances, and a lock holder never
 *   waits, so the wait graph has no cycles by construction. `deadlocks()` still
 *   checks every tick as a safety net (legacy saves, a plane registered on an
 *   occupied cell) and the host resolves a cycle by making one aircraft yield.
 */

export type CellKind = 'air' | 'ground' | 'runway'

export interface RouteCell {
  key: string
  kind: CellKind
  /** Runway ids this cell belongs to (crossing runways share cells). */
  runways: readonly string[]
}

export type AtcRole = 'arrival' | 'departure' | 'taxi'

/** Lower is stronger right of way. */
export const RIGHT_OF_WAY = {
  shortFinal: 0,
  vacating: 1,
  departure: 2,
  taxi: 3,
} as const

export interface AtcTuning {
  /** Departures and crossings may not take a runway when an arrival is this close (sim s). */
  finalWindowSec: number
  /** A plane waiting this long counts as a long wait for alerts. */
  longWaitSec: number
}

export const ATC_TUNING: AtcTuning = {
  finalWindowSec: 10,
  longWaitSec: 25,
}

interface Entry {
  id: string
  role: AtcRole
  route: RouteCell[]
  /** Route index the aircraft fully occupies. */
  pos: number
  /** Moving between pos and pos+1. */
  moving: boolean
  /** Remaining visits per ground key at or after pos. */
  visits: Map<string, number>
  locks: Set<string>
  grant: number
  waitSince: number | null
  blocker: string | null
  reason: string
}

export interface WaitInfo {
  id: string
  since: number
  blocker: string | null
  reason: string
  cell: string | null
}

interface RunwayAsk {
  id: string
  rank: number
  runways: string[]
}

export class GroundControl {
  readonly tune: AtcTuning
  private queues = new Map<string, string[]>()
  private entries = new Map<string, Entry>()
  private lockOwner = new Map<string, string>()
  private finals = new Map<string, { runways: string[]; eta: number }>()
  private asks = new Map<string, RunwayAsk>()
  private seq = 0
  now = 0

  constructor(tune: Partial<AtcTuning> = {}) {
    this.tune = { ...ATC_TUNING, ...tune }
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  role(id: string): AtcRole | null {
    return this.entries.get(id)?.role ?? null
  }

  ids(): string[] {
    return [...this.entries.keys()]
  }

  /**
   * Clear an aircraft along `route`, starting at index `pos`.
   * The cell it already sits on goes to the front of its queue (it is physically
   * there); every later ground cell joins the back.
   */
  register(id: string, role: AtcRole, route: RouteCell[], pos = 0): void {
    const keepLocks = this.entries.get(id)?.locks
    this.release(id, true)
    const visits = new Map<string, number>()
    for (let i = Math.max(0, pos); i < route.length; i++) {
      const c = route[i]
      if (c.kind !== 'ground') continue
      visits.set(c.key, (visits.get(c.key) ?? 0) + 1)
    }
    const here = route[pos]
    for (const key of visits.keys()) {
      const q = this.queues.get(key) ?? []
      if (here && here.key === key) q.unshift(id)
      else q.push(id)
      this.queues.set(key, q)
    }
    const entry: Entry = {
      id,
      role,
      route,
      pos: Math.max(0, pos),
      moving: false,
      visits,
      locks: new Set(),
      grant: ++this.seq,
      waitSince: null,
      blocker: null,
      reason: '',
    }
    // A plane already on a runway keeps its lock through a re-clear.
    if (keepLocks) {
      for (const rw of keepLocks) {
        if (this.lockOwner.get(rw) === id || !this.lockOwner.has(rw)) {
          this.lockOwner.set(rw, id)
          entry.locks.add(rw)
        }
      }
    }
    this.entries.set(id, entry)
  }

  /** Drop every reservation and lock the aircraft holds. */
  release(id: string, keepLocksForReclear = false): void {
    const e = this.entries.get(id)
    this.finals.delete(id)
    this.asks.delete(id)
    if (!e) return
    for (const key of e.visits.keys()) this.dequeue(key, id)
    if (!keepLocksForReclear) {
      for (const rw of e.locks) if (this.lockOwner.get(rw) === id) this.lockOwner.delete(rw)
    }
    this.entries.delete(id)
  }

  private dequeue(key: string, id: string) {
    const q = this.queues.get(key)
    if (!q) return
    const i = q.indexOf(id)
    if (i >= 0) q.splice(i, 1)
    if (!q.length) this.queues.delete(key)
  }

  /**
   * Report the aircraft's progress: it fully occupies route[pos]; `moving`
   * means it is part-way to route[pos + 1]. Cells behind it are released, and
   * runway locks it no longer touches are handed back.
   */
  progress(id: string, pos: number, moving = false): void {
    const e = this.entries.get(id)
    if (!e) return
    const next = Math.min(Math.max(pos, 0), e.route.length - 1)
    for (let i = e.pos; i < next; i++) {
      const c = e.route[i]
      if (c.kind !== 'ground') continue
      const left = (e.visits.get(c.key) ?? 1) - 1
      if (left <= 0) {
        e.visits.delete(c.key)
        this.dequeue(c.key, id)
      } else e.visits.set(c.key, left)
    }
    e.pos = next
    e.moving = moving
    this.dropUnusedLocks(e)
  }

  private dropUnusedLocks(e: Entry) {
    if (!e.locks.size) return
    const touching = new Set<string>()
    const here = e.route[e.pos]
    if (here) for (const rw of here.runways) touching.add(rw)
    const ahead = e.moving ? e.route[e.pos + 1] : undefined
    if (ahead) for (const rw of ahead.runways) touching.add(rw)
    // Keep a lock while the next cells are still on that runway (rolling out).
    for (let i = e.pos + 1; i < e.route.length; i++) {
      const c = e.route[i]
      if (c.kind !== 'runway') break
      for (const rw of c.runways) touching.add(rw)
    }
    for (const rw of [...e.locks]) {
      if (touching.has(rw)) continue
      e.locks.delete(rw)
      if (this.lockOwner.get(rw) === id(e)) this.lockOwner.delete(rw)
    }
  }

  /** Airborne after takeoff: hand the runway back. */
  airborne(id: string): void {
    const e = this.entries.get(id)
    if (!e) return
    for (const rw of e.locks) if (this.lockOwner.get(rw) === id) this.lockOwner.delete(rw)
    e.locks.clear()
  }

  /** Arrival on final; `eta` sim seconds to the threshold. */
  onFinal(id: string, runways: string[], eta: number): void {
    this.finals.set(id, { runways, eta })
  }

  offFinal(id: string): void {
    this.finals.delete(id)
  }

  holdsRunway(id: string, rw?: string): boolean {
    const e = this.entries.get(id)
    if (!e) return false
    return rw ? e.locks.has(rw) : e.locks.size > 0
  }

  runwayOwner(rw: string): string | null {
    return this.lockOwner.get(rw) ?? null
  }

  /** Is the aircraft at the head of every ground queue in route[from..to)? */
  private headsRange(e: Entry, from: number, to: number): boolean {
    for (let i = from; i < to; i++) {
      const c = e.route[i]
      if (c.kind !== 'ground') continue
      const q = this.queues.get(c.key)
      if (!q || q[0] !== e.id) return false
    }
    return true
  }

  /** Index range after the runway block starting at `start`, up to the next runway or the end. */
  private exitRange(e: Entry, start: number): [number, number] {
    let i = start
    while (i < e.route.length && e.route[i].kind === 'runway') i++
    let j = i
    while (j < e.route.length && e.route[j].kind !== 'runway') j++
    return [i, j]
  }

  /**
   * Furthest route index the aircraft may roll to this tick. Records why it
   * stopped and files a runway request when the next cell is a runway.
   */
  limit(id: string, rank?: number): number {
    const e = this.entries.get(id)
    if (!e) return Number.MAX_SAFE_INTEGER
    let j = e.pos
    let blocker: string | null = null
    let reason = ''
    while (j + 1 < e.route.length) {
      const c = e.route[j + 1]
      if (c.kind === 'air') {
        j++
        continue
      }
      if (c.kind === 'runway') {
        const missing = c.runways.filter((rw) => !e.locks.has(rw))
        if (missing.length) {
          const r = rank ?? (e.role === 'departure' ? RIGHT_OF_WAY.departure : RIGHT_OF_WAY.taxi)
          this.asks.set(id, { id, rank: r, runways: [...c.runways] })
          blocker = missing.map((rw) => this.lockOwner.get(rw)).find(Boolean) ?? this.finalBlocker(c.runways, id)
          reason = 'runway'
          break
        }
        j++
        continue
      }
      const q = this.queues.get(c.key)
      if (q && q[0] !== id) {
        blocker = q[0]
        reason = 'taxi'
        break
      }
      j++
    }
    const stopped = j + 1 < e.route.length && j === e.pos && !e.moving
    if (stopped) {
      if (e.waitSince === null) e.waitSince = this.now
      e.blocker = blocker
      e.reason = reason
    } else {
      e.waitSince = null
      e.blocker = null
      e.reason = ''
    }
    return j
  }

  private finalBlocker(runways: readonly string[], self: string): string | null {
    for (const [fid, f] of this.finals) {
      if (fid === self) continue
      if (f.eta > this.tune.finalWindowSec || !f.runways.some((rw) => runways.includes(rw))) continue
      // An arrival whose exit is physically occupied cannot clear, so it does not hold departures.
      if (!this.landingReady(fid)) continue
      return fid
    }
    return null
  }

  /** The aircraft's current cell, plus the next cell while it is rolling into it. */
  private occupiedKeys(id: string): string[] {
    const e = this.entries.get(id)
    if (!e) return []
    const keys: string[] = []
    const here = e.route[e.pos]
    if (here) keys.push(here.key)
    if (e.moving) {
      const next = e.route[e.pos + 1]
      if (next) keys.push(next.key)
    }
    return keys
  }

  private onRunway(id: string, rw: string): boolean {
    const e = this.entries.get(id)
    if (!e) return false
    const keys = new Set(this.occupiedKeys(id))
    return e.route.some((c) => c.kind === 'runway' && c.runways.includes(rw) && keys.has(c.key))
  }

  /** Ground cells the arrival must roll after the runway, before the next runway or the stand. */
  private exitSpan(id: string): RouteCell[] {
    const e = this.entries.get(id)
    if (!e) return []
    const start = e.route.findIndex((c, i) => i >= e.pos && c.kind === 'runway')
    if (start < 0) return []
    const [a, b] = this.exitRange(e, start)
    return e.route.slice(a, b).filter((c) => c.kind === 'ground')
  }

  /** Another aircraft is physically on this arrival's exit. Queued-but-not-there does not count. */
  private exitBlocked(id: string): boolean {
    for (const cell of this.exitSpan(id)) {
      const q = this.queues.get(cell.key) ?? []
      if (q.some((other) => other !== id && this.occupiedKeys(other).includes(cell.key))) return true
    }
    return false
  }

  /** Put the arrival first on exit cells nobody is sitting on, so it can clear the runway. */
  private promoteThroughExit(id: string): void {
    for (const cell of this.exitSpan(id)) {
      const q = this.queues.get(cell.key)
      if (!q) continue
      if (q.some((other) => other !== id && this.occupiedKeys(other).includes(cell.key))) continue
      const at = q.indexOf(id)
      if (at > 0) {
        q.splice(at, 1)
        q.unshift(id)
      }
    }
  }

  /** Would a landing clearance be granted now (exit physically clear, ignoring a lineup lock)? */
  landingReady(id: string): boolean {
    const e = this.entries.get(id)
    if (!e) return false
    return !this.exitBlocked(id)
  }

  /** Runway free (or ours) and the exit is clear: a landing clearance would be granted. */
  canLand(id: string, runways: readonly string[]): boolean {
    if (!this.landingReady(id)) return false
    return !runways.some((rw) => {
      const owner = this.lockOwner.get(rw)
      return owner != null && owner !== id && this.onRunway(owner, rw)
    })
  }

  /**
   * Arrival on short final asks for its runway. Granted only when the runway is
   * free and the arrival already heads every queue from the exit to its stand,
   * so it can land and clear without stopping. Returns false → go around.
   */
  requestLanding(id: string, runways: string[]): boolean {
    const e = this.entries.get(id)
    if (!e) return false
    if (runways.every((rw) => e.locks.has(rw))) return true
    for (const rw of runways) {
      const owner = this.lockOwner.get(rw)
      if (!owner || owner === id) continue
      if (this.onRunway(owner, rw)) return false
      // A lineup holds a lock it has not entered. The arrival on final takes it.
      if (this.lockOwner.get(rw) === owner) this.lockOwner.delete(rw)
      this.entries.get(owner)?.locks.delete(rw)
    }
    if (this.exitBlocked(id)) return false
    this.promoteThroughExit(id)
    for (const rw of runways) {
      this.lockOwner.set(rw, id)
      e.locks.add(rw)
    }
    this.finals.delete(id)
    return true
  }

  /** Grant pending runway requests by right of way. Call once per tick. */
  arbitrate(): string[] {
    const granted: string[] = []
    const asks = [...this.asks.values()].sort(
      (a, b) => a.rank - b.rank || (this.entries.get(a.id)?.grant ?? 0) - (this.entries.get(b.id)?.grant ?? 0),
    )
    this.asks.clear()
    for (const ask of asks) {
      const e = this.entries.get(ask.id)
      if (!e) continue
      if (ask.runways.some((rw) => this.lockOwner.has(rw) && this.lockOwner.get(rw) !== ask.id)) continue
      if (ask.rank > RIGHT_OF_WAY.vacating && this.finalBlocker(ask.runways, ask.id)) continue
      const start = e.route.findIndex((c, i) => i > e.pos && c.kind === 'runway')
      if (start >= 0) {
        const [a, b] = this.exitRange(e, start)
        if (!this.headsRange(e, a, b)) continue
      }
      for (const rw of ask.runways) {
        this.lockOwner.set(rw, ask.id)
        e.locks.add(rw)
      }
      granted.push(ask.id)
    }
    return granted
  }

  waiting(): WaitInfo[] {
    const out: WaitInfo[] = []
    for (const e of this.entries.values()) {
      if (e.waitSince === null) continue
      out.push({
        id: e.id,
        since: e.waitSince,
        blocker: e.blocker,
        reason: e.reason,
        cell: e.route[e.pos]?.key ?? null,
      })
    }
    return out
  }

  waitFor(id: string): WaitInfo | null {
    return this.waiting().find((w) => w.id === id) ?? null
  }

  /** Cycles in the wait-for graph. Each cycle lists the aircraft ids in it. */
  deadlocks(): string[][] {
    const edge = new Map<string, string>()
    for (const e of this.entries.values()) {
      if (e.waitSince !== null && e.blocker && this.entries.has(e.blocker)) edge.set(e.id, e.blocker)
    }
    const cycles: string[][] = []
    const done = new Set<string>()
    for (const start of edge.keys()) {
      if (done.has(start)) continue
      const trail: string[] = []
      const seen = new Map<string, number>()
      let cur: string | undefined = start
      while (cur && !done.has(cur) && !seen.has(cur)) {
        seen.set(cur, trail.length)
        trail.push(cur)
        cur = edge.get(cur)
      }
      if (cur && seen.has(cur)) cycles.push(trail.slice(seen.get(cur)))
      for (const t of trail) done.add(t)
    }
    return cycles
  }

  /** Re-clear an aircraft at the back of every queue (keeps its own cell). */
  yieldTo(id: string): void {
    const e = this.entries.get(id)
    if (!e) return
    this.register(id, e.role, e.route, e.pos)
  }

  /** Debug / test view of the reservation queues. */
  queueOf(key: string): readonly string[] {
    return this.queues.get(key) ?? []
  }

  lockCount(): number {
    return this.lockOwner.size
  }
}

function id(e: Entry): string {
  return e.id
}
