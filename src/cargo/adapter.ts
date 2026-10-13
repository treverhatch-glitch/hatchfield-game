import { airframeCargoProfile, starterCargoTerminal } from './catalog.ts'
import { CargoSim } from './engine.ts'
import {
  CARGO_STAGES,
  type CargoBottleneck,
  type CargoContract,
  type CargoContractInput,
  type CargoEvent,
  type CargoFlight,
  type CargoFlightLoad,
  type CargoKind,
  type CargoSnapshot,
  type CargoStage,
  type CargoTerminalConfig,
  type HandlingUnitKind,
  type ImportShipment,
} from './types.ts'

/** Minimal structural shape accepted by src/flow/FlowGraph.addNode. */
export interface CargoFlowNodeDef {
  id: string
  kind: 'source' | 'cargoShed' | 'stand' | 'generic'
  label?: string
  chain: 'cargo'
  accepts: { cargo?: number }
  ratePerMin: number
  outCapacity?: number
  staffRequired?: number
  staffAssigned?: number
  sink?: boolean
}

/** Minimal structural shape accepted by src/flow/FlowGraph.addLink. */
export interface CargoFlowLinkDef {
  id: string
  from: string
  to: string
  unit: 'cargo'
  capacityPerMin: number
  mode: 'vehicle' | 'conveyor' | 'virtual'
  travelTimeMin?: number
}

export interface CargoFlowRegistrar {
  addNode(definition: CargoFlowNodeDef): unknown
  addLink(definition: CargoFlowLinkDef): unknown
}

export type CargoLoaderType = 'uld_loader' | 'main_deck_loader'

export interface CargoLoaderReservation {
  id: string
  flightId: string
  loaderId: string
  type: CargoLoaderType
}

/**
 * Shared structural port. A logistics-owned implementation reserves the same
 * vehicle its dispatcher will use; cargo releases it on cancel/departure.
 */
export interface CargoLoaderReservationPort {
  reserve(request: {
    flightId: string
    preferred: CargoLoaderType
    allowUldFallback: boolean
  }): CargoLoaderReservation | null
  release(reservationId: string): void
}

/** Structural posting shape for the planned src/core/bank.ts money bus. */
export interface CargoMoneyPosting {
  time: number
  amount: number
  category: 'cargo_airport_revenue' | 'cargo_penalty'
  referenceId: string
}

export interface CargoHost {
  /** Preferred integration: pass each posting to bank.post(). */
  postMoney?(posting: CargoMoneyPosting): void
  /** Compatibility callback until src/core/bank.ts is on the base branch. */
  addMoney?(
    amount: number,
    category: 'cargo_airport_revenue' | 'cargo_penalty',
    contractId: string,
  ): void
  addHandlerMoney?(amount: number, contractId: string): void
  notify?(message: string, severity: 'info' | 'warn'): void
  onBottlenecks?(bottlenecks: readonly CargoBottleneck[]): void
  /**
   * Authoritative boundary telemetry for a flow adapter. The current FlowGraph
   * needs a small record-boundary bridge; do not replay this as autonomous flow.
   */
  onFlow?(stage: CargoStage, direction: 'in' | 'out', tonnes: number): void
  loaderReservations?: CargoLoaderReservationPort
}

export interface CargoAdapter {
  tick(dtMinutes: number): void
  acceptContract(input: CargoContractInput): CargoContract
  seedLegacyReadyCargo(input: CargoContractInput): CargoContract
  setStaff(stage: CargoStage, assigned: number): void
  /**
   * Call before logistics.onAircraftParked. The returned kg is passed as
   * TurnaroundOptions.outboundCargoKg; reservation is released on cancel.
   */
  prepareFlight(
    flightId: string,
    airframeId: string,
    overrides?: Partial<Omit<CargoFlight, 'id' | 'airframeId'>>,
  ): CargoFlightLoad
  cancelFlight(flightId: string): void
  /** Call only after departure; this posts contract revenue. */
  flightDeparted(flightId: string): CargoFlightLoad | null
  /** Wire LogisticsHost.onCargoToArea here (kg -> tonnes). */
  cargoUnloadedFromAircraft(
    standId: string,
    kg: number,
    manifest?: {
      shipmentId?: string
      kind?: CargoKind
      unitKind?: HandlingUnitKind
      /** Last tug/cart delivery for this aircraft manifest. */
      complete?: boolean
    },
  ): ImportShipment
  snapshot(): CargoSnapshot
}

