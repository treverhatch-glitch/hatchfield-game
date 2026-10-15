/** Phases where a helicopter is on the pad, not on the way in or already gone. */
const PAD_PHASES = new Set(['landing', 'taxi_in', 'servicing', 'deboard', 'board', 'parked'])

export interface PadTurn {
  craft: string
  phase: string
  stand: { c: number; r: number } | null
}

/** True when a helicopter turn is on this pad cell. Approach, hold, takeoff, and gone do not count. */
export function helipadTurnOnPad(flights: readonly PadTurn[], cell: { c: number; r: number }): boolean {
  return flights.some(
    (flight) =>
      flight.craft === 'helo' &&
      flight.stand != null &&
      flight.stand.c === cell.c &&
      flight.stand.r === cell.r &&
      PAD_PHASES.has(flight.phase),
  )
}
