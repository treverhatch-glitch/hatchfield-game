import { needsFor } from './needs'
import { RoadGraph } from './roads'
import type {
  DelayCause,
  Ledger,
  LogisticsConfig,
  LogisticsEvent,
  MoneyCategory,
  ServiceKind,
  StandConfig,
  TurnaroundNeeds,
  VehicleType,
} from './types'
import { VEHICLE_TYPES } from './types'

const SERVICE_VEHICLE: Record<ServiceKind, VehicleType> = {
  fuel: 'fuel_truck',
  catering: 'catering_truck',
  baggage: 'baggage_tug',
  gpu: 'gpu',
  pushback: 'pushback_tug',
}

const EPS = 1e-9

export type VehiclePhase = 'idle' | 'to_supply' | 'loading' | 'waiting_stock' | 'to_stand' | 'servicing'

export interface VehicleState {
  id: string
  type: VehicleType
  node: string
  phase: VehiclePhase
  /** When the current phase ends (Infinity for idle / waiting). */
  phaseEnd: number
  /** Litres or meals on board. */
  load: number
  /** Request currently served. */
  requestId: number | null
  /** Amount being pumped / delivered in the current service phase. */
  serving: number
}

interface ServiceRequest {
  id: number
  turnaroundId: string
  standId: string
  service: ServiceKind
  /** Litres or meals still to deliver (fuel/catering); 1 otherwise. */
  remaining: number
  createdAt: number
}

interface HydrantJob {
  turnaroundId: string
  standId: string
  litres: number
  end: number
}

interface Delivery {
  litres: number
  eta: number
  vehicleId: string
}

export type ServiceStatus = 'pending' | 'active' | 'done'

export interface TurnaroundState {
  id: string
  standId: string
  airframeId: string
  needs: TurnaroundNeeds
  startedAt: number
  readyBy: number
  services: Partial<Record<ServiceKind, ServiceStatus>>
  causes: Set<DelayCause>
  completedAt: number | null
}

export type LogisticsListener = (e: LogisticsEvent) => void

/**
 * Deterministic, pure-TS ground logistics. Drive it with tick(dtMinutes).
 * Results do not depend on how a span of time is split into ticks.
 */
export class LogisticsSim {
  readonly config: LogisticsConfig
  readonly roads: RoadGraph
  now = 0
  fuelLitres: number
  meals: number
  readonly vehicles: VehicleState[] = []
  readonly ledger: Ledger = { fuelSales: 0, cateringFees: 0, fuelPurchase: 0, mealProduction: 0, vehicleUpkeep: 0 }
  private readonly stands = new Map<string, StandConfig>()
  private readonly turnarounds = new Map<string, TurnaroundState>()
  private readonly byStand = new Map<string, string>()
  private requests: ServiceRequest[] = []
  private hydrants: HydrantJob[] = []
  private deliveries: Delivery[] = []
  private readonly listeners: LogisticsListener[] = []
  private nextReq = 1
  private nextTurn = 1
  private nextDelivery = 1
  private fuelLowFlag = false
  private mealsLowFlag = false

