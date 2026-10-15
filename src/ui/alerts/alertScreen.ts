/**
 * Screen positions for critical-alert pins.
 * The apron renderer writes these each frame. The pin overlay only reads them.
 */

export interface AlertPoint {
  /** 0–1 across the playfield. */
  x: number
  /** 0–1 down the playfield. */
  y: number
  /** False when the cell is behind the camera. */
  on: boolean
}

const points = new Map<string, AlertPoint>()
const listeners = new Set<() => void>()
let rev = 0

function same(a: AlertPoint | undefined, b: AlertPoint): boolean {
  if (!a) return false
  return Math.abs(a.x - b.x) < 0.004 && Math.abs(a.y - b.y) < 0.004 && a.on === b.on
}

export function writeAlertPoints(next: ReadonlyMap<string, AlertPoint>): void {
  let changed = next.size !== points.size
  if (!changed) {
    for (const [id, pt] of next) {
      if (!same(points.get(id), pt)) {
        changed = true
        break
      }
    }
  }
  if (!changed) return
  points.clear()
  for (const [id, pt] of next) points.set(id, pt)
  rev += 1
  for (const fn of listeners) fn()
}

export function alertPoint(id: string): AlertPoint | undefined {
  return points.get(id)
}

export function alertPointsRev(): number {
  return rev
}

export function subscribeAlertPoints(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
