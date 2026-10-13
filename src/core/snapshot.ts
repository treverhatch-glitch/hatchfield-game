import type { BankState } from './bank.ts'
import type { ClockState } from './clock.ts'
import type { RngState } from './rng.ts'

/** Bump when the portable field set changes. Loaders reject newer versions. */
export const CORE_SNAPSHOT_VERSION = 1

/**
 * JSON-safe sim state. v1 round-trips the world the `Game` fields already
 * hold (flights, trucks, guests, books, bank, clock, diplomacy save,
 * economy state, rng). Lazily rebuilt adapters — ground logistics,
 * catering, cargo — are dropped on load and recreated on the next tick.
 * Their in-progress turnaround memory is not in this version.
 */
export interface CoreSnapshot {
  v: typeof CORE_SNAPSHOT_VERSION
  rng: RngState
  clock: ClockState
  bank: BankState
  economy: unknown
  diplomacy: string | null
  diplomacySeed: number
  bags: {
    phase: number
    tags: unknown[]
    books: [string, unknown][]
  }
  sets: {
    fuelHoldNoted: string[]
    queueDelayFlight: string[]
  }
  flags: {
    firstTakeoffNoted: boolean
    secSeq: number
    groundRev: number
    groundAnnounced: boolean
    groundNoteKey: string
  }
  notes: {
    ground: unknown[]
    cargo: unknown[]
  }
  /** Public data fields. No class instances, listeners, or wall-clock stamps. */
  world: Record<string, unknown>
}
