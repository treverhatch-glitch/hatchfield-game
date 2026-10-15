/**
 * Schedule-chart tunables, in game minutes.
 * One sim second is `GAME_MINUTES_PER_SIM_SECOND` (8) game minutes.
 * The chart reads these. The hall show-up clock stays `PLANNED_TURN_SEC`.
 */
import type { AircraftKind } from '../../game/types'
import { GAME_MINUTES_PER_SIM_SECOND } from '../../pax/showup'
import type { IcaoCode } from './types'

export const SCHEDULE = {
  /** Full turn on stand. Narrowbody sits in the 35–45 minute reference band. */
  turnMin: {
    narrow: 40,
    wide: 75,
    heavy: 110,
    regional: 30,
  },
  /** Amber hatch after a bar. The next turn inside it is tight, not a clash. */
  standBufferMin: 10,
  /** Free drag, in game minutes, around the banked time. */
  softWindowMin: 20,
  /** Past this, a drag snaps back. */
  hardWindowMin: 60,
  /** Face step for a time nudge. Replaces the ±10 sim-second planner buttons. */
  dragStepMin: 16,
} as const

export type TurnBand = keyof typeof SCHEDULE.turnMin

export function gameMinToSim(min: number): number {
  return min / GAME_MINUTES_PER_SIM_SECOND
}

export function turnSimSec(band: TurnBand): number {
  return gameMinToSim(SCHEDULE.turnMin[band])
}

/** Code C with no airframe is a narrowbody. Regional and light types stay shorter. */
export function turnBand(icao: IcaoCode, kind?: AircraftKind): TurnBand {
  if (icao === 'F') return 'heavy'
  if (icao === 'E' || icao === 'D' || kind === 'widebody' || kind === 'freighter') return 'wide'
  if (kind === 'regional' || icao === 'A' || icao === 'B') return 'regional'
  return 'narrow'
}