  constructor(config: LogisticsConfig) {
    this.config = config
    this.roads = new RoadGraph(config.nodes, config.edges)
    for (const n of [config.depotNode, config.fuelFarm.node, config.kitchen.node]) {
      if (!this.roads.has(n)) throw new Error(`Unknown road node: ${n}`)
    }
    for (const s of config.stands) {
      if (!this.roads.has(s.node)) throw new Error(`Stand ${s.id} on unknown node ${s.node}`)
      this.stands.set(s.id, s)
    }
    this.fuelLitres = Math.min(config.fuelFarm.initialLitres, config.fuelFarm.capacityLitres)
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
        })
      }
    }
  }

  // ---------------------------------------------------------------- public API

  on(listener: LogisticsListener): () => void {
    this.listeners.push(listener)
    return () => {
      const i = this.listeners.indexOf(listener)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  get fuelSellPrice(): number {
    const f = this.config.fuelFarm
    return f.purchasePricePerLitre * (1 + f.markup)
  }

  get profit(): number {
    const l = this.ledger
    return l.fuelSales + l.cateringFees - l.fuelPurchase - l.mealProduction - l.vehicleUpkeep
  }

  get inboundLitres(): number {
    return this.deliveries.reduce((s, d) => s + d.litres, 0)
  }

  /** Aircraft blocked in on a stand: queue its services. Returns the turnaround id. */
  startTurnaround(standId: string, airframeId: string, scheduledMinutes: number): string {
    if (!this.stands.has(standId)) throw new Error(`Unknown stand: ${standId}`)
    if (this.byStand.has(standId)) throw new Error(`Stand ${standId} already has a turnaround`)
    const needs = needsFor(airframeId)
    const id = `T${this.nextTurn++}`
    const t: TurnaroundState = {
      id,
      standId,
      airframeId,
      needs,
      startedAt: this.now,
      readyBy: this.now + scheduledMinutes,
      services: {},
      causes: new Set(),
      completedAt: null,
    }
    this.turnarounds.set(id, t)
    this.byStand.set(standId, id)
    for (const s of needs.services) {
      if (s === 'pushback') continue
      t.services[s] = 'pending'
      if (s === 'fuel' && this.stands.get(standId)!.hydrant) {
        this.tryHydrant(t)
      } else {
        this.addRequest(t, s, s === 'fuel' ? needs.fuelLitres : s === 'catering' ? needs.meals : 1)
      }
    }
    if (needs.services.includes('pushback')) t.services.pushback = 'pending'
    this.checkPushbackReady(t)
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

  /** Projected delay right now (minutes past readyBy, or 0). */
  currentDelay(id: string): number {
    const t = this.turnarounds.get(id)
    if (!t) return 0
    const end = t.completedAt ?? this.now
    return Math.max(0, end - t.readyBy)
  }

  /** Pending requests not yet assigned to a vehicle. */
  get queueLength(): number {
    return this.requests.filter((r) => !this.vehicles.some((v) => v.requestId === r.id)).length
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
    for (let guard = 0; guard < 100000; guard++) {
      const next = Math.min(this.nextEventTime(), target)
      this.advanceContinuous(next - this.now)
      this.now = next
      const progressed = this.processDue()
      if (progressed) this.dispatch()
      if (this.now >= target - EPS && !progressed) break
    }
    this.now = target
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
    }
    this.ledger[key[category]] += Math.abs(amount)
    this.emit({ type: 'money', time: this.now, amount, category })
  }

  private addRequest(t: TurnaroundState, service: ServiceKind, remaining: number): void {
    this.requests.push({
      id: this.nextReq++,
      turnaroundId: t.id,
      standId: t.standId,
      service,
      remaining,
      createdAt: this.now,
    })
  }

  private nextEventTime(): number {
    let t = Infinity
    for (const v of this.vehicles) if (v.phaseEnd < t) t = v.phaseEnd
    for (const h of this.hydrants) if (h.end < t) t = h.end
    for (const d of this.deliveries) if (d.eta < t) t = d.eta
    return t
  }

  /** Kitchen production and vehicle upkeep accrue continuously. */
  private advanceContinuous(dt: number): void {
    if (dt <= 0) return
    const k = this.config.kitchen
    const made = Math.min(k.capacityMeals - this.meals, (k.mealsPerHour * dt) / 60)
    if (made > 0) {
      this.meals += made
      this.money(-made * k.costPerMeal, 'meal_production')
      if (this.mealsLowFlag && this.meals >= k.lowStockMeals) this.mealsLowFlag = false
    }
    let upkeep = 0
    for (const v of this.vehicles) upkeep += (this.config.vehicleSpecs[v.type].upkeepPerDay * dt) / 1440
    this.money(-upkeep, 'vehicle_upkeep')
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
    for (const h of this.hydrants.filter((h) => due(h.end))) {
      this.hydrants.splice(this.hydrants.indexOf(h), 1)
      this.emit({ type: 'refuel_stop', time: this.now, standId: h.standId, litres: h.litres, method: 'hydrant' })
      this.finishService(h.turnaroundId, 'fuel')
      changed = true
    }
    for (const v of this.vehicles) {
      if (due(v.phaseEnd)) {
        this.advanceVehicle(v)
        changed = true
      }
    }
    return changed
  }

  private request(v: VehicleState): ServiceRequest | undefined {
    return this.requests.find((r) => r.id === v.requestId)
  }

  private advanceVehicle(v: VehicleState): void {
    const req = this.request(v)
    switch (v.phase) {
      case 'to_supply':
        v.node = this.supplyNode(v.type)
        this.beginLoading(v)
        return
      case 'loading':
        this.goToStand(v)
        return
      case 'to_stand': {
        if (!req) return this.idle(v)
        v.node = this.stands.get(req.standId)!.node
        this.emit({ type: 'truck_arrive', time: this.now, vehicleId: v.id, vehicle: v.type, standId: req.standId })
        const t = this.turnarounds.get(req.turnaroundId)!
        t.services[req.service] = 'active'
        v.phase = 'servicing'
        if (req.service === 'fuel') {
          v.serving = Math.min(v.load, req.remaining)
          v.phaseEnd = this.now + v.serving / this.config.truckPumpLpm
          this.emit({ type: 'refuel_start', time: this.now, standId: req.standId, litres: v.serving, method: 'truck', vehicleId: v.id })
        } else if (req.service === 'catering') {
          v.serving = Math.min(v.load, req.remaining)
          v.phaseEnd = this.now + t.needs.cateringMinutes * (req.remaining > 0 ? v.serving / req.remaining : 1)
        } else {
          v.serving = 1
          v.phaseEnd = this.now + this.serviceMinutes(t.needs, req.service)
        }
        return
      }
      case 'servicing': {
        if (!req) return this.idle(v)
        if (req.service === 'fuel') {
          v.load -= v.serving
          this.money(v.serving * this.fuelSellPrice, 'fuel_sales')
          this.emit({ type: 'refuel_stop', time: this.now, standId: req.standId, litres: v.serving, method: 'truck', vehicleId: v.id })
        } else if (req.service === 'catering') {
          v.load -= v.serving
          this.money(v.serving * this.config.kitchen.feePerMeal, 'catering_fees')
        }
        req.remaining -= v.serving
        if (req.remaining <= EPS) {
          this.requests.splice(this.requests.indexOf(req), 1)
          this.finishService(req.turnaroundId, req.service)
        } else {
          // Partial: leave the request queued for another trip.
          const t = this.turnarounds.get(req.turnaroundId)!
          t.services[req.service] = 'pending'
        }
        this.idle(v)
        return
      }
      default:
        return
    }
  }

  private idle(v: VehicleState): void {
    v.phase = 'idle'
    v.phaseEnd = Infinity
    v.requestId = null
    v.serving = 0
  }

  private serviceMinutes(n: TurnaroundNeeds, s: ServiceKind): number {
    if (s === 'baggage') return n.baggageMinutes
    if (s === 'gpu') return n.gpuMinutes
    if (s === 'pushback') return n.pushbackMinutes
    return n.cateringMinutes
  }

  private supplyNode(type: VehicleType): string {
    return type === 'fuel_truck' ? this.config.fuelFarm.node : this.config.kitchen.node
  }

  private needsSupply(type: VehicleType): boolean {
    return type === 'fuel_truck' || type === 'catering_truck'
  }

  private beginLoading(v: VehicleState): void {
    const spec = this.config.vehicleSpecs[v.type]
    const req = this.request(v)
    const want = Math.min(spec.capacity, req ? req.remaining : spec.capacity) - v.load
    const isFuel = v.type === 'fuel_truck'
    const avail = Math.floor(isFuel ? this.fuelLitres : this.meals)
    const take = Math.max(0, Math.min(want, avail))
    if (take <= 0 && v.load <= 0) {
      v.phase = 'waiting_stock'
      v.phaseEnd = Infinity
      if (req) this.turnarounds.get(req.turnaroundId)?.causes.add(isFuel ? 'no_fuel' : 'no_meals')
      return
    }
    if (isFuel) this.fuelLitres -= take
    else this.meals -= take
    v.load += take
    this.checkLowStock()
    v.phase = 'loading'
    v.phaseEnd = this.now + (take > 0 ? spec.loadMinutes : 0)
  }

  private goToStand(v: VehicleState): void {
    const req = this.request(v)
    if (!req) return this.idle(v)
    const dest = this.stands.get(req.standId)!.node
    v.phase = 'to_stand'
    v.phaseEnd = this.now + this.roads.travelMinutes(v.node, dest, this.config.vehicleSpecs[v.type].speedKmh)
  }

  private retryStockWaiters(): void {
    for (const v of this.vehicles) if (v.phase === 'waiting_stock') this.beginLoading(v)
    for (const t of this.turnarounds.values()) {
      if (t.completedAt === null && t.services.fuel === 'pending' && this.stands.get(t.standId)!.hydrant) {
        this.tryHydrant(t)
      }
    }
  }

  private tryHydrant(t: TurnaroundState): void {
    if (this.hydrants.some((h) => h.turnaroundId === t.id)) return
    const litres = t.needs.fuelLitres
    if (this.fuelLitres < litres) {
      t.causes.add('no_fuel')
      return
    }
    this.fuelLitres -= litres
    this.checkLowStock()
    t.services.fuel = 'active'
    this.hydrants.push({ turnaroundId: t.id, standId: t.standId, litres, end: this.now + litres / this.config.hydrantPumpLpm })
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

  private finishService(turnaroundId: string, service: ServiceKind): void {
    const t = this.turnarounds.get(turnaroundId)
    if (!t) return
    t.services[service] = 'done'
    this.emit({ type: 'service_done', time: this.now, standId: t.standId, service })
    if (service === 'pushback') return this.complete(t)
    this.checkPushbackReady(t)
  }

  private checkPushbackReady(t: TurnaroundState): void {
    const others = (Object.keys(t.services) as ServiceKind[]).filter((s) => s !== 'pushback')
    if (!others.every((s) => t.services[s] === 'done')) return
    if (t.services.pushback === 'pending') {
      if (!this.requests.some((r) => r.turnaroundId === t.id && r.service === 'pushback')) {
        this.addRequest(t, 'pushback', 1)
      }
    } else if (t.services.pushback === undefined) {
      this.complete(t)
    }
  }

  private complete(t: TurnaroundState): void {
    if (t.completedAt !== null) return
    t.completedAt = this.now
    this.byStand.delete(t.standId)
    const delay = Math.max(0, t.completedAt - t.readyBy)
    this.emit({
      type: 'turnaround_complete',
      time: this.now,
      standId: t.standId,
      turnaroundId: t.id,
      delayMinutes: delay,
      causes: delay > 0 ? [...t.causes].sort() : [],
    })
  }

  /** FIFO: each waiting request gets the idle vehicle of its type with the shortest trip. */
  private dispatch(): void {
    for (const req of this.requests) {
      if (this.vehicles.some((v) => v.requestId === req.id)) continue
      const type = SERVICE_VEHICLE[req.service]
      const dest = this.stands.get(req.standId)!.node
      let best: VehicleState | null = null
      let bestT = Infinity
      for (const v of this.vehicles) {
        if (v.type !== type || v.phase !== 'idle') continue
        const tt = this.tripMinutes(v, dest, req.remaining)
        if (tt < bestT - EPS) {
          best = v
          bestT = tt
        }
      }
      const t = this.turnarounds.get(req.turnaroundId)!
      if (!best) {
        t.causes.add('no_vehicle')
        continue
      }
      best.requestId = req.id
      const spec = this.config.vehicleSpecs[type]
      if (this.needsSupply(type) && best.load + EPS < Math.min(spec.capacity, req.remaining)) {
        best.phase = 'to_supply'
        best.phaseEnd = this.now + this.roads.travelMinutes(best.node, this.supplyNode(type), spec.speedKmh)
      } else {
        this.goToStand(best)
      }
    }
  }

  private tripMinutes(v: VehicleState, dest: string, remaining: number): number {
    const spec = this.config.vehicleSpecs[v.type]
    if (this.needsSupply(v.type) && v.load + EPS < Math.min(spec.capacity, remaining)) {
      const s = this.supplyNode(v.type)
      return this.roads.travelMinutes(v.node, s, spec.speedKmh) + this.roads.travelMinutes(s, dest, spec.speedKmh)
    }
    return this.roads.travelMinutes(v.node, dest, spec.speedKmh)
  }
}
