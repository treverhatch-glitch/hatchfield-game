/**
 * Interior animation clock. The sim advances it by dt × speed.
 * Speed 0 (paused) adds nothing, so trays, belts and people stay put.
 */
let animSec = 0

/** Seconds of interior motion since the clock was reset. */
export function readAnimSec(): number {
  return animSec
}

/** Add `dt * speed` seconds. A paused sim (speed 0) does not move the clock. */
export function advanceAnimSec(dt: number, speed: number): void {
  if (!(dt > 0) || !(speed > 0)) return
  animSec += dt * speed
}

/** New game and tests start from a known time. */
export function resetAnimSec(sec = 0): void {
  animSec = Number.isFinite(sec) ? sec : 0
}
