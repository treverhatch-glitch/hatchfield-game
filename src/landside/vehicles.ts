/**
 * Drawn landside vehicles: bodies on the public-road lanes.
 *
 * Vehicles arrive at the city's rate, keep a gap to whatever is ahead in
 * every lane they cover, change lane to reach the curb, pull into a free
 * stall, bay, rank or car park, dwell while people get out, then pull out
 * and leave round the loop. Nothing here feeds the capacity model.
 */
import { LANDSIDE, type ParkKind } from './config.ts'
import {
  buildLanes,
  headingAt,
  indexAt,
  indexAtMetres,
  laneMetres,
  laneOpenAt,
  pointAt,
  sideSign,
  type LaneGeometry,
} from './lanes.ts'
import { cellId } from './network.ts'
import type {
  Cell,
  LandsideField,
  Network,
  PassengerRead,
  VehicleKind,
  VehicleRead,
  VehicleState,
} from './types.ts'

/** Vehicles per minute of each kind the city sends. */
export interface ArrivalRates {
  car: number
  taxi: number
  bus: number
}

type Group = 'curb' | 'bay' | 'rank' | 'lot'

interface Slot {
  key: string
  group: Group
  /** Sample index of the stall centre. */
  x: number
  /** Sample index where the pull-in starts. */
  startX: number
  /** Longest body that fits. */
  maxLen: number
  pull: number
  holder: Vehicle | null
  /** Car park this stall is the entrance of. */
  park: string | null
  tile: Cell
}

interface Lot {
  capacity: number
  /** Sim-clock times the parked cars come back out, earliest first. */
  out: number[]
  slot: Slot
}

type Mode = 'lane' | 'change' | 'pullIn' | 'pullOut'
type Phase = 'arrive' | 'dwell' | 'leave'

interface Vehicle {
  id: string
  kind: VehicleKind
  half: number
  /** Fractional sample on the loop. Below 0 is off the map before the entry. */
  x: number
  /** Lane the vehicle is in, or moving into. */
  lane: number
  from: number
  /** Progress from `from` to `lane`, 0 to 1. */
  p: number
  mode: Mode
  moveFrom: number
  moveLen: number
  v: number
  heading: number
  phase: Phase
  slot: Slot | null
  dwell: number
  gone: boolean
}

interface Walker {
  id: string
  fromC: number
  fromR: number
  toC: number
  toR: number
  age: number
}

interface Road {
  key: string
  geo: LaneGeometry
  headStep: number[]
  tailStep: number[]
  /** Speed the road's curvature allows, per lane per sample. */
  cap: Float64Array[]
  /** Turn radius per lane per sample, metres. Infinity on the straight. */
  radius: Float64Array[]
  slotKey: string
  slots: Slot[]
  lots: Map<string, Lot>
}

const KINDS: VehicleKind[] = ['car', 'taxi', 'bus']
const WIDEST_HALF = Math.max(...Object.values(LANDSIDE.bodies).map((body) => body.widthM / 2))
const SWEEP_MARGIN_M = 0.1
/** Most a body turns off its lane, radians. Longer bodies turn less so the tail stays in its lane. */
const MAX_YAW = 0.3
/** Sideways sweep of a body's end while it changes lane or pulls in, metres. */
const MAX_SWEEP_M = 0.6
/**
 * A lane change or pull-out within this share of its length is done. A pull-out
 * ends exactly at the layby gap behind the next stall, so it would otherwise
 * stop a rounding error short and keep holding the layby.
 */
const MOVE_DONE = 1e-3
/** A follower parks exactly on the gap it needs, so a merge test on that gap allows this much rounding. */
const GAP_TOLERANCE_M = 0.01

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function smoothstep(p: number): number {
  const t = clamp(p, 0, 1)
  return t * t * (3 - 2 * t)
}

