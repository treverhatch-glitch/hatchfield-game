/**
 * Common-use check-in. Times are game minutes on the same clock as show-up:
 * one sim-second is eight game minutes. A desk is not free — locking one
 * below Preferred costs cash. Preferred waives that fee. Trusted also
 * shortens service at the locked desk.
 */
export const CHECKIN_ALLOC = {
  /** Wide-body / long-haul desks open this many game minutes before STD. */
  openLongHaulGameMin: 180,
  /** Every other passenger flight. */
  openShortHaulGameMin: 120,
  /** Desks close this many game minutes before STD. */
  closeGameMin: 45,
  /** Booked passengers per branded desk. The flight still takes at least one. */
  paxPerDesk: 70,
  minDesksPerFlight: 1,
  /** Cash to lock a desk when the airline is below Preferred. */
  dedicatedFee: 2000,
  /** Wave 3 contract tier that waives the lock fee. */
  preferredTier: 2,
  /** Wave 3 contract tier that also speeds a locked desk. */
  trustedTier: 3,
  /** Service time at a Trusted dedicated desk, as a share of the normal desk. */
  trustedServiceShare: 0.75,
  /** Building-panel reason when open flights want more desks than are staffed. */
  shortReason: 'short of desks',
} as const

/** Painted when a common desk is not holding an airline. */
export const NEUTRAL_DESK_BRAND = {
  id: 'neutral',
  name: 'Check-in',
  code: 'ANY',
  primary: '#5c6770',
  secondary: '#e7ebef',
} as const
