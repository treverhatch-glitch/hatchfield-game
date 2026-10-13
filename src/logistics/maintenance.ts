import type { RoadGraph } from './roads'
import { SeededRng } from './rng'
import type { LogisticsEvent, MoneyCategory, VehicleType } from './types'

/** Vehicles the maintenance building sends out. */
export type CrewType = 'repair_van' | 'tow_truck' | 'sweeper' | 'building_crew'

export type FacilityKind = 'stand' | 'taxiway' | 'runway' | 'building' | 'hydrant'

export interface FacilityConfig {
  id: string
  kind: FacilityKind
  /** Road node a crew drives to. */
  node: string
  /** For 'stand' and 'hydrant': which stand it belongs to. */
  standId?: string
  /** Buildings passengers see (terminal) hurt mood when run down. */
  public?: boolean
}

export type MaintenanceTier = 1 | 2 | 3

export interface TierSpec {
  bays: number
  staff: number
  /** Multiplies work speed in bays and on site. */
  speed: number
  crews: Record<CrewType, number>
  upkeepPerDay: number
}

export const MAINTENANCE_TIERS: Record<MaintenanceTier, TierSpec> = {
  1: { bays: 2, staff: 2, speed: 1, crews: { repair_van: 1, tow_truck: 1, sweeper: 1, building_crew: 1 }, upkeepPerDay: 400 },
  2: { bays: 4, staff: 5, speed: 1.5, crews: { repair_van: 2, tow_truck: 1, sweeper: 1, building_crew: 2 }, upkeepPerDay: 900 },
  3: { bays: 6, staff: 9, speed: 2.2, crews: { repair_van: 3, tow_truck: 2, sweeper: 2, building_crew: 3 }, upkeepPerDay: 1800 },
}

export interface MaintenanceConfig {
  seed: number
  /** The maintenance building, or null when none is built. */
  building: { node: string; tier: MaintenanceTier } | null
  facilities: FacilityConfig[]
  /** Broken vehicles stop in the lane: paths through that node get slower. */
  blockLanes: boolean
  /** Extra metres added for passing a blocked node. */
  laneBlockPenaltyM: number
  /** Condition points lost per km driven and per job. */
  wearPerKm: number
  wearPerUse: number
  /** Breakdown chance per trip at full condition. Rises steeply as condition drops and service is overdue. */
  baseBreakdownPerTrip: number
  overdueBreakdownPerDay: number
  serviceIntervalMinutes: number
  serviceMinutes: number
  /** Below this condition a broken vehicle needs a tow, above it the van fixes it on the spot. */
  towBelowCondition: number
  repairMinutes: number
  /** Costs. Repairs are deliberately dearer than prevention. */
  serviceCost: number
  repairCost: number
  towCost: number
  facilityCostPerPoint: number
  /** Facility repair multiplier when it has already failed. */
  emergencyMultiplier: number
  /** Facility wear per hour and per use. */
  facilityWearPerHour: Record<FacilityKind, number>
  standWearPerTurnaround: number
  runwayWearPerMovement: number
  /** Crews start preventive work below this. */
  preventiveBelow: number
  runwayInspectionEveryMinutes: number
  inspectionMinutes: number
  facilityWorkMinutes: number
  crewSpeedKmh: number
  crewUpkeepPerDay: number
}

export function defaultMaintenanceConfig(over: Partial<MaintenanceConfig> = {}): MaintenanceConfig {
  return {
    seed: 1,
    building: { node: 'depot', tier: 1 },
    facilities: [
      { id: 'stand-1', kind: 'stand', node: 's1', standId: 'stand-1' },
      { id: 'stand-2', kind: 'stand', node: 's2', standId: 'stand-2' },
      { id: 'stand-3', kind: 'stand', node: 's3', standId: 'stand-3' },
      { id: 'stand-4', kind: 'stand', node: 's4', standId: 'stand-4' },
      { id: 'remote-1', kind: 'stand', node: 's5', standId: 'remote-1' },
      { id: 'hydrant-1', kind: 'hydrant', node: 's1', standId: 'stand-1' },
      { id: 'rwy-09', kind: 'runway', node: 'j4' },
      { id: 'twy-a', kind: 'taxiway', node: 'j2' },
      { id: 'terminal', kind: 'building', node: 'terminal', public: true },
      { id: 'fuel-farm', kind: 'building', node: 'farm' },
    ],
    blockLanes: true,
    laneBlockPenaltyM: 400,
    wearPerKm: 0.6,
    wearPerUse: 0.4,
    baseBreakdownPerTrip: 0.002,
    overdueBreakdownPerDay: 1,
    serviceIntervalMinutes: 1440,
    serviceMinutes: 45,
    towBelowCondition: 25,
    repairMinutes: 40,
    serviceCost: 150,
    repairCost: 700,
    towCost: 900,
    facilityCostPerPoint: 40,
    emergencyMultiplier: 3,
    facilityWearPerHour: { stand: 0.05, taxiway: 0.08, runway: 0.12, building: 0.04, hydrant: 0.06 },
    standWearPerTurnaround: 0.5,
    runwayWearPerMovement: 0.05,
    preventiveBelow: 70,
    runwayInspectionEveryMinutes: 480,
    inspectionMinutes: 15,
    facilityWorkMinutes: 60,
    crewSpeedKmh: 30,
    crewUpkeepPerDay: 80,
    ...over,
  }
}

