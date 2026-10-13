import { HOTEL_NIGHT_COST, REBOOK_FEE, STANDING_HIT_PER_PAX } from './config.ts'
import type { MissPenalty } from './types.ts'

/**
 * The airport pays either a hotel night (when a hotel is open) or a rebooking fee.
 * Amounts stay finite so a bad clock cannot post NaN cash.
 */
export function missPenalty(opts: { hasHotel: boolean; passengers: number }): MissPenalty {
  const passengers = Number.isFinite(opts.passengers) ? Math.max(0, Math.floor(opts.passengers)) : 0
  const unit = opts.hasHotel ? HOTEL_NIGHT_COST : REBOOK_FEE
  const amount = passengers * unit
  const standing = passengers === 0 ? 0 : -STANDING_HIT_PER_PAX * passengers
  if (!Number.isFinite(amount) || !Number.isFinite(standing)) {
    return { kind: opts.hasHotel ? 'hotel' : 'rebook', amount: 0, standing: 0, passengers: 0 }
  }
  return {
    kind: opts.hasHotel ? 'hotel' : 'rebook',
    amount,
    standing,
    passengers,
  }
}
