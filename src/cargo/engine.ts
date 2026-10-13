import { CARGO_PRODUCTS, HANDLING_UNITS, availableBellyCargoTonnes } from './catalog.ts'
import {
  CARGO_STAGES,
  EXPORT_STAGES,
  IMPORT_STAGES,
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
  type CargoKind,
  type HandlingUnitKind,
  type ImportShipment,
  type ImportShipmentInput,
  type LandsideTruck,
} from './types.ts'

const EPSILON = 1e-7
const MAX_STEP_MINUTES = 1
type WithoutTime<T> = T extends unknown ? Omit<T, 'time'> : never

interface CargoBatch {
  ownerId: string
  direction: 'export' | 'import'
  kind: CargoKind
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

interface TruckJob {
  direction: 'export' | 'import'
  ownerId: string
  tonnes: number
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
  readonly imports = new Map<string, ImportShipment>()
  readonly trucks: LandsideTruck[] = []
  time = 0
  revenue = 0
  airportRevenue = 0
  handlerRevenue = 0
  penalties = 0

  private facilities = new Map<CargoStage, FacilityRuntime>()
  private queues = new Map<CargoStage, CargoBatch[]>()
  private importArrivalBacklog: CargoBatch[] = []
  private truckJobs: TruckJob[] = []
  private truckSlots: (string | null)[] = []
  private truckSlotAvailableAt: number[] = []
  private listeners = new Set<CargoListener>()
  private reservations = new Map<string, FlightReservation>()
  private nextTruckId = 1
  private nextAdvisorSample = 0
  private lastBottlenecks: CargoBottleneck[] = []

  constructor(config: CargoTerminalConfig) {
    this.config = {
      ...config,
      facilities: config.facilities.map((facility) => ({ ...facility })),
      trucks: { ...config.trucks },
      revenueShare: { ...config.revenueShare },
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
    this.truckSlots = Array.from({ length: this.config.trucks.count }, () => null)
    this.truckSlotAvailableAt = Array.from({ length: this.config.trucks.count }, () => 0)
    const share = this.config.revenueShare
    if (
      !Number.isFinite(share.airport) ||
      !Number.isFinite(share.handler) ||
      share.airport < 0 ||
      share.handler < 0 ||
      Math.abs(share.airport + share.handler - 1) > EPSILON
    ) {
      throw new Error('Cargo revenue shares must be finite, non-negative, and total 1')
    }
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
    const contract = this.createContract(input)
    this.scheduleContractTrucks(contract)
    return contract
  }

  /** Save-migration hook: legacy shed stock is already screened and ready. */
  seedLegacyReadyCargo(input: CargoContractInput): CargoContract {
    const contract = this.createContract(input)
    contract.deliveredTonnes = contract.tonnes
    this.queue('ready').push({
      ownerId: contract.id,
      direction: 'export',
      kind: contract.kind,
      tonnes: contract.tonnes,
      unitKind: contract.unitKind,
    })
    this.emit({ type: 'flow', stage: 'ready', direction: 'in', tonnes: contract.tonnes })
    return contract
  }

  private createContract(input: CargoContractInput): CargoContract {
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
      deadlineSettled: false,
      revenuePerTonne,
      penaltyPerTonne,
      unitKind: input.unitKind ?? defaults.unitKind,
      allowedModes: input.allowedModes ?? defaults.allowedModes,
      status: 'active',
      penaltyPaid: 0,
      airportRevenueEarned: 0,
      handlerRevenueEarned: 0,
      revenueEarned: 0,
    }
    this.contracts.set(contract.id, contract)
    return contract
  }