/** Fields the engine keeps on every service vehicle for maintenance. */
export interface WearState {
  condition: number
  km: number
  uses: number
  lastServiceAt: number
  breakdowns: number
  /** Scheduled moment a breakdown hits during the current trip. */
  breakAt: number | null
  breakNode: string | null
  /** Forced out of action until this time (external events), then auto-fixed. */
  brokenUntil: number | null
  /** Waiting for / being worked on by this crew job. */
  repairJob: number | null
  /** When it joined the bay queue (first come, first served). */
  bayQueuedAt: number
}

/** Narrow view of a service vehicle (engine VehicleState satisfies it). */
export interface MaintVehicle {
  id: string
  type: VehicleType
  node: string
  phase: string
  phaseEnd: number
  wear: WearState
}

export interface MaintenanceHost {
  now(): number
  roads: RoadGraph
  vehicles: MaintVehicle[]
  baseSpeed(type: VehicleType): number
  emit(e: LogisticsEvent): void
  money(amount: number, category: MoneyCategory): void
  /** Drop the vehicle's current job back into the queue. */
  releaseJob(v: MaintVehicle): void
  /** True if the vehicle type has work waiting. */
  hasOpenWork(type: VehicleType): boolean
  /** Put a vehicle back in the pool (phase idle). */
  setIdle(v: MaintVehicle): void
  redispatch(): void
}

export type FacilityStatus = 'ok' | 'worn' | 'failed'

export interface FacilityState {
  config: FacilityConfig
  condition: number
  status: FacilityStatus
  /** Crew job assigned. */
  job: number | null
}

interface CrewVehicle {
  id: string
  type: CrewType
  node: string
  phase: 'idle' | 'to_job' | 'working' | 'towing' | 'returning'
  phaseEnd: number
  job: number | null
}

interface CrewJob {
  id: number
  kind: 'repair' | 'tow' | 'facility' | 'inspect'
  crew: CrewType
  vehicleId?: string
  facilityId?: string
  node: string
  createdAt: number
  emergency: boolean
}

export interface MaintenanceMetrics {
  avgVehicleCondition: number
  vehicles: number
  broken: number
  overdue: number
  inService: number
  breakdowns: number
  safetyIncidents: number
  ratingPenalty: number
  paxMoodPenalty: number
  preventiveSpend: number
  repairSpend: number
  runwayClosed: boolean
  standsOutOfService: string[]
  facilities: { id: string; kind: FacilityKind; condition: number; status: FacilityStatus }[]
  crewBusy: number
  crewTotal: number
  queuedJobs: number
  hints: string[]
}

const EPS = 1e-6

/**
 * Wear, breakdowns, servicing, crews and facility upkeep. Owned by LogisticsSim;
 * every random roll goes through one seeded RNG in event order, so runs replay exactly.
 */
export class Maintenance {
  readonly config: MaintenanceConfig
  readonly facilities = new Map<string, FacilityState>()
  private readonly host: MaintenanceHost
  private readonly rng: SeededRng
  private readonly crews: CrewVehicle[] = []
  private jobs: CrewJob[] = []
  private nextJob = 1
  private nextHour = 60
  private lastInspection = 0
  private runwayClosedBy: string | null = null
  breakdowns = 0
  safetyIncidents = 0
  ratingPenalty = 0
  paxMoodPenalty = 0
  preventiveSpend = 0
  repairSpend = 0

