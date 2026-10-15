/**
 * Story index for the interior editor.
 * Floor 0 is the only story the game walks. Floor 1 is reserved for a later
 * upgrade (departures up, arrivals down). Pieces omit `floor` to mean 0.
 */
import type { BuildLayout, VerticalKind } from './types.ts'

/** The story a starter terminal ships with, and the only one the nav walks. */
export const GROUND_FLOOR = 0

/** How many stories are live. Raise this when the upper floor upgrade lands. */
export const ENABLED_STORIES = 1

/** Starter and premade halls are one story. */
export const STARTER_STORIES = 1

export function floorOf(piece: { floor?: number } | null | undefined): number {
  const f = piece?.floor
  return f == null || !Number.isFinite(f) ? GROUND_FLOOR : f
}

export function storyCount(layout: Pick<BuildLayout, 'stories'>): number {
  const n = layout.stories
  return n == null || n < 1 ? STARTER_STORIES : n
}

/** True when this story is one the player can build and walk today. */
export function storyEnabled(floor: number, enabled = ENABLED_STORIES): boolean {
  return floor >= 0 && floor < enabled
}

export interface FloorLink {
  kind: VerticalKind
  x: number
  y: number
  fromFloor: number
  toFloor: number
}

/**
 * Stairs, escalators, and lifts whose both ends are inside `enabledStories`.
 * With `ENABLED_STORIES` this is empty: a link up to floor 1 is stored and ignored.
 */
export function floorLinks(layout: BuildLayout, enabledStories = ENABLED_STORIES): FloorLink[] {
  const out: FloorLink[] = []
  for (const v of layout.verticals ?? []) {
    const from = floorOf(v)
    const to = v.toFloor
    if (from === to || !storyEnabled(from, enabledStories) || !storyEnabled(to, enabledStories)) continue
    out.push({ kind: v.kind, x: v.x, y: v.y, fromFloor: from, toFloor: to })
  }
  return out
}
