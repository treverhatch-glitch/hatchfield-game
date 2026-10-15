/**
 * Whether a new passenger contract fits the open check-in desks and kiosks.
 * Rates stay in the scale table. This file does not price a desk.
 */
import { PAX_UNITS, SIZE_TIERS, TIER_RANK } from '../scale/data.ts'
import { sizeTierOf } from '../scale/logic.ts'
import type { SizeTier } from '../scale/types.ts'

/** Peak check-in demand for one carrier, from the largest passenger type they list. */
export function carrierPeakPaxPerMin(kind: string, airframeIds: readonly string[]): number {
  if (kind !== 'pax') return 0
  let best: SizeTier = 'small'
  for (const id of airframeIds) {
    const tier = sizeTierOf(id)
    if (TIER_RANK[tier] > TIER_RANK[best]) best = tier
  }
  return SIZE_TIERS[best].paxPerMin
}

/** Passengers a minute the open desks and kiosks can clear. */
export function checkinCapacityPerMin(openDesks: number, kiosks: number): number {
  const desks = Number.isFinite(openDesks) ? Math.max(0, Math.floor(openDesks)) : 0
  const machines = Number.isFinite(kiosks) ? Math.max(0, Math.floor(kiosks)) : 0
  return desks * PAX_UNITS.desk.perMin + machines * PAX_UNITS.kiosk.perMin
}

export interface CheckinSignGate {
  ok: boolean
  /** Letter line. Empty when the carrier does not check passengers in. */
  line: string
  peak: number
  capacity: number
}

/**
 * A passenger contract whose peak, with the carriers already signed,
 * is more than the open desks and kiosks can clear.
 */
export function checkinSignGate(input: {
  kind: string
  peakPaxPerMin: number
  openDesks: number
  kiosks: number
  label: string
}): CheckinSignGate {
  const capacity = checkinCapacityPerMin(input.openDesks, input.kiosks)
  if (input.kind !== 'pax') return { ok: true, line: '', peak: 0, capacity }
  const peak = Number.isFinite(input.peakPaxPerMin) ? Math.max(0, input.peakPaxPerMin) : 0
  const sentence = `${input.label} needs ${peak} passengers a minute at check-in. Desks and kiosks clear ${capacity}.`
  if (peak > capacity) return { ok: false, line: `${sentence} Add check-in desks`, peak, capacity }
  return { ok: true, line: sentence, peak, capacity }
}
