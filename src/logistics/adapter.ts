import { defaultConfig } from './defaults'
import { LogisticsSim } from './engine'
import type { DelayCause, LogisticsConfig, LogisticsEvent, TurnaroundOptions } from './types'

/** What the game sim calls. Kept tiny so sim.ts only needs a handful of lines. */
export interface LogisticsAdapter {
  /** Call every sim step with elapsed game minutes. */
  tick(dtMinutes: number): void
  /** Aircraft parked on a stand. scheduledMinutes = planned turnaround length. */
  onAircraftParked(standId: string, airframeId: string, scheduledMinutes: number, opts?: TurnaroundOptions): string
  /** Terminal sim: passengers reached the gate (count or passenger ids). */
  paxArrivedAtGate(standId: string, countOrIds: number | string[]): number
  /** Terminal sim: outbound bags ready at make-up (count or bag tag ids). */
  bagsReadyAtMakeup(standId: string, countOrIds: number | string[]): number
  /** True once every service incl. pushback is finished. */
  isReadyToDepart(standId: string): boolean
  /** Minutes the aircraft on this stand is running late (0 if on time). */
  delayAt(standId: string): number
  orderFuel(litres?: number): void
  snapshot(): LogisticsSnapshot
}

/** Things the game supplies: where money goes, where sounds go. */
export interface LogisticsHost {
  addMoney?(amount: number, category: string): void
  playSound?(cue: SoundCue, standId?: string): void
  notify?(message: string, severity: 'info' | 'warn'): void
  /** Inbound passengers handed to the terminal (arrivals hall). */
  onPaxDeplaned?(standId: string, count: number): void
  /** Inbound bags delivered to bag claim. */
  onBagsToClaim?(standId: string, count: number): void
  /** Inbound cargo delivered to the cargo shed. */
  onCargoToArea?(standId: string, kg: number): void
  /** Passengers who missed gate close (offloaded) and their pulled bags. */
  onPaxOffloaded?(standId: string, count: number, bags: number): void
  /** True when the terminal sim feeds gate arrivals / bags (disables fallback models). */
  gateFeed?: boolean
  bagFeed?: boolean
}

export type SoundCue = 'refuel_start' | 'refuel_stop' | 'truck_arrive' | 'tanker_arrive'

export interface LogisticsSnapshot {
  time: number
  fuelLitres: number
  fuelCapacity: number
  meals: number
  queueLength: number
  busyVehicles: number
  totalVehicles: number
  profit: number
}

export interface TurnaroundResult {
  standId: string
  delayMinutes: number
  causes: DelayCause[]
}

export function createLogisticsAdapter(
  host: LogisticsHost = {},
  config: LogisticsConfig = defaultConfig(),
): LogisticsAdapter & { sim: LogisticsSim; completed: TurnaroundResult[] } {
  const sim = new LogisticsSim(config)
  const completed: TurnaroundResult[] = []
  const done = new Set<string>()
  sim.on((e: LogisticsEvent) => {
    switch (e.type) {
      case 'money':
        host.addMoney?.(e.amount, e.category)
        break
      case 'refuel_start':
      case 'refuel_stop':
        host.playSound?.(e.type, e.standId)
        break
      case 'truck_arrive':
        host.playSound?.('truck_arrive', e.standId)
        break
      case 'delivery_arrived':
        host.playSound?.('tanker_arrive')
        host.notify?.(`Fuel tanker delivered ${Math.round(e.litres).toLocaleString('en-US')} L`, 'info')
        break
      case 'pax_deplaned':
        host.onPaxDeplaned?.(e.standId, e.count)
        break
      case 'bags_to_claim':
        host.onBagsToClaim?.(e.standId, e.count)
        break
      case 'cargo_to_area':
        host.onCargoToArea?.(e.standId, e.kg)
        break
      case 'pax_offloaded':
        host.onPaxOffloaded?.(e.standId, e.count, e.bags)
        break
      case 'low_stock':
        host.notify?.(e.stock === 'fuel' ? 'Fuel farm running low' : 'Catering kitchen running low', 'warn')
        break
      case 'turnaround_complete':
        done.add(e.standId)
        completed.push({ standId: e.standId, delayMinutes: e.delayMinutes, causes: e.causes })
        if (e.delayMinutes > 0) {
          host.notify?.(`Turnaround at ${e.standId} late by ${Math.round(e.delayMinutes)} min (${e.causes.join(', ') || 'slow service'})`, 'warn')
        }
        break
      default:
        break
    }
  })
  return {
    sim,
    completed,
    tick: (dt) => sim.tick(dt),
    onAircraftParked(standId, airframeId, scheduledMinutes, opts = {}) {
      done.delete(standId)
      return sim.startTurnaround(standId, airframeId, scheduledMinutes, {
        gateFeed: host.gateFeed,
        bagFeed: host.bagFeed,
        ...opts,
      })
    },
    paxArrivedAtGate: (standId, countOrIds) => sim.paxArrivedAtGate(standId, countOrIds),
    bagsReadyAtMakeup: (standId, countOrIds) => sim.bagsReadyAtMakeup(standId, countOrIds),
    isReadyToDepart: (standId) => done.has(standId),
    delayAt(standId) {
      const t = sim.turnaroundAt(standId)
      return t ? sim.currentDelay(t.id) : 0
    },
    orderFuel: (litres) => sim.orderFuel(litres),
    snapshot: () => ({
      time: sim.now,
      fuelLitres: sim.fuelLitres,
      fuelCapacity: config.fuelFarm.capacityLitres,
      meals: Math.floor(sim.meals),
      queueLength: sim.queueLength,
      busyVehicles: sim.vehicles.filter((v) => v.phase !== 'idle').length,
      totalVehicles: sim.vehicles.length,
      profit: sim.profit,
    }),
  }
}