  constructor(host: MaintenanceHost, config: MaintenanceConfig) {
    this.host = host
    this.config = config
    this.rng = new SeededRng(config.seed)
    for (const f of config.facilities) {
      if (!host.roads.has(f.node)) throw new Error(`Facility ${f.id} on unknown node ${f.node}`)
      this.facilities.set(f.id, { config: f, condition: 100, status: 'ok', job: null })
    }
    const b = config.building
    if (b) {
      if (!host.roads.has(b.node)) throw new Error(`Maintenance building on unknown node ${b.node}`)
      const spec = MAINTENANCE_TIERS[b.tier]
      for (const type of ['repair_van', 'tow_truck', 'sweeper', 'building_crew'] as CrewType[]) {
        for (let i = 1; i <= spec.crews[type]; i++) {
          this.crews.push({ id: `${type}-${i}`, type, node: b.node, phase: 'idle', phaseEnd: Infinity, job: null })
        }
      }
    }
  }

  static freshWear(now: number): WearState {
    return { condition: 100, km: 0, uses: 0, lastServiceAt: now, breakdowns: 0, breakAt: null, breakNode: null, brokenUntil: null, repairJob: null, bayQueuedAt: 0 }
  }

  get tier(): TierSpec | null {
    return this.config.building ? MAINTENANCE_TIERS[this.config.building.tier] : null
  }

  // ------------------------------------------------------------ penalties (queried by the engine / sim)

  /** Worn vehicles crawl: full speed above 50%, down to 70% at zero. */
  speedFactor(v: MaintVehicle): number {
    const c = v.wear.condition
    return c >= 50 ? 1 : 0.7 + (0.3 * c) / 50
  }

  standAvailable(standId: string): boolean {
    for (const f of this.facilities.values()) {
      if (f.config.kind === 'stand' && f.config.standId === standId && f.status === 'failed') return false
    }
    return true
  }

  hydrantWorking(standId: string): boolean {
    for (const f of this.facilities.values()) {
      if (f.config.kind === 'hydrant' && f.config.standId === standId && f.status === 'failed') return false
    }
    return true
  }

  /** Runway closed for FOD inspection or because it has failed. */
  runwayClosed(): boolean {
    if (this.runwayClosedBy) return true
    for (const f of this.facilities.values()) if (f.config.kind === 'runway' && f.status === 'failed') return true
    return false
  }

  /** Multiplier for taxi speed (worn taxiways are slower). */
  taxiSpeedFactor(): number {
    let worst = 1
    for (const f of this.facilities.values()) {
      if (f.config.kind !== 'taxiway') continue
      worst = Math.min(worst, f.status === 'failed' ? 0.5 : f.status === 'worn' ? 0.8 : 1)
    }
    return worst
  }

  overdue(v: MaintVehicle): number {
    return Math.max(0, this.host.now() - v.wear.lastServiceAt - this.config.serviceIntervalMinutes)
  }

  breakdownChance(v: MaintVehicle): number {
    const c = this.config
    const missing = (100 - v.wear.condition) / 25
    const overdueDays = this.overdue(v) / 1440
    return Math.min(0.9, c.baseBreakdownPerTrip * (1 + missing * missing) * (1 + overdueDays * c.overdueBreakdownPerDay * 4))
  }

  // ------------------------------------------------------------ engine hooks

  /** Trip starts: wear by distance and maybe schedule a breakdown part-way. */
  onTravel(v: MaintVehicle, from: string, to: string, minutes: number): void {
    const km = this.host.roads.distance(from, to) / 1000
    if (!Number.isFinite(km) || km <= 0) return
    v.wear.km += km
    v.wear.condition = Math.max(0, v.wear.condition - km * this.config.wearPerKm)
    const roll = this.rng.next()
    const where = this.rng.next()
    if (roll < this.breakdownChance(v)) {
      v.wear.breakAt = this.host.now() + minutes * where
      v.wear.breakNode = where < 0.5 ? from : to
    }
  }

  onUse(v: MaintVehicle): void {
    v.wear.uses++
    v.wear.condition = Math.max(0, v.wear.condition - this.config.wearPerUse)
  }

  onTurnaroundComplete(standId: string): void {
    for (const f of this.facilities.values()) {
      if (f.config.kind === 'stand' && f.config.standId === standId) this.wearFacility(f, this.config.standWearPerTurnaround)
    }
  }

