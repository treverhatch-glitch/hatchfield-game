/** The one time unit passed between Hatchfield simulation modules. */
export type SimMinutes = number

export const SIM_MINUTES_PER_GAME_DAY = 1_440
export const REAL_SECONDS_PER_GAME_DAY = 180
export const SIM_MINUTES_PER_REAL_SECOND = SIM_MINUTES_PER_GAME_DAY / REAL_SECONDS_PER_GAME_DAY
export const SIM_MINUTES_PER_REAL_MINUTE = SIM_MINUTES_PER_REAL_SECOND * 60

export interface ClockState {
  simMinutes: SimMinutes
}

export interface ClockStep {
  /** Sim-minute delta. Pass this value to every simulation module. */
  dt: SimMinutes
  simMinutes: SimMinutes
  gameDay: number
  crossedGameDays: number
}

export function gameDayAt(simMinutes: SimMinutes): number {
  return Math.floor(Math.max(0, simMinutes) / SIM_MINUTES_PER_GAME_DAY)
}

export function realSecondsToSimMinutes(realSeconds: number, speed = 1): SimMinutes {
  if (!(realSeconds > 0) || !(speed > 0)) return 0
  return realSeconds * speed * SIM_MINUTES_PER_REAL_SECOND
}

export function realMinutesToSimMinutes(realMinutes: number, speed = 1): SimMinutes {
  return realSecondsToSimMinutes(realMinutes * 60, speed)
}

export function simMinutesToRealMinutes(simMinutes: SimMinutes): number {
  return Math.max(0, simMinutes) / SIM_MINUTES_PER_REAL_MINUTE
}

/**
 * Deterministic clock for frame loops, headless tests, and save/replay.
 * Paused frames pass speed 0 and produce dt 0.
 */
export class SimClock {
  private current: SimMinutes

  constructor(state: ClockState = { simMinutes: 0 }) {
    this.current = Math.max(0, state.simMinutes)
  }

  get simMinutes(): SimMinutes {
    return this.current
  }

  get gameDay(): number {
    return gameDayAt(this.current)
  }

  advanceRealSeconds(realSeconds: number, speed = 1): ClockStep {
    return this.advance(realSecondsToSimMinutes(realSeconds, speed))
  }

  advance(dt: SimMinutes): ClockStep {
    const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0
    const previousDay = this.gameDay
    this.current += safeDt
    return {
      dt: safeDt,
      simMinutes: this.current,
      gameDay: this.gameDay,
      crossedGameDays: this.gameDay - previousDay,
    }
  }

  snapshot(): ClockState {
    return { simMinutes: this.current }
  }
}
