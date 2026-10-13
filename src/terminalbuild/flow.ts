/**
 * Passenger and bag flow through a built layout. Pure and deterministic.
 *
 * Departures: curb -> check-in desk -> security lane -> boarding desk of the
 * flight's gate. Bags ride the belts from the desk to a make-up carousel.
 * Arrivals: gate apron door -> exit door -> curb.
 *
 * Each desk, lane, and carousel is a single server. Passengers are handled in
 * show-up order and take the server that frees up soonest, so queues come
 * only from the kit the player built and where they put it. Nobody is
 * spawned, capped, or dropped except by the layout or the clock.
 */
import { BUILD_TUNING, EQUIP_SPEC } from './config.ts'
import { flood, indexLayout, tileKey, walkStep, type GridIndex } from './grid.ts'
import type { BuildLayout, Equip, Tile } from './types.ts'
import { bagRoute, makeupReachesApron, reachOf, serviceTiles } from './validate.ts'

export interface FlowFlight {
  id: string
  /** Gate room id. Defaults to the first gate room. */
  gate?: string
  /** Seconds from the start of the run. */
  departSec: number
  departing: number
  arriveSec?: number
  arriving?: number
  bagsPerPax: number
}

export interface FlowReport {
  departing: number
  boarded: number
  lostPax: number
  bagsChecked: number
  bagsLoaded: number
  lostBags: number
  arriving: number
  exited: number
  lostArrivals: number
  /** Worst wait at any one server, seconds. */
  maxWaitSec: number
  /** The layout with kit wear advanced by use. */
  layout: BuildLayout
}

interface Server {
  eq: Equip
  freeAt: number
  uses: number
}

const isLaneAt = (ix: GridIndex, t: Tile) => ix.equipAt.get(tileKey(t.x, t.y))?.kind === 'security_lane'

function serviceSec(eq: Equip): number {
  const base = EQUIP_SPEC[eq.kind].serviceSec
  return base * (1 + (BUILD_TUNING.wornSlowdown - 1) * Math.min(1, eq.wear / 100))
}

const walkSec = (tiles: number) => (tiles * BUILD_TUNING.tileMetres) / BUILD_TUNING.walkMps

