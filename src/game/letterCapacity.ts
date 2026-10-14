/**
 * Honest stand (or pad) capacity for a contract letter.
 * Turns per place come from the sim day and the planned turn, not a new fee.
 * Carrier demand uses the same 4 / 3 split the negotiation profile already uses.
 * The line warns. It never blocks a signature.
 */
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import { PLANNED_TURN_SEC } from '../pax/showup.ts'

/** Turns one stand or pad can host in a game day. */
export const TURNS_PER_STAND_PER_DAY = Math.floor(REAL_SECONDS_PER_GAME_DAY / PLANNED_TURN_SEC)

/**
 * Daily turns a carrier asks for.
 * Tier 4 and 5 ask for 3. Everyone else asks for 4.
 * Keep this aligned with `profileFromTrunk` in negotiationBridge.ts.
 */
export function carrierTurnsWanted(tier: number): number {
  return tier >= 4 ? 3 : 4
}

export function capacityWarning(
  count: number,
  signedWant: number,
  adds: number,
  noun: 'stand' | 'pad',
): string {
  const places = Math.max(0, Math.floor(count))
  const host = places * TURNS_PER_STAND_PER_DAY
  const word = places === 1 ? noun : `${noun}s`
  const want = Math.max(0, Math.round(signedWant))
  const extra = Math.max(0, Math.round(adds))
  return `Your ${places} ${word} host ~${host} turns/day; signed carriers already want ${want}; this adds ${extra}`
}
