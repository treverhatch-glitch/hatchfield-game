import type { PaxTag } from '../game/guests.ts'
import {
  LAYOVER_COMFORT_MINUTES,
  LAYOVER_DRAIN_CAP,
  LAYOVER_DRAIN_PER_HOUR,
  LAYOVER_NEED_CAP,
  LAYOVER_NEEDS_PER_HOUR,
  NIGHT_END,
  NIGHT_START,
  SHORT_LAYOVER_MAX,
} from './config.ts'
import type { LayoverClass, LayoverTrait, OvernightChoice, OvernightOptions } from './types.ts'

export function layoverTrait(tag: PaxTag): LayoverTrait {
  if (tag === 'business' || tag === 'premium') return 'business'
  if (tag === 'family') return 'family'
  return 'budget'
}

/** True when a wall-clock hour (0–24) is inside the night window. */
export function isNightHour(hour: number): boolean {
  if (!Number.isFinite(hour)) return false
  const h = ((hour % 24) + 24) % 24
  return NIGHT_START <= NIGHT_END ? h >= NIGHT_START && h < NIGHT_END : h >= NIGHT_START || h < NIGHT_END
}

/**
 * Tight waits go straight to the gate. Short ones browse airside.
 * Long ones need a lounge or a bed, and any wait across the night is overnight.
 */
export function classifyLayover(waitMinutes: number, mct: number, crossesNight: boolean): LayoverClass {
  const wait = Number.isFinite(waitMinutes) ? Math.max(0, waitMinutes) : 0
  if (wait <= Math.max(0, mct) + 30) return 'tight'
  if (wait > SHORT_LAYOVER_MAX) return crossesNight ? 'overnight' : 'long'
  return 'short'
}

/** Need-drain multiplier for a waiting transfer. 1 inside the comfort window. */
export function layoverDrain(waitMinutes: number): number {
  const over = Math.max(0, (Number.isFinite(waitMinutes) ? waitMinutes : 0) - LAYOVER_COMFORT_MINUTES)
  return Math.min(LAYOVER_DRAIN_CAP, 1 + (over / 60) * LAYOVER_DRAIN_PER_HOUR)
}

/**
 * Starting needs for a short layover so the passenger visits food, shops,
 * lounges and seating. Families lean to play, business to the lounge.
 */
export function layoverNeeds(
  waitMinutes: number,
  trait: LayoverTrait,
): { hunger: number; shop: number; play: number; energy: number } {
  const hours = Math.max(0, (Number.isFinite(waitMinutes) ? waitMinutes : 0) / 60)
  const cap = (n: number) => Math.min(LAYOVER_NEED_CAP, Math.round(n))
  const play = trait === 'family' ? 1.5 : trait === 'business' ? 0.5 : 1
  const energy = trait === 'business' ? 1.4 : 1
  const shop = trait === 'budget' ? 0.7 : 1
  return {
    hunger: cap(LAYOVER_NEEDS_PER_HOUR.hunger * hours),
    shop: cap(LAYOVER_NEEDS_PER_HOUR.shop * hours * shop),
    play: cap(LAYOVER_NEEDS_PER_HOUR.play * hours * play),
    energy: cap(LAYOVER_NEEDS_PER_HOUR.energy * hours * energy),
  }
}

/**
 * Where a long or overnight transfer sleeps.
 * Business: transit hotel, then a linked landside hotel, then the lounge.
 * Family: any bed they can reach, else the terminal.
 * Budget: terminal bench unless a voucher pays for a bed.
 */
export function chooseOvernight(trait: LayoverTrait, opts: OvernightOptions): OvernightChoice {
  const transit = opts.transitRooms > 0
  const landside = opts.landsideRooms > 0 && opts.landsideLinked
  if (trait === 'business') {
    if (transit) return 'transit_hotel'
    if (landside) return 'landside_hotel'
    if (opts.lounge) return 'lounge'
    return 'terminal_sleep'
  }
  if (trait === 'family') {
    if (transit) return 'transit_hotel'
    if (landside) return 'landside_hotel'
    return 'terminal_sleep'
  }
  if (opts.voucher) {
    if (landside) return 'landside_hotel'
    if (transit) return 'transit_hotel'
  }
  return 'terminal_sleep'
}
