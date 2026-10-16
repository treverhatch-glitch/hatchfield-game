/**
 * Arrival walks in aircraft-local metres (+X nose, +Z port).
 * A skin of 0 keeps the straight line (callers that have no airframe).
 * Otherwise a segment that would enter the fuselage goes around the nose
 * or the tail, outside the barrel, and the shorter way is used.
 */
export interface CrewFootprint {
  nose: number
  tail: number
  /** Fuselage radius in the same metres as the points. */
  skin: number
}

function rawHit(x: number, z: number, foot: CrewFootprint, gap: number): boolean {
  const rad = foot.skin + gap
  const half = Math.max(Math.abs(foot.nose), Math.abs(foot.tail))
  const ax = Math.abs(x)
  if (ax > half + gap) return false
  const body = Math.max(0, half - rad)
  if (ax <= body) return Math.abs(z) <= rad
  const dx = ax - body
  return dx * dx + z * z <= rad * rad
}

/** The cone walker stands 0.6 m to +Z of the path, so that point has to clear too. */
function hits(x: number, z: number, foot: CrewFootprint, gap: number): boolean {
  if (!(foot.skin > 0)) return false
  return rawHit(x, z, foot, gap) || rawHit(x, z + 0.6, foot, gap)
}

function segmentHits(a: readonly [number, number], b: readonly [number, number], foot: CrewFootprint): boolean {
  if (!(foot.skin > 0)) return false
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    if (hits(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, foot, 0.35)) return true
  }
  return false
}

function lengthOf(pts: readonly (readonly [number, number])[]): number {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return total
}

function around(from: readonly [number, number], to: readonly [number, number], endX: number, clear: number): [number, number][] {
  const sign = (z: number, other: number) => {
    if (Math.abs(z) >= clear) return z
    const s = Math.sign(z || other || 1)
    return s * clear
  }
  const z0 = sign(from[1], to[1])
  const z1 = sign(to[1], from[1])
  return [
    [from[0], from[1]],
    [endX, z0],
    [endX, z1],
    [to[0], to[1]],
  ]
}

/** Polyline from `from` to `to` that stays outside the fuselage. */
export function pathOutside(
  from: readonly [number, number],
  to: readonly [number, number],
  foot: CrewFootprint,
): [number, number][] {
  if (!segmentHits(from, to, foot)) return [[from[0], from[1]], [to[0], to[1]]]
  // +0.6 walker offset on the starboard side steps toward the skin, so the rail sits further out.
  const clear = foot.skin + 1.5
  const nose = around(from, to, foot.nose + 1.6, clear)
  const tail = around(from, to, foot.tail - 1.6, clear)
  return lengthOf(nose) <= lengthOf(tail) ? nose : tail
}

/** Point at fraction `u` (0..1) along pathOutside. */
export function walkOutside(
  from: readonly [number, number],
  to: readonly [number, number],
  u: number,
  foot: CrewFootprint,
): [number, number] {
  const pts = pathOutside(from, to, foot)
  const uu = u <= 0 ? 0 : u >= 1 ? 1 : u
  const total = lengthOf(pts)
  if (!(total > 0)) return [to[0], to[1]]
  let left = total * uu
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (left <= d || i === pts.length - 1) {
      const t = d > 0 ? Math.min(1, left / d) : 1
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
    }
    left -= d
  }
  return [to[0], to[1]]
}
