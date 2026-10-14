import { Maintenance, type MaintenanceMetrics, type WearState } from './maintenance'
import { sizeTierOf, vehicleCanServe } from '../scale/logic'
import { needsFor } from './needs'
import { RoadGraph } from './roads'
import { ApronTraffic } from './traffic'
import {
  ServiceFlow,
  anchorIdFor,
  buildingAnchors,
  gradeTurnaround,
  serviceReason,
  standAnchors,
  standLabel,
  taskLine,
  type DockPhase,
  type DockVisual,
} from './serviceFlow'
import type {
  DelayCause,
  FlightKind,
  Ledger,
  LogisticsConfig,
  LogisticsEvent,
  MoneyCategory,
  ServiceKind,
  StandAccess,
  StandConfig,
  TurnaroundNeeds,
  TurnaroundOptions,
  VehicleType,
} from './types'
import { VEHICLE_TYPES } from './types'

const EPS = 1e-6

function pointAlong(pts: { x: number; y: number }[], u: number): { x: number; y: number; heading: number } {
  const lens: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    lens.push(len)
    total += len
  }
  if (total <= EPS) return { x: pts[0].x, y: pts[0].y, heading: 0 }
  let remain = Math.min(1, Math.max(0, u)) * total
  for (let i = 0; i < lens.length; i++) {
    const len = lens[i]
    const a = pts[i]
    const b = pts[i + 1]
    const heading = Math.atan2(b.y - a.y, b.x - a.x)
    if (remain <= len || i === lens.length - 1) {
      const t = len <= EPS ? 1 : Math.min(1, remain / len)
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, heading }
    }
    remain -= len
  }
  const last = pts[pts.length - 1]
  return { x: last.x, y: last.y, heading: 0 }
}

export interface VehiclePose {
  id: string
  type: VehicleType
  x: number
  y: number
  heading: number
  /** Current job phase, for render rigs (lift up while servicing, etc.). */
  phase: VehiclePhase
  /** 0..1 progress through the phase on the sim clock (1 when unbounded). */
  u: number
  /** Apron traffic: held up, yielding to another vehicle. */
  waiting?: boolean
  /** Task line for the follow camera, e.g. "Refuel ZO116 at Stand 3 — on the job". */
  reason?: string
  /** Dock offset in the stand or building frame. Absent when the truck is just driving. */
  dock?: DockVisual
}

/** A vehicle standing at an aircraft, with the sim clock for that service. */
export interface ActiveCrew {
  id: string
  type: VehicleType
  service: 'fuel' | 'bags' | 'catering' | 'gpu' | 'pushback' | 'lav' | 'water'
  x: number
  y: number
  heading: number
  start: number
  end: number
}

/** Lav / water dock time: about half the cabin clean, never under 4 minutes. */
export function lavWaterMinutes(cleaningMinutes: number): number {
  return Math.max(4, Math.round(cleaningMinutes * 0.5))
}

function crewServiceOf(type: VehicleType): ActiveCrew['service'] | null {
  if (type === 'fuel_truck' || type === 'heavy_fuel_truck' || type === 'hydrant_dispenser') return 'fuel'
  if (type === 'baggage_tug' || type === 'heavy_baggage_tug' || type === 'belt_loader' || type === 'uld_loader') return 'bags'
  if (type === 'catering_truck' || type === 'highlift_catering') return 'catering'
  if (type === 'gpu') return 'gpu'
  if (type === 'lavatory_truck') return 'lav'
  if (type === 'water_truck') return 'water'
  if (type === 'pushback_tug' || type === 'heavy_tug') return 'pushback'
  return null
}

/**
 * How a vehicle-served job moves things.
 * - carry: vehicle keeps a load between jobs (fuel, meals) drawn from a global store.
 * - in: pick up at a source node from this turnaround's pool, deliver at the stand.
 * - out: pick up at the stand, drop at a drop-off node.
 * - onsite: just be at the stand (fixed minutes, or until released for loaders).
 */
type JobMode = 'carry' | 'in' | 'out' | 'onsite'

const TUGS: VehicleType[] = ['heavy_baggage_tug', 'baggage_tug']

const HOLD_SERVICES: ServiceKind[] = ['bag_unload', 'cargo_unload', 'bag_load', 'cargo_load', 'bag_offload']

export type VehiclePhase =
  | 'idle'
  | 'to_source'
  | 'loading'
  | 'waiting_stock'
  | 'to_stand'
  | 'servicing'
  | 'to_dropoff'
  | 'unloading'
  | 'broken'
  | 'towed'
  | 'to_maintenance'
  | 'in_bay'
  /** Waiting for a free bay. The docking module owns the queue order. */
  | 'queued'
  /** Backing into the bay: approach, then align. */
  | 'docking'
  /** Clearing the bay after the work. */
  | 'departing'

export type DockIntent = 'stand' | 'load' | 'drop' | 'stand-done' | 'load-done' | 'drop-done' | 'stand-to-drop' | null

export interface VehicleState {
  id: string
  type: VehicleType
  node: string
  phase: VehiclePhase
  /** When the current phase ends (Infinity for idle / waiting / loaders on station). */
  phaseEnd: number
  /** Litres, meals, pax, bags or kg on board. */
  load: number
  requestId: number | null
  /** Amount handled in the current stand phase. */
  serving: number
  /** Amount this vehicle was dispatched for but hasn't picked up yet. */
  reserved: number
  /** Cargo module hold. Dispatcher skips this truck for every other flight. */
  heldFor: string | null
  /** Condition, wear and breakdown state (maintenance). */
  wear: WearState
  /** Service-road nodes for the drive in progress. */
  route?: string[] | null
  /** Sim-minute when the current drive started. */
  phaseStart?: number
  /** Which bay the docking sequence is heading for. Null when docks are off. */
  dockIntent: DockIntent
}

interface ServiceRequest {
  id: number
  turnaroundId: string
  standId: string
  service: ServiceKind
  /** Vehicle types that can do the job, best first. */
  vehicles: VehicleType[]
  /** 'upper' = A380 upper-deck catering door. */
  part?: 'upper'
  mode: JobMode
  /** carry/out: amount to deliver/pick up. in: dynamic, see targetOf(). */
  target: number
  /** Delivered (carry/in) or picked up (out). */
  done: number
  /** in: picked up but not delivered. out: being picked up right now. */
  inTransit: number
  /** Claimed by dispatched vehicles that haven't loaded yet. */
  reserved: number
  createdAt: number
}

interface Timer {
  turnaroundId: string
  standId: string
  service: ServiceKind
  end: number
  amount: number
}

interface Delivery {
  litres: number
  eta: number
  vehicleId: string
}

export type ServiceStatus = 'blocked' | 'pending' | 'active' | 'done'

export interface PaxState {
  arriving: number
  deplaned: number
  booked: number
  atGate: number
  boarded: number
  offloaded: number
  fed: boolean
  ids: Set<string>
  /** Fallback late batch. */
  arrivals: { time: number; count: number }[]
  noShows: number
  groupSizes: number[]
  boardingStart: number | null
  boardingEnd: number | null
  lateWait: number
}

export interface BagState {
  inbound: number
  expected: number
  atMakeup: number
  loaded: number
  /** Bags to load after gate close (no-show bags removed). */
  closedTarget: number | null
  fed: boolean
  ids: Set<string>
  arrivals: { time: number; count: number }[]
  noShowBags: number
  offloaded: number
  leftBehind: number
  wait: number
  loadEnd: number | null
}

export interface TurnaroundState {
  id: string
  standId: string
  airframeId: string
  kind: FlightKind
  access: StandAccess
  needs: TurnaroundNeeds
  startedAt: number
  readyBy: number
  /** Gate close time (outbound). */
  cutoff: number
  gateClosed: boolean
  services: Partial<Record<ServiceKind, ServiceStatus>>
  causes: Set<DelayCause>
  completedAt: number | null
  pax: PaxState
  bags: BagState
  cargoIn: number
  cargoOut: number
  cargoLoaded: number
  loaderVehicle: string | null
  loaderBusyUntil: number
  doorBusyUntil: number
  /** Galley truck is the catering module. Do not dispatch an abstract catering truck. */
  deferCatering: boolean
  /** Set once the external galley fee has been posted. */
  cateringFeePosted: boolean
  /** Flight id from the terminal, used to match a reserved loader. */
  externalFlightId: string
  /** Fuel monitor grounded this departure, so the fuel service stays blocked. */
  fuelExternalHold: boolean
  /** Callsign for the vehicle task line. Empty when the caller didn't pass one. */
  callsign: string
}

export type LogisticsListener = (e: LogisticsEvent) => void

/**
 * Deterministic, pure-TS ground logistics. Drive it with tick(dtMinutes).
 * Results do not depend on how a span of time is split into ticks.
 */
export class LogisticsSim {
  readonly config: LogisticsConfig
  readonly roads: RoadGraph
  /** Apron traffic when config.traffic is set; null = closed-form drive times. */
  readonly traffic: ApronTraffic | null = null
  /** Service-point bays when config.docks is set. Null keeps the old closed-form stops. */
  readonly flow: ServiceFlow | null = null
  now = 0
  /**
   * Standalone sims keep this number. A game binds {@link bindFuelStock} so
   * every read and write hits the sim tank instead.
   */
  private ownFuelLitres = 0
  private fuelStock: { get(): number; set(litres: number): void } | null = null
  meals: number
  readonly vehicles: VehicleState[] = []
  readonly ledger: Ledger = {
    fuelSales: 0,
    cateringFees: 0,
    fuelPurchase: 0,
    mealProduction: 0,
    vehicleUpkeep: 0,
    maintenancePreventive: 0,
    maintenanceRepair: 0,
    maintenanceUpkeep: 0,
  }
  /** Present when config.maintenance is set. */
  readonly maintenance: Maintenance | null = null
  private readonly stands = new Map<string, StandConfig>()
  private readonly turnarounds = new Map<string, TurnaroundState>()
  private readonly byStand = new Map<string, string>()
  private requests: ServiceRequest[] = []
  private timers: Timer[] = []
  private deliveries: Delivery[] = []
  private readonly listeners: LogisticsListener[] = []
  private nextReq = 1
  private nextTurn = 1
  private nextDelivery = 1
  private fuelLowFlag = false
  private mealsLowFlag = false
  private readonly loaderHolds = new Map<string, string>()
  private nextHold = 1

