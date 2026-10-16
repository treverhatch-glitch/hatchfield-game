/**
 * Departure and arrival stage scripts. The walk records a hit or a named skip
 * for every stage. Passport is an arrival stage and only when the flight is international.
 */
import type { StageId } from '../terminalbuild/stages.ts'
import { stageDef } from '../terminalbuild/stages.ts'
import type { StopKind } from './config.ts'

export type BoardMethod = 'stairs' | 'bus' | 'bridge'

/** Durations are seconds on the boarding socket after the door. Bus capacity matches a passenger bus. */
export const BOARD = {
  stairsSec: 48,
  busSec: 22,
  bridgeSec: 35,
  busCapacity: 60,
} as const

export interface BoardRoute {
  method: BoardMethod
  /** Facade door the passenger walks to. */
  door: 'gate_apron' | 'gate_bridge'
  durationSec: number
  /** Seats on one bus load. Stairs and the bridge take people one at a time. */
  capacity: number
}

export interface StageSkip {
  stage: StageId
  reason: string
}

export interface StageTrace {
  hit: StageId[]
  skips: StageSkip[]
}

export function emptyTrace(): StageTrace {
  return { hit: [], skips: [] }
}

export function boardRoute(method: BoardMethod, capacity: number = BOARD.busCapacity): BoardRoute {
  if (method === 'bus') return { method, door: 'gate_apron', durationSec: BOARD.busSec, capacity }
  if (method === 'bridge') return { method, door: 'gate_bridge', durationSec: BOARD.bridgeSec, capacity: 1 }
  return { method: 'stairs', door: 'gate_apron', durationSec: BOARD.stairsSec, capacity: 1 }
}

/** How long this arrival waits at the door before they can walk. A bus unloads one load at a time. */
export function deplaneDelay(method: BoardMethod, index: number, capacity: number = BOARD.busCapacity): number {
  const route = boardRoute(method, capacity)
  if (method !== 'bus') return route.durationSec
  const trip = Math.floor(Math.max(0, index) / Math.max(1, route.capacity))
  return route.durationSec * (trip + 1)
}

export function namedSkip(stage: StageId): string {
  return stageDef(stage).skip || stage
}

/**
 * Stops a departure walks, plus the skips already decided at the curb.
 * Bag drop is its own stop. A desk that takes the bags retires it later.
 */
export function departureStops(opts: {
  bags: boolean
  online: boolean
  needs: readonly StopKind[]
}): { stops: StopKind[]; skips: StageSkip[] } {
  const skips: StageSkip[] = []
  const stops: StopKind[] = []
  const needs = opts.needs.filter((n) => n === 'toilet' || n === 'food' || n === 'shop')
  if (opts.online && !opts.bags) skips.push({ stage: 'CHECKIN', reason: namedSkip('CHECKIN') })
  else stops.push('checkin')
  if (!opts.bags) skips.push({ stage: 'BAG_DROP', reason: namedSkip('BAG_DROP') })
  else stops.push('bagdrop')
  stops.push('security', ...needs, 'gate')
  return { stops, skips }
}

export type ArrivalStop = 'toilet' | 'shop' | 'passport' | 'claim' | 'exit' | 'curb'

/** Arrival stages. Passport is inserted only for an international flight. It is never skipped then. */
export function arrivalStops(opts: {
  intl: boolean
  bags: boolean
  needs: readonly ('toilet' | 'shop')[]
}): { stops: ArrivalStop[]; skips: StageSkip[] } {
  const skips: StageSkip[] = []
  const stops: ArrivalStop[] = []
  if (opts.intl) stops.push('passport')
  else skips.push({ stage: 'PASSPORT', reason: namedSkip('PASSPORT') })
  if (opts.needs.length) stops.push(...opts.needs)
  else skips.push({ stage: 'ARR_FREE', reason: namedSkip('ARR_FREE') })
  if (opts.bags) stops.push('claim')
  else skips.push({ stage: 'CLAIM', reason: namedSkip('CLAIM') })
  stops.push('exit', 'curb')
  return { stops, skips }
}

export function noteStage(trace: StageTrace, stage: StageId, reason = ''): void {
  if (trace.hit.includes(stage) || trace.skips.some((s) => s.stage === stage)) return
  if (reason) trace.skips.push({ stage, reason })
  else trace.hit.push(stage)
}

/** True when every stage was walked or skipped with a reason. */
export function traceCovers(trace: StageTrace, stages: readonly StageId[]): boolean {
  for (const stage of stages) {
    if (trace.hit.includes(stage)) continue
    const skip = trace.skips.find((s) => s.stage === stage)
    if (!skip?.reason) return false
  }
  return true
}
