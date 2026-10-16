import type { Body, BodySource } from '../bodies/index.ts'
import { LANDSIDE } from './config.ts'
import { buildNetwork, cellId } from './network.ts'
import type { CurbNotice, CurbOrder } from './trips.ts'
import type { LandsideField, LandsideView, ModeSplit, Network, SegmentRead } from './types.ts'
import { LandsideFleet } from './vehicles.ts'

interface Sample {
  arrivalsPerMin: number
  modes: ModeSplit
  roadVehPerMin: number
  /** City vehicles per minute by kind, the ones that are drawn. Fuel tankers are not. */
  carVehPerMin: number
  taxiVehPerMin: number
  busVehPerMin: number
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
  const turns = clamp01(field.turns ?? 0)
  const extraTurns = Math.max(0, turns - LANDSIDE.turnAllowance)
  return (
    LANDSIDE.baseArrivalsPerMin +
    pax * LANDSIDE.perPaxPerDay +
    departures * LANDSIDE.perDeparture +
    extraTurns * LANDSIDE.perTurn
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
    carVehPerMin: carVeh,
    taxiVehPerMin: taxiVeh,
    busVehPerMin: busVeh,
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
 * Landside traffic: the capacity model plus the vehicles that are drawn.
 * Pressure, delay and missed check-ins come from {@link measure}. The drawn
 * vehicles follow those per-kind rates until {@link LandsideTraffic.offer}
 * hands them real passenger trips. Stall load (`curbBusy`) is the cars
 * actually in the stalls. Pressure, delay, and the rate queue stay on measure.
 * Rendering reads {@link LandsideTraffic.snapshot} and does not feed back.
 * The drawn vehicles are also bodies on the shared {@link BodySource} list.
 */
export class LandsideTraffic implements BodySource {
  readonly bodyOwner = 'landside'
  private queue = 0
  private delaySec = 0
  private curbBusy = 0
  private wasLate = false
  private fleet = new LandsideFleet()
  private view: LandsideView = emptyView()

  reset(): void {
    this.queue = 0
    this.delaySec = 0
    this.curbBusy = 0
    this.wasLate = false
    this.fleet.reset()
    this.view = emptyView()
  }

  /**
   * Carry these passengers. An empty list still turns decorative traffic off,
   * so the game curb shows only people who have a flight.
   * The same id offered again is ignored.
   */
  offer(orders: readonly CurbOrder[]): void {
    this.fleet.offer(orders)
  }

  /** Alighted, boarded, and picked up since the last take. */
  takeNotices(): CurbNotice[] {
    return this.fleet.takeNotices()
  }

  snapshot(): LandsideView {
    return this.view
  }

  /** The vehicles as last drawn, in metres on the site grid. */
  bodies(): Body[] {
    const cellM = LANDSIDE.cellM
    return this.view.vehicles.map((car) => {
      const body = LANDSIDE.bodies[car.kind]
      return {
        id: `${this.bodyOwner}:${car.id}`,
        owner: this.bodyOwner,
        kind: car.kind,
        x: car.c * cellM,
        y: car.r * cellM,
        heading: car.heading,
        halfLength: body.lengthM / 2,
        halfWidth: body.widthM / 2,
        speed: car.speed,
      }
    })
  }

  tick(dtSec: number, field: LandsideField): LandsideView {
    const dt = Math.max(0, Math.min(1, dtSec))
    const net = buildNetwork(field)
    const sample = measure(field, net)
    this.queue = smooth(this.queue, sample.queue, dt)
    this.delaySec = smooth(this.delaySec, sample.delaySec, dt)
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
    this.fleet.step(dt, field, net, {
      car: sample.carVehPerMin,
      taxi: sample.taxiVehPerMin,
      bus: sample.busVehPerMin,
    })
    this.curbBusy = smooth(this.curbBusy, this.fleet.stallsHeld(), dt)
    this.view = {
      segments: segmentsFor(net, sample, this.queue, this.curbBusy),
      vehicles: this.fleet.vehicles(),
      passengers: this.fleet.passengers(),
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
}

/** Green, amber, then red. Shared by the ground tint and tests. */
export function pressureColor(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio < 0.7) return '#3dbe6e'
  if (ratio < 1) return '#e0b15a'
  return '#d35a4a'
}
