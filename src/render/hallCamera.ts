/**
 * Opening Hall camera and passenger figure.
 * Elevated three-quarter view, 8–12 m back along the curb-to-gate walk,
 * high enough to clear the 3.15 m walls and the counters.
 */

/** Figure is authored at standing height. Scale stays 1. */
export const HALL_PAX_SCALE = 1

/** Head + torso + legs, metres. */
export const HALL_FIGURE_M = 1.78

export const HALL_CAM_LOOK_X = -6.4
export const HALL_CAM_LOOK_Z = -4.4
/** Yaw that places the eye on the curb side, looking toward the gate (+x). */
export const HALL_CAM_YAW = -1.78
/** Elevation from the horizontal. About 33°, a three-quarter look down the walk. */
export const HALL_CAM_PITCH = 0.58
export const HALL_CAM_DIST = 11.4
/** Tight enough that a standing figure reads, wide enough to hold the walk. */
export const HALL_CAM_FOV = 40
export const HALL_CAM_MIN_DIST = 8
export const HALL_CAM_MAX_DIST = 70
/** Pulls the clip plane off the walls and counters. */
export const HALL_CAM_NEAR = 0.8
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
