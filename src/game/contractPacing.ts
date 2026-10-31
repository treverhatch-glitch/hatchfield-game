/**
 * When the next contract letter may arrive. Pure; the sim calls it.
 * Tunables live in contractPacingData.ts.
 */
import { simRandom } from './simRng.ts'
import { LETTER_PACING } from './contractPacingData.ts'

/** Cool set when a carrier signs. `signed` counts the carrier that just signed. */
export function coolAfterSign(signed: number, roll: number = simRandom()): number {
  const p = LETTER_PACING
  const n = Math.max(1, signed)
  const cool = p.afterSignBase + p.afterSignPerCarrier * (n - 1) + p.afterSignJitter * roll
  return Math.min(p.afterSignMax, cool)
}

export interface SettleState {
  signed: number
  flightsDone: number
  /** Sim seconds since the last signature. */
  sinceSign: number
}

/**
 * True when the field is ready to hear from another carrier. A small book
 * waits until the carriers it has are actually turning flights.
 */
export function lettersSettled(state: SettleState): boolean {
  const p = LETTER_PACING
  if (state.signed < 1 || state.signed >= p.settleUntilSigned) return true
  if (state.sinceSign >= p.settleMaxWait) return true
  return state.flightsDone >= state.signed * p.settleTurnsPerCarrier
}