  constructor(config: LogisticsConfig) {
    this.config = config
    this.roads = new RoadGraph(config.nodes, config.edges)
    for (const n of [config.depotNode, config.fuelFarm.node, config.kitchen.node, config.terminalNode, config.makeupNode, config.cargoNode]) {
      if (!this.roads.has(n)) throw new Error(`Unknown road node: ${n}`)
    }
    for (const s of config.stands) {
      if (!this.roads.has(s.node)) throw new Error(`Stand ${s.id} on unknown node ${s.node}`)
      this.stands.set(s.id, s)
    }
    if (config.traffic) this.traffic = new ApronTraffic(this.roads, config.edges, config.traffic === true ? {} : config.traffic)
    if (config.docks) {
      const dockCfg = config.docks === true ? {} : config.docks
      const anchors = [
        ...buildingAnchors(
          {
            fuel: config.fuelFarm.node,
            kitchen: config.kitchen.node,
            makeup: config.makeupNode,
            cargo: config.cargoNode,
            terminal: config.terminalNode,
          },
          dockCfg,
        ),
      ]
      for (const s of config.stands) anchors.push(...standAnchors(s.id, 'M', 1, 1))
      const caps: Record<string, number> = {}
      for (const type of VEHICLE_TYPES) {
        const owned = config.vehicles[type] ?? 0
        const limit = dockCfg.fleetCap?.[type]
        caps[type] = limit === undefined ? owned : Math.min(owned, Math.max(0, limit))
      }
      this.flow = new ServiceFlow(anchors, caps)
    }
    this.ownFuelLitres = Math.min(config.fuelFarm.initialLitres, config.fuelFarm.capacityLitres)
    this.meals = Math.min(config.kitchen.initialMeals, config.kitchen.capacityMeals)
    for (const type of VEHICLE_TYPES) {
      const count = config.vehicles[type] ?? 0
      for (let i = 1; i <= count; i++) {
        this.vehicles.push({
          id: `${type}-${i}`,
          type,
          node: config.depotNode,
          phase: 'idle',
          phaseEnd: Infinity,
          load: 0,
          requestId: null,
          serving: 0,
          reserved: 0,
          heldFor: null,
          wear: Maintenance.freshWear(0),
          route: null,
          phaseStart: 0,
          dockIntent: null,
        })
      }
    }
    if (config.maintenance) {
      this.maintenance = new Maintenance(
        {
          now: () => this.now,
          roads: this.roads,
          vehicles: this.vehicles,
          baseSpeed: (type) => config.vehicleSpecs[type].speedKmh,
          emit: (e) => this.emit(e),
          money: (amount, category) => this.money(amount, category),
          releaseJob: (v) => this.releaseJob(v as VehicleState),
          hasOpenWork: (type) =>
            this.requests.some(
              (r) =>
                r.vehicles.includes(type) &&
                (r.mode === 'carry' || r.mode === 'onsite'
                  ? !this.vehicles.some((v) => v.requestId === r.id)
                  : this.openAmount(r) > EPS),
            ),
          setIdle: (v) => this.idle(v as VehicleState),
          redispatch: () => this.dispatch(),
        },
        config.maintenance,
      )
    }
  }

  // ---------------------------------------------------------------- public API

  /** Maintenance metrics and advisor hints (null when maintenance is off). */
  maintenanceMetrics(): MaintenanceMetrics | null {
    return this.maintenance?.metrics() ?? null
  }

  /** Stand usable (not failed from neglect). */
  standAvailable(standId: string): boolean {
    return this.maintenance?.standAvailable(standId) ?? true
  }

  /**
   * Knock out working vehicles of a type right away (external events such as a
   * random fuel-truck failure). With durationMin they come back by themselves.
   */
  forceBreakdown(type: VehicleType, count = 1, durationMin?: number): string[] {
    const m = this.maintenance
    if (!m) return []
    const pool = this.vehicles
      .filter((v) => v.type === type && v.phase !== 'broken' && v.phase !== 'towed' && v.phase !== 'in_bay')
      .sort((a, b) => a.wear.condition - b.wear.condition || (a.id < b.id ? -1 : 1))
      .slice(0, count)
    for (const v of pool) m.breakDown(v, 'event', durationMin)
    return pool.map((v) => v.id)
  }

  /** Working vehicles of a type (for external event odds). */
  workingVehicles(type: VehicleType): number {
    return this.vehicles.filter((v) => v.type === type && v.phase !== 'broken' && v.phase !== 'towed' && v.phase !== 'in_bay').length
  }

