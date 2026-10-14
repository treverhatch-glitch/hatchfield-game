/** Status words the split-flap board can show. */
export type BoardStatus = 'Boarding' | 'Delayed' | 'Departed'

export type BoardKind = 'departures' | 'arrivals'

export type WayfindingKind = 'checkin' | 'security' | 'gates' | 'baggage'

export interface BoardRow {
  id: string
  flight: string
  airline: string
  destination: string
  /** HH:MM on the airport day clock. */
  time: string
  gate: string
  status: BoardStatus
  /** Sim-seconds of the scheduled movement, used only to order rows. */
  at: number
}

export interface BoardSnapshot {
  now: number
  clock: string
  airportName: string
  departures: BoardRow[]
  arrivals: BoardRow[]
}

/** One inbound timetable line. A subset of the sim slot, read only. */
export interface FeedSlot {
  id: string
  airline: string
  flightNo: string
  eta: number
  status: string
  delaySec: number
  flightId: string | null
  /** Preferred stand on a sim slot. */
  standPref?: { c: number; r: number } | null
  /** Plain stand, when the feed was built by hand. */
  stand?: { c: number; r: number } | null
}

/** One aircraft the board can list. A subset of the sim flight, read only. */
export interface FeedFlight {
  id: string
  airline: string
  flightNo: string
  destination?: string
  phase: string
  stand: { c: number; r: number } | null
  std?: number
  scheduleId?: string | null
}

/**
 * The slice of the sim the board reads. It never writes economy or service points.
 * `Game` satisfies this structurally.
 */
export interface FidsSource {
  clock: number
  schedule: readonly FeedSlot[]
  flights: readonly FeedFlight[]
  airline(id: string): { name: string } | undefined
  gateLabel(stand: { c: number; r: number } | null): string
  branding?: { airportName?: string }
}
