import { PEOPLE_LOD } from './config.ts'

/** 0 = full body with accessories, 1 = simple body, 2 = single block, -1 = not drawn. */
export type PeopleLod = 0 | 1 | 2 | -1

export interface LodLimits {
  nearDistance: number
  midDistance: number
  farDistance: number
  nearCap: number
  midCap: number
}

export function lodForDistance(distanceM: number, limits: LodLimits = PEOPLE_LOD): PeopleLod {
  if (distanceM <= limits.nearDistance) return 0
  if (distanceM <= limits.midDistance) return 1
  if (distanceM <= limits.farDistance) return 2
  return -1
}

/**
 * Choose a level per person. Distance picks the level, then the caps demote the
 * farthest of an over-full level so the closest people keep their detail.
 * `lite` (fast-forward) never spends a level 0 body.
 * Returns levels in input order.
 */
export function assignPeopleLod(distances: ArrayLike<number>, lite = false, limits: LodLimits = PEOPLE_LOD): PeopleLod[] {
  const n = distances.length
  const out: PeopleLod[] = new Array(n)
  const near: number[] = []
  const mid: number[] = []
  for (let i = 0; i < n; i++) {
    let lod = lodForDistance(distances[i], limits)
    if (lite && lod === 0) lod = 1
    out[i] = lod
    if (lod === 0) near.push(i)
    else if (lod === 1) mid.push(i)
  }
  if (near.length > limits.nearCap) {
    near.sort((a, b) => distances[a] - distances[b])
    for (let k = limits.nearCap; k < near.length; k++) {
      out[near[k]] = 1
      mid.push(near[k])
    }
  }
  if (mid.length > limits.midCap) {
    mid.sort((a, b) => distances[a] - distances[b])
    for (let k = limits.midCap; k < mid.length; k++) out[mid[k]] = 2
  }
  return out
}
