/**
 * Airport view spends the culled-interior budget on full exterior detail.
 * Terminal view does not draw this scene. Nothing here reads frame time to
 * drop LOD, textures, or shadows. Max-zoom fps is a reference log only.
 */

/** Apron orbit cap, world units. Matches the apron camera. */
export const APRON_MAX_DIST = 280

/**
 * A mesh may leave the full band only past this distance.
 * It is far beyond the orbit and the airfield, so zoom never collapses detail.
 */
export const FULL_DETAIL_DIST = 8000

let frames = 0
let windowStart = 0
let lastFps = 0
let lastLog = 0

/** Latest max-zoom sample. 0 until the camera has held the far orbit for half a second. */
export function maxZoomFps(): number {
  return lastFps
}

/**
 * Count frames while the apron camera is at max zoom.
 * The sample is wall-clock frames, not the clamped sim step. Returns once half
 * a second of real time has passed. Never a quality change. `dt` is unused.
 */
export function noteMaxZoomFrame(_dt: number, atMax: boolean, now = typeof performance !== 'undefined' ? performance.now() : 0): number | null {
  if (!atMax) {
    frames = 0
    windowStart = 0
    return null
  }
  if (frames === 0) windowStart = now
  frames += 1
  const elapsed = now - windowStart
  if (elapsed < 500) return null
  lastFps = (frames * 1000) / elapsed
  frames = 0
  windowStart = 0
  if (now - lastLog > 2000) {
    lastLog = now
    console.info(`[view-budget] max-zoom ${lastFps.toFixed(1)} fps (reference only)`)
  }
  return lastFps
}
