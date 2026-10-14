/**
 * Last sim tick duration, recorded by the play loop.
 * The renderer reads it for the F3 overlay. The sim itself does not import this.
 */
let tickMs = 0

export function recordSimTick(ms: number) {
  tickMs = Number.isFinite(ms) && ms >= 0 ? ms : 0
}

export function simTickMs(): number {
  return tickMs
}
