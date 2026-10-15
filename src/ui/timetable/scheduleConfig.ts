/**
 * Face of the scheduler numbers the chart still names.
 * The values come from `timeWindow`, `DEFAULT_MTT`, and `DEFAULT_SCHEDULER_OPTIONS`.
 * The hall show-up clock stays `PLANNED_TURN_SEC`.
 */
import { DEFAULT_MTT } from '../../contracts/airframes'
import { timeWindow } from '../../contracts/contracts'
import { DEFAULT_SCHEDULER_OPTIONS } from '../../contracts/scheduler'
import type { AircraftKind } from '../../game/types'
import { GAME_MINUTES_PER_SIM_SECOND } from '../../pax/showup'
import type { IcaoCode } from './types'

const windowDefaults = timeWindow(0)

export const SCHEDULE = {
  /** Full turn on stand. Same minutes as the scheduler minimum turnaround. */
  turnMin: {
    narrow: DEFAULT_MTT.narrow,
    wide: DEFAULT_MTT.wide,
    heavy: DEFAULT_MTT.super,
    regional: DEFAULT_MTT.regional,
  },
  /** Amber hatch after a bar. The scheduler's stand buffer, not a local copy. */
  standBufferMin: DEFAULT_SCHEDULER_OPTIONS.standBufferMin,
  /** Free drag, in game minutes, around the banked time. */
  softWindowMin: windowDefaults.softMin,
  /** Past this, a drag snaps back. */
  hardWindowMin: windowDefaults.hardMin,
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
