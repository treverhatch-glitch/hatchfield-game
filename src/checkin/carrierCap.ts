/**
 * How many passenger carriers the desks, the extra lanes, and the hall rung can sign.
 * Rates stay in the scale table. This file only says how they add up.
 */
import { PAX_UNITS, SIZE_TIERS } from '../scale/data.ts'

/**
 * Extra carrier slots a premade hall rung adds on top of the desks.
 * Tier 1 is the starter. Tier 2 is the first bigger hall (a third carrier).
 * Tier 3 opens a fourth. Bought desks and lanes add slots without this bonus.
 */
export const HALL_CARRIER_SLOTS: Record<1 | 2 | 3, number> = {
  1: 0,
  2: 1,
  3: 2,
}

/** Passengers a minute one small carrier is counted as. */
export const CARRIER_SLOT_PAX = SIZE_TIERS.small.paxPerMin

/** Passengers a minute one security lane adds, beyond the rung's own lanes. */
export const LANE_CARRIER_PER_MIN = PAX_UNITS.scanner.perMin

export interface CarrierPlant {
  checkinPerMin: number
  /** Bought lanes only. The rung's own lanes are already in the hall. */
  lanePerMin: number
  hallPerMin: number
  /** Desks, extra lanes, and the hall rung, added. */
  perMin: number
  /** Whole carriers that figure can hold. */
  slots: number
}

export function carrierPlant(input: {
  checkinPerMin: number
  openLanes: number
  /** Lanes that came with this hall rung. Lanes above this count as bought. */
  bundleLanes: number
  hallTier: 1 | 2 | 3
  /** A custom hall grows by the items in it. The rung bonus stays on the prefab. */
  premade: boolean
}): CarrierPlant {
  const checkin = Number.isFinite(input.checkinPerMin) ? Math.max(0, input.checkinPerMin) : 0
  const open = Number.isFinite(input.openLanes) ? Math.max(0, Math.floor(input.openLanes)) : 0
  const bundle = Number.isFinite(input.bundleLanes) ? Math.max(0, Math.floor(input.bundleLanes)) : 0
  const lanePerMin = Math.max(0, open - bundle) * LANE_CARRIER_PER_MIN
  const tier = input.hallTier === 2 || input.hallTier === 3 ? input.hallTier : 1
  const hallPerMin = input.premade ? HALL_CARRIER_SLOTS[tier] * CARRIER_SLOT_PAX : 0
  const perMin = checkin + lanePerMin + hallPerMin
  return {
    checkinPerMin: checkin,
    lanePerMin,
    hallPerMin,
    perMin,
    slots: Math.floor(perMin / CARRIER_SLOT_PAX),
  }
}

export function carrierRoomPhrase(slots: number): string {
  const n = Math.max(0, Math.floor(slots))
  return `Room for ${n} ${n === 1 ? 'carrier' : 'carriers'}`
}
