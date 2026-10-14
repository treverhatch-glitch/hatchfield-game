/**
 * Contract letter pacing — how often carriers write. Pure data, read by
 * contractPacing.ts. All values are sim seconds (one sim day ≈ 180s).
 *
 * A new field should take a carrier, fly it, and only then hear from the
 * next one. Each carrier on the books stretches the gap, so the stands and
 * the hall fill at the speed the player builds them.
 */
export const LETTER_PACING = {
  /** Cool after a signature: base, plus this much per carrier already on the books. */
  afterSignBase: 150,
  afterSignPerCarrier: 90,
  /** Random spread added on top, 0..jitter. */
  afterSignJitter: 30,
  /** Longest cool a signature can set. */
  afterSignMax: 480,
  /**
   * While the book is small, the next carrier waits for finished turns:
   * this many departures per signed carrier.
   */
  settleTurnsPerCarrier: 1,
  /** The turn wait only applies below this many signed carriers. */
  settleUntilSigned: 4,
  /** A stuck ramp never silences the phone for longer than this after a signature. */
  settleMaxWait: 360,
  /** "Later" — they write again soon, no Standing hit. */
  afterSnooze: 18,
  /** Letter ran out unread. */
  afterExpire: 55,
  /** Walked or hung up on. */
  afterDecline: 70,
  /** Walked away at the negotiation desk. */
  afterWalk: 48,
} as const