export function createCargoAdapter(
  host: CargoHost = {},
  config: CargoTerminalConfig = starterCargoTerminal(),
): CargoAdapter & { sim: CargoSim } {
  const sim = new CargoSim(config)
  const loaderReservations = new Map<string, string>()
  const activeImportByStand = new Map<string, string>()
  let nextImportId = 1
  sim.on((event: CargoEvent) => {
    switch (event.type) {
      case 'money':
        if (event.category === 'cargo_handler_revenue') {
          host.addHandlerMoney?.(event.amount, event.contractId)
        } else if (host.postMoney) {
          host.postMoney({
            time: event.time,
            amount: event.amount,
            category: event.category,
            referenceId: event.contractId,
          })
        } else {
          host.addMoney?.(event.amount, event.category, event.contractId)
        }
        break
      case 'bottlenecks':
        host.onBottlenecks?.(event.bottlenecks)
        break
      case 'flow':
        host.onFlow?.(event.stage, event.direction, event.tonnes)
        break
      case 'contract_status':
        host.notify?.(
          `Cargo contract ${event.contractId} ${event.status}`,
          event.status === 'failed' ? 'warn' : 'info',
        )
        if (event.status === 'failed') {
          for (const [flightId, reservationId] of loaderReservations) {
            if ((sim.reservationLoad(flightId)?.tonnes ?? 0) > 0) continue
            host.loaderReservations?.release(reservationId)
            loaderReservations.delete(flightId)
          }
        }
        break
      case 'import_status':
        if (event.status === 'collected') {
          host.notify?.(`Import shipment ${event.shipmentId} collected landside`, 'info')
        }
        break
      case 'truck_status':
        break
    }
  })
  return {
    sim,
    tick: (dtMinutes) => sim.tick(dtMinutes),
    acceptContract: (input) => sim.acceptContract(input),
    seedLegacyReadyCargo: (input) => sim.seedLegacyReadyCargo(input),
    setStaff: (stage, assigned) => sim.setStaff(stage, assigned),
    prepareFlight(flightId, airframeId, overrides = {}) {
      const profile = airframeCargoProfile(airframeId)
      const load = sim.planFlight({
        id: flightId,
        airframeId,
        mode: overrides.mode ?? profile.mode,
        capacityTonnes: overrides.capacityTonnes ?? profile.capacityTonnes,
        supportedUnits: overrides.supportedUnits ?? profile.supportedUnits,
        holdCapacityTonnes: overrides.holdCapacityTonnes,
        baggageTonnes: overrides.baggageTonnes,
        mainDeckLoaderAvailable: overrides.mainDeckLoaderAvailable ?? profile.needsMainDeckLoader,
      })
      if (load.loaderReservationId) return load
      if (!load.requiredLoader || load.tonnes <= 0) return load
      if (!host.loaderReservations) {
        const rejected = load.assignments.map((assignment) => ({
          contractId: assignment.contractId,
          reason: 'logistics loader reservation bridge unavailable',
        }))
        sim.cancelFlight(flightId)
        load.assignments = []
        load.rejected.push(...rejected)
        load.tonnes = 0
        load.units = 0
        load.requiredLoader = null
        return load
      }
      const reservation = host.loaderReservations.reserve({
        flightId,
        preferred: load.requiredLoader,
        allowUldFallback: load.requiredLoader === 'main_deck_loader',
      })
      if (reservation) {
        load.loaderReservationId = reservation.id
        load.requiredLoader = reservation.type
        loaderReservations.set(flightId, reservation.id)
        return load
      }
      const rejected = load.assignments.map((assignment) => ({
        contractId: assignment.contractId,
        reason: 'no compatible cargo loader available',
      }))
      sim.cancelFlight(flightId)
      load.assignments = []
      load.rejected.push(...rejected)
      load.tonnes = 0
      load.units = 0
      load.requiredLoader = null
      return load
    },
    cancelFlight(flightId) {
      sim.cancelFlight(flightId)
      const reservationId = loaderReservations.get(flightId)
      if (reservationId) host.loaderReservations?.release(reservationId)
      loaderReservations.delete(flightId)
    },
    flightDeparted(flightId) {
      const result = sim.confirmFlightDeparted(flightId)
      const reservationId = loaderReservations.get(flightId)
      if (reservationId) host.loaderReservations?.release(reservationId)
      loaderReservations.delete(flightId)
      return result
    },
    cargoUnloadedFromAircraft(standId, kg, manifest = {}) {
      let shipmentId = manifest.shipmentId ?? activeImportByStand.get(standId)
      if (
        !manifest.shipmentId &&
        shipmentId &&
        sim.imports.get(shipmentId)?.status === 'collected'
      ) {
        shipmentId = undefined
      }
      if (!shipmentId) {
        do {
          shipmentId = `import-${nextImportId++}`
        } while (sim.imports.has(shipmentId))
        activeImportByStand.set(standId, shipmentId)
      }
      const shipment = sim.receiveImport({
        id: shipmentId,
        kind: manifest.kind ?? 'general',
        tonnes: Math.max(0, kg) / 1000,
        unitKind: manifest.unitKind,
        standId,
      })
      if (manifest.complete) activeImportByStand.delete(standId)
      return shipment
    },
    snapshot: () => sim.snapshot(),
  }
}

