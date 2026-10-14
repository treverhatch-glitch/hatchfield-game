/**
 * Stuck-entity watchdog tuning.
 *
 * Times are sim minutes on the shared clock (eight sim minutes = one field second,
 * 1,440 sim minutes = one game day). A state that has not changed for `limits[state]`
 * sim minutes takes the first recovery step. Each later step waits `stepMin`.
 *
 * The scripted repros (BU131 landing, ZO116 board, BU130 taxi-out) use the short
 * limits below so the whole ladder finishes inside `recoverWithinMin`.
 * Movement that ground control is legally holding is not sampled, so a runway queue
 * does not start this clock.
 */
export const STUCK_WATCH = {
  /** Sim minutes between recovery steps after the first. */
  stepMin: 1,
  /** Scripted repros must be moving again, or cancelled, inside this window. */
  recoverWithinMin: 5,
  /**
   * Field-second ATC holds shorter than this stay legal (converted at the call site).
   * 240 sim minutes = 30 field seconds, the departure-starve window.
   */
  authorizedHoldMin: 240,
  /** Airport pays at least this when a cancelled flight collected no fees. */
  minRefund: 400,
  /** How many recovery lines the debug log keeps. */
  logCap: 40,
  /**
   * Field seconds of pushback before the watchdog treats a still aircraft as stuck.
   * The sim shoves for 2.8s, then waits out a short ground queue until 8s.
   */
  pushbackGraceSec: 8.2,
  /**
   * Sim minutes with an unchanged state before the first step.
   * Missing states use `default`.
   */
  limits: {
    approach: 0.8,
    landing: 0.8,
    taxi_in: 0.8,
    taxi_out: 0.8,
    pushback: 0.8,
    takeoff: 0.8,
    mx_taxi: 0.8,
    mx_return: 0.8,
    board: 0.8,
    deboard: 12,
    servicing: 16,
    parked: 120,
    hold: 120,
    mx_bay: 40,
    unload: 0.8,
    to_claim: 0.8,
    pickup: 0.8,
    load: 0.8,
    fuel: 0.8,
    fuel_reload: 0.8,
    deice: 0.8,
    cater: 0.8,
    patrol: 120,
    ferry_arr: 0.8,
    ferry_dep: 0.8,
    sort_inbound: 0.8,
    city_guard: 0.8,
    city_shed: 0.8,
    city_depart: 0.8,
    build_guard: 8,
    build_site: 8,
    build_out: 8,
    default: 4,
  } as Record<string, number>,
} as const

/** Phases where the aircraft itself should be changing position. */
export const STUCK_MOVING_PHASES = new Set([
  'approach',
  'landing',
  'taxi_in',
  'taxi_out',
  'pushback',
  'takeoff',
  'mx_taxi',
  'mx_return',
])

export function stuckLimitMin(state: string): number {
  return STUCK_WATCH.limits[state] ?? STUCK_WATCH.limits.default
}

/** First step plus the three follow-ups. Used by the repro acceptance check. */
export function stuckLadderMin(state: string): number {
  return stuckLimitMin(state) + STUCK_WATCH.stepMin * 3
}
