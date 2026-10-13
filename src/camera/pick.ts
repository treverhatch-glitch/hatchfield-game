import type { Trackable, TrackKind } from './types.ts'

/** How far a click may land from an actor, in cells. Planes are easier to hit. */
export const TRACK_REACH: Record<TrackKind, number> = {
  plane: 2.2,
  vehicle: 1.5,
  passenger: 0.95,
}

const RANK: Record<TrackKind, number> = { plane: 0, vehicle: 1, passenger: 2 }

/**
 * Closest actor inside its reach. A tie keeps the larger subject (plane, then vehicle).
 */
export function pickTrackable(
  at: { c: number; r: number },
  tracks: readonly Trackable[],
): Trackable | null {
  let best: Trackable | null = null
  let bestD = Infinity
  let bestRank = Infinity
  for (const t of tracks) {
    const d = Math.hypot(t.c - at.c, t.r - at.r)
    if (d > TRACK_REACH[t.kind]) continue
    const rank = RANK[t.kind]
    const closer = d < bestD - 1e-9
    const tie = Math.abs(d - bestD) <= 1e-9 && rank < bestRank
    if (closer || tie) {
      best = t
      bestD = d
      bestRank = rank
    }
  }
  return best
}