  receiveImport(input: ImportShipmentInput): ImportShipment {
    if (!Number.isFinite(input.tonnes) || input.tonnes <= 0) {
      throw new Error('Import shipment tonnes must be finite and positive')
    }
    const existing = this.imports.get(input.id)
    if (
      existing &&
      (existing.kind !== input.kind ||
        existing.unitKind !== (input.unitKind ?? CARGO_PRODUCTS[input.kind].unitKind))
    ) {
      throw new Error(`Import shipment manifest mismatch: ${input.id}`)
    }
    const shipment: ImportShipment =
      existing ??
      {
        id: input.id,
        kind: input.kind,
        tonnes: 0,
        collectedTonnes: 0,
        unitKind: input.unitKind ?? CARGO_PRODUCTS[input.kind].unitKind,
        standId: input.standId ?? null,
        status: 'processing',
      }
    if (shipment.status === 'collected') shipment.status = 'processing'
    shipment.tonnes += input.tonnes
    this.imports.set(shipment.id, shipment)
    this.importArrivalBacklog.push({
      ownerId: shipment.id,
      direction: 'import',
      kind: shipment.kind,
      tonnes: input.tonnes,
      unitKind: shipment.unitKind,
    })
    return shipment
  }

  tick(dtMinutes: number): void {
    if (!Number.isFinite(dtMinutes) || dtMinutes < 0) throw new Error('Cargo tick must be a finite non-negative duration')
    let remaining = dtMinutes
    while (remaining > EPSILON) {
      const step = Math.min(MAX_STEP_MINUTES, remaining)
      this.time += step
      this.dispatchTruckJobs()
      this.unloadTrucks(step)
      this.admitImports()
      this.processFacilities(step)
      this.loadImportTrucks(step)
      this.dispatchTruckJobs()
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
      effectiveCapacityTonnes: 0,
      capacityLostToBaggageTonnes: 0,
      requiredLoader: null,
      loaderReservationId: null,
      assignments: [],
      rejected: [],
    }
    const batches: CargoBatch[] = []
    const ready = this.queue('ready')
    const ordered = ready
      .map((batch, index) => ({ batch, index }))
      .sort((a, b) => this.contract(a.batch.ownerId).deadline - this.contract(b.batch.ownerId).deadline)
    const baggage = flight.mode === 'belly' ? flight.baggageTonnes ?? 0 : 0
    const physicalHold = flight.holdCapacityTonnes ?? flight.capacityTonnes + baggage
    load.effectiveCapacityTonnes =
      flight.mode === 'belly'
        ? availableBellyCargoTonnes(physicalHold, baggage, flight.capacityTonnes)
        : flight.capacityTonnes
    load.capacityLostToBaggageTonnes = Math.max(0, flight.capacityTonnes - load.effectiveCapacityTonnes)
    let capacity = load.effectiveCapacityTonnes

    for (const candidate of ordered) {
      if (capacity <= EPSILON) break
      const contract = this.contract(candidate.batch.ownerId)
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
    for (const batch of reservation.batches) {
      const contract = this.contract(batch.ownerId)
      if (this.time + EPSILON >= contract.deadline) {
        this.settleReturnedCargo(contract, batch.tonnes)
      } else {
        this.queue('ready').push(batch)
      }
    }
    this.reservations.delete(flightId)
  }

  reservationLoad(flightId: string): CargoFlightLoad | null {
    return this.reservations.get(flightId)?.load ?? null
  }

  confirmFlightDeparted(flightId: string): CargoFlightLoad | null {
    const reservation = this.reservations.get(flightId)
    if (!reservation) return null
    for (const assignment of reservation.load.assignments) {
      const contract = this.contract(assignment.contractId)
      contract.shippedTonnes += assignment.tonnes
      if (contract.status === 'active') {
        const amount = assignment.tonnes * contract.revenuePerTonne
        const airportAmount = amount * this.config.revenueShare.airport
        const handlerAmount = amount * this.config.revenueShare.handler
        contract.revenueEarned += amount
        contract.airportRevenueEarned += airportAmount
        contract.handlerRevenueEarned += handlerAmount
        this.revenue += amount
        this.airportRevenue += airportAmount
        this.handlerRevenue += handlerAmount
        this.emit({
          type: 'money',
          amount: airportAmount,
          category: 'cargo_airport_revenue',
          contractId: contract.id,
        })
        this.emit({
          type: 'money',
          amount: handlerAmount,
          category: 'cargo_handler_revenue',
          contractId: contract.id,
        })
      }
      if (
        contract.shippedTonnes + contract.returnedTonnes + EPSILON >= contract.tonnes &&
        contract.status === 'active'
      ) {
        contract.status = contract.penaltyPaid > 0 ? 'failed' : 'fulfilled'
        this.emit({ type: 'contract_status', contractId: contract.id, status: contract.status })
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
      imports: [...this.imports.values()].map((shipment) => ({ ...shipment })),
      trucks: this.trucks.map((truck) => ({ ...truck })),
      pendingExportTruckTonnes: this.truckJobs
        .filter((job) => job.direction === 'export')
        .reduce((sum, job) => sum + job.tonnes, 0),
      pendingImportPickupTonnes: this.truckJobs
        .filter((job) => job.direction === 'import')
        .reduce((sum, job) => sum + job.tonnes, 0),
      airsideBacklogTonnes: totalTonnes(this.importArrivalBacklog),
      reservedTonnes: [...this.reservations.values()].reduce((sum, entry) => sum + entry.load.tonnes, 0),
      revenue: this.revenue,
      airportRevenue: this.airportRevenue,
      handlerRevenue: this.handlerRevenue,
      penalties: this.penalties,
      bottlenecks: this.lastBottlenecks.map((entry) => ({ ...entry, fixes: { ...entry.fixes } })),
    }
  }

  detectBottlenecks(): CargoBottleneck[] {
    const output: CargoBottleneck[] = []
    for (const stage of CARGO_STAGES) {
      const runtime = this.facility(stage)
      const queued = totalTonnes(this.queue(stage))
      const fill = runtime.config.inputCapacityTonnes <= 0 ? (queued > 0 ? 1 : 0) : queued / runtime.config.inputCapacityTonnes
      const staff = staffing(runtime.config)
      const downstream = this.downstreamStages(stage)
      const nextFill = downstream.reduce((highest, next) => {
        const fill =
          totalTonnes(this.queue(next)) /
          Math.max(this.facility(next).config.inputCapacityTonnes, EPSILON)
        return Math.max(highest, fill)
      }, 0)
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
      this.truckJobs.push({ direction: 'export', ownerId: contract.id, tonnes })
      remaining -= tonnes
    }
    this.dispatchTruckJobs()
  }

  private ensureImportTruckJob(shipmentId: string): void {
    const truckConfig = this.config.trucks
    if (truckConfig.count <= 0 || truckConfig.payloadTonnes <= 0) return
    const alreadyPlanned =
      this.truckJobs.some((job) => job.direction === 'import' && job.ownerId === shipmentId) ||
      this.trucks.some(
        (truck) =>
          truck.direction === 'import' &&
          truck.shipmentId === shipmentId &&
          truck.status !== 'departed',
      )
    if (alreadyPlanned) return
    const shipment = this.importShipment(shipmentId)
    const remaining = shipment.tonnes - shipment.collectedTonnes
    if (remaining <= EPSILON) return
    this.truckJobs.push({
      direction: 'import',
      ownerId: shipmentId,
      tonnes: Math.min(truckConfig.payloadTonnes, remaining),
    })
    this.dispatchTruckJobs()
  }

  private dispatchTruckJobs(): void {
    for (let slot = 0; slot < this.truckSlots.length; slot++) {
      if (this.truckSlots[slot] || this.truckSlotAvailableAt[slot] > this.time + EPSILON) continue
      const job = this.truckJobs.shift()
      if (!job) return
      const id = `cargo-truck-${this.nextTruckId++}`
      this.truckSlots[slot] = id
      this.trucks.push({
        id,
        direction: job.direction,
        contractId: job.direction === 'export' ? job.ownerId : null,
        shipmentId: job.direction === 'import' ? job.ownerId : null,
        fleetSlot: slot,
        tonnes: job.tonnes,
        remainingTonnes: job.tonnes,
        arrivesAt: this.time + this.config.trucks.inboundTravelMinutes,
        status: 'inbound',
      })
    }
  }

  private admitImports(): void {
    const queue = this.queue('import_airside')
    let free = Math.max(0, this.facility('import_airside').config.inputCapacityTonnes - totalTonnes(queue))
    while (free > EPSILON && this.importArrivalBacklog.length > 0) {
      const batch = this.importArrivalBacklog[0]
      const amount = Math.min(batch.tonnes, free)
      queue.push({ ...batch, tonnes: amount })
      batch.tonnes -= amount
      free -= amount
      this.emit({ type: 'flow', stage: 'import_airside', direction: 'in', tonnes: amount })
      if (batch.tonnes <= EPSILON) this.importArrivalBacklog.shift()
    }
  }

  private unloadTrucks(dt: number): void {
    const dock = this.facility('truck_dock').config
    const dockQueue = this.queue('truck_dock')
    let dockFree = Math.max(0, dock.inputCapacityTonnes - totalTonnes(dockQueue))
    let unloadBudget = this.config.trucks.unloadTonnesPerMin * dt
    for (const truck of this.trucks) {
      if (truck.direction !== 'export' || truck.status === 'departed' || truck.arrivesAt > this.time + EPSILON) continue
      if (dockFree <= EPSILON || unloadBudget <= EPSILON) {
        this.updateTruckStatus(truck, 'queued')
        continue
      }
      this.updateTruckStatus(truck, 'unloading')
      const amount = Math.min(truck.remainingTonnes, dockFree, unloadBudget)
      if (amount <= EPSILON) continue
      const contract = this.contract(truck.contractId!)
      dockQueue.push({
        ownerId: contract.id,
        direction: 'export',
        kind: contract.kind,
        tonnes: amount,
        unitKind: contract.unitKind,
      })
      truck.remainingTonnes -= amount
      contract.deliveredTonnes += amount
      dockFree -= amount
      unloadBudget -= amount
      this.emit({ type: 'flow', stage: 'truck_dock', direction: 'in', tonnes: amount })
      if (truck.remainingTonnes <= EPSILON) this.updateTruckStatus(truck, 'departed')
    }
  }

  private processFacilities(dt: number): void {
    this.moveStage('build_up', dt, () => 'ready')
    this.moveStage('cold_storage', dt, () => 'build_up')
    this.moveStage('warehouse', dt, (batch) => (batch.kind === 'perishable' ? 'cold_storage' : 'build_up'))
    this.moveStage('screening', dt, () => 'warehouse')
    this.moveStage('customs', dt, () => 'screening')
    this.moveStage('truck_dock', dt, () => 'customs')

    this.moveStage('import_cold_storage', dt, () => 'import_truck_dock')
    this.moveStage('import_warehouse', dt, (batch) =>
      batch.kind === 'perishable' ? 'import_cold_storage' : 'import_truck_dock',
    )
    this.moveStage('import_customs', dt, () => 'import_warehouse')
    this.moveStage('import_screening', dt, () => 'import_customs')
    this.moveStage('import_breakdown', dt, () => 'import_screening')
    this.moveStage('import_airside', dt, () => 'import_breakdown')
  }

  private moveStage(
    stage: CargoStage,
    dt: number,
    targetFor: (batch: CargoBatch) => CargoStage,
  ): void {
    const runtime = this.facility(stage)
    const queue = this.queue(stage)
    const effectiveRate = runtime.config.rateTonnesPerMin * staffing(runtime.config)
    let budget = effectiveRate * dt
    let moved = 0
    let blocked = false
    let index = 0
    while (budget > EPSILON && index < queue.length) {
      const batch = queue[index]
      const target = targetFor(batch)
      const targetRuntime = this.facility(target)
      const targetQueue = this.queue(target)
      const downstreamStored = this.downstreamStages(stage).reduce(
        (sum, downstream) => sum + totalTonnes(this.queue(downstream)),
        0,
      )
      const free = Math.max(
        0,
        Math.min(
          targetRuntime.config.inputCapacityTonnes - totalTonnes(targetQueue),
          runtime.config.outputCapacityTonnes - downstreamStored,
        ),
      )
      if (free <= EPSILON) {
        blocked = true
        index++
        continue
      }
      const amount = Math.min(batch.tonnes, budget, free)
      targetQueue.push({ ...batch, tonnes: amount })
      if (target === 'import_truck_dock') this.ensureImportTruckJob(batch.ownerId)
      batch.tonnes -= amount
      budget -= amount
      moved += amount
      this.emit({ type: 'flow', stage, direction: 'out', tonnes: amount })
      this.emit({ type: 'flow', stage: target, direction: 'in', tonnes: amount })
      if (batch.tonnes <= EPSILON) queue.splice(index, 1)
      else index++
    }
    runtime.processedTonnes += moved
    runtime.lastUtilization = effectiveRate <= EPSILON ? (queue.length > 0 ? 1 : 0) : moved / (effectiveRate * dt)
    if (queue.length > 0 && (blocked || effectiveRate <= EPSILON)) runtime.blockedMinutes += dt
  }

  private loadImportTrucks(dt: number): void {
    const dockQueue = this.queue('import_truck_dock')
    const runtime = this.facility('import_truck_dock')
    const effectiveRate =
      Math.min(this.config.trucks.unloadTonnesPerMin, runtime.config.rateTonnesPerMin) *
      staffing(runtime.config)
    let budget = effectiveRate * dt
    let moved = 0
    for (const truck of this.trucks) {
      if (
        truck.direction !== 'import' ||
        truck.status === 'departed' ||
        truck.arrivesAt > this.time + EPSILON
      ) {
        continue
      }
      const batchIndex = dockQueue.findIndex((batch) => batch.ownerId === truck.shipmentId)
      if (batchIndex < 0 || budget <= EPSILON) {
        this.updateTruckStatus(truck, 'queued')
        continue
      }
      this.updateTruckStatus(truck, 'loading')
      const batch = dockQueue[batchIndex]
      const amount = Math.min(batch.tonnes, truck.remainingTonnes, budget)
      batch.tonnes -= amount
      truck.remainingTonnes -= amount
      budget -= amount
      const shipment = this.importShipment(truck.shipmentId!)
      shipment.collectedTonnes += amount
      moved += amount
      this.emit({ type: 'flow', stage: 'import_truck_dock', direction: 'out', tonnes: amount })
      if (batch.tonnes <= EPSILON) dockQueue.splice(batchIndex, 1)
      if (truck.remainingTonnes <= EPSILON) {
        this.updateTruckStatus(truck, 'departed')
        if (dockQueue.some((entry) => entry.ownerId === shipment.id)) {
          this.ensureImportTruckJob(shipment.id)
        }
      }
    }
    for (const shipment of this.imports.values()) {
      const status =
        shipment.collectedTonnes + EPSILON >= shipment.tonnes
          ? 'collected'
          : dockQueue.some((batch) => batch.ownerId === shipment.id)
            ? 'awaiting_truck'
            : 'processing'
      if (shipment.status !== status) {
        shipment.status = status
        this.emit({ type: 'import_status', shipmentId: shipment.id, status })
      }
    }
    runtime.processedTonnes += moved
    runtime.lastUtilization =
      effectiveRate <= EPSILON ? (dockQueue.length > 0 ? 1 : 0) : moved / (effectiveRate * dt)
    if (dockQueue.length > 0 && moved <= EPSILON) runtime.blockedMinutes += dt
  }

  private expireContracts(): void {
    for (const contract of this.contracts.values()) {
      if (
        contract.status !== 'active' ||
        contract.deadlineSettled ||
        this.time + EPSILON < contract.deadline
      ) {
        continue
      }
      const reserved = [...this.reservations.values()].reduce(
        (sum, reservation) =>
          sum +
          reservation.load.assignments
            .filter((assignment) => assignment.contractId === contract.id)
            .reduce((subtotal, assignment) => subtotal + assignment.tonnes, 0),
        0,
      )
      const uncommitted = Math.max(
        0,
        contract.tonnes - contract.shippedTonnes - contract.returnedTonnes - reserved,
      )
      contract.deadlineSettled = true
      if (uncommitted > EPSILON) {
        this.returnUnreservedCargo(contract.id)
        this.settleReturnedCargo(contract, uncommitted)
      }
      if (reserved <= EPSILON && contract.status === 'active') {
        contract.status = contract.penaltyPaid > 0 ? 'failed' : 'fulfilled'
        this.emit({ type: 'contract_status', contractId: contract.id, status: contract.status })
      }
    }
  }

  private flightRejection(contract: CargoContract, flight: CargoFlight): string | null {
    if (!contract.allowedModes.includes(flight.mode)) return `${contract.kind} contract requires ${contract.allowedModes.join(' or ')} capacity`
    if (!flight.supportedUnits.includes(contract.unitKind)) return `${flight.airframeId} cannot carry ${contract.unitKind}`
    if (HANDLING_UNITS[contract.unitKind].mainDeckOnly && flight.mode !== 'freighter') return `${contract.unitKind} is main-deck only`
    return null
  }

  private returnUnreservedCargo(contractId: string): void {
    this.truckJobs = this.truckJobs.filter(
      (job) => job.direction !== 'export' || job.ownerId !== contractId,
    )
    for (const stage of CARGO_STAGES) {
      const queue = this.queue(stage)
      let removed = 0
      for (let index = queue.length - 1; index >= 0; index--) {
        if (queue[index].direction !== 'export' || queue[index].ownerId !== contractId) continue
        removed += queue[index].tonnes
        queue.splice(index, 1)
      }
      if (removed > EPSILON) this.emit({ type: 'flow', stage, direction: 'out', tonnes: removed })
    }
    for (const truck of this.trucks) {
      if (truck.direction !== 'export' || truck.contractId !== contractId || truck.status === 'departed') continue
      truck.remainingTonnes = 0
      this.updateTruckStatus(truck, 'departed')
    }
  }

  private settleReturnedCargo(contract: CargoContract, tonnes: number): void {
    const amount = Math.min(
      tonnes,
      Math.max(0, contract.tonnes - contract.shippedTonnes - contract.returnedTonnes),
    )
    if (amount <= EPSILON) return
    const penalty = amount * contract.penaltyPerTonne
    contract.returnedTonnes += amount
    contract.penaltyPaid += penalty
    contract.deadlineSettled = true
    this.penalties += penalty
    if (penalty > 0) {
      this.emit({
        type: 'money',
        amount: -penalty,
        category: 'cargo_penalty',
        contractId: contract.id,
      })
    }
    if (
      contract.shippedTonnes + contract.returnedTonnes + EPSILON >= contract.tonnes &&
      contract.status === 'active'
    ) {
      contract.status = 'failed'
      this.emit({ type: 'contract_status', contractId: contract.id, status: 'failed' })
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
    if (status === 'departed') {
      this.truckSlots[truck.fleetSlot] = null
      this.truckSlotAvailableAt[truck.fleetSlot] =
        this.time +
        Math.max(
          0,
          this.config.trucks.roundTripMinutes - this.config.trucks.inboundTravelMinutes,
        )
    }
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

  private importShipment(id: string): ImportShipment {
    const shipment = this.imports.get(id)
    if (!shipment) throw new Error(`Unknown import shipment: ${id}`)
    return shipment
  }

  private downstreamStages(stage: CargoStage): CargoStage[] {
    if (stage === 'warehouse') return ['cold_storage', 'build_up']
    if (stage === 'import_warehouse') return ['import_cold_storage', 'import_truck_dock']
    const chain = stage.startsWith('import_') ? IMPORT_STAGES : EXPORT_STAGES
    const index = chain.indexOf(stage)
    return index >= 0 && index + 1 < chain.length ? [chain[index + 1]] : []
  }

  private emit(event: WithoutTime<CargoEvent>): void {
    const timed = { ...event, time: this.time } as CargoEvent
    for (const listener of this.listeners) listener(timed)
  }
}
