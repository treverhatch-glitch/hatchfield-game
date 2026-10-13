/** Distance-based LOD with hysteresis, fades, and the zoom-fitted shadow frustum. */

/**
 * Level 0 is the most detailed. `thresholds` are ascending switch distances. A level
 * only changes once the distance clears the threshold by `hysteresis` (fraction), so
 * slow zooms near a boundary don't flicker.
 */
export function pickLod(prev: number, dist: number, thresholds: readonly number[], hysteresis = 0.08): number {
  let raw = 0
  while (raw < thresholds.length && dist > thresholds[raw]) raw++
  if (raw === prev) return prev
  if (raw > prev) {
    // Moving away: must pass the threshold we just crossed by the margin.
    let lvl = prev
    while (lvl < thresholds.length && dist > thresholds[lvl] * (1 + hysteresis)) lvl++
    return lvl
  }
  let lvl = prev
  while (lvl > 0 && dist < thresholds[lvl - 1] * (1 - hysteresis)) lvl--
  return lvl
}

/** Move `cur` toward `target` at `rate` per second. */
export function stepFade(cur: number, target: number, dt: number, rate = 4): number {
  const step = rate * Math.max(0, dt)
  if (cur < target) return Math.min(target, cur + step)
  if (cur > target) return Math.max(target, cur - step)
  return cur
}

export interface ShadowFit {
  /** Half extent of the orthographic shadow box. */
  half: number
  /** Box centre snapped to whole shadow texels to stop shimmer while panning. */
  x: number
  z: number
}

/**
 * Close-up cameras get a tight shadow box (crisp contact shadows on props); wide
 * cameras get a big one. Snapping keeps the texel grid fixed in world space.
 */
export function fitShadow(camDist: number, focusX: number, focusZ: number, mapSize: number): ShadowFit {
  const half = Math.max(16, Math.min(120, camDist * 0.95))
  const texel = (half * 2) / Math.max(1, mapSize)
  return {
    half,
    x: Math.round(focusX / texel) * texel,
    z: Math.round(focusZ / texel) * texel,
  }
}

/** Where a camera ray through the screen centre meets y = 0 (null if looking up). */
export function groundFocus(
  pos: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
): { x: number; z: number } | null {
  if (dir.y >= -1e-4) return null
  const t = -pos.y / dir.y
  return { x: pos.x + dir.x * t, z: pos.z + dir.z * t }
}
