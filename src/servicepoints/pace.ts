/**
 * One building, several service points, one shared queue.
 * Used to check that the prefab's point count stays ahead of the opening
 * bank and falls behind once flights stack up. Deterministic.
 */

export interface PaceInput {
  /** Staffed points in use. Closed points are not counted. */
  points: number
  /** Seconds to serve one passenger at one point. */
  serviceSec: number
  /** Seconds between departing flights. */
  flightGapSec: number
  bodiesPerFlight: number
  /** Bodies from one flight arrive spread across this window. 0 = all at once. */
  releaseSpreadSec?: number
  seconds: number
  dt?: number
}

export interface PaceResult {
  maxQueue: number
  /** Longest time a served passenger waited, seconds. */
  maxWaitSec: number
  served: number
}

export function simulatePoints(input: PaceInput): PaceResult {
  const points = Math.max(0, Math.floor(input.points))
  const service = input.serviceSec > 0 ? input.serviceSec : 0
  const dt = input.dt && input.dt > 0 ? input.dt : 0.25
  const spread = Math.max(0, input.releaseSpreadSec ?? 0)
  const waiting: number[] = []
  const busy: number[] = []
  let nextFlight = 8
  let maxQueue = 0
  let maxWait = 0
  let served = 0
  const bodies = Math.max(0, Math.round(input.bodiesPerFlight))
  for (let t = 0; t < input.seconds; t += dt) {
    if (t >= nextFlight) {
      for (let k = 0; k < bodies; k++) {
        const at = spread > 0 && bodies > 1 ? t + (spread * k) / (bodies - 1) : t
        waiting.push(at)
      }
      nextFlight += Math.max(dt, input.flightGapSec)
    }
    for (let i = busy.length - 1; i >= 0; i--) {
      busy[i] -= dt
      if (busy[i] <= 0) busy.splice(i, 1)
    }
    while (busy.length < points && waiting.length && waiting[0] <= t) {
      const arrived = waiting.shift()!
      maxWait = Math.max(maxWait, t - arrived)
      served += 1
      busy.push(service)
    }
    // People still on the way to the doors are not in the line yet.
    let queued = 0
    for (const at of waiting) if (at <= t) queued += 1
    if (queued > maxQueue) maxQueue = queued
  }
  return { maxQueue, maxWaitSec: maxWait, served }
}
