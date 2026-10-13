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
  type CargoSnapshot,
  type CargoStage,
  type CargoTerminalConfig,
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

export interface CargoHost {
  addMoney?(amount: number, category: 'cargo_revenue' | 'cargo_penalty', contractId: string): void
  notify?(message: string, severity: 'info' | 'warn'): void
  onBottlenecks?(bottlenecks: readonly CargoBottleneck[]): void
  /**
   * Authoritative boundary telemetry for a flow adapter. The current FlowGraph
   * needs a small record-boundary bridge; do not replay this as autonomous flow.
   */
  onFlow?(stage: CargoStage, direction: 'in' | 'out', tonnes: number): void
  /** Logistics inbound callback; import delivery is intentionally host-owned in v1. */
  onImportedCargo?(standId: string, tonnes: number): void
}

export interface CargoAdapter {
  tick(dtMinutes: number): void
  acceptContract(input: CargoContractInput): CargoContract
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
  cargoUnloadedFromAircraft(standId: string, kg: number): void
  snapshot(): CargoSnapshot
}

export function createCargoAdapter(
  host: CargoHost = {},
  config: CargoTerminalConfig = starterCargoTerminal(),
): CargoAdapter & { sim: CargoSim } {
  const sim = new CargoSim(config)
  sim.on((event: CargoEvent) => {
    switch (event.type) {
      case 'money':
        host.addMoney?.(event.amount, event.category, event.contractId)
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
        break
      case 'truck_status':
        break
    }
  })
  return {
    sim,
    tick: (dtMinutes) => sim.tick(dtMinutes),
    acceptContract: (input) => sim.acceptContract(input),
    setStaff: (stage, assigned) => sim.setStaff(stage, assigned),
    prepareFlight(flightId, airframeId, overrides = {}) {
      const profile = airframeCargoProfile(airframeId)
      return sim.planFlight({
        id: flightId,
        airframeId,
        mode: overrides.mode ?? profile.mode,
        capacityTonnes: overrides.capacityTonnes ?? profile.capacityTonnes,
        supportedUnits: overrides.supportedUnits ?? profile.supportedUnits,
        mainDeckLoaderAvailable: overrides.mainDeckLoaderAvailable ?? !profile.needsMainDeckLoader,
      })
    },
    cancelFlight: (flightId) => sim.cancelFlight(flightId),
    flightDeparted: (flightId) => sim.confirmFlightDeparted(flightId),
    cargoUnloadedFromAircraft(standId, kg) {
      host.onImportedCargo?.(standId, Math.max(0, kg) / 1000)
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
      kind: stage === 'warehouse' ? 'cargoShed' : 'generic',
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

  const ids = ['landside', ...CARGO_STAGES, 'flight']
  for (let index = 0; index < ids.length - 1; index++) {
    const from = ids[index]
    const to = ids[index + 1]
    const previous = config.facilities.find((entry) => entry.id === from)
    registrar.addLink({
      id: `cargo:${from}>${to}`,
      from: `cargo:${from}`,
      to: `cargo:${to}`,
      unit: 'cargo',
      capacityPerMin:
        to === 'flight'
          ? 1_000_000
          : previous?.rateTonnesPerMin ?? config.trucks.unloadTonnesPerMin,
      mode: from === 'landside' ? 'vehicle' : to === 'flight' ? 'vehicle' : 'conveyor',
      travelTimeMin: from === 'landside' ? config.trucks.inboundTravelMinutes : 0,
    })
  }
}
