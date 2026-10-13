import { slotKey } from './scheduler.ts'
import type { ScheduleState } from './types.ts'

export const SLOT_RULE_THRESHOLD = 0.8

export interface SeriesUsage { contractId: string; lineId: string; planned: number; used: number; usage: number }

/** Usage per series (contract line): operated / planned. Cancelled and grounded count as unused. */
export function seriesUsage(state: ScheduleState): SeriesUsage[] {
  const m = new Map<string, SeriesUsage>()
  for (const s of state.slots) {
    const k = slotKey(s.contractId, s.lineId)
    const u = m.get(k) ?? { contractId: s.contractId, lineId: s.lineId, planned: 0, used: 0, usage: 0 }
    u.planned++
    if (!s.cancelled && !s.actual?.grounded) u.used++
    m.set(k, u)
  }
  for (const u of m.values()) u.usage = u.planned ? u.used / u.planned : 0
  return [...m.values()]
}

/**
 * Historic precedence for next season's Slot Round (optional 80/20 toggle, off by default, #21).
 * Toggle off → every series keeps precedence. On → series under 80% lose it and are placed after others.
 */
export function historicPrecedence(state: ScheduleState): { precedence: Set<string>; lost: SeriesUsage[] } {
  const usage = seriesUsage(state)
  if (!state.slotRule80) return { precedence: new Set(usage.map((u) => slotKey(u.contractId, u.lineId))), lost: [] }
  const lost = usage.filter((u) => u.usage < SLOT_RULE_THRESHOLD)
  return { precedence: new Set(usage.filter((u) => u.usage >= SLOT_RULE_THRESHOLD).map((u) => slotKey(u.contractId, u.lineId))), lost }
}

export function setSlotRule80(state: ScheduleState, on: boolean): ScheduleState {
  return { ...state, slotRule80: on }
}
