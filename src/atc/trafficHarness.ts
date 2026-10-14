/**
 * Headless airfield traffic harness for the ground controller.
 * ASCII layouts: R runway, T taxiway, S stand, anything else grass.
 * Aircraft move cell by cell at the sim's speeds (landing 1.35, taxi 1.1,
 * departure roll 1.2 cells/s) and every move is capped by GroundControl.
 */
import { GroundControl, RIGHT_OF_WAY, type RouteCell } from './groundControl.ts'

export interface HarnessOptions {
  /** Seconds between arrival spawns (flood when small). */
  spawnEverySec: number
  /** Turnaround on stand (s). */
  turnSec: number
  days: number
  dt?: number
  seed?: number
  /** Arrivals that wait longer than this in the stack divert (s). */
  holdDivertSec?: number
  maxGoArounds?: number
  holdStack?: number
  finalWindowSec?: number
}

export interface HarnessReport {
  layout: string
  simHours: number
  landings: number
  takeoffs: number
  movementsPerHour: number
  goArounds: number
  diversions: number
  rejectedAtStack: number
  maxHoldStack: number
  maxGroundWaitSec: number
  avgTaxiOutWaitSec: number
  deadlocks: number
  incursions: number
  overlaps: number
  stalls: number
  vectorSec: number
}

type Ph = 'stack' | 'final' | 'ground_in' | 'turn' | 'ground_out' | 'airborne' | 'done'

interface Plane {
  id: string
  ph: Ph
  route: RouteCell[]
  pos: number
  t: number
  stand: string | null
  runway: string
  timer: number
  goArounds: number
  stackSince: number
  outWait: number
}

const key = (c: number, r: number) => `${c},${r}`

export class Field {
  readonly cells = new Map<string, string>()
  readonly runways = new Map<string, string[]>()
  readonly stands: string[] = []
  readonly rows: string[]
  constructor(rows: string[]) {
    this.rows = rows
    rows.forEach((row, r) => {
      ;[...row].forEach((ch, c) => {
        if ('RTS'.includes(ch)) this.cells.set(key(c, r), ch)
        if (ch === 'S') this.stands.push(key(c, r))
      })
      const runs = [...row.matchAll(/R+/g)]
      for (const m of runs) {
        const id = `rw${r}_${m.index}`
        const strip: string[] = []
        for (let c = m.index!; c < m.index! + m[0].length; c++) strip.push(key(c, r))
        this.runways.set(id, strip)
      }
    })
  }

  runwayOf(k: string): string[] {
    const out: string[] = []
    for (const [id, strip] of this.runways) if (strip.includes(k)) out.push(id)
    return out
  }

  private cellMemo = new Map<string, RouteCell>()
  private routeMemo = new Map<string, string[] | null>()
  cell(k: string): RouteCell {
    const hit = this.cellMemo.get(k)
    if (hit) return hit
    const rws = this.runwayOf(k)
    const out: RouteCell = { key: k, kind: rws.length ? 'runway' : 'ground', runways: rws }
    this.cellMemo.set(k, out)
    return out
  }

  private nbrs(k: string): string[] {
    const [c, r] = k.split(',').map(Number)
    return [key(c + 1, r), key(c - 1, r), key(c, r + 1), key(c, r - 1)].filter((n) => this.cells.has(n))
  }

  /** Stand → runway entry over taxiways (no other stands, no runway until the goal). */
  standToRunway(stand: string, rw: string): string[] | null {
    const strip = new Set(this.runways.get(rw) ?? [])
    const prev = new Map<string, string | null>([[stand, null]])
    const q = [stand]
    while (q.length) {
      const cur = q.shift()!
      if (strip.has(cur)) {
        const path: string[] = []
        for (let p: string | null = cur; p; p = prev.get(p) ?? null) path.unshift(p)
        return path
      }
      for (const n of this.nbrs(cur)) {
        if (prev.has(n)) continue
        const t = this.cells.get(n)
        if (t === 'S') continue
        if (t === 'R' && !strip.has(n)) continue
        prev.set(n, cur)
        q.push(n)
      }
    }
    return null
  }

  /** Same shape as Game.landingRoute: longer runway side → entry → taxi to stand. */
  landingRoute(stand: string, rw: string): string[] | null {
    const mk = `${stand}|${rw}`
    if (!this.routeMemo.has(mk)) this.routeMemo.set(mk, this.buildLanding(stand, rw))
    return this.routeMemo.get(mk)!
  }

