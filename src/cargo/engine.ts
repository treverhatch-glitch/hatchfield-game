import { CARGO_PRODUCTS, HANDLING_UNITS } from './catalog.ts'
import {
  CARGO_STAGES,
  type CargoBottleneck,
  type CargoContract,
  type CargoContractInput,
  type CargoEvent,
  type CargoFacilityConfig,
  type CargoFacilitySnapshot,
  type CargoFlight,
  type CargoFlightLoad,
  type CargoListener,
  type CargoSnapshot,
  type CargoStage,
  type CargoTerminalConfig,
  type HandlingUnitKind,
  type LandsideTruck,
} from './types.ts'

const EPSILON = 1e-7
const MAX_STEP_MINUTES = 1

interface CargoBatch {
  contractId: string
  tonnes: number
  unitKind: HandlingUnitKind
}

interface FacilityRuntime {
  config: CargoFacilityConfig
  processedTonnes: number
  blockedMinutes: number
  lastUtilization: number
}

interface FlightReservation {
  load: CargoFlightLoad
  batches: CargoBatch[]
}

function totalTonnes(batches: readonly CargoBatch[]): number {
  return batches.reduce((sum, batch) => sum + batch.tonnes, 0)
}

function staffing(config: CargoFacilityConfig): number {
  if (config.staffRequired <= 0) return 1
  return Math.min(1, Math.max(0, config.staffAssigned / config.staffRequired))
}

function severityFor(fill: number): 'low' | 'medium' | 'high' {
  if (fill >= 0.98) return 'high'
  if (fill >= 0.9) return 'medium'
  return 'low'
}

/**
 * Deterministic aggregate cargo simulation. Cargo remains contract-labelled
 * through every buffer, so deadlines, penalties and flight revenue are exact.
 */
export class CargoSim {
  readonly config: CargoTerminalConfig
  readonly contracts = new Map<string, CargoContract>()
  readonly trucks: LandsideTruck[] = []
  time = 0
  revenue = 0
  penalties = 0

  private facilities = new Map<CargoStage, FacilityRuntime>()
  private queues = new Map<CargoStage, CargoBatch[]>()
  private listeners = new Set<CargoListener>()
  private reservations = new Map<string, FlightReservation>()
  private nextTruckId = 1
  private nextTruckSequence = 0
  private nextAdvisorSample = 0
  private lastBottlenecks: CargoBottleneck[] = []

  constructor(config: CargoTerminalConfig) {
    this.config = {
      ...config,
      facilities: config.facilities.map((facility) => ({ ...facility })),
      trucks: { ...config.trucks },
    }
    const truckValues = [
      this.config.trucks.count,
      this.config.trucks.payloadTonnes,
      this.config.trucks.inboundTravelMinutes,
      this.config.trucks.roundTripMinutes,
      this.config.trucks.unloadTonnesPerMin,
      this.config.advisorSampleMinutes,
    ]
    if (truckValues.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error('Cargo truck and advisor configuration must be finite and non-negative')
    }
    if (!Number.isInteger(this.config.trucks.count)) throw new Error('Cargo truck count must be an integer')
    for (const stage of CARGO_STAGES) {
      const facility = this.config.facilities.find((entry) => entry.id === stage)
      if (!facility) throw new Error(`Missing cargo facility: ${stage}`)
      const values = [
        facility.inputCapacityTonnes,
        facility.outputCapacityTonnes,
        facility.rateTonnesPerMin,
        facility.staffRequired,
        facility.staffAssigned,
      ]
      if (values.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new Error(`Cargo facility capacity cannot be negative: ${stage}`)
      }
      this.facilities.set(stage, {
        config: facility,
        processedTonnes: 0,
        blockedMinutes: 0,
        lastUtilization: 0,
      })
      this.queues.set(stage, [])
    }
    this.nextAdvisorSample = Math.max(0.1, config.advisorSampleMinutes)
  }

