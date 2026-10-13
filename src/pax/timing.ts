import { SHOWUP_WINDOWS, type WindowSpec } from './config.ts'
import { asSegment } from './facts.ts'
import { clamp, finite } from './num.ts'
import { sampleStandardNormal, type PaxRng } from './rng.ts'
import { GAME_MINUTES_PER_SIM_SECOND, SHOWUP_LEAD_GAME_MIN } from './showup.ts'
import type { LeadWindow, PaxSegment } from './types.ts'

const WINDOWS: Record<PaxSegment, WindowSpec> = SHOWUP_WINDOWS

function specFor(segment: PaxSegment): WindowSpec {
  return WINDOWS[asSegment(segment)]
}

/**
 * Show-up window relative to STD.
 * Road warriors arrive late. Lounge lovers arrive early. Normal sits between
 * them. An international bank shifts every window earlier, and nothing opens
 * before the hall's outer lead.
 */
export function leadWindow(segment: PaxSegment, intl = false): LeadWindow {
  const spec = specFor(segment)
  const extra = intl ? Math.max(0, finite(spec.intlExtra, 0)) : 0
  const sd = Math.max(0, finite(spec.sd, 0))
  let min = finite(spec.min, 0) + extra
  let max = Math.min(SHOWUP_LEAD_GAME_MIN, finite(spec.max, SHOWUP_LEAD_GAME_MIN) + extra)
  let mean = finite(spec.mean, 0) + extra
  if (!Number.isFinite(min)) min = 0
  if (!Number.isFinite(max)) max = SHOWUP_LEAD_GAME_MIN
  if (min > max) min = max
  mean = clamp(mean, min, max)
  return {
    segment: asSegment(segment),
    meanLeadMin: mean,
    sdMin: sd,
    minLeadMin: min,
    maxLeadMin: max,
  }
}

/** One draw from the segment's truncated normal, in game minutes before STD. */
export function sampleLeadMin(segment: PaxSegment, rng: PaxRng, intl = false): number {
  const window = leadWindow(segment, intl)
  const z = sampleStandardNormal(rng)
  const raw = window.meanLeadMin + z * window.sdMin
  if (!Number.isFinite(raw)) return window.meanLeadMin
  return clamp(raw, window.minLeadMin, window.maxLeadMin)
}

/** Game minutes before STD → sim-seconds before STD. */
export function leadToSimSec(leadGameMin: number): number {
  const lead = finite(leadGameMin, 0)
  const sec = lead / GAME_MINUTES_PER_SIM_SECOND
  return Number.isFinite(sec) ? sec : 0
}
