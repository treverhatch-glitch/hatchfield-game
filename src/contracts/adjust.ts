import { airframeInfo, standFits } from './airframes.ts'
import { evaluateFlags, slotKey, withDefaults } from './scheduler.ts'
import { MIN_PER_DAY } from './seasons.ts'
import type { Contract, Infrastructure, ScheduleState, SchedulerOptions, SlotInstance } from './types.ts'

/** Standing cost per week for each flight sitting in the hard band (doc §5, open question: standing vs cash). */
export const OFF_WINDOW_STANDING_PER_WEEK = 1

export type AdjustResult =
  | { ok: true; state: ScheduleState; zone: 'window' | 'hard_band' | 'none'; standingCostPerWeek: number }
  | { ok: false; state: ScheduleState; reason: string }

interface Ctx {
  contracts: Contract[]
  infra: Infrastructure
  options?: Partial<SchedulerOptions>
}

function lineFor(ctx: Ctx, s: SlotInstance) {
  const c = ctx.contracts.find((x) => x.id === s.contractId)
  const l = c?.lines.find((x) => x.id === s.lineId)
  if (!l) throw new Error(`no line for slot ${s.id}`)
  return l
}

function commit(state: ScheduleState, slots: SlotInstance[], ctx: Ctx): ScheduleState {
  return { ...state, slots: evaluateFlags(slots, ctx.contracts, ctx.infra, ctx.options) }
}

function find(state: ScheduleState, id: string) {
  return state.slots.find((s) => s.id === id)
}

/** Where an on-block time sits relative to its line's window. */
export function windowZone(s: SlotInstance, ctx: Ctx, onBlock: number): 'window' | 'hard_band' | 'outside' {
  const l = lineFor(ctx, s)
  const d = Math.abs(onBlock - (s.day * MIN_PER_DAY + l.arrival.preferredMin))
  return d <= l.arrival.softMin ? 'window' : d <= l.arrival.hardMin ? 'hard_band' : 'outside'
}

/**
 * Drag a flight bar to a new on-block time. Free inside the window; allowed in the hard band at a standing cost per week;
 * refused beyond the hard band. The turnaround length is preserved and the slot becomes pinned (auto won't move it).
 * Capacity conflicts are allowed and flagged red — never blocked.
 */
export function dragSlot(state: ScheduleState, slotId: string, newOnBlock: number, ctx: Ctx): AdjustResult {
  const s = find(state, slotId)
  if (!s) return { ok: false, state, reason: 'unknown slot' }
  if (s.cancelled) return { ok: false, state, reason: 'slot is cancelled' }
  const zone = windowZone(s, ctx, newOnBlock)
  if (zone === 'outside') return { ok: false, state, reason: 'outside hard band' }
  const tt = s.plannedOffBlock - s.plannedOnBlock
  const slots = state.slots.map((x) => x.id === slotId ? { ...x, plannedOnBlock: newOnBlock, plannedOffBlock: newOnBlock + tt, pinned: true } : x)
  return { ok: true, state: commit(state, slots, ctx), zone, standingCostPerWeek: zone === 'hard_band' ? OFF_WINDOW_STANDING_PER_WEEK : 0 }
}

/** Pull = earlier, Bump = later (same semantics as trunk game.pullSlot/bumpSlot), in game minutes. */
export function pullSlot(state: ScheduleState, slotId: string, byMin: number, ctx: Ctx): AdjustResult {
  const s = find(state, slotId)
  if (!s) return { ok: false, state, reason: 'unknown slot' }
  return dragSlot(state, slotId, s.plannedOnBlock - Math.abs(byMin), ctx)
}
export function bumpSlot(state: ScheduleState, slotId: string, byMin: number, ctx: Ctx): AdjustResult {
  const s = find(state, slotId)
  if (!s) return { ok: false, state, reason: 'unknown slot' }
  return dragSlot(state, slotId, s.plannedOnBlock + Math.abs(byMin), ctx)
}

/** Cancel / restore a single day's operation. Cancelled slots free capacity and count against usage (80% rule). */
export function setCancelled(state: ScheduleState, slotId: string, cancelled: boolean, ctx: Ctx): AdjustResult {
  if (!find(state, slotId)) return { ok: false, state, reason: 'unknown slot' }
  const slots = state.slots.map((x) => x.id === slotId ? { ...x, cancelled } : x)
  return { ok: true, state: commit(state, slots, ctx), zone: 'none', standingCostPerWeek: 0 }
}

