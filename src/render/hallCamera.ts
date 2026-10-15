/**
 * Opening Hall camera and passenger figure.
 * Medium-close three-quarter of the 48×32 m hall. The default holds the
 * whole shell in frame; scroll zooms between a readable group and a wide pull-back.
 */

/** Figure is authored at standing height. Scale stays 1. */
export const HALL_PAX_SCALE = 1

/** Head + torso + legs, metres. */
export const HALL_FIGURE_M = 1.78

/** Look at the middle of the hall, not a single desk. */
export const HALL_CAM_LOOK_X = 0
export const HALL_CAM_LOOK_Z = 0
/** North-west corner, so the long wall and the walk both read. */
export const HALL_CAM_YAW = Math.PI - 0.42
/** About 30° above the floor: standing figures stay upright, the shell still fits. */
export const HALL_CAM_PITCH = 0.52
/** Default distance that holds the 48×32 m shell inside a 3:2 frame. */
export const HALL_CAM_DIST = 66
export const HALL_CAM_FOV = 40
/** Close enough to read a passenger. Scroll back out for the whole hall. */
export const HALL_CAM_MIN_DIST = 8
/** Far enough to see the hall with apron around it. */
export const HALL_CAM_MAX_DIST = 120
/**
 * Charging pucks, lounge cushions, jet-bridge cabin trim, and the
 * additive room dressing draw while the camera is inside this range.
 * The whole hall zoom stays inside it; the apron view drops it when
 * the terminal is far.
 */
export const HALL_NEAR_DIST = HALL_CAM_MAX_DIST
/** Pulls the clip plane off the walls and counters. */
export const HALL_CAM_NEAR = 0.8
export const HALL_CAM_FAR = 480
/** Walls and counters closer than this fade out instead of filling the lens. */
export const HALL_OCCLUDE_M = 6

export function hallPassengerHeightM(): number {
  return HALL_FIGURE_M * HALL_PAX_SCALE
}

/** Offset from the look-at pivot, matching HallWorld.placeCam. */
export function hallCameraOffset(): { x: number; y: number; z: number } {
  const x = Math.sin(HALL_CAM_YAW) * Math.cos(HALL_CAM_PITCH) * HALL_CAM_DIST
  const y = Math.sin(HALL_CAM_PITCH) * HALL_CAM_DIST
  const z = Math.cos(HALL_CAM_YAW) * Math.cos(HALL_CAM_PITCH) * HALL_CAM_DIST
  return { x, y, z }
}

export function hallCameraEye(): { x: number; y: number; z: number } {
  const o = hallCameraOffset()
  return { x: HALL_CAM_LOOK_X + o.x, y: o.y, z: HALL_CAM_LOOK_Z + o.z }
}
