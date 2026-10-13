import { soundForEvent, type BindableEvent } from '../audio/bindings.ts'
import type { Advice } from './advisor.ts'
import {
  CargoSim,
  createCargoAdapter,
  estimateBaggageTonnes,
  registerCargoFlow,
  starterCargoTerminal,
  type CargoAdapter,
  type CargoFlightLoad,
  type CargoHost,
  type CargoLoaderReservationPort,
} from '../cargo/index.ts'

/**
 * Airport share of a real cargo dollar, after the handler cut already taken
 * inside the cargo module. A full freighter would otherwise dwarf a landing fee.
 */
export const CARGO_CASH_SCALE = 0.1

export interface CargoBridgeHandlers {
  postMoney(amount: number, category: 'cargo_airport_revenue' | 'cargo_penalty'): void
  loaders(): CargoLoaderReservationPort | null
  cue(name: string | null): void
  notify(message: string, severity: 'info' | 'warn'): void
  onNotes(): void
  standCell(standId: string): { c: number; r: number } | null
}

/**
 * Cargo terminal on the same game-minute clock as the ramp.
 * Handler revenue stays off the airport books. Flow registration is topology only.
 */
export class CargoBridge {
  readonly adapter: CargoAdapter & { sim: CargoSim }
  notes: Advice[] = []
  readonly flowNodeIds: string[] = []
  private readonly standFlight = new Map<string, string>()
  private readonly deliveredKg = new Map<string, number>()
  private readonly handlers: CargoBridgeHandlers

  constructor(handlers: CargoBridgeHandlers) {
    this.handlers = handlers
    const host: CargoHost = {
      postMoney: (posting) => {
        const scaled = Math.round(posting.amount * CARGO_CASH_SCALE * 100) / 100
        if (scaled !== 0) handlers.postMoney(scaled, posting.category)
      },
      onBottlenecks: (bottlenecks) => {
        const held = this.notes.filter((n) => n.id.startsWith('cargo-loader-'))
        this.notes = [
          ...held,
          ...bottlenecks.map((b) => ({
            id: b.id,
            title: `Cargo ${b.stage.replaceAll('_', ' ')}`,
            detail: `${b.reason.replaceAll('_', ' ')}. ${b.queueTonnes.toFixed(1)} t waiting.`,
            fix: b.fixes.staff || b.fixes.build,
            cells: [],
            scope: 'apron' as const,
          })),
        ]
        handlers.onNotes()
      },
      onFlow: () => {
        // Snapshot and the advisor carry the numbers. Do not drive a flow graph.
      },
      notify: (message, severity) => handlers.notify(message, severity),
      loaderReservations: {
        reserve: (request) => handlers.loaders()?.reserve(request) ?? null,
        release: (id) => handlers.loaders()?.release(id),
      },
    }
    this.adapter = createCargoAdapter(host, starterCargoTerminal())
    this.adapter.sim.on((event) => {
      handlers.cue(soundForEvent(event as BindableEvent, 'cargo'))
    })
    registerCargoFlow({
      addNode: (node) => {
        this.flowNodeIds.push(node.id)
      },
      addLink: () => {},
    })
    this.adapter.acceptContract({ id: 'field-general', kind: 'general', tonnes: 8, deadline: 24 * 60 })
    this.adapter.acceptContract({
      id: 'field-maindeck',
      kind: 'general',
      tonnes: 12,
      deadline: 36 * 60,
      unitKind: 'pmc',
    })
  }

  prepare(
    flightId: string,
    airframeId: string,
    standId: string,
    holdCapacityTonnes: number,
    bagUnits: number,
  ): CargoFlightLoad {
    this.standFlight.set(standId, flightId)
    const load = this.adapter.prepareFlight(flightId, airframeId, {
      holdCapacityTonnes,
      baggageTonnes: estimateBaggageTonnes(bagUnits),
    })
    const loaderMiss = load.rejected.find((entry) => /loader/i.test(entry.reason))
    if (load.tonnes <= 0 && loaderMiss) {
      const cell = this.handlers.standCell(standId)
      const id = `cargo-loader-${flightId}`
      this.notes = [
        ...this.notes.filter((n) => n.id !== id),
        {
          id,
          title: 'No cargo loader free',
          detail: loaderMiss.reason,
          fix: 'Add a vehicle depot with a main-deck loader, or wait until one is free.',
          cells: cell ? [cell] : [],
          scope: 'apron',
        },
      ]
      this.handlers.onNotes()
    }
    return load
  }

  /** Inbound tug loads share one import shipment. The last tug closes it. */
  inbound(standId: string, kg: number, cargoInKg: number): void {
    if (!(kg > 0)) return
    const flightId = this.standFlight.get(standId) ?? standId
    const soFar = (this.deliveredKg.get(standId) ?? 0) + kg
    this.deliveredKg.set(standId, soFar)
    const complete = cargoInKg > 0 ? soFar + 0.5 >= cargoInKg : true
    this.adapter.cargoUnloadedFromAircraft(standId, kg, {
      shipmentId: `imp_${flightId}`,
      complete,
    })
    if (complete) this.deliveredKg.delete(standId)
  }

  departed(flightId: string) {
    return this.adapter.flightDeparted(flightId)
  }

  cancel(flightId: string) {
    this.adapter.cancelFlight(flightId)
  }
}
