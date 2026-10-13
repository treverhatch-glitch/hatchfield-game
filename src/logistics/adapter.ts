import { defaultConfig } from './defaults'
import { LogisticsSim } from './engine'
import type { DelayCause, LogisticsConfig, LogisticsEvent } from './types'

/** What the game sim calls. Kept tiny so sim.ts only needs a handful of lines. */
export interface LogisticsAdapter {
  /** Call every sim step with elapsed game minutes. */
  tick(dtMinutes: number): void
  /** Aircraft parked on a stand. scheduledMinutes = planned turnaround length. */
  onAircraftParked(standId: string, airframeId: string, scheduledMinutes: number): string
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
    onAircraftParked(standId, airframeId, scheduledMinutes) {
      done.delete(standId)
      return sim.startTurnaround(standId, airframeId, scheduledMinutes)
    },
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