/** Derivative of {@link smoothstep} with respect to p. Zero at both ends, so a lane change starts and finishes straight. */
function smoothstepDeriv(p: number): number {
  const t = clamp(p, 0, 1)
  return 6 * t * (1 - t)
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/** Bumper-to-bumper gap `car` keeps behind the vehicle ahead in `lane`. Stalls in the layby pack closer. */
function followGap(road: Road, car: Vehicle, lane: number): number {
  if (lane === road.geo.layby) return LANDSIDE.minGapM
  return Math.max(LANDSIDE.minGapM, LANDSIDE.followBodyLengths * car.half * 2)
}

function lengthOf(kind: VehicleKind): number {
  return LANDSIDE.bodies[kind].lengthM
}

function dwellFor(kind: VehicleKind, slot: Slot | null): number {
  if (slot?.group === 'lot') return LANDSIDE.parkGateSec
  return kind === 'bus' ? LANDSIDE.busDwellSec : LANDSIDE.dwellSec
}

/**
 * Lanes a body covers. A vehicle between lanes covers both. In a turn a
 * straight body's ends swing outward, so a long one also covers the lane
 * outside it while the swing would cross the lane line.
 */
function occupies(road: Road, car: Vehicle): number[] {
  const out = car.p < 1 && car.from !== car.lane ? [car.from, car.lane] : [car.lane]
  const { geo } = road
  const lane = car.lane
  if (out.length > 1 || lane >= geo.curbLane + 1) return out
  const radius = road.radius[lane]
  const lo = Math.max(0, Math.floor(car.x - car.half / geo.step))
  const hi = Math.min(geo.count - 1, Math.ceil(car.x + car.half / geo.step))
  let tight = Infinity
  let at = -1
  for (let i = lo; i <= hi; i++) {
    if (radius[i] < tight) {
      tight = radius[i]
      at = i
    }
  }
  if (at < 0 || !Number.isFinite(tight)) return out
  const sweep = (car.half * car.half) / (2 * tight)
  if (sweep <= LANDSIDE.laneWidthM - WIDEST_HALF - SWEEP_MARGIN_M - halfWidth(car.kind)) return out
  const inner = lane - 1
  const outer = lane + 1
  const outside = outer <= geo.curbLane && (inner < 0 || road.radius[outer][at] > radius[at]) ? outer : inner
  if (outside >= 0 && outside <= geo.curbLane) out.push(outside)
  return out
}

function halfWidth(kind: VehicleKind): number {
  return LANDSIDE.bodies[kind].widthM / 2
}

function sAt(road: Road, lane: number, x: number): number {
  const { geo } = road
  const last = geo.count - 1
  if (x < 0) return x * road.headStep[lane]
  if (x > last) return geo.cum[lane][last] + (x - last) * road.tailStep[lane]
  return laneMetres(geo, lane, x)
}

function xAt(road: Road, lane: number, s: number): number {
  const { geo } = road
  const last = geo.count - 1
  const end = geo.cum[lane][last]
  if (s < 0) return s / road.headStep[lane]
  if (s > end) return last + (s - end) / road.tailStep[lane]
  return indexAtMetres(geo, lane, s)
}

function place(road: Road, x: number, lat: number): { x: number; y: number } {
  const { geo } = road
  const last = geo.count - 1
  if (x >= 0 && x <= last) return pointAt(geo, x, lat)
  const i = x < 0 ? 0 : last - 1
  const a = pointAt(geo, i, lat)
  const b = pointAt(geo, i + 1, lat)
  const base = x < 0 ? a : b
  const t = x < 0 ? x : x - last
  return { x: base.x + (b.x - a.x) * t, y: base.y + (b.y - a.y) * t }
}

function latOf(road: Road, car: Vehicle): number {
  const lat = road.geo.lat
  return lat[car.from] + (lat[car.lane] - lat[car.from]) * smoothstep(car.p)
}

function curvature(geo: LaneGeometry): { cap: Float64Array[]; radius: Float64Array[] } {
  const vmax = LANDSIDE.speedMps
  const cap: Float64Array[] = []
  const radius: Float64Array[] = []
  geo.lat.forEach((lat, lane) => {
    const speeds = new Float64Array(geo.count).fill(vmax)
    const radii = new Float64Array(geo.count).fill(Infinity)
    const cum = geo.cum[lane]
    let prev = headingAt(geo, 0, lat)
    for (let i = 1; i < geo.count - 1; i++) {
      const next = headingAt(geo, i, lat)
      const turn = Math.abs(wrap(next - prev))
      const ds = (cum[i + 1] - cum[i - 1]) / 2
      if (turn > 1e-6 && ds > 1e-6) {
        radii[i] = ds / turn
        speeds[i] = Math.min(vmax, Math.sqrt(LANDSIDE.turnLatAccelMps2 * radii[i]))
      }
      prev = next
    }
    cap.push(speeds)
    radius.push(radii)
  })
  return { cap, radius }
}

function slotInputsKey(field: LandsideField, net: Network): string {
  const ids = (cells: Cell[] | undefined) => (cells ?? []).map(cellId).join(';')
  return [
    ids(net.frontage),
    ids(field.terminals),
    ids(field.busBays),
    ids(field.curbLanes),
    ids(field.taxiRanks),
    field.parks.map((park) => `${cellId(park)}:${park.kind}`).join(';'),
  ].join('|')
}

interface TileSpec {
  group: Group
  stalls: number
  kind: VehicleKind
  park: ParkKind | null
}

/**
 * Stalls along the layby. A tile beside a straight road cell gets stalls on
 * the half of the loop whose kerb faces it. Corner cells get none.
 */
function buildSlots(geo: LaneGeometry, net: Network, field: LandsideField): { slots: Slot[]; lots: Map<string, Lot> } {
  const L = LANDSIDE
  const sign = sideSign()
  const halls = new Set(field.terminals.map(cellId))
  const front = new Set(net.frontage.map(cellId))
  const tiles = new Map<string, TileSpec>()
  for (const cell of field.busBays) tiles.set(cellId(cell), { group: 'bay', stalls: L.stallsPerBusBay, kind: 'bus', park: null })
  for (const cell of field.curbLanes ?? []) tiles.set(cellId(cell), { group: 'curb', stalls: L.stallsPerCurbLane, kind: 'car', park: null })
  for (const cell of field.taxiRanks ?? []) tiles.set(cellId(cell), { group: 'rank', stalls: L.stallsPerTaxiRank, kind: 'taxi', park: null })
  for (const park of field.parks) tiles.set(cellId(park), { group: 'lot', stalls: 1, kind: 'car', park: park.kind })

  const slots: Slot[] = []
  const lots = new Map<string, Lot>()
  const usedSide = new Set<string>()
  const usedTile = new Set<string>()
  const lay = (spine: number, back: boolean, tile: Cell, spec: TileSpec) => {
    const len = lengthOf(spec.kind)
    const fit = Math.max(1, Math.floor(L.cellM / (len + L.minGapM + L.pullMinM)))
    const n = Math.max(1, Math.min(spec.stalls, fit))
    const spacing = L.cellM / n
    const maxLen = spacing - L.minGapM - L.pullMinM
    const pull = clamp(spacing - len - L.minGapM, L.pullMinM, L.pullMaxM)
    for (let i = 0; i < n; i++) {
      const along = -L.cellM / 2 + spacing * (i + 0.5)
      const x = indexAt(geo, spine, along, back)
      const startX = indexAt(geo, spine, along - pull, back)
      if (x < 0) continue
      const slot: Slot = {
        key: `${spec.group}:${cellId(tile)}:${back ? 1 : 0}:${i}`,
        group: spec.group,
        x,
        startX,
        maxLen,
        pull,
        holder: null,
        park: spec.park ? cellId(tile) : null,
        tile,
      }
      slots.push(slot)
      if (spec.park) lots.set(cellId(tile), { capacity: L.parkSpaces[spec.park] ?? 0, out: [], slot })
    }
  }
  geo.cells.forEach((spine, j) => {
    if (spine.corner) return
    const cell = spine.cell
    const out = sign > 0 ? { c: -spine.dir.y, r: spine.dir.x } : { c: spine.dir.y, r: -spine.dir.x }
    const toward = (back: boolean): Cell => ({
      c: cell.c + (back ? -out.c : out.c),
      r: cell.r + (back ? -out.r : out.r),
    })
    const canBack = geo.backStart >= 0
    if (front.has(cellId(cell))) {
      const hallOut = halls.has(cellId(toward(false)))
      const hallBack = halls.has(cellId(toward(true)))
      const back = canBack && hallBack && !hallOut
      usedSide.add(`${j}:${back}`)
      lay(j, back, toward(back), { group: 'curb', stalls: L.stallsPerCurbCell, kind: 'car', park: null })
    }
    for (const back of [false, true]) {
      if (back && !canBack) continue
      if (usedSide.has(`${j}:${back}`)) continue
      const tile = toward(back)
      const id = cellId(tile)
      const spec = tiles.get(id)
      if (!spec || usedTile.has(id)) continue
      usedTile.add(id)
      usedSide.add(`${j}:${back}`)
      lay(j, back, tile, spec)
    }
  })
  slots.sort((a, b) => a.x - b.x)
  return { slots, lots }
}

/**
 * The drawn vehicles and the people they drop.
 * Deterministic: the same field and the same ticks give the same cars.
 */
export class LandsideFleet {
  private road: Road | null = null
  private cars: Vehicle[] = []
  private walkers: Walker[] = []
  private due: Record<VehicleKind, number> = { car: 0, taxi: 0, bus: 0 }
  private primed = false
  private nextId = 1
  private clock = 0
  private door: Cell | null = null

  reset(): void {
    this.road = null
    this.cars = []
    this.walkers = []
    this.due = { car: 0, taxi: 0, bus: 0 }
    this.primed = false
    this.nextId = 1
    this.clock = 0
    this.door = null
  }

  step(dt: number, field: LandsideField, net: Network, rates: ArrivalRates): void {
    this.door = net.door
    this.ensureRoad(field, net)
    const road = this.road
    if (!road) {
      this.cars = []
      this.walkers = []
      return
    }
    if (dt > 0) {
      const n = Math.max(1, Math.ceil(dt / LANDSIDE.substepSec - 1e-9))
      const h = dt / n
      for (let k = 0; k < n; k++) this.substep(road, h, rates)
    }
    this.stepWalkers(dt)
  }

  vehicles(): VehicleRead[] {
    const road = this.road
    if (!road) return []
    const cellM = LANDSIDE.cellM
    return this.cars.map((car) => {
      const pos = place(road, car.x, latOf(road, car))
      return {
        id: car.id,
        kind: car.kind,
        c: pos.x / cellM,
        r: pos.y / cellM,
        heading: car.heading,
        state: stateOf(car),
        lane: car.lane,
        speed: car.v,
      }
    })
  }

  passengers(): PassengerRead[] {
    return this.walkers.map((walker) => {
      const t = Math.min(1, walker.age / LANDSIDE.walkSec)
      return {
        id: walker.id,
        c: walker.fromC + (walker.toC - walker.fromC) * t,
        r: walker.fromR + (walker.toR - walker.fromR) * t,
        heading: Math.atan2(walker.toR - walker.fromR, walker.toC - walker.fromC),
      }
    })
  }

  private ensureRoad(field: LandsideField, net: Network): void {
    const key = `${net.path.map(cellId).join(';')}|${net.exit.map(cellId).join(';')}|${net.edgeExit}|${LANDSIDE.drivingSide}`
    if (!this.road || this.road.key !== key) {
      this.cars = []
      const geo = buildLanes(net)
      this.road = geo
        ? {
            key,
            geo,
            headStep: geo.cum.map((cum) => Math.max(1e-6, cum[1] - cum[0])),
            tailStep: geo.cum.map((cum) => Math.max(1e-6, cum[geo.count - 1] - cum[geo.count - 2])),
            ...curvature(geo),
            slotKey: '',
            slots: [],
            lots: new Map(),
          }
        : null
    }
    const road = this.road
    if (!road) return
    const slotKey = slotInputsKey(field, net)
    if (road.slotKey === slotKey) return
    const { slots, lots } = buildSlots(road.geo, net, field)
    const byKey = new Map(slots.map((slot) => [slot.key, slot]))
    for (const car of this.cars) {
      const fresh = car.slot ? byKey.get(car.slot.key) : undefined
      if (car.slot && fresh && !fresh.holder) {
        fresh.holder = car
        car.slot = fresh
      }
    }
    for (const [id, lot] of lots) {
      const old = road.lots.get(id)
      if (old) lot.out = old.out
    }
    road.slotKey = slotKey
    road.slots = slots
    road.lots = lots
  }

  private substep(road: Road, h: number, rates: ArrivalRates): void {
    this.clock += h
    const cars = this.cars.sort((a, b) => b.x - a.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const last: (Vehicle | null)[] = road.geo.lat.map(() => null)
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i]
      this.move(road, car, i, cars, last, h)
      if (car.gone) continue
      for (const k of occupies(road, car)) last[k] = car
    }
    this.cars = cars.filter((car) => !car.gone)
    this.leaveLots(road)
    this.spawn(road, h, rates)
  }

  private move(road: Road, car: Vehicle, i: number, cars: Vehicle[], last: (Vehicle | null)[], h: number): void {
    const L = LANDSIDE
    const { geo } = road
    const curb = geo.curbLane
    const layby = geo.layby
    const before = place(road, car.x, latOf(road, car))

    if (car.phase === 'dwell') {
      car.dwell -= h
      if (car.dwell <= 0) {
        if (car.slot?.park) {
          this.enterLot(road, car)
          return
        }
        car.phase = 'leave'
      }
    }
    if (car.phase === 'arrive' && !car.slot) this.assign(road, car)

    const need = this.needX(road, car)
    if (car.mode === 'lane' && car.lane === layby) {
      if (car.phase === 'leave') this.tryPullOut(road, car, i, cars, last)
    } else if (car.mode === 'lane') {
      const slot = car.phase === 'arrive' ? car.slot : null
      if (slot && car.lane === curb && car.x >= slot.startX - 1e-9) {
        const from = sAt(road, layby, car.x)
        car.from = curb
        car.lane = layby
        car.p = 0
        car.mode = 'pullIn'
        car.moveFrom = from
        car.moveLen = Math.max(0.5, sAt(road, layby, slot.x) - from)
      } else {
        const want = this.desire(road, car, need, last)
        if (want !== car.lane) this.tryChange(road, car, want, need, i, cars, last)
      }
    }

    if (car.mode === 'lane' && car.lane === layby) {
      car.v = 0
      return
    }

    const m = car.lane
    const s = sAt(road, m, car.x)
    let vCap: number = L.speedMps
    let limX = Infinity
    let leadV = 0
    for (const k of occupies(road, car)) {
      const lead = last[k]
      if (!lead) continue
      const lx = xAt(road, k, sAt(road, k, lead.x) - lead.half - car.half - followGap(road, car, k))
      if (lx < limX) {
        limX = lx
        leadV = lead.v
      }
    }
    const merger = car.mode === 'lane' && m === curb && m > 0 ? last[m - 1] : null
    if (merger && this.waitingToMerge(road, merger)) {
      // Zipper: leave the stopped merger a gap if this car can still stop short of it.
      const lx = xAt(road, m, sAt(road, m, merger.x) - merger.half - car.half - followGap(road, car, m))
      const room = sAt(road, m, lx) - s
      if (lx < limX && room >= (car.v * car.v) / (2 * L.decelMps2)) {
        limX = lx
        leadV = 0
      }
    }
    if (limX < Infinity) {
      const gap = Math.max(0, sAt(road, m, limX) - s)
      vCap = Math.min(vCap, Math.sqrt(leadV * leadV + 2 * L.decelMps2 * gap))
    }
    let stopX = this.stopX(road, car, need)
    if (stopX < car.x) stopX = car.x
    if (stopX < Infinity) {
      vCap = Math.min(vCap, Math.sqrt(2 * L.decelMps2 * Math.max(0, sAt(road, m, stopX) - s)))
    }
    if (car.mode === 'pullIn' || car.mode === 'pullOut') {
      vCap = Math.min(vCap, L.pullSpeedMps)
    } else if (car.phase === 'arrive' && car.slot && m === curb) {
      const toPull = sAt(road, curb, car.slot.startX) - s
      if (toPull >= 0) vCap = Math.min(vCap, Math.sqrt(L.pullSpeedMps ** 2 + 2 * L.decelMps2 * toPull))
    }
    vCap = Math.min(vCap, this.curveCap(road, m, car.x, s))

    let v = car.v < vCap ? Math.min(vCap, car.v + L.accelMps2 * h) : Math.max(vCap, car.v - 2 * L.decelMps2 * h)
    v = Math.max(0, v)
    let nx = xAt(road, m, s + v * h)
    nx = Math.max(car.x, Math.min(nx, limX, stopX))
    const moved = sAt(road, m, nx) - s
    car.v = Math.max(0, Math.min(v, moved / h))
    car.x = nx

    if (car.mode !== 'lane') {
      const sNow = sAt(road, m, car.x)
      car.p = clamp((sNow - car.moveFrom) / car.moveLen, 0, 1)
      if (car.mode === 'pullIn') {
        const slot = car.slot
        if (slot && sNow >= sAt(road, layby, slot.x) - 0.05 && car.v < 0.5) {
          car.x = slot.x
          car.p = 1
          car.from = layby
          car.mode = 'lane'
          car.v = 0
          car.phase = 'dwell'
          car.dwell = dwellFor(car.kind, slot)
          if (!slot.park) this.drop(road, car)
        }
      } else if (car.p >= 1 - MOVE_DONE) {
        car.mode = 'lane'
        car.from = car.lane
        car.p = 1
      }
    }

    if (sAt(road, m, car.x) >= geo.cum[m][geo.count - 1] + car.half) {
      car.gone = true
      return
    }

    const lat = latOf(road, car)
    const after = place(road, car.x, lat)
    const dx = after.x - before.x
    const dy = after.y - before.y
    const tangent = headingAt(geo, car.x, lat)
    let steer = 0
    if (car.mode !== 'lane' && car.moveLen > 0.5) {
      // Nose follows the S-curve: it yaws into the new lane through the middle and is straight again at the end.
      const delta = geo.lat[car.lane] - geo.lat[car.from]
      steer = Math.atan2(delta * smoothstepDeriv(car.p), car.moveLen)
    } else if (Math.hypot(dx, dy) > 0.02) {
      steer = wrap(Math.atan2(dy, dx) - tangent)
    }
    const limit = car.mode === 'lane' ? Math.min(MAX_YAW, MAX_SWEEP_M / car.half) : MAX_YAW
    car.heading = tangent + clamp(steer, -limit, limit)
  }

  /** Sample by which the vehicle must be settled in the curb lane, or Infinity. */
  private needX(road: Road, car: Vehicle): number {
    const { geo } = road
    let need = geo.backStart >= 0 && car.x <= geo.forwardEnd ? geo.forwardEnd : Infinity
    if (car.phase === 'arrive') {
      if (car.slot) need = Math.min(need, car.slot.startX)
      else need = Math.min(need, this.holdX(road, car))
    }
    return need
  }

  /** True when `other` sits stopped at its merge line, waiting for a gap into the curb lane. */
  private waitingToMerge(road: Road, other: Vehicle): boolean {
    if (other.mode !== 'lane' || other.lane >= road.geo.curbLane || other.v >= 0.5) return false
    const need = this.needX(road, other)
    if (need === Infinity) return false
    const lane = other.lane
    return sAt(road, lane, this.stopX(road, other, need)) - sAt(road, lane, other.x) <= 1
  }

  /** Where the vehicle must stop if nothing changes. */
  private stopX(road: Road, car: Vehicle, need: number): number {
    const { geo } = road
    const curb = geo.curbLane
    if (car.mode === 'pullIn') return car.slot ? car.slot.x : Infinity
    if (car.mode !== 'lane') return Infinity
    if (car.lane === curb) {
      if (car.phase !== 'arrive') return Infinity
      return car.slot ? car.slot.x : this.holdX(road, car)
    }
    if (car.lane < curb && need < Infinity) {
      // Front bumper on the line, so a long body waiting to merge is still on the straight and does not swing into the curb lane.
      return xAt(road, car.lane, sAt(road, car.lane, need) - LANDSIDE.laneChangeMinM - car.half)
    }
    return Infinity
  }

  private desire(road: Road, car: Vehicle, need: number, last: (Vehicle | null)[]): number {
    const L = LANDSIDE
    const { geo } = road
    const curb = geo.curbLane
    const s = sAt(road, car.lane, car.x)
    if (car.lane < curb) {
      if (need < Infinity && sAt(road, car.lane, need) - s < L.prepM) return car.lane + 1
      return car.lane
    }
    if (curb === 0) return car.lane
    const passer = car.slot != null || car.phase === 'leave'
    if (!passer) return car.lane
    if (need < Infinity && sAt(road, curb, need) - s <= L.prepM) return car.lane
    const ahead = last[curb]
    if (!ahead || ahead.v >= 1) return car.lane
    const gap = sAt(road, curb, ahead.x) - ahead.half - (s + car.half)
    if (gap > 20) return car.lane
    if (!laneOpenAt(geo, curb - 1, car.x)) return car.lane
    return curb - 1
  }

  private tryChange(
    road: Road,
    car: Vehicle,
    target: number,
    need: number,
    i: number,
    cars: Vehicle[],
    last: (Vehicle | null)[],
  ): boolean {
    const L = LANDSIDE
    const { geo } = road
    if (!laneOpenAt(geo, target, car.x)) return false
    if (!this.roomIn(road, car, target, i, cars, last)) return false
    const s = sAt(road, target, car.x)
    let len = clamp(car.v * L.laneChangeSec, L.laneChangeMinM, L.laneChangeM)
    if (target === geo.curbLane && need < Infinity) {
      len = Math.max(L.laneChangeMinM, Math.min(len, sAt(road, target, need) - s))
    }
    car.from = car.lane
    car.lane = target
    car.p = 0
    car.mode = 'change'
    car.moveFrom = s
    car.moveLen = len
    return true
  }

  private tryPullOut(road: Road, car: Vehicle, i: number, cars: Vehicle[], last: (Vehicle | null)[]): void {
    const curb = road.geo.curbLane
    if (!this.roomIn(road, car, curb, i, cars, last)) return
    const slot = car.slot
    car.from = road.geo.layby
    car.lane = curb
    car.p = 0
    car.mode = 'pullOut'
    car.moveFrom = sAt(road, curb, car.x)
    car.moveLen = slot ? slot.pull : LANDSIDE.pullMinM
    if (slot && slot.holder === car) slot.holder = null
    car.slot = null
  }

  /** True when `target` has a safe gap ahead and behind the vehicle. */
  private roomIn(road: Road, car: Vehicle, target: number, i: number, cars: Vehicle[], last: (Vehicle | null)[]): boolean {
    const L = LANDSIDE
    const s = sAt(road, target, car.x)
    const lead = last[target]
    if (lead) {
      const gap = sAt(road, target, lead.x) - lead.half - (s + car.half)
      if (gap < followGap(road, car, target) + Math.max(0, car.v - lead.v) * L.headwaySec - GAP_TOLERANCE_M) return false
    }
    for (let j = i + 1; j < cars.length; j++) {
      const back = cars[j]
      if (!occupies(road, back).includes(target)) continue
      const gap = s - car.half - (sAt(road, target, back.x) + back.half)
      if (gap < followGap(road, back, target) + back.v * L.headwaySec - GAP_TOLERANCE_M) return false
      break
    }
    return true
  }

  private curveCap(road: Road, lane: number, x: number, s: number): number {
    const L = LANDSIDE
    const reach = (L.speedMps * L.speedMps) / (2 * L.decelMps2) + 2
    const caps = road.cap[lane]
    let cap: number = L.speedMps
    for (let j = Math.max(0, Math.floor(x)); j < road.geo.count; j++) {
      const d = sAt(road, lane, j) - s
      if (d > reach) break
      cap = Math.min(cap, Math.sqrt(caps[j] * caps[j] + 2 * L.decelMps2 * Math.max(0, d)))
    }
    return cap
  }

  private prefs(road: Road, kind: VehicleKind): Group[] {
    if (kind === 'taxi') return ['rank', 'curb']
    if (kind === 'bus') {
      const len = lengthOf('bus')
      return road.slots.some((slot) => slot.group === 'bay' && slot.maxLen >= len) ? ['bay'] : ['curb']
    }
    return ['lot', 'curb']
  }

  private assign(road: Road, car: Vehicle): void {
    const L = LANDSIDE
    const { geo } = road
    const len = car.half * 2
    const s = sAt(road, geo.curbLane, car.x)
    const reach = s + (car.v * car.v) / (2 * L.decelMps2) + (car.lane === geo.curbLane ? 0 : L.laneChangeMinM)
    for (const group of this.prefs(road, car.kind)) {
      let best: Slot | null = null
      let bestHalf = 2
      for (const slot of road.slots) {
        if (slot.group !== group || slot.holder || slot.maxLen < len) continue
        if (slot.park) {
          const lot = road.lots.get(slot.park)
          if (!lot || lot.out.length >= lot.capacity) continue
        }
        if (sAt(road, geo.curbLane, slot.startX) < reach) continue
        const half = slot.x > geo.forwardEnd ? 1 : 0
        if (!best || half < bestHalf || (half === bestHalf && slot.x > best.x)) {
          best = slot
          bestHalf = half
        }
      }
      if (best) {
        best.holder = car
        car.slot = best
        return
      }
    }
  }

  /** Where a vehicle with no free stall waits: just short of its group's first stall ahead. */
  private holdX(road: Road, car: Vehicle): number {
    const L = LANDSIDE
    const curb = road.geo.curbLane
    const len = car.half * 2
    const prefs = this.prefs(road, car.kind)
    let group: Group | null = null
    for (let k = prefs.length - 1; k >= 0 && !group; k--) {
      if (road.slots.some((slot) => slot.group === prefs[k] && slot.maxLen >= len)) group = prefs[k]
    }
    if (!group) return Infinity
    for (const slot of road.slots) {
      if (slot.group !== group || slot.maxLen < len) continue
      const hx = xAt(road, curb, sAt(road, curb, slot.x) - slot.maxLen / 2 - L.minGapM - car.half)
      if (hx >= car.x - 1e-6) return hx
    }
    return Infinity
  }

  private enterLot(road: Road, car: Vehicle): void {
    const slot = car.slot
    if (slot?.park) {
      const lot = road.lots.get(slot.park)
      lot?.out.push(this.clock + LANDSIDE.parkDwellMin * 60)
      this.dropFrom(car, slot.tile.c, slot.tile.r, car.heading)
    }
    if (slot && slot.holder === car) slot.holder = null
    car.slot = null
    car.gone = true
  }

  /** A parked car comes back out through the entrance once its stay is up. */
  private leaveLots(road: Road): void {
    const L = LANDSIDE
    const layby = road.geo.layby
    for (const lot of road.lots.values()) {
      if (!lot.out.length || lot.out[0] > this.clock) continue
      const slot = lot.slot
      if (slot.holder) continue
      if (!road.slots.includes(slot)) continue
      const half = lengthOf('car') / 2
      const at = sAt(road, layby, slot.x)
      const blocked = this.cars.some(
        (other) =>
          occupies(road, other).includes(layby) &&
          Math.abs(sAt(road, layby, other.x) - at) < other.half + half + L.minGapM,
      )
      if (blocked) continue
      lot.out.shift()
      const car = this.make(road, 'car', slot.x, layby, 0)
      car.phase = 'leave'
      car.slot = slot
      slot.holder = car
      this.cars.push(car)
    }
  }

  private spawn(road: Road, h: number, rates: ArrivalRates): void {
    const L = LANDSIDE
    for (const kind of KINDS) this.due[kind] += Math.max(0, rates[kind] || 0) * (h / 60)
    if (!this.primed) {
      let first: VehicleKind | null = null
      for (const kind of KINDS) if ((rates[kind] || 0) > 0 && (!first || rates[kind] > rates[first])) first = kind
      if (first) {
        this.due[first] = Math.max(this.due[first], 1)
        this.primed = true
      }
    }
    let kind: VehicleKind | null = null
    for (const k of KINDS) if (this.due[k] >= 1 && (!kind || this.due[k] > this.due[kind])) kind = k
    if (!kind) return
    const half = lengthOf(kind) / 2
    const curb = road.geo.curbLane
    for (let lane = curb; lane >= 0; lane--) {
      let first: Vehicle | null = null
      for (const other of this.cars) {
        if (occupies(road, other).includes(lane) && (!first || other.x < first.x)) first = other
      }
      const room = first ? sAt(road, lane, first.x) - first.half : Infinity
      const gap = room - Math.max(L.minGapM, L.followBodyLengths * half * 2)
      if (gap < 0) continue
      const leadV = first ? first.v : L.speedMps
      const v = Math.min(L.speedMps, Math.sqrt(leadV * leadV + 2 * L.decelMps2 * gap))
      const car = this.make(road, kind, xAt(road, lane, -half), lane, v)
      // The passing lane is kept for vehicles that already have a stall to go to.
      // Ones still waiting for a stall queue in the curb lane.
      if (lane < curb) {
        this.assign(road, car)
        if (!car.slot) continue
      }
      this.cars.push(car)
      this.due[kind] -= 1
      return
    }
    for (const k of KINDS) this.due[k] = Math.min(this.due[k], 1)
  }

  private make(road: Road, kind: VehicleKind, x: number, lane: number, v: number): Vehicle {
    const half = lengthOf(kind) / 2
    return {
      id: `curb-${this.nextId++}`,
      kind,
      half,
      x,
      lane,
      from: lane,
      p: 1,
      mode: 'lane',
      moveFrom: 0,
      moveLen: 1,
      v,
      heading: headingAt(road.geo, x, road.geo.lat[lane]),
      phase: 'arrive',
      slot: null,
      dwell: 0,
      gone: false,
    }
  }

  /** People step out on the kerb side and walk to the hall door. */
  private drop(road: Road, car: Vehicle): void {
    const kerb = road.geo.lat[road.geo.layby] + LANDSIDE.laybyWidthM / 2 + 0.6
    const at = place(road, car.x, kerb)
    this.dropFrom(car, at.x / LANDSIDE.cellM, at.y / LANDSIDE.cellM, car.heading)
  }

  private dropFrom(car: Vehicle, c: number, r: number, heading: number): void {
    const door = this.door
    if (!door) return
    const count = LANDSIDE.alight[car.kind]
    const along = 1.6 / LANDSIDE.cellM
    for (let n = 0; n < count; n++) {
      const f = (n + 1) / (count + 1) - 0.5
      this.walkers.push({
        id: `${car.id}-p${n}`,
        fromC: c + Math.cos(heading) * along * f,
        fromR: r + Math.sin(heading) * along * f,
        toC: door.c,
        toR: door.r,
        age: 0,
      })
    }
  }

  private stepWalkers(dt: number): void {
    const stay = LANDSIDE.walkSec + LANDSIDE.dwellSec * 0.45
    const next: Walker[] = []
    for (const walker of this.walkers) {
      walker.age += Math.max(0, dt)
      if (walker.age < stay) next.push(walker)
    }
    this.walkers = next
  }
}

function stateOf(car: Vehicle): VehicleState {
  if (car.phase === 'dwell') return 'stop'
  if (car.phase === 'leave') return 'leave'
  return car.v < 0.3 ? 'queue' : 'drive'
}