export function runFlow(l: BuildLayout, flights: readonly FlowFlight[]): FlowReport {
  const ix = indexLayout(l)
  const R = reachOf(l, ix)
  const T = BUILD_TUNING
  const servers = new Map<string, Server>(l.equipment.map((eq) => [eq.id, { eq, freeAt: 0, uses: 0 }]))
  const gateRooms = l.rooms.filter((r) => r.kind === 'gate')

  // Lanes are walked into only as the security stop itself, never as a corridor.
  const noLanes = walkStep(l, ix, 'depart', (t) => isLaneAt(ix, t))
  const fromCurb = flood(R.curb, noLanes).dist
  const tileDist = (from: Tile) => flood([from], noLanes).dist
  const nearest = (dist: Map<string, number>, tiles: Tile[]) =>
    tiles.reduce((best, t) => Math.min(best, dist.get(tileKey(t.x, t.y)) ?? Infinity), Infinity)

  // Check-in desks that can take bags all the way to a carousel that reaches the apron.
  const deskBags = new Map<string, { carousel: Equip; beltTiles: number } | null>()
  for (const d of l.equipment.filter((e) => e.kind === 'checkin_desk')) {
    const route = bagRoute(l, ix, d)
    deskBags.set(d.id, route && makeupReachesApron(l, ix, route.carousel) ? route : null)
  }

  let maxWait = 0
  const serve = (s: Server, arriveAt: number) => {
    const start = Math.max(arriveAt, s.freeAt)
    maxWait = Math.max(maxWait, start - arriveAt)
    s.freeAt = start + serviceSec(s.eq)
    s.uses++
    return s.freeAt
  }
  /** Pick the server of a kind with the earliest finish, given walk distances from `dist`. */
  const pickServer = (kind: Equip['kind'], dist: Map<string, number>, t0: number, only?: (e: Equip) => boolean) => {
    let best: { s: Server; tile: Tile; arrive: number; done: number } | null = null
    for (const s of servers.values()) {
      if (s.eq.kind !== kind || (only && !only(s.eq))) continue
      const tiles = serviceTiles(l, ix, s.eq)
      const d = nearest(dist, tiles)
      if (!Number.isFinite(d)) continue
      const arrive = t0 + walkSec(d)
      const done = Math.max(arrive, s.freeAt) + serviceSec(s.eq)
      if (!best || done < best.done) {
        const tile = tiles.find((t) => dist.get(tileKey(t.x, t.y)) === d)!
        best = { s, tile, arrive, done }
      }
    }
    return best
  }

  let departing = 0
  let boarded = 0
  let bagsChecked = 0
  let bagsLoaded = 0
  let arriving = 0
  let exited = 0

  type Pax = { flight: FlowFlight; at: number }
  const queue: Pax[] = []
  for (const f of flights) {
    const span = T.showUpEarlySec - T.showUpLateSec
    for (let i = 0; i < f.departing; i++) {
      const at = f.departSec - T.showUpEarlySec + (f.departing > 1 ? (span * i) / (f.departing - 1) : 0)
      queue.push({ flight: f, at })
    }
  }
  queue.sort((a, b) => a.at - b.at)

  for (const p of queue) {
    departing++
    bagsChecked += p.flight.bagsPerPax
    const room = gateRooms.find((r) => r.id === p.flight.gate) ?? gateRooms[0]
    const t0 = Math.max(0, p.at)
    const desk = pickServer('checkin_desk', fromCurb, t0, (e) => !!deskBags.get(e.id))
    if (!desk) continue
    const doneCheckin = serve(desk.s, desk.arrive)

    // Bags: belt ride, then the carousel sorts each one.
    const route = deskBags.get(desk.s.eq.id)!
    const car = servers.get(route.carousel.id)!
    for (let b = 0; b < p.flight.bagsPerPax; b++) {
      const atCar = doneCheckin + (route.beltTiles * T.tileMetres) / T.beltMps
      const sorted = serve(car, atCar)
      if (sorted <= p.flight.departSec - T.bagCutoffSec) bagsLoaded++
    }

    const lane = pickServer('security_lane', tileDist(desk.tile), doneCheckin)
    if (!lane || !room) continue
    const cleared = serve(lane.s, lane.arrive)
    const afterLane = tileDist({ x: lane.s.eq.x, y: lane.s.eq.y })
    const gate = pickServer('gate_desk', afterLane, cleared, (e) => ix.roomAt.get(tileKey(e.x, e.y))?.id === room.id)
    if (!gate) continue
    const done = serve(gate.s, gate.arrive)
    if (done <= p.flight.departSec - T.gateCloseSec) boarded++
  }

  // Arrivals walk out through the one-way exit.
  const arriveStep = walkStep(l, ix, 'arrive', (t) => isLaneAt(ix, t))
  for (const f of flights) {
    const n = f.arriving ?? 0
    if (!n) continue
    arriving += n
    const room = gateRooms.find((r) => r.id === f.gate) ?? gateRooms[0]
    const door = R.gateApron.find((t) => ix.roomAt.get(tileKey(t.x, t.y))?.id === room?.id)
    if (!door) continue
    const out = nearest(flood([door], arriveStep).dist, R.curb)
    if (Number.isFinite(out)) exited += n
  }

  const layout: BuildLayout = {
    ...l,
    equipment: l.equipment.map((eq) => {
      const uses = servers.get(eq.id)?.uses ?? 0
      return uses ? { ...eq, wear: Math.min(100, eq.wear + uses * T.wearPerUse) } : eq
    }),
  }
  return {
    departing,
    boarded,
    lostPax: departing - boarded,
    bagsChecked,
    bagsLoaded,
    lostBags: bagsChecked - bagsLoaded,
    arriving,
    exited,
    lostArrivals: arriving - exited,
    maxWaitSec: maxWait,
    layout,
  }
}
