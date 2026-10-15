/**
 * Story index for the interior editor.
 * The starter is one story. Arrivals and departures are apart on that floor.
 * Floor 1 is stored, not walked, until the WP6 upgrade (departures up, arrivals down).
 * Pieces omit `floor` to mean 0.
 */
import type { BuildLayout, FloorSlab, VerticalKind } from './types.ts'

/** The story a starter terminal ships with, and the only one the nav walks. */
export const GROUND_FLOOR = 0

/** Metres from one slab to the next. The WP6 upper floor sits at this height. */
export const FLOOR_TO_FLOOR_M = 5

/** How many stories are live. WP6 raises this when the upper floor is bought. */
export const ENABLED_STORIES = 1

/** Starter and premade halls are one story, with split arrival and departure flows. */
export const STARTER_STORIES = 1

/**
 * The starter layout id. `split1f` keeps arrivals and departures on floor 0.
 * `stacked2f` is the WP6 upgrade, not a new-game stamp.
 */
export const STARTER_TERMINAL = 'split1f' as const

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

/** An empty upper slab the size of `layout`. Index 0 is the ground arrays, not a slab entry. */
export function emptySlab(index: number, w: number, h: number): FloorSlab {
  return {
    index,
    elevationM: index * FLOOR_TO_FLOOR_M,
    tiles: Array.from({ length: h }, () => Array.from({ length: w }, () => false)),
    zones: Array.from({ length: h }, () => Array.from({ length: w }, () => null)),
  }
}

/** Ground slab plus any stored upper slabs, in index order. Ground is always index 0. */
export function layoutSlabs(layout: BuildLayout): FloorSlab[] {
  const ground: FloorSlab = {
    index: GROUND_FLOOR,
    elevationM: 0,
    tiles: layout.floor,
    zones: layout.zones,
    paint: layout.floorPaint,
  }
  const upper = (layout.slabs ?? []).filter((s) => s.index > GROUND_FLOOR).slice().sort((a, b) => a.index - b.index)
  return [ground, ...upper]
}

export function slabAt(layout: BuildLayout, floor: number): FloorSlab | null {
  if (floor === GROUND_FLOOR) return layoutSlabs(layout)[0] ?? null
  return layout.slabs?.find((s) => s.index === floor) ?? null
}

/**
 * Store an upper slab. The ground slab stays on `layout.floor`.
 * A hall whose `stories` is 1 refuses floor 1: the field exists, the starter does not use it.
 * Storing a slab does not enable it. Walkers still stop at `ENABLED_STORIES`.
 */
export function attachSlab(layout: BuildLayout, slab: FloorSlab): { layout: BuildLayout; error?: string } {
  if (slab.index < 1) return { layout, error: 'The ground slab is the layout floor.' }
  if (slab.index >= storyCount(layout)) return { layout, error: 'This hall has no story there yet.' }
  if (slab.tiles.length !== layout.h || slab.tiles.some((row) => row.length !== layout.w)) {
    return { layout, error: 'Slab is the wrong size.' }
  }
  const slabs = (layout.slabs ?? []).filter((s) => s.index !== slab.index)
  slabs.push(slab)
  slabs.sort((a, b) => a.index - b.index)
  return { layout: { ...layout, slabs } }
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