/** Pin a flight to a stand. Refused if the stand isn't built or is too small; clashes are allowed and flagged. */
export function pinStand(state: ScheduleState, slotId: string, standId: string, ctx: Ctx): AdjustResult {
  const s = find(state, slotId)
  if (!s) return { ok: false, state, reason: 'unknown slot' }
  const st = ctx.infra.stands.find((x) => x.id === standId)
  if (!st) return { ok: false, state, reason: 'unknown stand' }
  const cls = airframeInfo(withDefaults(ctx.options).airframes, s.airframeId).sizeClass
  if (!standFits(st.sizeClass, cls)) return { ok: false, state, reason: `stand ${standId} too small for ${cls}` }
  const slots = state.slots.map((x) => x.id === slotId ? { ...x, standId, standPinned: true } : x)
  return { ok: true, state: commit(state, slots, ctx), zone: 'none', standingCostPerWeek: 0 }
}

export function unpinStand(state: ScheduleState, slotId: string, ctx: Ctx): AdjustResult {
  if (!find(state, slotId)) return { ok: false, state, reason: 'unknown slot' }
  const slots = state.slots.map((x) => x.id === slotId ? { ...x, standPinned: false } : x)
  return { ok: true, state: commit(state, slots, ctx), zone: 'none', standingCostPerWeek: 0 }
}

/** Release a dragged flight back to the auto-scheduler on next re-run. */
export function unpinTime(state: ScheduleState, slotId: string, ctx: Ctx): AdjustResult {
  if (!find(state, slotId)) return { ok: false, state, reason: 'unknown slot' }
  const slots = state.slots.map((x) => x.id === slotId ? { ...x, pinned: false } : x)
  return { ok: true, state: commit(state, slots, ctx), zone: 'none', standingCostPerWeek: 0 }
}

/** Swap two flights' stands; both must fit. Both become stand-pinned. */
export function swapStands(state: ScheduleState, aId: string, bId: string, ctx: Ctx): AdjustResult {
  const a = find(state, aId)
  const b = find(state, bId)
  if (!a || !b) return { ok: false, state, reason: 'unknown slot' }
  const o = withDefaults(ctx.options)
  const def = (id: string | null) => ctx.infra.stands.find((x) => x.id === id)
  const sa = def(a.standId)
  const sb = def(b.standId)
  if (!sa || !sb) return { ok: false, state, reason: 'both flights need a stand' }
  if (!standFits(sb.sizeClass, airframeInfo(o.airframes, a.airframeId).sizeClass)) return { ok: false, state, reason: `stand ${sb.id} too small for ${a.id}` }
  if (!standFits(sa.sizeClass, airframeInfo(o.airframes, b.airframeId).sizeClass)) return { ok: false, state, reason: `stand ${sa.id} too small for ${b.id}` }
  const slots = state.slots.map((x) => x.id === aId ? { ...x, standId: sb.id, standPinned: true } : x.id === bId ? { ...x, standId: sa.id, standPinned: true } : x)
  return { ok: true, state: commit(state, slots, ctx), zone: 'none', standingCostPerWeek: 0 }
}

/** Turn auto-scheduling off (hand-schedule) or on per airline. */
export function setAuto(state: ScheduleState, airlineId: string, on: boolean): ScheduleState {
  return { ...state, autoByAirline: { ...state.autoByAirline, [airlineId]: on } }
}

/** Standing cost this week per airline for flights the player left in the hard band. */
export function weeklyOffWindowCost(state: ScheduleState, weekStartDay: number, ctx: Ctx): Record<string, number> {
  const out: Record<string, number> = {}
  const seen = new Set<string>()
  for (const s of state.slots) {
    if (s.cancelled || s.day < weekStartDay || s.day >= weekStartDay + 7) continue
    if (windowZone(s, ctx, s.plannedOnBlock) !== 'hard_band') continue
    // charged once per flight line per week
    const k = slotKey(s.contractId, s.lineId)
    if (seen.has(k)) continue
    seen.add(k)
    out[s.airlineId] = (out[s.airlineId] ?? 0) + OFF_WINDOW_STANDING_PER_WEEK
  }
  return out
}
