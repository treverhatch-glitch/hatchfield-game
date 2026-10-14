/**
 * Screen positions for world-anchored tip chips.
 * The apron renderer writes these each frame. The chip overlay only reads them.
 */

export interface TipPoint {
  /** 0–1 across the playfield. */
  x: number
  /** 0–1 down the playfield. */
  y: number
  /** False when the cell is behind the camera. The chip then parks at the edge. */
  on: boolean
}

const points = new Map<string, TipPoint>()
const listeners = new Set<() => void>()

function same(a: TipPoint | undefined, b: TipPoint): boolean {
  if (!a) return false
  return Math.abs(a.x - b.x) < 0.004 && Math.abs(a.y - b.y) < 0.004 && a.on === b.on
}

export function writeTipPoints(next: ReadonlyMap<string, TipPoint>): void {
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
  for (const fn of listeners) fn()
}

export function tipPoint(id: string): TipPoint | undefined {
  return points.get(id)
}

export function subscribeTipPoints(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
