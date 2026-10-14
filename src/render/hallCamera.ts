/**
 * Opening Hall orbit and passenger size.
 * The capsule in HallWorld is authored near 1 m. Scale brings it to a standing person
 * so the default camera reads walkers instead of specks.
 */

/** Authored capsule: radius * 2 + cylinder length. */
export const HALL_CAPSULE_RADIUS = 0.22
export const HALL_CAPSULE_LENGTH = 0.55

/** ~1.75 m standing height from the authored capsule. */
export const HALL_PAX_SCALE = 1.75

export const HALL_CAM_YAW = 0.42
export const HALL_CAM_PITCH = 0.56
export const HALL_CAM_DIST = 15
export const HALL_CAM_MIN_DIST = 8
export const HALL_CAM_MAX_DIST = 70

export function hallPassengerHeightM(): number {
  return (HALL_CAPSULE_RADIUS * 2 + HALL_CAPSULE_LENGTH) * HALL_PAX_SCALE
}