  /** Call per runway movement (landing or take-off). */
  recordMovement(runwayId?: string): void {
    for (const f of this.facilities.values()) {
      if (f.config.kind === 'runway' && (!runwayId || f.config.id === runwayId)) this.wearFacility(f, this.config.runwayWearPerMovement)
    }
  }

  /** The scheduled breakdown hits now. */
  breakDown(v: MaintVehicle, reason: 'wear' | 'event' = 'wear', durationMin?: number): void {
    const now = this.host.now()
    if (v.wear.breakNode) v.node = v.wear.breakNode
    v.wear.breakAt = null
    v.wear.breakNode = null
    this.host.releaseJob(v)
    v.phase = 'broken'
    v.phaseEnd = Infinity
    v.wear.breakdowns++
    this.breakdowns++
    if (durationMin !== undefined) v.wear.brokenUntil = now + durationMin
    this.host.emit({ type: 'vehicle_breakdown', time: now, vehicleId: v.id, vehicle: v.type, node: v.node, condition: v.wear.condition, reason })
    if (this.config.blockLanes) this.host.roads.setPenalty(v.node, this.config.laneBlockPenaltyM)
    if (v.wear.condition < 20 && this.rng.next() < 0.2) this.incident(`${v.type} failure on the apron`, 3)
    if (v.wear.brokenUntil === null) {
      const tow = v.wear.condition < this.config.towBelowCondition
      v.wear.repairJob = this.addJob(tow ? 'tow' : 'repair', tow ? 'tow_truck' : 'repair_van', v.node, { vehicleId: v.id, emergency: true })
    }
    this.host.redispatch()
  }

  /** Engine finished dispatching: send idle vehicles that are due for service to the building. */
  afterDispatch(): void {
    const b = this.config.building
    if (!b) return
    for (const v of this.host.vehicles) {
      if (v.phase !== 'idle' || this.host.now() - v.wear.lastServiceAt < this.config.serviceIntervalMinutes) continue
      if (this.host.hasOpenWork(v.type)) continue
      const mins = this.host.roads.travelMinutes(v.node, b.node, this.host.baseSpeed(v.type) * this.speedFactor(v))
      v.phase = 'to_maintenance'
      v.phaseEnd = this.host.now() + mins
    }
  }

  /** Engine: a maintenance-phase vehicle reached its phaseEnd. */
  advance(v: MaintVehicle): void {
    const b = this.config.building
    if (v.phase === 'to_maintenance' && b) {
      v.node = b.node
      v.phase = 'in_bay'
      v.phaseEnd = Infinity
      v.wear.bayQueuedAt = this.host.now()
      this.fillBays()
      return
    }
    if (v.phase === 'in_bay') {
      // Bay work finished: full service.
      const wasRepair = v.wear.repairJob !== null || v.wear.condition < 1
      v.wear.condition = 100
      v.wear.lastServiceAt = this.host.now()
      v.wear.repairJob = null
      this.host.emit({ type: 'vehicle_serviced', time: this.host.now(), vehicleId: v.id, vehicle: v.type, repair: wasRepair })
      if (!wasRepair) this.spend(this.config.serviceCost, 'maintenance_preventive')
      this.host.setIdle(v)
      this.fillBays()
      this.host.redispatch()
      return
    }
    if (v.phase === 'broken' && v.wear.brokenUntil !== null) {
      v.wear.brokenUntil = null
      v.wear.condition = Math.max(v.wear.condition, 60)
      this.fixedInPlace(v)
    }
  }

  // ------------------------------------------------------------ time

  nextEventTime(): number {
    let t = this.nextHour
    for (const c of this.crews) if (c.phaseEnd < t) t = c.phaseEnd
    for (const v of this.host.vehicles) {
      if (v.phase === 'broken' && v.wear.brokenUntil !== null && v.wear.brokenUntil < t) t = v.wear.brokenUntil
    }
    return t
  }

  advanceContinuous(dt: number): void {
    const tier = this.tier
    let upkeep = tier ? tier.upkeepPerDay : 0
    upkeep += this.crews.length * this.config.crewUpkeepPerDay
    if (upkeep > 0) this.host.money((-upkeep * dt) / 1440, 'maintenance_upkeep')
  }

