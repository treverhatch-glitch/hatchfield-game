import { LANDSIDE } from './config.ts'
import { buildNetwork, cellId } from './network.ts'
import type {
  Cell,
  LandsideField,
  LandsideView,
  ModeSplit,
  Network,
  PassengerRead,
  SegmentRead,
  VehicleKind,
  VehicleRead,
  VehicleState,
} from './types.ts'

interface Sample {
  arrivalsPerMin: number
  modes: ModeSplit
  roadVehPerMin: number
  curbVehPerMin: number
  laneFlowPerMin: number
  curbServicePerMin: number
  travelSec: number
  queue: number
  curbBusy: number
  delaySec: number
  pressure: number
  lanes: number
  curbStalls: number
  parkSpaces: number
  busBays: number
  curbLanes: number
  taxiRanks: number
}

interface Agent {
  id: string
  kind: VehicleKind
  /** Metres from the city end. Increases through the curb and the exit. */
  metres: number
  state: VehicleState
  dwell: number
  dropped: boolean
}

interface Walker {
  id: string
  fromC: number
  fromR: number
  toC: number
  toR: number
  /** Seconds since they stepped out. */
  age: number
}

const EMPTY_MODES: ModeSplit = { car: 0, taxi: 0, bus: 0, rail: 0 }