  on(listener: CargoListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setStaff(stage: CargoStage, assigned: number): void {
    if (!Number.isFinite(assigned)) throw new Error('Cargo staffing must be finite')
    this.facility(stage).config.staffAssigned = Math.max(0, assigned)
  }

  acceptContract(input: CargoContractInput): CargoContract {
    if (this.contracts.has(input.id)) throw new Error(`Duplicate cargo contract: ${input.id}`)
    if (!Number.isFinite(input.tonnes) || input.tonnes <= 0) throw new Error('Cargo contract tonnes must be finite and positive')
    if (!Number.isFinite(input.deadline) || input.deadline <= this.time) throw new Error('Cargo contract deadline must be finite and in the future')
    const defaults = CARGO_PRODUCTS[input.kind]
    const revenuePerTonne = input.revenuePerTonne ?? defaults.revenuePerTonne
    const penaltyPerTonne = input.penaltyPerTonne ?? defaults.penaltyPerTonne
    if (!Number.isFinite(revenuePerTonne) || revenuePerTonne < 0) throw new Error('Cargo revenue must be finite and non-negative')
    if (!Number.isFinite(penaltyPerTonne) || penaltyPerTonne < 0) throw new Error('Cargo penalty must be finite and non-negative')
    const contract: CargoContract = {
      id: input.id,
      kind: input.kind,
      tonnes: input.tonnes,
      deliveredTonnes: 0,
      shippedTonnes: 0,
      returnedTonnes: 0,
      deadline: input.deadline,
      revenuePerTonne,
      penaltyPerTonne,
      unitKind: input.unitKind ?? defaults.unitKind,
      allowedModes: input.allowedModes ?? defaults.allowedModes,
      status: 'active',
      penaltyPaid: 0,
      revenueEarned: 0,
    }
    this.contracts.set(contract.id, contract)
    this.scheduleContractTrucks(contract)
    return contract
  }

  tick(dtMinutes: number): void {
    if (!Number.isFinite(dtMinutes) || dtMinutes < 0) throw new Error('Cargo tick must be a finite non-negative duration')
    let remaining = dtMinutes
    while (remaining > EPSILON) {
      const step = Math.min(MAX_STEP_MINUTES, remaining)
      this.time += step
      this.unloadTrucks(step)
      this.processFacilities(step)
      this.expireContracts()
      if (this.time + EPSILON >= this.nextAdvisorSample) {
        this.lastBottlenecks = this.detectBottlenecks()
        this.emit({ type: 'bottlenecks', bottlenecks: this.lastBottlenecks })
        this.nextAdvisorSample += Math.max(0.1, this.config.advisorSampleMinutes)
      }
      remaining -= step
    }
  }

  planFlight(flight: CargoFlight): CargoFlightLoad {
    if (this.reservations.has(flight.id)) return this.reservations.get(flight.id)!.load
    if (!Number.isFinite(flight.capacityTonnes) || flight.capacityTonnes < 0) {
      throw new Error('Cargo flight capacity must be finite and non-negative')
    }
    const load: CargoFlightLoad = {
      flightId: flight.id,
      tonnes: 0,
      units: 0,
      requiredLoader: null,
      assignments: [],
      rejected: [],
    }
    const batches: CargoBatch[] = []
    const ready = this.queue('ready')
    const ordered = ready
      .map((batch, index) => ({ batch, index }))
      .sort((a, b) => this.contract(a.batch.contractId).deadline - this.contract(b.batch.contractId).deadline)
    let capacity = Math.max(0, flight.capacityTonnes)

    for (const candidate of ordered) {
      if (capacity <= EPSILON) break
      const contract = this.contract(candidate.batch.contractId)
      if (contract.status !== 'active') continue
      const rejection = this.flightRejection(contract, flight)
      if (rejection) {
        if (!load.rejected.some((entry) => entry.contractId === contract.id)) {
          load.rejected.push({ contractId: contract.id, reason: rejection })
        }
        continue
      }
      const take = Math.min(candidate.batch.tonnes, capacity)
      if (take <= EPSILON) continue
      candidate.batch.tonnes -= take
      const reserved = { ...candidate.batch, tonnes: take }
      batches.push(reserved)
      capacity -= take
      const existing = load.assignments.find((entry) => entry.contractId === contract.id)
      if (existing) {
        existing.tonnes += take
        existing.units = this.unitsFor(existing.unitKind, existing.tonnes)
      } else {
        load.assignments.push({
          contractId: contract.id,
          kind: contract.kind,
          unitKind: contract.unitKind,
          tonnes: take,
          units: this.unitsFor(contract.unitKind, take),
        })
      }
    }
    for (let index = ready.length - 1; index >= 0; index--) {
      if (ready[index].tonnes <= EPSILON) ready.splice(index, 1)
    }
    load.tonnes = load.assignments.reduce((sum, entry) => sum + entry.tonnes, 0)
    load.units = load.assignments.reduce((sum, entry) => sum + entry.units, 0)
    if (load.assignments.some((entry) => HANDLING_UNITS[entry.unitKind].mainDeckOnly)) {
      load.requiredLoader = flight.mainDeckLoaderAvailable ? 'main_deck_loader' : 'uld_loader'
    } else if (load.tonnes > 0 && flight.mode === 'freighter') {
      load.requiredLoader = 'uld_loader'
    }
    this.reservations.set(flight.id, { load, batches })
    return load
  }

  cancelFlight(flightId: string): void {
    const reservation = this.reservations.get(flightId)
    if (!reservation) return
    this.queue('ready').push(...reservation.batches)
    this.reservations.delete(flightId)
  }

  confirmFlightDeparted(flightId: string): CargoFlightLoad | null {
    const reservation = this.reservations.get(flightId)
    if (!reservation) return null
    for (const assignment of reservation.load.assignments) {
      const contract = this.contract(assignment.contractId)
      contract.shippedTonnes += assignment.tonnes
      if (contract.status === 'active') {
        const amount = assignment.tonnes * contract.revenuePerTonne
        contract.revenueEarned += amount
        this.revenue += amount
        this.emit({ type: 'money', amount, category: 'cargo_revenue', contractId: contract.id })
      }
      if (contract.shippedTonnes + EPSILON >= contract.tonnes && contract.status === 'active') {
        contract.status = 'fulfilled'
        this.emit({ type: 'contract_status', contractId: contract.id, status: 'fulfilled' })
      }
    }
    if (reservation.load.tonnes > EPSILON) {
      this.emit({ type: 'flow', stage: 'ready', direction: 'out', tonnes: reservation.load.tonnes })
    }
    this.reservations.delete(flightId)
    return reservation.load
  }

  snapshot(): CargoSnapshot {
    return {
      time: this.time,
      facilities: CARGO_STAGES.map((stage) => this.facilitySnapshot(stage)),
      contracts: [...this.contracts.values()].map((contract) => ({ ...contract })),
      trucks: this.trucks.map((truck) => ({ ...truck })),
      reservedTonnes: [...this.reservations.values()].reduce((sum, entry) => sum + entry.load.tonnes, 0),
      revenue: this.revenue,
      penalties: this.penalties,
      bottlenecks: this.lastBottlenecks.map((entry) => ({ ...entry, fixes: { ...entry.fixes } })),
    }
  }

  detectBottlenecks(): CargoBottleneck[] {
    const output: CargoBottleneck[] = []
    for (let index = 0; index < CARGO_STAGES.length; index++) {
      const stage = CARGO_STAGES[index]
      const runtime = this.facility(stage)
      const queued = totalTonnes(this.queue(stage))
      const fill = runtime.config.inputCapacityTonnes <= 0 ? (queued > 0 ? 1 : 0) : queued / runtime.config.inputCapacityTonnes
      const staff = staffing(runtime.config)
      const next = CARGO_STAGES[index + 1]
      const nextFill = next ? totalTonnes(this.queue(next)) / Math.max(this.facility(next).config.inputCapacityTonnes, EPSILON) : 0
      let reason: CargoBottleneck['reason'] | null = null
      if (staff < 0.999 && queued > EPSILON) reason = 'understaffed'
      else if (fill >= 0.85) reason = 'input_full'
      else if (nextFill >= 0.98 && queued > EPSILON) reason = 'output_blocked'
      else if (runtime.lastUtilization >= 0.9 && queued > runtime.config.rateTonnesPerMin) reason = 'saturated'
      if (!reason) continue
      const score = Math.max(fill, runtime.lastUtilization, nextFill)
      output.push({
        id: `cargo:${stage}:${reason}`,
        stage,
        severity: severityFor(score),
        reason,
        queueTonnes: queued,
        capacityTonnes: runtime.config.inputCapacityTonnes,
        utilization: runtime.lastUtilization,
        fixes: {
          build: `Add ${runtime.config.label.toLowerCase()} capacity`,
          upgrade: `Upgrade ${runtime.config.label.toLowerCase()} throughput`,
          staff: `Assign ${Math.max(0, runtime.config.staffRequired - runtime.config.staffAssigned)} more cargo staff`,
        },
      })
    }
    return output
  }

  private scheduleContractTrucks(contract: CargoContract): void {
    const truckConfig = this.config.trucks
    if (truckConfig.count <= 0 || truckConfig.payloadTonnes <= 0) return
    let remaining = contract.tonnes
    while (remaining > EPSILON) {
      const tonnes = Math.min(truckConfig.payloadTonnes, remaining)
      const sequence = this.nextTruckSequence++
      const wave = Math.floor(sequence / truckConfig.count)
      const lane = sequence % truckConfig.count
      const arrivesAt =
        this.time +
        truckConfig.inboundTravelMinutes +
        wave * truckConfig.roundTripMinutes +
        lane * Math.min(2, truckConfig.inboundTravelMinutes / Math.max(1, truckConfig.count))
      this.trucks.push({
        id: `cargo-truck-${this.nextTruckId++}`,
        contractId: contract.id,
        tonnes,
        remainingTonnes: tonnes,
        arrivesAt,
        status: 'inbound',
      })
      remaining -= tonnes
    }
  }

  private unloadTrucks(dt: number): void {
    const dock = this.facility('truck_dock').config
    const dockQueue = this.queue('truck_dock')
    let dockFree = Math.max(0, dock.inputCapacityTonnes - totalTonnes(dockQueue))
    let unloadBudget = this.config.trucks.unloadTonnesPerMin * dt
    for (const truck of this.trucks) {
      if (truck.status === 'departed' || truck.arrivesAt > this.time + EPSILON) continue
      if (dockFree <= EPSILON || unloadBudget <= EPSILON) {
        this.updateTruckStatus(truck, 'queued')
        continue
      }
      this.updateTruckStatus(truck, 'unloading')
      const amount = Math.min(truck.remainingTonnes, dockFree, unloadBudget)
      if (amount <= EPSILON) continue
      const contract = this.contract(truck.contractId)
      dockQueue.push({ contractId: contract.id, tonnes: amount, unitKind: contract.unitKind })
      truck.remainingTonnes -= amount
      contract.deliveredTonnes += amount
      dockFree -= amount
      unloadBudget -= amount
      this.emit({ type: 'flow', stage: 'truck_dock', direction: 'in', tonnes: amount })
      if (truck.remainingTonnes <= EPSILON) this.updateTruckStatus(truck, 'departed')
    }
  }

  private processFacilities(dt: number): void {
    for (let index = CARGO_STAGES.length - 2; index >= 0; index--) {
      const stage = CARGO_STAGES[index]
      const nextStage = CARGO_STAGES[index + 1]
      const runtime = this.facility(stage)
      const nextRuntime = this.facility(nextStage)
      const queue = this.queue(stage)
      const nextQueue = this.queue(nextStage)
      const effectiveRate = runtime.config.rateTonnesPerMin * staffing(runtime.config)
      let budget = effectiveRate * dt
      let moved = 0
      const downstreamFree = Math.max(
        0,
        Math.min(nextRuntime.config.inputCapacityTonnes, runtime.config.outputCapacityTonnes) - totalTonnes(nextQueue),
      )
      let free = downstreamFree
      while (budget > EPSILON && free > EPSILON && queue.length > 0) {
        const batch = queue[0]
        const amount = Math.min(batch.tonnes, budget, free)
        nextQueue.push({ ...batch, tonnes: amount })
        batch.tonnes -= amount
        budget -= amount
        free -= amount
        moved += amount
        if (batch.tonnes <= EPSILON) queue.shift()
      }
      runtime.processedTonnes += moved
      runtime.lastUtilization = effectiveRate <= EPSILON ? (queue.length > 0 ? 1 : 0) : moved / (effectiveRate * dt)
      if (queue.length > 0 && downstreamFree <= EPSILON) runtime.blockedMinutes += dt
      if (moved > EPSILON) {
        this.emit({ type: 'flow', stage, direction: 'out', tonnes: moved })
        this.emit({ type: 'flow', stage: nextStage, direction: 'in', tonnes: moved })
      }
    }
  }

  private expireContracts(): void {
    for (const contract of this.contracts.values()) {
      if (contract.status !== 'active' || this.time + EPSILON < contract.deadline) continue
      const unshipped = Math.max(0, contract.tonnes - contract.shippedTonnes)
      const penalty = unshipped * contract.penaltyPerTonne
      contract.penaltyPaid = penalty
      contract.status = 'failed'
      contract.returnedTonnes = unshipped
      this.penalties += penalty
      this.returnFailedCargo(contract.id)
      if (penalty > 0) {
        this.emit({ type: 'money', amount: -penalty, category: 'cargo_penalty', contractId: contract.id })
      }
      this.emit({ type: 'contract_status', contractId: contract.id, status: 'failed' })
    }
  }

  private flightRejection(contract: CargoContract, flight: CargoFlight): string | null {
    if (!contract.allowedModes.includes(flight.mode)) return `${contract.kind} contract requires ${contract.allowedModes.join(' or ')} capacity`
    if (!flight.supportedUnits.includes(contract.unitKind)) return `${flight.airframeId} cannot carry ${contract.unitKind}`
    if (HANDLING_UNITS[contract.unitKind].mainDeckOnly && flight.mode !== 'freighter') return `${contract.unitKind} is main-deck only`
    return null
  }

  private returnFailedCargo(contractId: string): void {
    for (const stage of CARGO_STAGES) {
      const queue = this.queue(stage)
      let removed = 0
      for (let index = queue.length - 1; index >= 0; index--) {
        if (queue[index].contractId !== contractId) continue
        removed += queue[index].tonnes
        queue.splice(index, 1)
      }
      if (removed > EPSILON) this.emit({ type: 'flow', stage, direction: 'out', tonnes: removed })
    }
    for (const truck of this.trucks) {
      if (truck.contractId !== contractId || truck.status === 'departed') continue
      truck.remainingTonnes = 0
      this.updateTruckStatus(truck, 'departed')
    }
    for (const reservation of this.reservations.values()) {
      reservation.batches = reservation.batches.filter((batch) => batch.contractId !== contractId)
      reservation.load.assignments = reservation.load.assignments.filter((entry) => entry.contractId !== contractId)
      reservation.load.tonnes = reservation.load.assignments.reduce((sum, entry) => sum + entry.tonnes, 0)
      reservation.load.units = reservation.load.assignments.reduce((sum, entry) => sum + entry.units, 0)
      if (reservation.load.assignments.length === 0) reservation.load.requiredLoader = null
    }
  }

  private unitsFor(kind: HandlingUnitKind, tonnes: number): number {
    return Math.ceil(tonnes / HANDLING_UNITS[kind].nominalPayloadTonnes)
  }

  private facilitySnapshot(stage: CargoStage): CargoFacilitySnapshot {
    const runtime = this.facility(stage)
    return {
      id: stage,
      label: runtime.config.label,
      queuedTonnes: totalTonnes(this.queue(stage)),
      capacityTonnes: runtime.config.inputCapacityTonnes,
      outputCapacityTonnes: runtime.config.outputCapacityTonnes,
      rateTonnesPerMin: runtime.config.rateTonnesPerMin,
      effectiveRateTonnesPerMin: runtime.config.rateTonnesPerMin * staffing(runtime.config),
      staffing: staffing(runtime.config),
      utilization: runtime.lastUtilization,
      processedTonnes: runtime.processedTonnes,
      blockedMinutes: runtime.blockedMinutes,
    }
  }

  private updateTruckStatus(truck: LandsideTruck, status: LandsideTruck['status']): void {
    if (truck.status === status) return
    truck.status = status
    this.emit({ type: 'truck_status', truckId: truck.id, status })
  }

  private facility(stage: CargoStage): FacilityRuntime {
    const runtime = this.facilities.get(stage)
    if (!runtime) throw new Error(`Unknown cargo facility: ${stage}`)
    return runtime
  }

  private queue(stage: CargoStage): CargoBatch[] {
    const queue = this.queues.get(stage)
    if (!queue) throw new Error(`Unknown cargo queue: ${stage}`)
    return queue
  }

  private contract(id: string): CargoContract {
    const contract = this.contracts.get(id)
    if (!contract) throw new Error(`Unknown cargo contract: ${id}`)
    return contract
  }

  private emit(event: CargoEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}