  private buildLanding(stand: string, rw: string): string[] | null {
    const toRw = this.standToRunway(stand, rw)
    if (!toRw) return null
    const strip = this.runways.get(rw)!
    const entry = toRw[toRw.length - 1]
    const idx = strip.indexOf(entry)
    const fromStart = strip.slice(0, idx + 1)
    const fromEnd = [...strip].reverse().slice(0, strip.length - idx)
    const approach = fromStart.length >= fromEnd.length ? fromStart : fromEnd
    const merged = [...approach]
    for (const p of [...toRw].reverse()) if (merged[merged.length - 1] !== p) merged.push(p)
    return merged
  }
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function runHarness(name: string, rows: string[], opt: HarnessOptions): HarnessReport {
  const field = new Field(rows)
  const atc = new GroundControl({ finalWindowSec: opt.finalWindowSec ?? 24 })
  const rand = rng(opt.seed ?? 7)
  const dt = opt.dt ?? 0.5
  const holdDivert = opt.holdDivertSec ?? 600
  const maxGA = opt.maxGoArounds ?? 3
  const stackCap = opt.holdStack ?? 10
  const planes: Plane[] = []
  const rwIds = [...field.runways.keys()]
  const rep: HarnessReport = {
    layout: name,
    simHours: 0,
    landings: 0,
    takeoffs: 0,
    movementsPerHour: 0,
    goArounds: 0,
    diversions: 0,
    rejectedAtStack: 0,
    maxHoldStack: 0,
    maxGroundWaitSec: 0,
    avgTaxiOutWaitSec: 0,
    deadlocks: 0,
    incursions: 0,
    overlaps: 0,
    stalls: 0,
    vectorSec: 0,
  }
  let outWaitSum = 0
  let seq = 0
  let spawnIn = 0
  let rr = 0
  const end = opt.days * 86400
  const speed = (p: Plane) => (p.ph === 'ground_out' ? 1.2 : atc.holdsRunway(p.id) ? 1.35 : 1.1)
  const takenStands = () => new Set(planes.filter((p) => p.stand && p.ph !== 'done').map((p) => p.stand!))

  for (let now = 0; now < end; now += dt) {
    atc.now = now
    // Spawns into the holding stack.
    spawnIn -= dt
    if (spawnIn <= 0) {
      spawnIn = opt.spawnEverySec * (0.6 + rand() * 0.8)
      const stack = planes.filter((p) => p.ph === 'stack').length
      if (stack >= stackCap) rep.rejectedAtStack++
      else
        planes.push({
          id: `f${++seq}`,
          ph: 'stack',
          route: [],
          pos: 0,
          t: 0,
          stand: null,
          runway: '',
          timer: 0,
          goArounds: 0,
          stackSince: now,
          outWait: 0,
        })
    }
    rep.maxHoldStack = Math.max(rep.maxHoldStack, planes.filter((p) => p.ph === 'stack').length)

    // Release one arrival per runway from the stack onto final.
    const departuresStarved = (rw: string) =>
      planes.some((p) => p.ph === 'ground_out' && p.runway === rw && p.outWait > 30)
    for (const rw of rwIds) {
      if (planes.some((p) => p.ph === 'final' && p.runway === rw)) continue
      if (departuresStarved(rw)) continue
      const p = planes.find((x) => x.ph === 'stack' && x.timer <= 0)
      if (!p) break
      const taken = takenStands()
      const stand = field.stands.find((s) => !taken.has(s) && field.landingRoute(s, rw))
      if (!stand) break
      const route = field.landingRoute(stand, rw)!.map((k) => field.cell(k))
      p.stand = stand
      p.runway = rw
      p.route = route
      p.pos = 0
      p.t = 0
      p.ph = 'final'
      p.timer = 20
      p.outWait = 0
      atc.register(p.id, 'arrival', route, 0)
    }

    for (const p of planes) {
      if (p.ph === 'stack') {
        p.timer -= dt
        if (now - p.stackSince > holdDivert) {
          p.ph = 'done'
          rep.diversions++
          atc.release(p.id)
        }
        continue
      }
      if (p.ph === 'final') {
        p.timer -= dt
        atc.onFinal(p.id, [p.runway], Math.max(0, p.timer))
        // Vector an arrival round an extended final while its exit is still blocked.
        if (p.timer <= 0 && !atc.canLand(p.id, [p.runway]) && p.outWait < 40) {
          p.outWait += dt
          p.timer = dt
          rep.vectorSec += dt
        }
        if (p.timer <= 0) {
          if (atc.requestLanding(p.id, [p.runway])) {
            p.ph = 'ground_in'
            p.pos = 0
            p.t = 0
          } else {
            rep.goArounds++
            p.goArounds++
            atc.offFinal(p.id)
            if (p.goArounds >= maxGA) {
              p.ph = 'done'
              rep.diversions++
              atc.release(p.id)
            } else {
              p.outWait = 0
              p.ph = 'stack'
              p.timer = 25
              p.stand = null
              atc.release(p.id)
            }
          }
        }
        continue
      }
      if (p.ph === 'turn') {
        p.timer -= dt
        if (p.timer <= 0) {
          const rw = rwIds[rr++ % rwIds.length]
          const ok = field.landingRoute(p.stand!, rw) ? rw : rwIds.find((x) => field.landingRoute(p.stand!, x))!
          const route = [...field.landingRoute(p.stand!, ok)!].reverse().map((k) => field.cell(k))
          p.route = route
          p.runway = ok
          p.pos = 0
          p.t = 0
          p.ph = 'ground_out'
          p.outWait = 0
          atc.register(p.id, 'departure', route, 0)
        }
        continue
      }
      if (p.ph === 'airborne') {
        p.timer -= dt
        if (p.timer <= 0) {
          atc.airborne(p.id)
          atc.release(p.id)
          p.ph = 'done'
          rep.takeoffs++
        }
        continue
      }
      if (p.ph === 'ground_in' || p.ph === 'ground_out') {
        const rank =
          p.ph === 'ground_out' ? RIGHT_OF_WAY.departure : atc.holdsRunway(p.id) ? RIGHT_OF_WAY.vacating : RIGHT_OF_WAY.taxi
        const lim = atc.limit(p.id, rank)
        if (p.pos >= lim && p.t === 0) {
          const w = atc.waitFor(p.id)
          if (w) rep.maxGroundWaitSec = Math.max(rep.maxGroundWaitSec, now - w.since)
          if (p.ph === 'ground_out') p.outWait += dt
          continue
        }
        p.t += speed(p) * dt
        while (p.t >= 1 && p.pos < lim) {
          p.t -= 1
          p.pos++
        }
        if (p.pos >= lim) p.t = Math.min(p.t, p.pos < p.route.length - 1 && p.pos < lim ? p.t : 0)
        atc.progress(p.id, p.pos, p.t > 0)
        if (p.pos >= p.route.length - 1) {
          if (p.ph === 'ground_in') {
            rep.landings++
            atc.release(p.id)
            p.ph = 'turn'
            p.timer = opt.turnSec
          } else {
            p.ph = 'airborne'
            p.timer = 3
            outWaitSum += p.outWait
          }
        }
      }
    }
    atc.arbitrate()

    // Invariants.
    const occ = new Map<string, string>()
    const onRunway = new Map<string, string>()
    for (const p of planes) {
      if (p.ph !== 'ground_in' && p.ph !== 'ground_out' && p.ph !== 'airborne' && p.ph !== 'turn') continue
      const cells =
        p.ph === 'turn'
          ? [field.cell(p.stand!)]
          : p.ph === 'airborne'
            ? [p.route[p.route.length - 1]]
            : [p.route[p.pos], ...(p.t > 0 && p.route[p.pos + 1] ? [p.route[p.pos + 1]] : [])]
      for (const c of cells) {
        const o = occ.get(c.key)
        if (o && o !== p.id) rep.overlaps++
        occ.set(c.key, p.id)
        if (p.ph === 'turn') continue
        for (const rw of c.runways) {
          if (!atc.holdsRunway(p.id, rw)) rep.incursions++
          const other = onRunway.get(rw)
          if (other && other !== p.id) rep.incursions++
          onRunway.set(rw, p.id)
        }
      }
    }
    const cyc = atc.deadlocks()
    if (cyc.length) {
      rep.deadlocks += cyc.length
      // Resolution: the latest-cleared taxiing aircraft in the cycle yields.
      for (const c of cyc) atc.yieldTo(c[c.length - 1])
    }
    for (const w of atc.waiting()) if (now - w.since > 900) rep.stalls++
    for (let i = planes.length - 1; i >= 0; i--) if (planes[i].ph === 'done') planes.splice(i, 1)
  }
  rep.simHours = end / 3600
  rep.movementsPerHour = Math.round(((rep.landings + rep.takeoffs) / rep.simHours) * 10) / 10
  rep.avgTaxiOutWaitSec = rep.takeoffs ? Math.round(outWaitSum / rep.takeoffs) : 0
  return rep
}

export const LAYOUTS: Record<string, string[]> = {
  /** One runway, one taxiway stub onto it — every movement shares one lane. */
  oneRunwaySingleEntry: [
    'RRRRRRRRRRRRRRRRRRRR',
    '..........T.........',
    '..........T.........',
    '....TTTTTTTTTTTT....',
    '....S.S.S.S.S.S.....',
  ],
  /** One runway, parallel taxiway, entries at both ends. */
  oneRunwayParallel: [
    'RRRRRRRRRRRRRRRRRRRR',
    '..T..............T..',
    '..TTTTTTTTTTTTTTTT..',
    '...S.S.S.S.S.S.S....',
  ],
  /** Two runways either side of a shared apron. */
  twoRunways: [
    'RRRRRRRRRRRRRRRRRRRR',
    '..T..............T..',
    '..TTTTTTTTTTTTTTTT..',
    '...S.S.S.S.S.S.S....',
    '..TTTTTTTTTTTTTTTT..',
    '..T..............T..',
    'RRRRRRRRRRRRRRRRRRRR',
  ],
}