function emptyView(): LandsideView {
  return {
    segments: [],
    vehicles: [],
    passengers: [],
    lanes: 0,
    laneFlowPerMin: 0,
    roadFlowPerMin: 0,
    curbStalls: 0,
    curbBusy: 0,
    curbFlowPerMin: 0,
    parkSpaces: 0,
    busBays: 0,
    curbLanes: 0,
    taxiRanks: 0,
    rail: false,
    arrivalsPerMin: 0,
    modes: { ...EMPTY_MODES },
    queue: 0,
    delaySec: 0,
    pressure: 0,
    satisfactionDelta: 0,
    missedCheckIns: 0,
    missShare: 0,
    news: '',
    fixes: [],
    focusId: null,
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

/** Passengers per minute. Grows with the day's passengers and the live bank. */
export function arrivalRate(field: LandsideField): number {
  if (!field.terminals.length || !field.roads.length) return 0
  const pax = clamp01(field.paxPerDay)
  const departures = clamp01(field.departures)
  return (
    LANDSIDE.baseArrivalsPerMin +
    pax * LANDSIDE.perPaxPerDay +
    departures * LANDSIDE.perDeparture
  )
}

function shares(rail: boolean): ModeSplit {
  const base = LANDSIDE.share
  const sum = base.car + base.taxi + base.bus
  if (!rail) return { car: base.car / sum, taxi: base.taxi / sum, bus: base.bus / sum, rail: 0 }
  const rest = 1 - LANDSIDE.railShare
  return {
    car: (base.car / sum) * rest,
    taxi: (base.taxi / sum) * rest,
    bus: (base.bus / sum) * rest,
    rail: LANDSIDE.railShare,
  }
}

/** Steady load implied by the field. Pure: no smoothing, no vehicles. */
export function measure(field: LandsideField, net: Network = buildNetwork(field)): Sample {
  const arrivals = arrivalRate(field)
  const split = shares(field.rail)
  const modes: ModeSplit = {
    car: arrivals * split.car,
    taxi: arrivals * split.taxi,
    bus: arrivals * split.bus,
    rail: arrivals * split.rail,
  }
  let taxiPax = modes.taxi
  let busPax = modes.bus
  if (net.busBays <= 0) {
    taxiPax += busPax
    busPax = 0
  } else {
    const bayPerMin = net.busBays * (LANDSIDE.paxPerBus / (LANDSIDE.busDwellSec / 60))
    const overflow = Math.max(0, busPax - bayPerMin)
    busPax -= overflow
    taxiPax += overflow
  }
  const carVeh = modes.car / LANDSIDE.paxPerCar
  const parkPerMin = net.parkSpaces / LANDSIDE.parkDwellMin
  const parked = Math.min(carVeh, parkPerMin)
  const curbCars = carVeh - parked
  const taxiVeh = taxiPax / LANDSIDE.paxPerTaxi
  const busVeh = busPax / LANDSIDE.paxPerBus
  const extraRaw = field.extraVehPerMin ?? 0
  const extraVeh = Number.isFinite(extraRaw) && extraRaw > 0 ? extraRaw : 0
  const roadVehPerMin = carVeh + taxiVeh + busVeh + extraVeh
  const curbVehPerMin =
    curbCars + taxiVeh + (net.busBays > 0 ? 0 : busVeh * LANDSIDE.busOnCurbWeight)
  const hops = Math.max(0, net.path.length - 1)
  const travelSec = hops > 0 ? (hops * LANDSIDE.cellM) / LANDSIDE.speedMps : 0
  const laneFlowPerMin = net.lanes * LANDSIDE.flowPerLanePerMin
  const curbServicePerMin =
    net.curbStalls > 0 ? net.curbStalls / (LANDSIDE.dwellSec / 60) : 0
  const flowGap = Math.max(0, roadVehPerMin - laneFlowPerMin)
  const flowDelay =
    laneFlowPerMin > 0 ? (flowGap / laneFlowPerMin) * Math.max(travelSec, LANDSIDE.dwellSec) : roadVehPerMin > 0 ? 180 : 0
  const curbTarget = curbVehPerMin * (LANDSIDE.dwellSec / 60)
  const curbGap = Math.max(0, curbTarget - net.curbStalls)
  const curbDelay = curbVehPerMin > 0 ? (curbGap / curbVehPerMin) * 60 : 0
  const queue = flowGap * (Math.max(travelSec, 1) / 60) + curbGap
  const lanePressure = laneFlowPerMin > 0 ? roadVehPerMin / laneFlowPerMin : roadVehPerMin > 0 ? 2 : 0
  const curbPressure = net.curbStalls > 0 ? curbTarget / net.curbStalls : curbVehPerMin > 0 ? 2 : 0
  return {
    arrivalsPerMin: arrivals,
    modes: { ...modes, bus: busPax, taxi: taxiPax },
    roadVehPerMin,
    curbVehPerMin,
    laneFlowPerMin,
    curbServicePerMin,
    travelSec,
    queue,
    curbBusy: Math.min(curbTarget, net.curbStalls),
    delaySec: Math.max(flowDelay, curbDelay),
    pressure: Math.max(lanePressure, curbPressure),
    lanes: net.lanes,
    curbStalls: net.curbStalls,
    parkSpaces: net.parkSpaces,
    busBays: net.busBays,
    curbLanes: net.curbLanes,
    taxiRanks: net.taxiRanks,
  }
}

function smooth(current: number, target: number, dt: number): number {
  const tau = LANDSIDE.smoothSec
  const k = 1 - Math.exp(-Math.max(0, dt) / tau)
  return current + (target - current) * k
}

function fixesFor(field: LandsideField, net: Network, sample: Sample): string[] {
  const lines: string[] = []
  if (!field.terminals.length) return ['Stamp a hall so the curb has somewhere to drop people.']
  if (!field.roads.length || !net.path.length) return ['Lay a road from the city edge up to the hall.']
  if (sample.roadVehPerMin > sample.laneFlowPerMin + 0.05) {
    lines.push(`Add a parallel lane along the approach. One lane passes ${sample.laneFlowPerMin.toFixed(0)} cars a minute.`)
  }
  if (sample.curbVehPerMin * (LANDSIDE.dwellSec / 60) > net.curbStalls + 0.05) {
    lines.push(`Lengthen the curb along the hall. It has ${net.curbStalls} stalls.`)
  }
  if (sample.modes.car > 1 && net.parkSpaces < 40) {
    lines.push('Stamp parking so cars leave the curb instead of waiting on it.')
  }
  if (net.busBays <= 0 && LANDSIDE.share.bus > 0) {
    lines.push(`Add a bus bay. It adds ${LANDSIDE.stallsPerBusBay} stalls and takes coaches off the curb.`)
  }
  if (net.curbLanes <= 0 && sample.pressure > 0.85) {
    lines.push(`Add a curb lane. Each one adds ${LANDSIDE.stallsPerCurbLane} drop-off stalls.`)
  }
  if (net.taxiRanks <= 0 && sample.modes.taxi > 1) {
    lines.push(`Add a taxi rank. Each one adds ${LANDSIDE.stallsPerTaxiRank} curb stalls.`)
  }
  if (!field.rail && sample.pressure > 0.85) {
    lines.push('A rail station, later, takes a share of arrivals off the road.')
  }
  if (!lines.length) lines.push('The curb is keeping up. More flights will fill it.')
  return lines
}

function poseAt(path: Cell[], metres: number): { c: number; r: number; heading: number } {
  if (!path.length) return { c: 0, r: 0, heading: 0 }
  if (path.length === 1) return { c: path[0].c, r: path[0].r, heading: 0 }
  const hop = LANDSIDE.cellM
  const max = (path.length - 1) * hop
  const clamped = Math.max(0, Math.min(max, metres))
  const i = Math.min(path.length - 2, Math.floor(clamped / hop))
  const t = (clamped - i * hop) / hop
  const a = path[i]
  const b = path[i + 1]
  return {
    c: a.c + (b.c - a.c) * t,
    r: a.r + (b.r - a.r) * t,
    heading: Math.atan2(b.r - a.r, b.c - a.c),
  }
}

function kindFor(index: number, sample: Sample): VehicleKind {
  const total = sample.roadVehPerMin
  if (!(total > 0)) return 'car'
  const car = Math.max(0, sample.modes.car) / LANDSIDE.paxPerCar / total
  const taxi = Math.max(0, sample.modes.taxi) / LANDSIDE.paxPerTaxi / total
  const x = (index * 0.618033988749) % 1
  if (x < car) return 'car'
  if (x < car + taxi) return 'taxi'
  return sample.modes.bus > 0 ? 'bus' : 'taxi'
}

function segmentsFor(net: Network, sample: Sample, queue: number, curbBusy: number): SegmentRead[] {
  const approach = new Set(net.path.map(cellId))
  const front = new Set(net.frontage.map(cellId))
  const hops = Math.max(1, net.path.length)
  const queuePerCell = queue / hops
  const out: SegmentRead[] = []
  for (const road of net.roads) {
    const id = cellId(road)
    const onPath = approach.has(id)
    const isCurb = front.has(id)
    const lanes = onPath ? net.lanes : 1
    const capacity = isCurb ? LANDSIDE.stallsPerCurbCell : lanes * LANDSIDE.carsPerLaneCell
    const servicePerMin = isCurb
      ? LANDSIDE.stallsPerCurbCell / (LANDSIDE.dwellSec / 60)
      : lanes * LANDSIDE.flowPerLanePerMin
    const flowPerMin = onPath ? sample.roadVehPerMin : sample.roadVehPerMin * 0.12
    const cellQueue = onPath ? queuePerCell : 0
    const ratio = isCurb
      ? net.curbStalls > 0
        ? curbBusy / net.curbStalls
        : 0
      : servicePerMin > 0
        ? Math.max(flowPerMin / servicePerMin, cellQueue / Math.max(1, capacity))
        : 0
    out.push({
      id,
      c: road.c,
      r: road.r,
      kind: isCurb ? 'curb' : 'road',
      lanes,
      capacity,
      servicePerMin,
      flowPerMin,
      queue: cellQueue,
      ratio,
    })
  }
  out.sort((a, b) => b.ratio - a.ratio || a.r - b.r || a.c - b.c)
  return out
}

/**
 * Capacity-based landside traffic.
 * The tick updates load, queues, and the few cars the player can see.
 * Rendering reads {@link LandsideTraffic.snapshot} and does not feed back.
 */
export class LandsideTraffic {
  private queue = 0
  private delaySec = 0
  private curbBusy = 0
  private wasLate = false
  private agents: Agent[] = []
  private walkers: Walker[] = []
  private route: Cell[] = []
  private nextId = 1
  private view: LandsideView = emptyView()

  reset(): void {
    this.queue = 0
    this.delaySec = 0
    this.curbBusy = 0
    this.wasLate = false
    this.agents = []
    this.walkers = []
    this.route = []
    this.nextId = 1
    this.view = emptyView()
  }

  snapshot(): LandsideView {
    return this.view
  }

  tick(dtSec: number, field: LandsideField): LandsideView {
    const dt = Math.max(0, Math.min(1, dtSec))
    const net = buildNetwork(field)
    const sample = measure(field, net)
    this.queue = smooth(this.queue, sample.queue, dt)
    this.delaySec = smooth(this.delaySec, sample.delaySec, dt)
    this.curbBusy = smooth(this.curbBusy, sample.curbBusy, dt)
    const late = this.delaySec > LANDSIDE.delayGraceSec
    const news =
      late && !this.wasLate
        ? 'Curb queue — passengers are arriving late. Add a curb lane, a taxi rank, or a bus bay.'
        : ''
    this.wasLate = late
    const lateBy = Math.max(0, this.delaySec - LANDSIDE.delayGraceSec)
    const satisfactionDelta = late
      ? -Math.min(LANDSIDE.satCapPerSec * dt, LANDSIDE.satPerLateSec * lateBy * dt)
      : 0
    const missShare = late ? Math.min(LANDSIDE.missShareCap, lateBy * LANDSIDE.missPerLateSec) : 0
    const missedCheckIns = sample.arrivalsPerMin * (dt / 60) * missShare
    this.stepAgents(dt, net, sample)
    const vehicles = this.agents.flatMap((agent) => this.readAgent(agent))
    const passengers = this.readWalkers()
    this.view = {
      segments: segmentsFor(net, sample, this.queue, this.curbBusy),
      vehicles,
      passengers,
      lanes: net.lanes,
      laneFlowPerMin: sample.laneFlowPerMin,
      roadFlowPerMin: sample.roadVehPerMin,
      curbStalls: net.curbStalls,
      curbBusy: this.curbBusy,
      curbFlowPerMin: sample.curbVehPerMin,
      parkSpaces: net.parkSpaces,
      busBays: net.busBays,
      curbLanes: net.curbLanes,
      taxiRanks: net.taxiRanks,
      rail: field.rail,
      arrivalsPerMin: sample.arrivalsPerMin,
      modes: sample.modes,
      queue: this.queue,
      delaySec: this.delaySec,
      pressure: sample.pressure,
      satisfactionDelta,
      missedCheckIns,
      missShare,
      news,
      fixes: fixesFor(field, net, sample),
      focusId: null,
    }
    return this.view
  }

  private stepAgents(dt: number, net: Network, sample: Sample): void {
    const approach = net.path
    const exit = net.exit.length > 0 ? net.exit : approach.slice(-1)
    if (approach.length < 2 || exit.length < 2 || !(sample.arrivalsPerMin > 0) || dt <= 0) {
      this.agents = []
      this.walkers = []
      this.route = []
      return
    }
    const route = approach.slice(0, -1).concat(exit)
    this.route = route
    const cellM = LANDSIDE.cellM
    const end = (route.length - 1) * cellM
    const curbStart = (approach.length - 1) * cellM
    const front = new Set(net.frontage.map(cellId))
    let curbEnd = curbStart
    for (let i = approach.length - 1; i < route.length; i++) {
      if (!front.has(cellId(route[i]))) break
      curbEnd = i * cellM
    }
    const slow = sample.pressure > 1 ? 1 / sample.pressure : 1
    const step = LANDSIDE.speedMps * slow * dt
    const gap = LANDSIDE.queueGapM
    const stallCount = Math.max(1, Math.min(net.curbStalls, LANDSIDE.visualCap))
    const stalls: number[] = []
    for (let i = 0; i < stallCount; i++) stalls.push(Math.max(curbStart, curbEnd - i * gap))

    const nearestIn = this.agents.reduce(
      (min, agent) => (agent.state === 'leave' ? min : Math.min(min, agent.metres)),
      Infinity,
    )
    if (this.agents.length < LANDSIDE.visualCap && (nearestIn === Infinity || nearestIn >= gap)) {
      this.agents.push({
        id: `curb-${this.nextId++}`,
        kind: kindFor(this.nextId, sample),
        metres: 0,
        state: 'drive',
        dwell: 0,
        dropped: false,
      })
    }

    const taken = new Set<number>()
    const ordered = [...this.agents].sort((a, b) => b.metres - a.metres)
    let ahead = Infinity
    for (const agent of ordered) {
      if (agent.state === 'leave') {
        agent.metres = Math.min(end, agent.metres + step)
        ahead = agent.metres
        continue
      }
      if (agent.state === 'stop') {
        agent.dwell -= dt
        const held = stalls.findIndex((stall) => Math.abs(stall - agent.metres) < gap * 0.5)
        if (held >= 0) taken.add(held)
        if (agent.dwell <= 0) {
          agent.state = 'leave'
          agent.metres = Math.min(end, agent.metres + step)
          if (held >= 0) taken.delete(held)
        }
        ahead = agent.metres
        continue
      }
      let stall = -1
      for (let i = 0; i < stalls.length; i++) {
        if (taken.has(i) || stalls[i] + 0.2 < agent.metres) continue
        if (stall < 0 || stalls[i] > stalls[stall]) stall = i
      }
      if (stall >= 0) taken.add(stall)
      const stopAt = stall >= 0 ? stalls[stall] : null
      const follow = Number.isFinite(ahead) ? ahead - gap : Infinity
      if (stopAt == null) {
        if (follow > agent.metres + 0.05) {
          agent.metres = Math.min(agent.metres + step, follow)
          agent.state = 'drive'
        } else {
          agent.state = 'queue'
        }
        ahead = agent.metres
        continue
      }
      const room = Math.min(stopAt, follow)
      if (room <= agent.metres + 0.05) {
        agent.state = 'queue'
        ahead = agent.metres
        continue
      }
      const next = Math.min(agent.metres + step, room)
      agent.metres = Math.max(agent.metres, next)
      if (agent.metres >= stopAt - 0.15 && stopAt - agent.metres <= step + 0.15) {
        agent.metres = stopAt
        agent.state = 'stop'
        agent.dwell = agent.kind === 'bus' ? LANDSIDE.busDwellSec : LANDSIDE.dwellSec
        if (!agent.dropped) {
          agent.dropped = true
          this.dropPassengers(agent, net)
        }
      } else if (room - agent.metres <= 0.05) {
        agent.state = 'queue'
      } else {
        agent.state = 'drive'
      }
      ahead = agent.metres
    }
    this.agents = this.agents.filter((agent) => agent.state !== 'leave' || agent.metres < end - 0.05)
    this.stepWalkers(dt)
  }

  private dropPassengers(agent: Agent, net: Network): void {
    const pose = poseAt(this.route, agent.metres)
    const door = net.door
    const count = LANDSIDE.alight[agent.kind]
    const toC = door ? door.c : pose.c
    const toR = door ? door.r : pose.r
    for (let n = 0; n < count; n++) {
      const f = (n + 1) / (count + 1)
      this.walkers.push({
        id: `${agent.id}-p${n}`,
        fromC: pose.c + (toC - pose.c) * 0.12,
        fromR: pose.r + (toR - pose.r) * 0.12 + (f - 0.5) * 0.18,
        toC,
        toR,
        age: 0,
      })
    }
  }

  private stepWalkers(dt: number): void {
    const next: Walker[] = []
    const stay = LANDSIDE.walkSec + LANDSIDE.dwellSec * 0.45
    for (const walker of this.walkers) {
      walker.age += dt
      if (walker.age < stay) next.push(walker)
    }
    this.walkers = next
  }

  private readAgent(agent: Agent): VehicleRead[] {
    const pose = poseAt(this.route, agent.metres)
    return [
      {
        id: agent.id,
        kind: agent.kind,
        c: pose.c,
        r: pose.r,
        heading: pose.heading,
        state: agent.state,
      },
    ]
  }

  private readWalkers(): PassengerRead[] {
    return this.walkers.map((walker) => {
      const t = Math.min(1, walker.age / LANDSIDE.walkSec)
      const c = walker.fromC + (walker.toC - walker.fromC) * t
      const r = walker.fromR + (walker.toR - walker.fromR) * t
      return {
        id: walker.id,
        c,
        r,
        heading: Math.atan2(walker.toR - walker.fromR, walker.toC - walker.fromC),
      }
    })
  }
}

/** Green, amber, then red. Shared by the ground tint and tests. */
export function pressureColor(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio < 0.7) return '#3dbe6e'
  if (ratio < 1) return '#e0b15a'
  return '#d35a4a'
}