  processDue(): boolean {
    const now = this.host.now()
    const due = (x: number): boolean => x <= now + EPS
    let changed = false
    for (const v of this.host.vehicles) {
      if (v.phase === 'broken' && v.wear.brokenUntil !== null && due(v.wear.brokenUntil)) {
        this.advance(v)
        changed = true
      }
    }
    for (const c of this.crews) {
      if (due(c.phaseEnd)) {
        this.advanceCrew(c)
        changed = true
      }
    }
    if (due(this.nextHour)) {
      this.hourly()
      this.nextHour += 60
      changed = true
    }
    if (changed) this.assignCrews()
    return changed
  }

  // ------------------------------------------------------------ internals

  private spend(amount: number, category: MoneyCategory): void {
    if (category === 'maintenance_preventive') this.preventiveSpend += amount
    else this.repairSpend += amount
    this.host.money(-amount, category)
  }

  private incident(what: string, ratingHit: number): void {
    this.safetyIncidents++
    this.ratingPenalty += ratingHit
    this.host.emit({ type: 'safety_incident', time: this.host.now(), what, ratingHit })
  }

  private statusOf(c: number): FacilityStatus {
    return c < 25 ? 'failed' : c < 50 ? 'worn' : 'ok'
  }

  private wearFacility(f: FacilityState, amount: number): void {
    f.condition = Math.max(0, f.condition - amount)
    this.updateStatus(f)
  }

  private updateStatus(f: FacilityState): void {
    const s = this.statusOf(f.condition)
    if (s === f.status) return
    f.status = s
    this.host.emit({ type: 'facility_status', time: this.host.now(), facilityId: f.config.id, kind: f.config.kind, status: s, condition: f.condition })
  }

  private hourly(): void {
    const c = this.config
    for (const f of this.facilities.values()) {
      this.wearFacility(f, c.facilityWearPerHour[f.config.kind])
      if (f.config.public && f.status !== 'ok') {
        const hit = f.status === 'failed' ? 3 : 1
        this.paxMoodPenalty += hit
        this.host.emit({ type: 'pax_mood_hit', time: this.host.now(), facilityId: f.config.id, amount: hit })
      }
      if (f.job === null && f.condition < c.preventiveBelow && this.config.building) {
        const crew: CrewType = f.config.kind === 'runway' ? 'sweeper' : 'building_crew'
        f.job = this.addJob('facility', crew, f.config.node, { facilityId: f.config.id, emergency: f.status === 'failed' })
      }
      if (f.config.kind === 'runway') this.runwayChecks(f)
    }
  }

  private runwayChecks(f: FacilityState): void {
    const now = this.host.now()
    // Foreign object debris gets likelier as the surface breaks up.
    const pFod = f.condition < 60 ? ((60 - f.condition) / 60) * 0.3 : 0
    const roll = this.rng.next()
    if (pFod > 0 && roll < pFod && !this.runwayClosedBy) {
      this.runwayClosedBy = f.config.id
      this.host.emit({ type: 'runway_fod', time: now, runwayId: f.config.id })
      this.host.emit({ type: 'runway_closed', time: now, runwayId: f.config.id, reason: 'fod' })
      if (this.rng.next() < (f.condition < 30 ? 0.3 : 0.05)) this.incident('FOD damage to a departing aircraft', 5)
      this.addJob('inspect', 'sweeper', f.config.node, { facilityId: f.config.id, emergency: true })
      return
    }
    if (this.config.building && now - this.lastInspection >= this.config.runwayInspectionEveryMinutes - EPS) {
      if (!this.jobs.some((j) => j.kind === 'inspect' && j.facilityId === f.config.id)) {
        this.lastInspection = now
        this.addJob('inspect', 'sweeper', f.config.node, { facilityId: f.config.id, emergency: false })
      }
    }
  }

  private addJob(kind: CrewJob['kind'], crew: CrewType, node: string, extra: { vehicleId?: string; facilityId?: string; emergency: boolean }): number {
    const id = this.nextJob++
    this.jobs.push({ id, kind, crew, node, createdAt: this.host.now(), ...extra })
    this.assignCrews()
    return id
  }

  private crewMinutes(from: string, to: string): number {
    return this.host.roads.travelMinutes(from, to, this.config.crewSpeedKmh)
  }

