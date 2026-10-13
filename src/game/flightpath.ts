import type { Vec } from './types.ts'

/**
 * Extend a landing route backward past the runway end so the jet
 * starts off the map and flies a visible approach.
 */
export function inboundApproach(route: Vec[], cells = 14): Vec[] {
  if (route.length < 2) return route.slice()
  const a = route[0]
  const b = route[1]
  let dc = a.c - b.c
  let dr = a.r - b.r
  const len = Math.hypot(dc, dr) || 1
  dc /= len
  dr /= len
  const lead: Vec[] = []
  for (let i = cells; i >= 1; i--) {
    lead.push({ c: a.c + dc * i, r: a.r + dr * i })
  }
  return [...lead, ...route]
}

/** True once the aircraft has cleared the playable grid. */
export function hasLeftMap(x: number, y: number, size: number, margin = 8): boolean {
  return x < -margin || y < -margin || x > size + margin || y > size + margin
}