  on(listener: LogisticsListener): () => void {
    this.listeners.push(listener)
    return () => {
      const i = this.listeners.indexOf(listener)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  get fuelSellPrice(): number {
    const f = this.config.fuelFarm
    return f.purchasePricePerLitre + f.throughputFeePerLitre
  }

  get profit(): number {
    const l = this.ledger
    return (
      l.fuelSales +
      l.cateringFees -
      l.fuelPurchase -
      l.mealProduction -
      l.vehicleUpkeep -
      l.maintenancePreventive -
      l.maintenanceRepair -
      l.maintenanceUpkeep
    )
  }

  get inboundLitres(): number {
    return this.deliveries.reduce((s, d) => s + d.litres, 0)
  }

  /**
   * Aircraft blocked in on a stand. readyBy = now + scheduledMinutes is when pushback
   * should be complete. Returns the turnaround id.
   */
  startTurnaround(standId: string, airframeId: string, scheduledMinutes: number, opts: TurnaroundOptions = {}): string {
    const stand = this.stands.get(standId)
    if (!stand) throw new Error(`Unknown stand: ${standId}`)
    if (this.byStand.has(standId)) throw new Error(`Stand ${standId} already has a turnaround`)
    if (!this.standAvailable(standId)) throw new Error(`Stand ${standId} is out of service`)
    const needs = needsFor(airframeId)
    const cfg = this.config
    const kind: FlightKind = opts.kind ?? 'turn'
    const inbound = kind !== 'outbound'
    const outbound = kind !== 'inbound'
    const lf = opts.loadFactor ?? cfg.pax.loadFactor
    const seatsPax = needs.carriesPax ? Math.round(needs.seats * lf) : 0
    const arriving = inbound ? Math.min(needs.seats, opts.arrivingPax ?? seatsPax) : 0
    const booked = outbound ? Math.min(needs.seats, opts.departingPax ?? seatsPax) : 0
    const readyBy = this.now + scheduledMinutes
    const cutoff = readyBy - cfg.pax.gateCloseMinutes[needs.sizeClass]
    const id = `T${this.nextTurn++}`
    const p = cfg.pax
    const gateFeed = opts.gateFeed ?? false
    const bagFeed = opts.bagFeed ?? false
    const noShows = gateFeed ? 0 : Math.round(booked * p.noShowRate)
    const late = gateFeed ? 0 : Math.round(booked * p.lateRate)
    const groups = Math.max(1, cfg.pax.groups[needs.sizeClass])
    const groupSizes: number[] = []
    for (let g = 0; g < groups; g++) groupSizes.push(Math.floor((booked * (g + 1)) / groups) - Math.floor((booked * g) / groups))
    const expectedBags = outbound ? opts.outboundBags ?? Math.round(booked * needs.bagsPerPax) : 0
    const noShowBags = bagFeed ? 0 : Math.min(expectedBags, Math.round(noShows * needs.bagsPerPax))
    const lateBags = bagFeed ? 0 : Math.round(expectedBags * cfg.hold.lateBagRate)
    const t: TurnaroundState = {
      id,
      standId,
      airframeId,
      kind,
      access: stand.access ?? 'stairs',
      needs,
      startedAt: this.now,
      readyBy,
      cutoff,
      gateClosed: false,
      services: {},
      causes: new Set(),
      completedAt: null,
      pax: {
        arriving,
        deplaned: 0,
        booked,
        atGate: gateFeed ? 0 : booked - noShows - late,
        boarded: 0,
        offloaded: 0,
        fed: gateFeed,
        ids: new Set(),
        arrivals: late > 0 ? [{ time: Math.max(this.now, cutoff - p.lateArrivalBeforeClose), count: late }] : [],
        noShows,
        groupSizes,
        boardingStart: null,
        boardingEnd: null,
        lateWait: 0,
      },
      bags: {
        inbound: inbound ? opts.inboundBags ?? Math.round(arriving * needs.bagsPerPax) : 0,
        expected: expectedBags,
        atMakeup: bagFeed ? 0 : expectedBags - lateBags,
        loaded: 0,
        closedTarget: null,
        fed: bagFeed,
        ids: new Set(),
        arrivals: lateBags > 0 ? [{ time: Math.max(this.now, cutoff - cfg.hold.lateBagsBeforeClose), count: lateBags }] : [],
        noShowBags,
        offloaded: 0,
        leftBehind: 0,
        wait: 0,
        loadEnd: null,
      },
      cargoIn: inbound ? opts.inboundCargoKg ?? needs.cargoKg : 0,
      cargoOut: outbound ? opts.outboundCargoKg ?? needs.cargoKg : 0,
      cargoLoaded: 0,
      loaderVehicle: null,
      loaderBusyUntil: this.now,
      doorBusyUntil: this.now,
      deferCatering: opts.deferCatering === true,
      cateringFeePosted: false,
      externalFlightId: opts.flightId ?? '',
      callsign: opts.callsign ?? '',
      fuelExternalHold: false,
    }
    this.turnarounds.set(id, t)
    this.byStand.set(standId, id)
    this.flow?.setBays(`stand:${standId}:fuel`, Math.max(1, needs.fuelPoints))
    this.flow?.setBays(`stand:${standId}:catering`, needs.upperDeck ? 2 : 1)

    const enable = (s: ServiceKind, on: boolean): void => {
      if (on && needs.services.includes(s)) t.services[s] = 'blocked'
    }
    enable('deplane', arriving > 0)
    enable('bag_unload', t.bags.inbound > 0)
    enable('cargo_unload', t.cargoIn > 0)
    enable('fuel', outbound)
    enable('catering', outbound && booked > 0)
    enable('cleaning', inbound && arriving > 0)
    enable('gpu', true)
    // Round F: lav and water trucks dock from block-in, overlapping deplaning. Opt-in: only a fleet that owns them gets the job.
    if (inbound && arriving > 0 && needs.carriesPax) {
      if (this.fleetHas('lavatory_truck')) t.services.lav = 'blocked'
      if (this.fleetHas('water_truck')) t.services.water = 'blocked'
    }
    enable('boarding', booked > 0)
    enable('bag_load', expectedBags > 0)
    enable('cargo_load', t.cargoOut > 0)
    enable('door_close', outbound)
    enable('pushback', outbound)
    if (needs.loader && HOLD_SERVICES.some((s) => t.services[s])) t.services.loader = 'blocked'
    this.advancePhases(t)
    this.dispatch()
    return id
  }

  getTurnaround(id: string): TurnaroundState | undefined {
    return this.turnarounds.get(id)
  }

  turnaroundAt(standId: string): TurnaroundState | undefined {
    const id = this.byStand.get(standId)
    return id ? this.turnarounds.get(id) : undefined
  }

  /**
   * Hold one idle loader for a flight. The dispatcher may still assign it to that
   * flight, and skips it for every other stand.
   */
  reserveLoader(
    flightId: string,
    preferred: 'uld_loader' | 'main_deck_loader',
    allowUldFallback: boolean,
  ): { id: string; flightId: string; loaderId: string; type: 'uld_loader' | 'main_deck_loader' } | null {
    const types: ('main_deck_loader' | 'uld_loader')[] =
      preferred === 'main_deck_loader'
        ? allowUldFallback
          ? ['main_deck_loader', 'uld_loader']
          : ['main_deck_loader']
        : ['uld_loader']
    for (const type of types) {
      const v = this.vehicles.find((x) => x.type === type && x.phase === 'idle' && !x.heldFor && x.requestId == null)
      if (!v) continue
      v.heldFor = flightId
      const id = `res-${v.id}-${this.nextHold++}`
      this.loaderHolds.set(id, v.id)
      return { id, flightId, loaderId: v.id, type }
    }
    return null
  }

  /** Drop a cargo-module hold. The truck keeps any job it already started. */
  releaseLoader(id: string): void {
    const vid = this.loaderHolds.get(id)
    if (!vid) return
    this.loaderHolds.delete(id)
    const v = this.vehicles.find((x) => x.id === vid)
    if (v) v.heldFor = null
  }

  /** Fuel outage monitor: a grounded departure does not start the fuel service. */
  setFuelHold(standId: string, hold: boolean): void {
    const t = this.turnaroundAt(standId)
    if (!t || t.fuelExternalHold === hold) return
    t.fuelExternalHold = hold
    if (!hold && t.services.fuel === 'blocked') this.advancePhases(t)
  }

  /**
   * The catering module finished the galley. Post the meal fee once and
   * unblock boarding. No second catering truck is dispatched.
   */
  releaseExternalCatering(standId: string): boolean {
    const t = this.turnaroundAt(standId)
    if (!t || !t.deferCatering) return false
    if (t.services.catering === 'done' || t.services.catering === undefined) return false
    if (!t.cateringFeePosted) {
      t.cateringFeePosted = true
      const fee = t.needs.meals * this.config.kitchen.feePerMeal
      if (fee > 0) this.money(fee, 'catering_fees')
    }
    this.finishService(t, 'catering')
    return true
  }

  /** Projected delay right now (minutes past readyBy, or 0). */
  currentDelay(id: string): number {
    const t = this.turnarounds.get(id)
    if (!t) return 0
    const end = t.completedAt ?? this.now
    return Math.max(0, end - t.readyBy)
  }

  /** Turnarounds that have not finished. A layout rebuild should wait for these. */
  get openTurnarounds(): number {
    let n = 0
    for (const t of this.turnarounds.values()) if (t.completedAt === null) n++
    return n
  }

  /**
   * Where each vehicle is right now, interpolated along the service-road route.
   * Idle and on-stand vehicles sit on their current node.
   */
  poses(): VehiclePose[] {
    const driving = new Set<VehiclePhase>(['to_source', 'to_stand', 'to_dropoff', 'to_maintenance', 'towed'])
    const traffic = this.traffic
    return this.vehicles.map((v) => {
      const start = v.phaseStart ?? this.now
      const span = v.phaseEnd - start
      const u = Number.isFinite(span) && span > EPS ? Math.min(1, Math.max(0, (this.now - start) / span)) : 1
      if (traffic) traffic.place(v)
      const tp = traffic?.pose(v.id)
      const base = tp
        ? { id: v.id, type: v.type, x: tp.x, y: tp.y, heading: tp.heading, phase: v.phase, u, waiting: traffic!.waiting(v.id) }
        : this.roadPose(v, driving, u)
      return this.withDock(v, base)
    })
  }

  private roadPose(v: VehicleState, driving: Set<VehiclePhase>, u: number): VehiclePose {
    const here = this.roads.at(v.node)
    const parked = { x: here?.x ?? 0, y: here?.y ?? 0, heading: this.arrivalHeading(v), phase: v.phase, u }
    if (!driving.has(v.phase) || !v.route || v.route.length < 2) {
      return { id: v.id, type: v.type, ...parked }
    }
    const pts = v.route.map((id) => this.roads.at(id)).filter((n): n is NonNullable<typeof n> => Boolean(n))
    if (pts.length < 2) return { id: v.id, type: v.type, ...parked }
    const at = pointAlong(pts, u)
    return { id: v.id, type: v.type, x: at.x, y: at.y, heading: at.heading, phase: v.phase, u }
  }

  /** Fold the docking pose and the task line onto a road pose. Driving trucks keep their route. */
  private withDock(v: VehicleState, base: VehiclePose): VehiclePose {
    const actor = this.flow?.actor(v.id)
    if (!actor || actor.phase === 'idle') return base
    const dockU = v.phase === 'servicing' || v.phase === 'loading' || v.phase === 'unloading' ? base.u : base.u
    const visual = this.flow!.visual(v.id, actor.phase === 'service' ? dockU : base.u)
    const reason = taskLine(actor.reason, actor.phase, actor.queueIndex)
    if (!visual || (actor.phase === 'route' && actor.queueIndex === 0)) return { ...base, reason }
    return { ...base, reason, dock: visual }
  }

  /** Task lines for the follow camera and the tests. */
  tasks(): { id: string; phase: DockPhase; queueIndex: number; reason: string }[] {
    return this.flow?.tasks() ?? []
  }

  /** Bays in service and the queue behind each point. */
  dockReport() {
    return this.flow?.throughput() ?? []
  }

  /** Live A–F grade for the aircraft on this stand. Null when that stand is empty. */
  turnGrade(standId: string): { grade: string; note: string } | null {
    const id = this.byStand.get(standId)
    const t = id ? this.turnarounds.get(id) : undefined
    if (!t) return null
    const scheduled = Math.max(0, t.readyBy - t.startedAt)
    const actual = (t.completedAt ?? this.now) - t.startedAt
    const graded = gradeTurnaround({
      scheduledMin: scheduled,
      actualMin: actual,
      queuedMin: this.flow?.queuedMinutes(t.id) ?? 0,
    })
    return { grade: graded.grade, note: graded.note }
  }

  /** Metres the tug has shoved this stand's nose. 0 when pushback is not on the job. */
  pushbackRoll(standId: string): number {
    if (!this.flow) return 0
    for (const v of this.vehicles) {
      const dock = this.flow.visual(v.id, this.phaseU(v))
      if (dock && dock.standId === standId && dock.rollM > 0) return dock.rollM
    }
    return 0
  }

  private phaseU(v: VehicleState): number {
    const start = v.phaseStart ?? this.now
    const span = v.phaseEnd - start
    return Number.isFinite(span) && span > EPS ? Math.min(1, Math.max(0, (this.now - start) / span)) : 1
  }

  /** Heading of the last drive, so a parked truck still faces the way it arrived. */
  private arrivalHeading(v: VehicleState): number {
    const route = v.route
    if (!route || route.length < 2) return 0
    const a = this.roads.at(route[route.length - 2])
    const b = this.roads.at(route[route.length - 1])
    if (!a || !b) return 0
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (dx * dx + dy * dy < 1e-8) return 0
    return Math.atan2(dy, dx)
  }

  /**
   * Vehicles currently working a fuel, bag, or catering job.
   * `start` and `end` are the sim clock for that work. Crew steps fill this
   * window; they do not add time.
   */
  activeCrew(): ActiveCrew[] {
    const poseOf = new Map(this.poses().map((pose) => [pose.id, pose]))
    const out: ActiveCrew[] = []
    for (const v of this.vehicles) {
      const started = v.phaseStart
      if (v.phase !== 'servicing' || started === undefined || !Number.isFinite(v.phaseEnd) || !(v.phaseEnd > started)) continue
      const service = crewServiceOf(v.type)
      if (!service) continue
      const pose = poseOf.get(v.id)
      if (!pose) continue
      out.push({
        id: v.id,
        type: v.type,
        service,
        x: pose.x,
        y: pose.y,
        heading: pose.heading,
        start: started,
        end: v.phaseEnd,
      })
    }
    return out
  }

  /** Requests still waiting for a vehicle. */
  get queueLength(): number {
    return this.requests.filter((r) => !this.vehicles.some((v) => v.requestId === r.id)).length
  }

  /**
   * Terminal sim hook: passengers reached the gate. Pass a count or passenger ids
   * (ids are de-duplicated). The first call switches the turnaround off the fallback model.
   */
  paxArrivedAtGate(standId: string, countOrIds: number | string[]): number {
    const t = this.turnaroundAt(standId)
    if (!t || t.pax.booked === 0) return 0
    const p = t.pax
    if (!p.fed) {
      p.fed = true
      p.arrivals = []
      p.atGate = Math.round(p.boarded + this.inTransitFor(t, 'boarding'))
    }
    if (t.gateClosed) return 0
    let n = 0
    if (typeof countOrIds === 'number') n = Math.max(0, Math.floor(countOrIds))
    else {
      for (const pid of countOrIds) {
        if (p.ids.has(pid)) continue
        p.ids.add(pid)
        n++
      }
    }
    n = Math.min(n, p.booked - p.atGate)
    p.atGate += n
    if (n > 0) this.retryStockWaiters()
    return n
  }

  /** Terminal sim hook: outbound bags sorted and ready at make-up (count or bag tag ids). */
  bagsReadyAtMakeup(standId: string, countOrIds: number | string[]): number {
    const t = this.turnaroundAt(standId)
    if (!t || t.bags.expected === 0) return 0
    const b = t.bags
    if (!b.fed) {
      b.fed = true
      b.arrivals = []
      b.noShowBags = 0
      b.atMakeup = Math.round(b.loaded + this.inTransitFor(t, 'bag_load'))
    }
    if (t.gateClosed) return 0
    let n = 0
    if (typeof countOrIds === 'number') n = Math.max(0, Math.floor(countOrIds))
    else {
      for (const bid of countOrIds) {
        if (b.ids.has(bid)) continue
        b.ids.add(bid)
        n++
      }
    }
    b.atMakeup += n
    if (b.atMakeup > b.expected) b.expected = b.atMakeup
    if (n > 0) this.retryStockWaiters()
    return n
  }

  /** Farm litres. Bound sims use the game tank; others use the private stock. */
  get fuelLitres(): number {
    return this.fuelStock ? this.fuelStock.get() : this.ownFuelLitres
  }

  set fuelLitres(value: number) {
    if (this.fuelStock) this.fuelStock.set(value)
    else this.ownFuelLitres = value
  }

  /**
   * Truck loads, the hydrant, and a tanker arrival read and write this port.
   * The private stock is left behind so a later unbind cannot resurrect it.
   */
  bindFuelStock(stock: { get(): number; set(litres: number): void }): void {
    this.fuelStock = stock
  }

  /** Order a tanker delivery. Paid on arrival. */
  orderFuel(litres = this.config.fuelFarm.tankerLitres): void {
    const eta = this.now + this.config.fuelFarm.deliveryLeadMinutes
    this.deliveries.push({ litres, eta, vehicleId: `tanker-${this.nextDelivery++}` })
    this.emit({ type: 'delivery_ordered', time: this.now, litres, eta })
  }

  tick(dtMinutes: number): void {
    if (!(dtMinutes > 0)) return
    const target = this.now + dtMinutes
    for (let guard = 0; guard < 200000; guard++) {
      const next = Math.min(this.nextEventTime(), target)
      if (next > this.now) {
        this.advanceContinuous(next - this.now)
        this.now = next
      }
      const progressed = this.processDue()
      if (progressed) {
        this.flushContinuousMoney()
        this.dispatch()
      }
      if (this.now >= target - EPS && !progressed) break
    }
    this.now = target
    this.flushContinuousMoney()
  }

  /**
   * With apron traffic on, the clock advances in small driving steps; meal and upkeep
   * costs accrue here and post once per event / tick instead of once per step
   * (same totals, far fewer money events for listeners).
   */
  private contMoney = { meals: 0, upkeep: 0 }

  private flushContinuousMoney(): void {
    const c = this.contMoney
    if (c.meals) this.money(-c.meals, 'meal_production')
    if (c.upkeep) this.money(-c.upkeep, 'vehicle_upkeep')
    c.meals = c.upkeep = 0
  }

  // ---------------------------------------------------------------- internals

  private emit(e: LogisticsEvent): void {
    for (const l of this.listeners) l(e)
  }

  private money(amount: number, category: MoneyCategory): void {
    if (amount === 0) return
    const key: Record<MoneyCategory, keyof Ledger> = {
      fuel_sales: 'fuelSales',
      catering_fees: 'cateringFees',
      fuel_purchase: 'fuelPurchase',
      meal_production: 'mealProduction',
      vehicle_upkeep: 'vehicleUpkeep',
      maintenance_preventive: 'maintenancePreventive',
      maintenance_repair: 'maintenanceRepair',
      maintenance_upkeep: 'maintenanceUpkeep',
    }
    this.ledger[key[category]] += Math.abs(amount)
    this.emit({ type: 'money', time: this.now, amount, category })
  }

  private stand(t: TurnaroundState): StandConfig {
    return this.stands.get(t.standId)!
  }

  private isDone(t: TurnaroundState, s: ServiceKind): boolean {
    const st = t.services[s]
    return st === undefined || st === 'done'
  }

  private paxDoors(t: TurnaroundState): number {
    const p = this.config.pax
    if (t.access !== 'bridge') return p.doors.stairs[t.needs.sizeClass]
    const bridges = this.stand(t).bridges ?? p.doors.bridge[t.needs.sizeClass]
    return Math.max(1, Math.min(bridges, t.needs.maxBridgeDoors))
  }

  private deplaneRate(t: TurnaroundState): number {
    const p = this.config.pax
    return this.paxDoors(t) * (t.access === 'bridge' ? p.deplanePerDoor.bridge : p.deplanePerDoor.stairs)
  }

  private boardRate(t: TurnaroundState): number {
    const p = this.config.pax
    return this.paxDoors(t) * (t.access === 'bridge' ? p.boardPerDoor.bridge : p.boardPerDoor.stairs)
  }

  private holdRates(t: TurnaroundState): { bagsPerMin: number; kgPerMin: number } {
    return t.needs.loader === 'belt_loader' || !t.needs.loader ? this.config.hold.bulk : this.config.hold.uld
  }

  // ---- phase engine

  private start(t: TurnaroundState, s: ServiceKind): void {
    t.services[s] = 'pending'
    this.emit({ type: 'service_start', time: this.now, standId: t.standId, service: s })
    const n = t.needs
    const remote = t.access === 'remote'
    switch (s) {
      case 'deplane':
        if (remote) this.addRequest(t, s, 'pax_bus', 'out', t.pax.arriving)
        else this.addTimer(t, s, t.pax.arriving / this.deplaneRate(t), t.pax.arriving)
        return
      case 'bag_unload':
        this.addRequest(t, s, TUGS, 'out', t.bags.inbound)
        return
      case 'cargo_unload':
        this.addRequest(t, s, TUGS, 'out', t.cargoIn)
        return
      case 'loader':
        this.addRequest(t, s, this.loaderTypes(t), 'onsite', 1)
        return
      case 'fuel':
        if (this.hasHydrant(t) && !this.fleetHas('hydrant_dispenser')) this.tryHydrant(t)
        else this.addFuelPoints(t)
        return
      case 'catering':
        if (t.deferCatering) {
          t.services.catering = 'pending'
          return
        }
        if (n.upperDeck) {
          // Both decks at once: the upper-deck door needs a high-lift truck.
          const upper = Math.round(n.meals / 2)
          this.addRequest(t, s, ['catering_truck', 'highlift_catering'], 'carry', n.meals - upper)
          this.addRequest(t, s, ['highlift_catering', 'catering_truck'], 'carry', upper, 'upper')
        } else {
          this.addRequest(t, s, ['catering_truck', 'highlift_catering'], 'carry', n.meals)
        }
        return
      case 'cleaning':
        this.addTimer(t, s, n.cleaningMinutes, 0)
        return
      case 'gpu':
        this.addRequest(t, s, 'gpu', 'onsite', 1)
        return
      case 'lav':
        this.addRequest(t, s, 'lavatory_truck', 'onsite', 1)
        return
      case 'water':
        this.addRequest(t, s, 'water_truck', 'onsite', 1)
        return
      case 'pushback':
        this.addRequest(t, s, n.superHeavy ? ['heavy_tug', 'pushback_tug'] : ['pushback_tug', 'heavy_tug'], 'onsite', 1)
        return
      case 'boarding':
        t.services.boarding = 'active'
        t.pax.boardingStart = this.now
        if (remote) this.addRequest(t, s, 'pax_bus', 'in', 0)
        this.checkBoardingDone(t)
        return
      case 'bag_load':
        this.addRequest(t, s, TUGS, 'in', 0)
        return
      case 'cargo_load':
        this.addRequest(t, s, TUGS, 'in', 0)
        return
      case 'bag_offload':
        this.startOffload(t)
        return
      case 'door_close':
        this.addTimer(t, s, this.config.pax.doorCloseMinutes, 0)
        return
    }
  }

  /** Start every blocked service whose prerequisites are now met. */
  private advancePhases(t: TurnaroundState): void {
    if (t.completedAt !== null) return
    const flag = this.config.pax.fuelWithPaxOnBoard
    const ready = (s: ServiceKind): boolean => {
      switch (s) {
        case 'fuel':
          if (t.fuelExternalHold) return false
          return flag || this.isDone(t, 'deplane')
        // Real turn charts (Boeing ACAPS 5.2, Airbus AC 5-2-0): services overlap rather than queue.
        // Lav and potable water work from external belly panels, so they start at block-in.
        case 'lav':
        case 'water':
          return true
        // Catering uses the service-side doors, so it starts once deplaning is under way at the passenger door.
        case 'catering':
          return t.services.deplane !== 'blocked'
        // The cleaning crew needs an empty cabin.
        case 'cleaning':
          return this.isDone(t, 'deplane')
        case 'boarding':
          return (
            this.isDone(t, 'deplane') &&
            this.isDone(t, 'cleaning') &&
            this.isDone(t, 'catering') &&
            (flag || this.isDone(t, 'fuel'))
          )
        case 'bag_load':
        case 'cargo_load':
          return this.isDone(t, 'bag_unload') && this.isDone(t, 'cargo_unload')
        case 'door_close':
          return (
            this.isDone(t, 'boarding') &&
            this.isDone(t, 'bag_load') &&
            this.isDone(t, 'cargo_load') &&
            // Lav / water trucks must be off their panels before the doors close.
            this.isDone(t, 'lav') &&
            this.isDone(t, 'water') &&
            (this.isDone(t, 'fuel') || !flag || t.pax.booked === 0)
          )
        case 'pushback':
          return t.services.door_close !== 'blocked'
        default:
          return true
      }
    }
    let again = true
    while (again) {
      again = false
      for (const s of Object.keys(t.services) as ServiceKind[]) {
        if (t.services[s] === 'blocked' && ready(s)) {
          this.start(t, s)
          again = true
        }
      }
    }
    this.maybeReleaseLoader(t)
    this.maybeStartPushback(t)
    const all = (Object.keys(t.services) as ServiceKind[]).every((k) => this.isDone(t, k))
    if (all) this.complete(t)
  }

  private finishService(t: TurnaroundState, s: ServiceKind): void {
    if (t.services[s] === 'done') return
    t.services[s] = 'done'
    if (s === 'bag_load') t.bags.loadEnd = this.now
    if (s === 'boarding') t.pax.boardingEnd = this.now
    this.emit({ type: 'service_done', time: this.now, standId: t.standId, service: s })
    this.advancePhases(t)
  }

  /** Everything except the push itself is finished (the loader may still be driving off). */
  private pushbackClear(t: TurnaroundState): boolean {
    return (Object.keys(t.services) as ServiceKind[]).every((k) => k === 'pushback' || k === 'loader' || this.isDone(t, k))
  }

  /** The tug is pre-positioned at door close and pushes as soon as the stand is clear. */
  private maybeStartPushback(t: TurnaroundState): void {
    for (const v of this.vehicles) {
      const r = this.request(v)
      if (!r || r.turnaroundId !== t.id || r.service !== 'pushback') continue
      if (v.phase === 'servicing' && v.phaseEnd === Infinity && this.pushbackClear(t)) {
        t.services.pushback = 'active'
        const mult = this.compatMult(r, v.type)
        if (mult < 1) t.causes.add('undersized_vehicle')
        v.phaseEnd = this.now + t.needs.pushbackMinutes / mult
      }
    }
  }

  private maybeReleaseLoader(t: TurnaroundState): void {
    if (!t.loaderVehicle) return
    if (!HOLD_SERVICES.every((s) => this.isDone(t, s))) return
    // The gate may still order bags off. Pulling the belt away early costs a whole re-dock.
    if (!t.gateClosed && t.bags.expected > 0) return
    const v = this.vehicles.find((x) => x.id === t.loaderVehicle)!
    this.maintenance?.onUse(v)
    const req = this.request(v)
    if (req) this.requests.splice(this.requests.indexOf(req), 1)
    this.idle(v)
    t.loaderVehicle = null
    if (t.services.loader !== 'done') {
      t.services.loader = 'done'
      this.emit({ type: 'service_done', time: this.now, standId: t.standId, service: 'loader' })
    }
  }

  private needLoader(t: TurnaroundState): void {
    if (t.loaderVehicle || !t.needs.loader) return
    if (this.requests.some((r) => r.turnaroundId === t.id && r.service === 'loader')) return
    t.services.loader = 'pending'
    this.addRequest(t, 'loader', this.loaderTypes(t), 'onsite', 1)
  }

  // ---- requests / timers

  private loaderTypes(t: TurnaroundState): VehicleType[] {
    if (t.needs.loader === 'belt_loader') return ['belt_loader']
    if (t.needs.loader === 'main_deck_loader') return ['main_deck_loader', 'uld_loader']
    return ['main_deck_loader', 'uld_loader']
  }

  /** Fuel through every fuel point at once (two wings on L-size types). */
  private addFuelPoints(t: TurnaroundState): void {
    const n = t.needs
    const points = Math.max(1, n.fuelPoints)
    const dispenser = this.stand(t).hydrant && (this.maintenance?.hydrantWorking(t.standId) ?? true) && this.fleetHas('hydrant_dispenser')
    let left = n.fuelLitres
    for (let i = 0; i < points; i++) {
      const share = i === points - 1 ? left : Math.round(n.fuelLitres / points)
      left -= share
      this.addRequest(t, 'fuel', dispenser ? ['hydrant_dispenser'] : ['heavy_fuel_truck', 'fuel_truck'], 'carry', share)
    }
  }

  private fleetHas(type: VehicleType): boolean {
    return this.vehicles.some((v) => v.type === type)
  }

  /**
   * Work-rate multiplier for a vehicle on this job (size-class compatibility).
   * Below 1 means the vehicle is undersized and slow.
   */
  private compatMult(r: ServiceRequest, type: VehicleType): number {
    const t = this.turnarounds.get(r.turnaroundId)!
    if (r.service === 'catering' && r.part === 'upper') return type === 'highlift_catering' ? 1 : 0.4
    if (r.service === 'pushback' && t.needs.superHeavy) return type === 'heavy_tug' ? 1 : 1 / 3
    if (r.service === 'loader' && t.needs.superHeavy && type === 'uld_loader') return 0.7
    return 1
  }

  private addRequest(
    t: TurnaroundState,
    service: ServiceKind,
    vehicle: VehicleType | VehicleType[],
    mode: JobMode,
    target: number,
    part?: 'upper',
  ): void {
    this.requests.push({
      id: this.nextReq++,
      turnaroundId: t.id,
      standId: t.standId,
      service,
      vehicles: Array.isArray(vehicle) ? vehicle : [vehicle],
      part,
      mode,
      target,
      done: 0,
      inTransit: 0,
      reserved: 0,
      createdAt: this.now,
    })
  }

  private addTimer(t: TurnaroundState, service: ServiceKind, minutes: number, amount: number): void {
    t.services[service] = 'active'
    this.timers.push({ turnaroundId: t.id, standId: t.standId, service, end: this.now + minutes, amount })
  }

  private inTransitFor(t: TurnaroundState, s: ServiceKind): number {
    return this.requests.filter((r) => r.turnaroundId === t.id && r.service === s).reduce((a, r) => a + r.inTransit, 0)
  }

  /** Amount the request ultimately has to move. */
  private targetOf(r: ServiceRequest): number {
    if (r.mode !== 'in') return r.target
    const t = this.turnarounds.get(r.turnaroundId)!
    if (r.service === 'boarding') return t.gateClosed ? t.pax.atGate : t.pax.booked
    if (r.service === 'bag_load') return t.bags.closedTarget ?? t.bags.expected
    return t.cargoOut
  }

  /** Amount still free to assign to a new vehicle. */
  private openAmount(r: ServiceRequest): number {
    return this.targetOf(r) - r.done - r.inTransit - r.reserved
  }

  /** What an in-job can pick up at its source right now. */
  private pool(r: ServiceRequest): number {
    const t = this.turnarounds.get(r.turnaroundId)!
    if (r.service === 'boarding') return this.allowedToBoard(t) - t.pax.boarded - r.inTransit
    if (r.service === 'bag_load') return Math.min(t.bags.atMakeup, this.targetOf(r)) - t.bags.loaded - r.inTransit
    return t.cargoOut - t.cargoLoaded - r.inTransit
  }

  private capacityFor(v: VehicleState, r: ServiceRequest): number {
    const spec = this.config.vehicleSpecs[v.type]
    if (r.service === 'cargo_load' || r.service === 'cargo_unload') return spec.cargoCapacityKg ?? spec.capacity
    return spec.capacity
  }

  private sourceNode(r: ServiceRequest): string {
    if (r.service === 'fuel') return this.config.fuelFarm.node
    if (r.service === 'catering') return this.config.kitchen.node
    if (r.service === 'boarding') return this.config.terminalNode
    if (r.service === 'bag_load') return this.config.makeupNode
    return this.config.cargoNode
  }

  private dropNode(r: ServiceRequest): string {
    return r.service === 'cargo_unload' ? this.config.cargoNode : this.config.terminalNode
  }

  // ---- passengers

  private openedGroupSize(t: TurnaroundState): number {
    const p = t.pax
    if (p.boardingStart === null) return 0
    if (t.gateClosed) return p.booked
    let s = 0
    p.groupSizes.forEach((g, i) => {
      if (p.boardingStart! + i * this.config.pax.groupGapMinutes <= this.now + EPS) s += g
    })
    return s
  }

  private allowedToBoard(t: TurnaroundState): number {
    return Math.min(t.pax.atGate, this.openedGroupSize(t))
  }

  private continuousBoarding(t: TurnaroundState): boolean {
    return t.services.boarding === 'active' && t.access !== 'remote' && t.completedAt === null
  }

  private checkBoardingDone(t: TurnaroundState): void {
    if (t.services.boarding !== 'active') return
    const target = t.gateClosed ? t.pax.atGate : t.pax.booked
    if (t.pax.boarded >= target - EPS && this.inTransitFor(t, 'boarding') <= EPS) {
      t.pax.boarded = Math.round(t.pax.boarded)
      const r = this.requests.find((x) => x.turnaroundId === t.id && x.service === 'boarding')
      if (r) this.dropRequest(r)
      this.finishService(t, 'boarding')
    }
  }

  private closeGate(t: TurnaroundState): void {
    t.gateClosed = true
    const p = t.pax
    const b = t.bags
    p.arrivals = []
    b.arrivals = []
    p.offloaded = p.booked - p.atGate
    const pendingAtGate = p.atGate - p.boarded - this.inTransitFor(t, 'boarding')
    if (p.boardingStart !== null && pendingAtGate > 0.5) t.causes.add('boarding_slow')
    this.emit({ type: 'gate_closed', time: this.now, standId: t.standId, boarded: Math.round(p.boarded), atGate: p.atGate })
    let nsBags = 0
    if (b.expected > 0) {
      nsBags = b.fed ? Math.min(b.atMakeup, Math.round(p.offloaded * t.needs.bagsPerPax)) : Math.min(b.atMakeup, b.noShowBags)
      if (p.offloaded === 0) nsBags = 0
      b.leftBehind = Math.max(0, b.expected - b.atMakeup)
      if (b.leftBehind > 0) this.emit({ type: 'bags_left_behind', time: this.now, standId: t.standId, count: b.leftBehind })
      b.closedTarget = b.atMakeup - nsBags
    }
    if (p.offloaded > 0) this.emit({ type: 'pax_offloaded', time: this.now, standId: t.standId, count: p.offloaded, bags: nsBags })
    this.checkOffload(t)
    // Waiting buses / tugs may now have nothing left to fetch.
    for (const r of this.requests.slice()) {
      if (r.turnaroundId !== t.id || r.mode !== 'in') continue
      for (const v of this.vehicles) {
        if (v.requestId === r.id && v.phase === 'waiting_stock' && this.pool(r) <= EPS) {
          r.reserved -= v.reserved
          this.idle(v)
        }
      }
      r.reserved = Math.max(0, Math.min(r.reserved, this.targetOf(r) - r.done - r.inTransit))
      this.checkInDone(r)
    }
    this.checkBoardingDone(t)
    this.advancePhases(t)
  }

  // ---- bags

  /** If more bags are in the hold than may fly, schedule pulling them. */
  private checkOffload(t: TurnaroundState): void {
    const b = t.bags
    if (b.closedTarget === null) return
    const excess = b.loaded - b.closedTarget
    if (excess <= EPS) return
    if (t.services.bag_offload === 'pending' || t.services.bag_offload === 'active') return
    t.causes.add('bag_offload')
    t.services.bag_offload = 'pending'
    this.emit({ type: 'service_start', time: this.now, standId: t.standId, service: 'bag_offload' })
    this.startOffload(t)
  }

  private startOffload(t: TurnaroundState): void {
    if (!t.loaderVehicle) {
      this.needLoader(t)
      return
    }
    const n = Math.round(t.bags.loaded - (t.bags.closedTarget ?? t.bags.loaded))
    if (n <= 0) return this.finishService(t, 'bag_offload')
    const h = this.config.hold
    const begin = Math.max(this.now, t.loaderBusyUntil)
    const end = begin + h.offloadBaseMinutes + (h.offloadPerBagMinutes * n) / this.loaderMult(t)
    t.loaderBusyUntil = end
    t.services.bag_offload = 'active'
    this.timers.push({ turnaroundId: t.id, standId: t.standId, service: 'bag_offload', end, amount: n })
  }

  // ---- time

  private nextEventTime(): number {
    let next = Infinity
    const consider = (x: number): void => {
      if (x > this.now + EPS && x < next) next = x
      else if (x <= this.now + EPS && x < next) next = this.now
    }
    for (const v of this.vehicles) {
      consider(v.phaseEnd)
      if (v.wear.breakAt !== null) consider(v.wear.breakAt)
    }
    if (this.maintenance) consider(this.maintenance.nextEventTime())
    if (this.traffic?.driving()) consider(this.now + this.traffic.cfg.stepMinutes)
    for (const h of this.timers) consider(h.end)
    for (const d of this.deliveries) consider(d.eta)
    for (const t of this.turnarounds.values()) {
      if (t.completedAt !== null) continue
      for (const a of t.pax.arrivals) consider(a.time)
      for (const a of t.bags.arrivals) consider(a.time)
      const outbound = t.pax.booked > 0 || t.bags.expected > 0
      if (outbound && !t.gateClosed) consider(t.cutoff)
      if (t.pax.boardingStart !== null && !t.gateClosed) {
        t.pax.groupSizes.forEach((_g, i) => {
          const at = t.pax.boardingStart! + i * this.config.pax.groupGapMinutes
          if (at > this.now + EPS) consider(at)
        })
      }
      if (this.continuousBoarding(t)) {
        const gap = this.allowedToBoard(t) - t.pax.boarded
        if (gap > EPS) consider(this.now + gap / this.boardRate(t))
      }
    }
    return next
  }

  /** Kitchen production, vehicle upkeep, boarding flow and wait accounting. */
  private advanceContinuous(dt: number): void {
    this.traffic?.step(this.vehicles, dt, this.now + dt)
    this.flow?.accrue(dt)
    const k = this.config.kitchen
    const made = Math.min(k.capacityMeals - this.meals, (k.mealsPerHour * dt) / 60)
    if (made > 0) {
      this.meals += made
      if (this.traffic) this.contMoney.meals += made * k.costPerMeal
      else this.money(-made * k.costPerMeal, 'meal_production')
      if (this.mealsLowFlag && this.meals >= k.lowStockMeals) this.mealsLowFlag = false
    }
    let upkeep = 0
    for (const v of this.vehicles) upkeep += (this.config.vehicleSpecs[v.type].upkeepPerDay * dt) / 1440
    if (this.traffic) this.contMoney.upkeep += upkeep
    else this.money(-upkeep, 'vehicle_upkeep')
    this.maintenance?.advanceContinuous(dt)
    for (const t of this.turnarounds.values()) {
      if (t.completedAt !== null || t.services.boarding !== 'active') continue
      const p = t.pax
      const target = t.gateClosed ? p.atGate : p.booked
      const allowed = this.allowedToBoard(t)
      const moving = this.inTransitFor(t, 'boarding')
      if (this.continuousBoarding(t)) {
        const gap = allowed - p.boarded
        if (gap > EPS) p.boarded += Math.min(gap, this.boardRate(t) * dt)
      }
      const starved = allowed - p.boarded - moving <= EPS && p.boarded + moving < target - EPS
      if (starved && p.atGate < this.openedGroupSize(t)) p.lateWait += dt
    }
    for (const v of this.vehicles) {
      if (v.phase !== 'waiting_stock') continue
      const r = this.request(v)
      if (r && r.service === 'bag_load') this.turnarounds.get(r.turnaroundId)!.bags.wait += dt
    }
  }

  /** Handle everything due at this.now. Returns true if any state changed. */
  private processDue(): boolean {
    let changed = false
    const due = (x: number): boolean => x <= this.now + EPS
    for (const d of this.deliveries.filter((d) => due(d.eta))) {
      this.deliveries.splice(this.deliveries.indexOf(d), 1)
      const f = this.config.fuelFarm
      const accepted = Math.min(d.litres, f.capacityLitres - this.fuelLitres)
      this.fuelLitres += accepted
      this.money(-accepted * f.purchasePricePerLitre, 'fuel_purchase')
      this.emit({ type: 'delivery_arrived', time: this.now, litres: accepted, vehicleId: d.vehicleId })
      if (this.fuelLitres >= f.lowStockLitres) this.fuelLowFlag = false
      changed = true
      this.retryStockWaiters()
    }
    for (const t of Array.from(this.turnarounds.values())) {
      if (t.completedAt !== null) continue
      for (const a of t.pax.arrivals.filter((a) => due(a.time))) {
        t.pax.arrivals.splice(t.pax.arrivals.indexOf(a), 1)
        t.pax.atGate = Math.min(t.pax.booked, t.pax.atGate + a.count)
        changed = true
      }
      for (const a of t.bags.arrivals.filter((a) => due(a.time))) {
        t.bags.arrivals.splice(t.bags.arrivals.indexOf(a), 1)
        t.bags.atMakeup += a.count
        changed = true
      }
      const outbound = t.pax.booked > 0 || t.bags.expected > 0
      if (outbound && !t.gateClosed && due(t.cutoff)) {
        this.closeGate(t)
        changed = true
      }
      if (this.continuousBoarding(t)) {
        const before = t.services.boarding
        this.checkBoardingDone(t)
        if (t.services.boarding !== before) changed = true
      }
    }
    if (changed) this.retryStockWaiters()
    for (const h of this.timers.filter((h) => due(h.end))) {
      this.timers.splice(this.timers.indexOf(h), 1)
      const t = this.turnarounds.get(h.turnaroundId)!
      if (h.service === 'fuel') {
        this.emit({ type: 'refuel_stop', time: this.now, standId: h.standId, litres: h.amount, method: 'hydrant' })
      } else if (h.service === 'deplane') {
        t.pax.deplaned = h.amount
        this.emit({ type: 'pax_deplaned', time: this.now, standId: h.standId, count: h.amount })
      } else if (h.service === 'bag_offload') {
        t.bags.loaded -= h.amount
        t.bags.offloaded += h.amount
        if (t.bags.loaded - (t.bags.closedTarget ?? 0) > EPS) {
          this.startOffload(t)
          changed = true
          continue
        }
      }
      this.finishService(t, h.service)
      changed = true
    }
    for (const v of this.vehicles) {
      if (v.wear.breakAt !== null && due(v.wear.breakAt)) {
        this.maintenance!.breakDown(v)
        changed = true
        continue
      }
      if (due(v.phaseEnd)) {
        this.advanceVehicle(v)
        changed = true
      }
    }
    if (this.maintenance?.processDue()) changed = true
    return changed
  }

  // ---- vehicles

  private request(v: VehicleState): ServiceRequest | undefined {
    return v.requestId === null ? undefined : this.requests.find((r) => r.id === v.requestId)
  }

  private standNode(r: ServiceRequest): string {
    return this.stands.get(r.standId)!.node
  }

  private speed(v: VehicleState): number {
    return this.config.vehicleSpecs[v.type].speedKmh * (this.maintenance?.speedFactor(v) ?? 1)
  }

  private advanceVehicle(v: VehicleState): void {
    const r = this.request(v)
    switch (v.phase) {
      case 'to_source':
        if (!r) return this.idle(v)
        v.node = this.sourceNode(r)
        if (this.holdForBay(v, r, 'load')) return
        this.beginLoading(v, r)
        return
      case 'loading':
        if (!r) return this.idle(v)
        if (this.flow?.actor(v.id)?.phase === 'service') {
          this.beginDepart(v, 'load-done')
          return
        }
        this.travel(v, 'to_stand', this.standNode(r))
        return
      case 'to_stand':
        if (!r) return this.idle(v)
        v.node = this.standNode(r)
        this.emit({ type: 'truck_arrive', time: this.now, vehicleId: v.id, vehicle: v.type, standId: r.standId })
        if (this.holdForBay(v, r, 'stand')) return
        this.arriveAtStand(v, r)
        return
      case 'docking':
        this.advanceDock(v, r)
        return
      case 'departing':
        this.finishDepart(v, r)
        return
      case 'queued':
        return
      case 'servicing':
        if (!r) return this.idle(v)
        this.finishAtStand(v, r)
        return
      case 'to_dropoff': {
        v.node = r ? this.dropNode(r) : v.node
        if (r && this.holdForBay(v, r, 'drop')) return
        v.phase = 'unloading'
        v.phaseStart = this.now
        v.phaseEnd = this.now + (this.config.vehicleSpecs[v.type].dropMinutes ?? 1)
        return
      }
      case 'unloading': {
        if (r) {
          const n = Math.round(v.load)
          if (r.service === 'deplane') this.emit({ type: 'pax_deplaned', time: this.now, standId: r.standId, count: n })
          else if (r.service === 'bag_unload') this.emit({ type: 'bags_to_claim', time: this.now, standId: r.standId, count: n })
          else if (r.service === 'cargo_unload') this.emit({ type: 'cargo_to_area', time: this.now, standId: r.standId, kg: n })
        }
        v.load = 0
        const leavingBay =
          this.flow?.actor(v.id)?.phase === 'service' ||
          this.flow?.actor(v.id)?.phase === 'align' ||
          this.flow?.actor(v.id)?.phase === 'approach'
        this.idle(v)
        if (r && !leavingBay) this.checkOutDone(r)
        return
      }
      default:
        this.maintenance?.advance(v)
        return
    }
  }

  /** True when the vehicle is waiting on a bay instead of starting the work. */
  private holdForBay(v: VehicleState, r: ServiceRequest, intent: 'stand' | 'load' | 'drop'): boolean {
    if (!this.flow) return false
    if (this.flow.actor(v.id)?.phase === 'service') return false
    const place = intent === 'stand' ? 'stand' : intent === 'load' ? 'source' : 'drop'
    const anchorId = anchorIdFor(r.standId, r.service, place)
    if (!this.flow.anchor(anchorId)) return false
    if (!this.flow.actor(v.id)) this.flow.markOut(v.id, v.type, this.jobReason(r, place), r.turnaroundId)
    else {
      const actor = this.flow.actor(v.id)!
      this.flow.markOut(v.id, v.type, this.jobReason(r, place), actor.turnaroundId || r.turnaroundId)
    }
    v.dockIntent = intent
    const got = this.flow.claim(v.id, anchorId)
    if (got === 'queue') {
      v.phase = 'queued'
      v.phaseStart = this.now
      v.phaseEnd = Infinity
      return true
    }
    this.flow.enter(v.id, 'approach')
    v.phase = 'docking'
    v.phaseStart = this.now
    v.phaseEnd = this.now + this.flow.timing.approachMin
    return true
  }

  private advanceDock(v: VehicleState, r: ServiceRequest | undefined): void {
    const actor = this.flow?.actor(v.id)
    if (!this.flow || !actor) return this.idle(v)
    if (actor.phase === 'approach') {
      this.flow.enter(v.id, 'align')
      v.phaseStart = this.now
      v.phaseEnd = this.now + this.flow.timing.alignMin
      return
    }
    this.flow.enter(v.id, 'service')
    if (!r) return this.idle(v)
    if (v.dockIntent === 'load') this.beginLoading(v, r)
    else if (v.dockIntent === 'drop') {
      v.phase = 'unloading'
      v.phaseStart = this.now
      v.phaseEnd = this.now + (this.config.vehicleSpecs[v.type].dropMinutes ?? 1)
    } else this.arriveAtStand(v, r)
  }

  private beginDepart(v: VehicleState, intent: DockIntent): void {
    if (!this.flow) return this.idle(v)
    this.flow.beginDepart(v.id)
    v.dockIntent = intent
    v.phase = 'departing'
    v.phaseStart = this.now
    v.phaseEnd = this.now + this.flow.timing.departMin
  }

  private finishDepart(v: VehicleState, r: ServiceRequest | undefined): void {
    const intent = v.dockIntent
    // A full load drives on. An empty pickup just clears the bay.
    if (intent === 'load-done' && r && this.flow && v.load > EPS) {
      const next = this.flow.releaseBay(v.id)
      v.dockIntent = null
      this.travel(v, 'to_stand', this.standNode(r))
      if (next) this.promote(next)
      return
    }
    if (intent === 'stand-to-drop' && r && this.flow) {
      const next = this.flow.releaseBay(v.id)
      v.dockIntent = null
      this.travel(v, 'to_dropoff', this.dropNode(r))
      if (next) this.promote(next)
      return
    }
    this.idle(v)
    if (!r) return
    // The job stays assigned through the pull-away, so the completion check
    // has to run again once the vehicle is actually free.
    if (intent === 'drop-done') this.checkOutDone(r)
    else if ((intent === 'stand-done' || intent === 'load-done') && r.mode === 'in') this.checkInDone(r)
  }

  private promote(id: string): void {
    const v = this.vehicles.find((x) => x.id === id)
    if (!v || !this.flow) return
    v.phase = 'docking'
    v.phaseStart = this.now
    v.phaseEnd = this.now + this.flow.timing.approachMin
  }

  private jobReason(r: ServiceRequest, place: 'stand' | 'source' | 'drop'): string {
    const t = this.turnarounds.get(r.turnaroundId)
    const callsign = t?.callsign ?? ''
    if (place === 'source') {
      const where =
        r.service === 'fuel'
          ? 'the fuel farm'
          : r.service === 'catering'
            ? 'the flight kitchen'
            : r.service === 'bag_load'
              ? 'bag makeup'
              : r.service === 'boarding'
                ? 'the terminal kerb'
                : 'the cargo dock'
      return serviceReason(r.service === 'fuel' ? 'fill' : r.service, callsign, where)
    }
    if (place === 'drop') {
      return serviceReason('drop', callsign, r.service === 'cargo_unload' ? 'the cargo dock' : 'the terminal kerb')
    }
    return serviceReason(r.service, callsign, standLabel(r.standId))
  }

  private travel(v: VehicleState, phase: VehiclePhase, dest: string): void {
    v.route = this.roads.route(v.node, dest)
    v.phaseStart = this.now
    v.phase = phase
    let mins = this.roads.travelMinutes(v.node, dest, this.speed(v))
    if (this.traffic && Number.isFinite(mins)) mins = this.traffic.begin(v, dest, this.now, (this.speed(v) * 1000) / 60)
    v.phaseEnd = this.now + mins
    this.maintenance?.onTravel(v, v.node, dest, mins)
  }

  /** A vehicle broke down mid-job: hand the work back to the queue. */
  private releaseJob(v: VehicleState): void {
    const r = this.request(v)
    v.requestId = null
    const reserved = v.reserved
    v.reserved = 0
    v.serving = 0
    if (!r) return
    const t = this.turnarounds.get(r.turnaroundId)!
    t.causes.add('vehicle_breakdown')
    if (r.mode === 'in' || r.mode === 'out') r.reserved = Math.max(0, r.reserved - reserved)
    if (r.mode === 'in' && v.load > 0) {
      // Pax / bags / cargo go back to the gate, make-up or shed for the next vehicle.
      r.inTransit -= v.load
      v.load = 0
    }
    if (r.mode === 'out' && v.load > 0) {
      // Already off the aircraft: transferred to another vehicle on the spot.
      const n = Math.round(v.load)
      if (r.service === 'deplane') this.emit({ type: 'pax_deplaned', time: this.now, standId: r.standId, count: n })
      else if (r.service === 'bag_unload') this.emit({ type: 'bags_to_claim', time: this.now, standId: r.standId, count: n })
      else if (r.service === 'cargo_unload') this.emit({ type: 'cargo_to_area', time: this.now, standId: r.standId, kg: n })
      v.load = 0
      this.checkOutDone(r)
    }
    if ((r.mode === 'carry' || r.mode === 'onsite') && t.services[r.service] === 'active') t.services[r.service] = 'pending'
  }

  private idle(v: VehicleState): void {
    const phase = this.flow?.actor(v.id)?.phase
    if (phase === 'service' || phase === 'align' || phase === 'approach') {
      const intent: DockIntent = v.dockIntent === 'load' ? 'load-done' : v.dockIntent === 'drop' ? 'drop-done' : 'stand-done'
      this.beginDepart(v, intent)
      return
    }
    const next = this.flow?.release(v.id) ?? null
    v.phase = 'idle'
    v.phaseEnd = Infinity
    v.requestId = null
    v.serving = 0
    v.reserved = 0
    v.route = null
    v.dockIntent = null
    if (next) this.promote(next)
  }

  private beginLoading(v: VehicleState, r: ServiceRequest): void {
    if (v.type === 'hydrant_dispenser') return this.arriveAtStand(v, r)
    const spec = this.config.vehicleSpecs[v.type]
    const t = this.turnarounds.get(r.turnaroundId)!
    if (r.mode === 'carry') {
      const isFuel = r.service === 'fuel'
      const want = Math.min(spec.capacity, r.target - r.done) - v.load
      const avail = Math.floor(isFuel ? this.fuelLitres : this.meals)
      const take = Math.max(0, Math.min(want, avail))
      if (take <= 0 && v.load <= 0) {
        v.phase = 'waiting_stock'
        v.phaseEnd = Infinity
        t.causes.add(isFuel ? 'no_fuel' : 'no_meals')
        return
      }
      if (take + EPS < want) t.causes.add(isFuel ? 'no_fuel' : 'no_meals')
      if (isFuel) this.fuelLitres -= take
      else this.meals -= take
      v.load += take
      this.checkLowStock()
      v.phase = 'loading'
      v.phaseEnd = this.now + (take > 0 ? spec.loadMinutes : 0)
      return
    }
    // in-job: take from this turnaround's pool.
    const take = Math.floor(Math.min(v.reserved, this.pool(r), this.targetOf(r) - r.done - r.inTransit) + EPS)
    if (take <= 0) {
      if (this.targetOf(r) - r.done - r.inTransit <= EPS) {
        r.reserved = Math.max(0, r.reserved - v.reserved)
        this.idle(v)
        this.checkInDone(r)
        return
      }
      v.phase = 'waiting_stock'
      v.phaseEnd = Infinity
      return
    }
    r.reserved = Math.max(0, r.reserved - v.reserved)
    v.reserved = 0
    r.inTransit += take
    v.load = take
    v.phase = 'loading'
    const loadMin = r.service === 'boarding' ? take / this.config.pax.busGateLoadPerMin : spec.loadMinutes
    v.phaseEnd = this.now + loadMin
  }

  private arriveAtStand(v: VehicleState, r: ServiceRequest): void {
    const t = this.turnarounds.get(r.turnaroundId)!
    v.phase = 'servicing'
    v.phaseStart = this.now
    if (r.mode === 'onsite') {
      if (r.service === 'loader') {
        t.loaderVehicle = v.id
        t.loaderBusyUntil = Math.max(t.loaderBusyUntil, this.now)
        t.services.loader = 'active'
        v.phaseEnd = Infinity
        if (t.services.bag_offload === 'pending') this.startOffload(t)
        this.maybeReleaseLoader(t)
        return
      }
      v.serving = 1
      if (r.service === 'pushback') {
        v.phaseEnd = Infinity
        this.maybeStartPushback(t)
        return
      }
      t.services[r.service] = 'active'
      v.phaseEnd = this.now + (r.service === 'lav' || r.service === 'water' ? lavWaterMinutes(t.needs.cleaningMinutes) : t.needs.gpuMinutes)
      return
    }
    if (r.mode === 'carry') {
      t.services[r.service] = 'active'
      if (v.type === 'hydrant_dispenser') {
        // Cart couples to the hydrant pit: fuel comes straight from the farm.
        const take = Math.min(r.target - r.done, Math.floor(this.fuelLitres))
        if (take <= 0) {
          t.causes.add('no_fuel')
          t.services.fuel = 'pending'
          v.phase = 'waiting_stock'
          v.phaseEnd = Infinity
          return
        }
        this.fuelLitres -= take
        this.checkLowStock()
        v.load = take
        v.serving = take
        v.phaseEnd = this.now + take / this.config.hydrantPumpLpm
        this.emit({ type: 'refuel_start', time: this.now, standId: r.standId, litres: take, method: 'hydrant', vehicleId: v.id })
        return
      }
      v.serving = Math.min(v.load, r.target - r.done)
      if (r.service === 'fuel') {
        const lpm = this.config.vehicleSpecs[v.type].pumpLpm ?? this.config.truckPumpLpm
        v.phaseEnd = this.now + v.serving / lpm
        this.emit({ type: 'refuel_start', time: this.now, standId: r.standId, litres: v.serving, method: 'truck', vehicleId: v.id })
      } else {
        const mult = this.compatMult(r, v.type)
        if (mult < 1) t.causes.add('undersized_vehicle')
        v.phaseEnd = this.now + (t.needs.cateringMinutes * (v.serving / Math.max(1, t.needs.meals))) / mult
      }
      return
    }
    t.services[r.service] = 'active'
    if (r.mode === 'out') {
      const n = Math.min(this.capacityFor(v, r), r.target - r.done - r.inTransit)
      r.reserved = Math.max(0, r.reserved - v.reserved)
      v.reserved = 0
      if (n <= EPS) return this.idle(v)
      r.inTransit += n
      v.serving = n
    } else {
      v.serving = v.load
    }
    // Hold work is serialised on the loader, bus work on the stairs.
    const hold = r.service !== 'deplane' && r.service !== 'boarding'
    const rate = hold
      ? (r.service.startsWith('cargo') ? this.holdRates(t).kgPerMin : this.holdRates(t).bagsPerMin) * this.loaderMult(t)
      : r.service === 'deplane'
        ? this.deplaneRate(t)
        : this.boardRate(t)
    const begin = Math.max(this.now, hold ? t.loaderBusyUntil : t.doorBusyUntil)
    const end = begin + v.serving / rate
    if (hold) t.loaderBusyUntil = end
    else t.doorBusyUntil = end
    v.phaseStart = begin
    v.phaseEnd = end
  }

  /** Loader on station: its own rate and how well it fits the aircraft. */
  private loaderMult(t: TurnaroundState): number {
    const v = this.vehicles.find((x) => x.id === t.loaderVehicle)
    if (!v) return 1
    const lr = this.requests.find((x) => x.turnaroundId === t.id && x.service === 'loader')
    const mult = (this.config.vehicleSpecs[v.type].rateMult ?? 1) * (lr ? this.compatMult(lr, v.type) : 1)
    if (lr && this.compatMult(lr, v.type) < 1) t.causes.add('undersized_vehicle')
    return mult
  }

  private finishAtStand(v: VehicleState, r: ServiceRequest): void {
    const t = this.turnarounds.get(r.turnaroundId)!
    this.maintenance?.onUse(v)
    if (r.mode === 'onsite') {
      this.dropRequest(r)
      this.idle(v)
      this.finishService(t, r.service)
      return
    }
    if (r.mode === 'carry') {
      v.load -= v.serving
      r.done += v.serving
      if (r.service === 'fuel') {
        this.money(v.serving * this.fuelSellPrice, 'fuel_sales')
        this.emit({ type: 'refuel_stop', time: this.now, standId: r.standId, litres: v.serving, method: 'truck', vehicleId: v.id })
      } else {
        this.money(v.serving * this.config.kitchen.feePerMeal, 'catering_fees')
      }
      this.idle(v)
      if (r.done >= r.target - EPS) {
        this.dropRequest(r)
        if (!this.requests.some((x) => x.turnaroundId === t.id && x.service === r.service)) this.finishService(t, r.service)
      } else {
        t.services[r.service] = 'pending'
      }
      return
    }
    if (r.mode === 'out') {
      const n = v.serving
      r.inTransit -= n
      r.done += n
      v.load = n
      v.serving = 0
      if (r.service === 'deplane') t.pax.deplaned += n
      if (r.done >= r.target - EPS && t.services[r.service] !== 'done') {
        this.finishService(t, r.service)
      }
      // Pull off the stand bay before the drive to the kerb, so the next cart can dock.
      const parked = this.flow?.actor(v.id)?.phase
      if (parked === 'service' || parked === 'align' || parked === 'approach') {
        this.beginDepart(v, 'stand-to-drop')
        return
      }
      this.travel(v, 'to_dropoff', this.dropNode(r))
      return
    }
    // in: deliver into the aircraft.
    const n = v.load
    r.inTransit -= n
    r.done += n
    v.load = 0
    if (r.service === 'boarding') t.pax.boarded += n
    else if (r.service === 'bag_load') t.bags.loaded += n
    else t.cargoLoaded += n
    this.idle(v)
    if (r.service === 'bag_load') this.checkOffload(t)
    if (r.service === 'boarding') this.checkBoardingDone(t)
    else this.checkInDone(r)
  }

  private dropRequest(r: ServiceRequest): void {
    const i = this.requests.indexOf(r)
    if (i >= 0) this.requests.splice(i, 1)
  }

  private checkInDone(r: ServiceRequest): void {
    if (r.mode !== 'in' || !this.requests.includes(r)) return
    const t = this.turnarounds.get(r.turnaroundId)!
    if (r.service === 'boarding') return this.checkBoardingDone(t)
    if (r.done >= this.targetOf(r) - EPS && r.inTransit <= EPS) {
      // A tug that already put its load on the aircraft may still be pulling off the bay.
      // That pull-away is not more work, so it must not hold the service open.
      const stillWorking = this.vehicles.some(
        (v) => v.requestId === r.id && !(v.phase === 'departing' && (v.dockIntent === 'stand-done' || (v.dockIntent === 'load-done' && v.load <= EPS))),
      )
      if (stillWorking) return
      this.dropRequest(r)
      this.finishService(t, r.service)
    }
  }

  private checkOutDone(r: ServiceRequest): void {
    if (r.done >= r.target - EPS && !this.vehicles.some((v) => v.requestId === r.id)) this.dropRequest(r)
  }

  private retryStockWaiters(): void {
    for (const v of this.vehicles) {
      if (v.phase !== 'waiting_stock') continue
      const r = this.request(v)
      if (r) this.beginLoading(v, r)
      else this.idle(v)
    }
    for (const t of this.turnarounds.values()) {
      if (t.completedAt === null && t.services.fuel === 'pending' && this.hasHydrant(t) && !this.fleetHas('hydrant_dispenser')) {
        this.tryHydrant(t)
      }
    }
  }

  private hasHydrant(t: TurnaroundState): boolean {
    return this.stand(t).hydrant && (this.maintenance?.hydrantWorking(t.standId) ?? true) && !this.requests.some((r) => r.turnaroundId === t.id && r.service === 'fuel')
  }

  private tryHydrant(t: TurnaroundState): void {
    if (this.timers.some((h) => h.turnaroundId === t.id && h.service === 'fuel')) return
    const litres = t.needs.fuelLitres
    t.services.fuel = 'pending'
    if (this.fuelLitres < litres) {
      t.causes.add('no_fuel')
      return
    }
    this.fuelLitres -= litres
    this.checkLowStock()
    this.addTimer(t, 'fuel', litres / this.config.hydrantPumpLpm, litres)
    this.money(litres * this.fuelSellPrice, 'fuel_sales')
    this.emit({ type: 'refuel_start', time: this.now, standId: t.standId, litres, method: 'hydrant' })
  }

  private checkLowStock(): void {
    const f = this.config.fuelFarm
    if (!this.fuelLowFlag && this.fuelLitres < f.lowStockLitres) {
      this.fuelLowFlag = true
      this.emit({ type: 'low_stock', time: this.now, stock: 'fuel', level: this.fuelLitres })
    }
    if (f.autoReorder && this.deliveries.length === 0 && this.fuelLitres < f.lowStockLitres) this.orderFuel()
    const k = this.config.kitchen
    if (!this.mealsLowFlag && this.meals < k.lowStockMeals) {
      this.mealsLowFlag = true
      this.emit({ type: 'low_stock', time: this.now, stock: 'meals', level: this.meals })
    }
  }

  private complete(t: TurnaroundState): void {
    if (t.completedAt !== null) return
    t.completedAt = this.now
    this.byStand.delete(t.standId)
    this.maintenance?.onTurnaroundComplete(t.standId)
    for (const r of this.requests.slice()) {
      if (r.turnaroundId === t.id && !this.vehicles.some((v) => v.requestId === r.id)) this.dropRequest(r)
    }
    const delay = Math.max(0, t.completedAt - t.readyBy)
    const graded = gradeTurnaround({
      scheduledMin: Math.max(0, t.readyBy - t.startedAt),
      actualMin: t.completedAt - t.startedAt,
      queuedMin: this.flow?.queuedMinutes(t.id) ?? 0,
    })
    if (delay > 0) {
      const paxWork = t.pax.arriving > 0 || t.pax.booked > 0
      if (paxWork && t.access !== 'bridge') t.causes.add('no_bridge')
      // Late passengers / bags only count when they pushed the work past gate close.
      if (t.pax.lateWait > EPS && (t.pax.boardingEnd ?? 0) > t.cutoff + EPS) t.causes.add('late_pax')
      if (t.bags.wait > EPS && (t.bags.loadEnd ?? 0) > t.cutoff + EPS) t.causes.add('late_bags')
    }
    this.emit({
      type: 'turnaround_complete',
      time: this.now,
      standId: t.standId,
      turnaroundId: t.id,
      delayMinutes: delay,
      causes: delay > 0 ? [...t.causes].sort() : [],
      grade: graded.grade,
      gradeNote: graded.note,
    })
  }

  /** FIFO: each waiting request gets the idle vehicles of its type with the shortest trips. */
  private dispatch(): void {
    for (const r of this.requests.slice()) {
      const t = this.turnarounds.get(r.turnaroundId)!
      if (t.completedAt !== null) continue
      const hold = HOLD_SERVICES.includes(r.service)
      if (hold && !t.loaderVehicle) continue
      const single = r.mode === 'carry' || r.mode === 'onsite'
      for (;;) {
        if (single) {
          if (this.vehicles.some((v) => v.requestId === r.id)) break
        } else if (this.openAmount(r) <= EPS) break
        const dest = this.standNode(r)
        // Best-fitting type first (an undersized truck only if nothing better is free), then nearest.
        let best: VehicleState | null = null
        let bestT = Infinity
        let bestFit = -1
        for (const v of this.vehicles) {
          if (!r.vehicles.includes(v.type) || v.phase !== 'idle') continue
          if (this.flow && !this.flow.canDispatch(v.type)) continue
          if (v.heldFor && v.heldFor !== t.externalFlightId) continue
          if (this.config.strictSizeTiers && !vehicleCanServe(v.type, sizeTierOf(t.needs.airframeId))) continue
          const fit = this.compatMult(r, v.type) * 10 - r.vehicles.indexOf(v.type)
          const tt = this.tripMinutes(v, r, dest)
          if (fit > bestFit + EPS || (Math.abs(fit - bestFit) <= EPS && tt < bestT - EPS)) {
            best = v
            bestT = tt
            bestFit = fit
          }
        }
        if (!best) {
          t.causes.add(r.service === 'loader' ? 'no_loader' : 'no_vehicle')
          break
        }
        best.requestId = r.id
        this.flow?.markOut(best.id, best.type, this.jobReason(r, this.visitsSource(best, r) ? 'source' : 'stand'), t.id)
        if (!single) {
          best.reserved = Math.min(this.capacityFor(best, r), this.openAmount(r))
          r.reserved += best.reserved
        }
        if (this.visitsSource(best, r)) this.travel(best, 'to_source', this.sourceNode(r))
        else this.travel(best, 'to_stand', dest)
      }
    }
    this.maintenance?.afterDispatch()
  }

  private visitsSource(v: VehicleState, r: ServiceRequest): boolean {
    if (r.mode === 'in') return true
    if (r.mode !== 'carry' || v.type === 'hydrant_dispenser') return false
    return v.load + EPS < Math.min(this.config.vehicleSpecs[v.type].capacity, r.target - r.done)
  }

  private tripMinutes(v: VehicleState, r: ServiceRequest, dest: string): number {
    const sp = this.speed(v)
    if (this.visitsSource(v, r)) {
      const s = this.sourceNode(r)
      return this.roads.travelMinutes(v.node, s, sp) + this.roads.travelMinutes(s, dest, sp)
    }
    return this.roads.travelMinutes(v.node, dest, sp)
  }
}