  /** Emergencies first, then FIFO; nearest idle crew of the right type. */
  private assignCrews(): void {
    const order = [...this.jobs].sort((a, b) => (a.emergency === b.emergency ? a.id - b.id : a.emergency ? -1 : 1))
    for (const j of order) {
      if (this.crews.some((c) => c.job === j.id)) continue
      let best: CrewVehicle | null = null
      let bestT = Infinity
      for (const c of this.crews) {
        if (c.type !== j.crew || c.phase !== 'idle') continue
        const t = this.crewMinutes(c.node, j.node)
        if (t < bestT - EPS) {
          best = c
          bestT = t
        }
      }
      if (!best) continue
      best.job = j.id
      best.phase = 'to_job'
      best.phaseEnd = this.host.now() + bestT
      this.host.emit({ type: 'crew_dispatched', time: this.host.now(), crewId: best.id, crew: best.type, job: j.kind, target: j.vehicleId ?? j.facilityId ?? '' })
    }
  }

  private advanceCrew(c: CrewVehicle): void {
    const j = this.jobs.find((x) => x.id === c.job)
    const now = this.host.now()
    const speed = this.tier?.speed ?? 1
    const b = this.config.building!
    if (!j) {
      c.phase = 'idle'
      c.phaseEnd = Infinity
      c.job = null
      return
    }
    if (c.phase === 'to_job') {
      c.node = j.node
      if (j.kind === 'tow') {
        const v = this.vehicle(j.vehicleId!)
        this.host.emit({ type: 'tow_start', time: now, crewId: c.id, vehicleId: v.id })
        this.host.roads.setPenalty(v.node, 0)
        v.phase = 'towed'
        c.phase = 'towing'
        c.phaseEnd = now + this.crewMinutes(c.node, b.node) * 1.5
        return
      }
      if (j.kind === 'inspect') {
        const f = this.facilities.get(j.facilityId!)!
        if (!this.runwayClosedBy) {
          this.runwayClosedBy = f.config.id
          this.host.emit({ type: 'runway_closed', time: now, runwayId: f.config.id, reason: 'inspection' })
        }
      }
      c.phase = 'working'
      const mins = j.kind === 'repair' ? this.config.repairMinutes : j.kind === 'inspect' ? this.config.inspectionMinutes : this.config.facilityWorkMinutes
      c.phaseEnd = now + mins / speed
      return
    }
    if (c.phase === 'towing') {
      const v = this.vehicle(j.vehicleId!)
      v.node = b.node
      c.node = b.node
      this.spend(this.config.towCost, 'maintenance_repair')
      this.finishJob(c, j)
      // Into a bay for a full rebuild.
      v.phase = 'in_bay'
      v.phaseEnd = Infinity
      v.wear.bayQueuedAt = now
      this.spend(this.config.repairCost, 'maintenance_repair')
      this.fillBays()
      return
    }
    if (c.phase === 'working') {
      if (j.kind === 'repair') {
        const v = this.vehicle(j.vehicleId!)
        v.wear.condition = Math.max(v.wear.condition, 60)
        this.spend(this.config.repairCost, 'maintenance_repair')
        v.wear.repairJob = null
        this.fixedInPlace(v)
      } else if (j.kind === 'inspect') {
        const f = this.facilities.get(j.facilityId!)!
        f.condition = Math.min(100, f.condition + 10)
        this.updateStatus(f)
        this.spend(this.config.facilityCostPerPoint * 2, 'maintenance_preventive')
        if (this.runwayClosedBy === f.config.id) {
          this.runwayClosedBy = null
          this.host.emit({ type: 'runway_reopened', time: now, runwayId: f.config.id })
        }
      } else {
        const f = this.facilities.get(j.facilityId!)!
        const points = 100 - f.condition
        const emergency = f.status === 'failed'
        const cost = points * this.config.facilityCostPerPoint * (emergency ? this.config.emergencyMultiplier : 1)
        this.spend(cost, emergency ? 'maintenance_repair' : 'maintenance_preventive')
        f.condition = 100
        f.job = null
        this.updateStatus(f)
        this.host.emit({ type: 'facility_repaired', time: now, facilityId: f.config.id, cost })
      }
      this.finishJob(c, j)
      c.phase = 'returning'
      c.phaseEnd = now + this.crewMinutes(c.node, b.node)
      c.job = null
      return
    }
    if (c.phase === 'returning') {
      c.node = b.node
      c.phase = 'idle'
      c.phaseEnd = Infinity
    }
  }

  private finishJob(c: CrewVehicle, j: CrewJob): void {
    this.jobs = this.jobs.filter((x) => x.id !== j.id)
    c.job = null
    c.phase = 'idle'
    c.phaseEnd = Infinity
  }

