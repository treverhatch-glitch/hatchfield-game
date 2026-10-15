/**
 * Roof and wall beats between Airport and Terminal. Pure timing.
 * The sim only stores which view was asked for. This file does not change it.
 */

export const TRANSITION_SEC = 1.25
export const SHELL_SECTIONS = 4
/** Ignore the click or key that started the beat. */
export const CUE_SKIP_MS = 300

export type ViewName = 'apron' | 'hall'

export interface ShellWeights {
  /** 0 = roof seated, 1 = lifted off, one value per section. */
  roof: number[]
  /** 0 = walls flat, 1 = full height, with a short overshoot as they snap. */
  wall: number[]
}

/** The transition always plays on the apron shell. Otherwise the live view. */
export function shownWorld(view: ViewName, cue: ViewName | null): ViewName {
  return cue ? 'apron' : view
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** 0 at the start of this section's turn, 1 when it has finished. */
export function sectionStagger(t: number, index: number, count: number): number {
  const n = Math.max(1, count)
  const window = 0.55
  const start = n === 1 ? 0 : (index / (n - 1)) * (1 - window)
  return smoothstep(start, start + window, t)
}

/** Settles at 1, with a small pop past it. */
export function legoSnap(u: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const x = clamp01(u)
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
}

/** Enter lifts the roof. Leave drops the roof and snaps the walls up. */
export function sectionWeights(kind: 'enter' | 'leave', t: number, count = SHELL_SECTIONS): ShellWeights {
  const roof: number[] = []
  const wall: number[] = []
  const n = Math.max(1, count)
  for (let i = 0; i < n; i++) {
    const u = sectionStagger(t, i, n)
    if (kind === 'enter') {
      roof.push(u)
      wall.push(1)
    } else {
      roof.push(1 - u)
      wall.push(legoSnap(u))
    }
  }
  return { roof, wall }
}

let target: ViewName | null = null
let startedAt = 0

export function beginCue(to: ViewName, now = typeof performance !== 'undefined' ? performance.now() : 0) {
  target = to
  startedAt = now
}

export function clearCue() {
  target = null
  startedAt = 0
}

export function cueTarget(): ViewName | null {
  return target
}

export function cueAge(now = typeof performance !== 'undefined' ? performance.now() : 0): number {
  if (!target) return 0
  return Math.max(0, now - startedAt)
}

export function cueCanSkip(now = typeof performance !== 'undefined' ? performance.now() : 0): boolean {
  return target != null && cueAge(now) >= CUE_SKIP_MS
}
