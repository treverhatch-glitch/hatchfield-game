import { clampToWindow } from './time'
import type { IcaoCode, TimetableAdapter, TtFlight, TtRunway, TtStand } from './types'

/**
 * Turns contract movements into timetable rows.
 * The live game builds those movements in gameAdapter and reads windows,
 * buffers, and the offer preview from src/contracts through schedulerBridge.
 * This file stays a mapper: it does not copy scheduler numbers.
 */
export interface ContractMovement {
  id: string
  contractId: string
  flightNo: string
  airlineName: string
  color: string
  direction: 'arr' | 'dep'
  /** Planned sim time. */
  time: number
  /** Agreed slot window from the contract. */
  windowStart: number
  windowEnd: number
  standId: string | null
  standLabel?: string
  standPinned?: boolean
  icao: IcaoCode
  aircraft: string
  /** Turnaround target agreed in the contract, sim seconds. */
  turnTarget: number
  services: string[]
  status: TtFlight['status']
  delaySec?: number
  delayReason?: string | null
  /** Arrival runway id (SlotInstance.runwayId). */
  runwayId?: string | null
  /** Departure runway id (SlotInstance.depRunwayId). */
  depRunwayId?: string | null
  /** Paired rotation id: arr and dep with the same rotation share one stand bar. */
  rotationId?: string
  airlineId?: string
  stripe?: string
  /** When set, overrides the status-based movable flag. Departures stay locked. */
  movable?: boolean
  manual?: boolean
  checkInFrom?: number | null
  checkInTo?: number | null
  terminal?: string
  traffic?: TtFlight['traffic']
}

export interface ContractsSource {
  dayLength: number
  now(): number
  movements(): ContractMovement[]
  stands(): TtStand[]
  runways(): TtRunway[]
  /** Returns the time actually applied (contracts clamp too). */
  reschedule(movementId: string, time: number): number | null
  assignStand(movementId: string, standId: string | null): void
  swapStands?(a: string, b: string): void
  pull?(movementId: string): void
  bump?(movementId: string): void
  cancel?(movementId: string): void
  /** Assign the movement's runway (arr → runwayId, dep → depRunwayId); null = auto. */
  assignRunway?(movementId: string, runwayId: string | null): void
}

export function contractsAdapter(src: ContractsSource): TimetableAdapter {
  const toRow = (m: ContractMovement, all: ContractMovement[]): TtFlight => {
    const pair = m.rotationId ? all.find((o) => o !== m && o.rotationId === m.rotationId) : undefined
    const arr = m.direction === 'arr' ? m : pair
    const dep = m.direction === 'dep' ? m : pair
    const from = arr ? arr.time + 6 : m.time - m.turnTarget
    const to = dep ? dep.time - 6 : from + m.turnTarget
    return {
      id: m.rotationId ? `${m.rotationId}:${m.direction}` : m.id,
      flightNo: m.flightNo,
      airlineName: m.airlineName,
      color: m.color,
      direction: m.direction,
      time: m.time,
      onStandFrom: from,
      onStandTo: to,
      window: { start: m.windowStart, end: m.windowEnd, source: 'contract' },
      status: m.status,
      delaySec: m.delaySec ?? 0,
      delayReason: m.delayReason ?? null,
      standId: m.standId,
      standLabel: m.standLabel ?? m.standId ?? 'Unassigned',
      pinned: !!m.standPinned,
      icao: m.icao,
      aircraft: m.aircraft,
      runwayId: (m.direction === 'dep' ? m.depRunwayId ?? m.runwayId : m.runwayId) ?? null,
      depRunwayId: m.depRunwayId ?? null,
      manual: m.manual ?? false,
      contractId: m.contractId,
      turnTarget: m.turnTarget,
      services: m.services,
      movable: m.movable ?? (m.status === 'scheduled' || m.status === 'delayed'),
      airlineId: m.airlineId,
      stripe: m.stripe,
      checkInFrom: m.checkInFrom ?? null,
      checkInTo: m.checkInTo ?? null,
      terminal: m.terminal,
      traffic: m.traffic,
    }
  }
  const idMap = new Map<string, string>()
  const real = (id: string) => idMap.get(id) ?? id
  return {
    source: 'Contracts',
    caps: {
      move: true,
      pin: true,
      swap: !!src.swapStands,
      pullBump: !!src.pull && !!src.bump,
      cancel: !!src.cancel,
      runway: !!src.assignRunway,
    },
    dayLength: src.dayLength,
    now: () => src.now(),
    flights() {
      const all = src.movements()
      idMap.clear()
      return all.map((m) => {
        const row = toRow(m, all)
        idMap.set(row.id, m.id)
        return row
      })
    },
    stands: () => src.stands(),
    runways: () => src.runways(),
    moveTo(id, time) {
      const m = src.movements().find((x) => x.id === real(id))
      if (!m) return null
      return src.reschedule(m.id, clampToWindow(time, { start: m.windowStart, end: m.windowEnd, source: 'contract' }))
    },
    pinStand: (id, standId) => src.assignStand(real(id), standId),
    swapStands: (a, b) => src.swapStands?.(real(a), real(b)),
    pull: (id) => src.pull?.(real(id)),
    bump: (id) => src.bump?.(real(id)),
    cancel: (id) => src.cancel?.(real(id)),
    setRunway: (id, rw) => src.assignRunway?.(real(id), rw),
  }
}