  private fixedInPlace(v: MaintVehicle): void {
    this.host.roads.setPenalty(v.node, 0)
    this.host.emit({ type: 'vehicle_repaired', time: this.host.now(), vehicleId: v.id, vehicle: v.type, inPlace: true })
    this.host.setIdle(v)
    this.host.redispatch()
  }

  private vehicle(id: string): MaintVehicle {
    return this.host.vehicles.find((v) => v.id === id)!
  }

  /** Start bay work for waiting vehicles while bays and staff allow. */
  private fillBays(): void {
    const tier = this.tier
    if (!tier) return
    const slots = Math.min(tier.bays, tier.staff)
    let busy = this.host.vehicles.filter((v) => v.phase === 'in_bay' && v.phaseEnd !== Infinity).length
    const waiting = this.host.vehicles
      .filter((v) => v.phase === 'in_bay' && v.phaseEnd === Infinity)
      .sort((a, b) => a.wear.bayQueuedAt - b.wear.bayQueuedAt || (a.id < b.id ? -1 : 1))
    for (const v of waiting) {
      if (busy >= slots) return
      const repair = v.wear.condition < 50
      const mins = (repair ? this.config.repairMinutes * 2 : this.config.serviceMinutes) / tier.speed
      v.phaseEnd = this.host.now() + mins
      busy++
    }
  }

  // ------------------------------------------------------------ metrics

  metrics(): MaintenanceMetrics {
    const vs = this.host.vehicles
    const overdue = vs.filter((v) => this.overdue(v) > 0).length
    const broken = vs.filter((v) => v.phase === 'broken' || v.phase === 'towed').length
    const facilities = [...this.facilities.values()].map((f) => ({ id: f.config.id, kind: f.config.kind, condition: f.condition, status: f.status }))
    const standsOut = facilities.filter((f) => f.kind === 'stand' && f.status === 'failed').map((f) => f.id)
    const hints: string[] = []
    const tier = this.tier
    if (!tier) hints.push('No maintenance building: vehicles and facilities will wear out and nothing gets fixed.')
    if (tier && overdue > tier.bays) hints.push(`Maintenance under-built: ${overdue} vehicles overdue for service.`)
    const waitingRepairs = this.jobs.filter((j) => j.kind === 'repair' || j.kind === 'tow').length
    const crewOfType = (t: CrewType): number => this.crews.filter((c) => c.type === t).length
    if (tier && waitingRepairs > crewOfType('repair_van') + crewOfType('tow_truck')) hints.push(`${waitingRepairs} broken vehicles waiting: add repair vans or upgrade the maintenance building.`)
    if (this.repairSpend > this.preventiveSpend * 2 && this.repairSpend > 0) hints.push('Repairs are costing far more than preventive servicing. Service vehicles on time.')
    for (const f of facilities) {
      if (f.status === 'failed') hints.push(`${f.id} has failed and needs urgent repair.`)
      else if (f.kind === 'runway' && f.condition < 60) hints.push(`${f.id} surface is breaking up: FOD risk. Inspect and resurface.`)
    }
    return {
      avgVehicleCondition: vs.length ? vs.reduce((a, v) => a + v.wear.condition, 0) / vs.length : 100,
      vehicles: vs.length,
      broken,
      overdue,
      inService: vs.filter((v) => v.phase === 'in_bay' || v.phase === 'to_maintenance').length,
      breakdowns: this.breakdowns,
      safetyIncidents: this.safetyIncidents,
      ratingPenalty: this.ratingPenalty,
      paxMoodPenalty: this.paxMoodPenalty,
      preventiveSpend: this.preventiveSpend,
      repairSpend: this.repairSpend,
      runwayClosed: this.runwayClosed(),
      standsOutOfService: standsOut,
      facilities,
      crewBusy: this.crews.filter((c) => c.phase !== 'idle').length,
      crewTotal: this.crews.length,
      queuedJobs: this.jobs.filter((j) => !this.crews.some((c) => c.job === j.id)).length,
      hints,
    }
  }

  /** Test / debug helper: set a facility's condition directly. */
  setFacilityCondition(id: string, condition: number): void {
    const f = this.facilities.get(id)
    if (!f) throw new Error(`Unknown facility ${id}`)
    f.condition = Math.max(0, Math.min(100, condition))
    this.updateStatus(f)
  }
}
