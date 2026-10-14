/**
 * Fuel-farm supply tunables. Prices, tanker size, and lead time stay on the
 * fuel contract. This file only times the dock and the road load.
 */
export const FUEL = {
  /** Game minutes the tanker sits on the farm coupler. Six sim-seconds at 1×. */
  dockMinutes: 48,
  /** Vehicles per minute one tanker adds to the public road while it is rolling. */
  tankerVehPerMin: 1,
  /** Vehicles per minute a live pipeline reserves in the road corridor. */
  pipelineVehPerMin: 0.35,
  /** Game minutes in a day: 180 sim-seconds × 8 game-minutes. */
  minutesPerDay: 1440,
  /** Pending uplift is spread across this many game minutes for days-of-cover. */
  upliftWindowMin: 90,
} as const
