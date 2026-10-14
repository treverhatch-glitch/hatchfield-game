import {
  MISCONNECT_BASE,
  MISCONNECT_BASE_RFID,
  MISCONNECT_CAP,
  MISCONNECT_PER_OVERLOAD,
  RFID_SORT_MULT,
  SORT_BAGS_PER_HOUR_PER_BELT,
  SORT_KNEE,
  TRANSFER_CENTRE_SORT_MULT,
} from './config.ts'
import { roll01 } from './mix.ts'
import type { SortCapacityInput } from './types.ts'

/** Bags per hour the sort can handle. No belts means nothing sorts. */
export function sortCapacityPerHour(input: SortCapacityInput): number {
  const belts = Number.isFinite(input.belts) ? Math.max(0, Math.floor(input.belts)) : 0
  let rate = belts * SORT_BAGS_PER_HOUR_PER_BELT
  if (input.transferCentre) rate *= TRANSFER_CENTRE_SORT_MULT
  if (input.rfid) rate *= RFID_SORT_MULT
  return Number.isFinite(rate) ? rate : 0
}

/**
 * Chance a transfer bag misses its onward flight. A small floor, then a steep
 * climb once the sort runs past its knee. No sort capacity at all caps out.
 */
export function misconnectRate(bagsPerHour: number, capacityPerHour: number, rfid: boolean): number {
  const load = Number.isFinite(bagsPerHour) ? Math.max(0, bagsPerHour) : 0
  const base = rfid ? MISCONNECT_BASE_RFID : MISCONNECT_BASE
  if (load <= 0) return base
  if (!(capacityPerHour > 0)) return MISCONNECT_CAP
  const utilisation = load / capacityPerHour
  const over = Math.max(0, utilisation - SORT_KNEE)
  return Math.min(MISCONNECT_CAP, base + over * MISCONNECT_PER_OVERLOAD)
}

/** Deterministic per-bag roll: same bag id and rate always gives the same answer. */
export function bagMisconnects(bagId: string, rate: number): boolean {
  if (!(rate > 0)) return false
  return roll01(`misconnect:${bagId}`) < rate
}

/** Rolling count of transfer bags fed to the sort in the last hour of game time. */
export class SortLoad {
  private stamps: number[] = []

  add(atMinute: number, bags = 1) {
    if (!Number.isFinite(atMinute)) return
    for (let i = 0; i < bags; i++) this.stamps.push(atMinute)
  }

  perHour(nowMinute: number): number {
    const from = nowMinute - 60
    this.stamps = this.stamps.filter((t) => t > from && t <= nowMinute + 1e-9)
    return this.stamps.length
  }

  clear() {
    this.stamps = []
  }
}