/**
 * Register the cargo chain with src/flow. CargoSim remains authoritative;
 * CargoHost.onFlow should mirror boundary movements into the graph.
 */
export function registerCargoFlow(
  registrar: CargoFlowRegistrar,
  config: CargoTerminalConfig = starterCargoTerminal(),
): void {
  registrar.addNode({
    id: 'cargo:landside',
    kind: 'source',
    label: 'Cargo truck arrivals',
    chain: 'cargo',
    accepts: {},
    ratePerMin: 0,
    outCapacity: config.facilities[0]?.inputCapacityTonnes ?? 0,
  })
  for (const stage of CARGO_STAGES) {
    const facility = config.facilities.find((entry) => entry.id === stage)
    if (!facility) throw new Error(`Missing cargo flow facility: ${stage}`)
    registrar.addNode({
      id: `cargo:${stage}`,
      kind: stage === 'warehouse' || stage === 'import_warehouse' ? 'cargoShed' : 'generic',
      label: facility.label,
      chain: 'cargo',
      accepts: { cargo: facility.inputCapacityTonnes },
      ratePerMin: facility.rateTonnesPerMin,
      outCapacity: facility.outputCapacityTonnes,
      staffRequired: facility.staffRequired,
      staffAssigned: facility.staffAssigned,
    })
  }
  registrar.addNode({
    id: 'cargo:flight',
    kind: 'stand',
    label: 'Aircraft cargo hold',
    chain: 'cargo',
    accepts: { cargo: 1_000_000 },
    ratePerMin: 1_000_000,
    sink: true,
  })
  registrar.addNode({
    id: 'cargo:flight_arrival',
    kind: 'source',
    label: 'Arriving aircraft hold',
    chain: 'cargo',
    accepts: {},
    ratePerMin: 0,
    outCapacity: 1_000_000,
  })
  registrar.addNode({
    id: 'cargo:landside_import',
    kind: 'stand',
    label: 'Import collection trucks',
    chain: 'cargo',
    accepts: { cargo: 1_000_000 },
    ratePerMin: 1_000_000,
    sink: true,
  })

  const edges: [string, string][] = [
    ['landside', 'truck_dock'],
    ['truck_dock', 'customs'],
    ['customs', 'screening'],
    ['screening', 'warehouse'],
    ['warehouse', 'cold_storage'],
    ['warehouse', 'build_up'],
    ['cold_storage', 'build_up'],
    ['build_up', 'ready'],
    ['ready', 'flight'],
    ['flight_arrival', 'import_airside'],
    ['import_airside', 'import_breakdown'],
    ['import_breakdown', 'import_screening'],
    ['import_screening', 'import_customs'],
    ['import_customs', 'import_warehouse'],
    ['import_warehouse', 'import_cold_storage'],
    ['import_warehouse', 'import_truck_dock'],
    ['import_cold_storage', 'import_truck_dock'],
    ['import_truck_dock', 'landside_import'],
  ]
  for (const [from, to] of edges) {
    const previous = config.facilities.find((entry) => entry.id === from)
    registrar.addLink({
      id: `cargo:${from}>${to}`,
      from: `cargo:${from}`,
      to: `cargo:${to}`,
      unit: 'cargo',
      capacityPerMin:
        to === 'flight' || to === 'landside_import'
          ? 1_000_000
          : previous?.rateTonnesPerMin ?? config.trucks.unloadTonnesPerMin,
      mode:
        from === 'landside' || to === 'landside_import' || to === 'flight'
          ? 'vehicle'
          : 'conveyor',
      travelTimeMin:
        from === 'landside' || to === 'landside_import'
          ? config.trucks.inboundTravelMinutes
          : 0,
    })
  }
}
