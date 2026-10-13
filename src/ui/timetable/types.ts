/**
 * Timetable view-model. The dock only ever talks to a TimetableAdapter, so it
 * works against today's game.schedule and the upcoming src/contracts module
 * without knowing which one is behind it.
 */

/** ICAO aerodrome reference code letter (wingspan band). */
export type IcaoCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export type TtDirection = 'arr' | 'dep'

export type TtStatus =
  | 'scheduled'
  | 'delayed'
  | 'inbound'
  | 'on_stand'
  | 'departing'
  | 'done'
  | 'cancelled'

export interface TtWindow {
  /** Earliest allowed sim time (seconds). */
  start: number
  /** Latest allowed sim time (seconds). */
  end: number
  /** 'contract' = agreed slot window; 'tower' = derived from tower pull/bump limits. */
  source: 'contract' | 'tower'
}

export interface TtFlight {
  id: string
  flightNo: string
  airlineName: string
  color: string
  direction: TtDirection
  /** Planned sim time for this movement (arrival ETA or departure ETD). */
  time: number
  /** Expected stand occupancy, sim seconds. */
  onStandFrom: number
  onStandTo: number
  window: TtWindow | null
  status: TtStatus
  delaySec: number
  delayReason: string | null
  standId: string | null
  standLabel: string
  /** Player pinned a stand. */
  pinned: boolean
  icao: IcaoCode
  aircraft: string
  runwayIndex: number | null
  manual: boolean
  /** Contract id when the flight comes from a contract. */
  contractId?: string | null
  /** Turnaround target from a contract, seconds. */
  turnTarget?: number | null
  services?: string[]
  /** Whether the player can still move it. */
  movable: boolean
}

export interface TtStand {
  id: string
  label: string
  /** Largest ICAO code the stand accepts. */
  icao: IcaoCode
  /** Game-side class letter (S/M/L) when present. */
  gameClass?: string
}

export interface TtRunway {
  index: number
  label: string
  /** Movements per sim-hour the strip can absorb. */
  hourlyCap: number
}

export interface TtCaps {
  move: boolean
  pin: boolean
  swap: boolean
  pullBump: boolean
  cancel: boolean
}

export interface TimetableAdapter {
  /** Short label for the source ("Tower bank", "Contracts"). */
  readonly source: string
  readonly caps: TtCaps
  /** Sim seconds per in-game day (24h face). */
  readonly dayLength: number
  now(): number
  flights(): TtFlight[]
  stands(): TtStand[]
  runways(): TtRunway[]
  /** Move a flight to a sim time; adapter clamps into the window. Returns applied time. */
  moveTo(id: string, time: number): number | null
  pinStand(id: string, standId: string | null): void
  swapStands(a: string, b: string): void
  pull(id: string): void
  bump(id: string): void
  cancel(id: string): void
}
