/**
 * Real-metre scale for the terminal. People, doors, and kit share these
 * numbers. The hall draws at scale 1, so a value here is a metre on screen.
 */

/** Adult standing height. The audit allows 1.55–1.95. */
export const PERSON_M = 1.75

export const PERSON_MIN_M = 1.55
export const PERSON_MAX_M = 1.95

/** Children. Kept off the adult band so a child does not read as a short adult. */
export const CHILD_MIN_M = 1.0
export const CHILD_MAX_M = 1.4

/** Shoulder width. A person occupies about this much of a queue. */
export const SHOULDER_M = 0.5

/** Clear door height. Curb doors are a little taller so a coach door reads. */
export const DOOR_H_M = 2.2
export const CURB_DOOR_H_M = 2.4

/** Check-in and gate counter height. */
export const DESK_H_M = 1.1

/** Bag belt width. */
export const BELT_W_M = 0.8

/** Seat pan height. */
export const SEAT_H_M = 0.45

/** Slab to slab. Matches `FLOOR_TO_FLOOR_M` in floors.ts. The upper floor is WP6. */
export const FLOOR_TO_FLOOR_M = 5.0

/** Clear height under the ground-floor structure. */
export const CLEAR_H_GROUND_M = 4.2

/** Roof height. A 1-story hall is 6 m. A 2-story hall (WP6) is 9 m. */
export const ROOF_H_1_M = 6.0
export const ROOF_H_2_M = 9.0

export function roofHeightM(stories: number): number {
  return stories >= 2 ? ROOF_H_2_M : ROOF_H_1_M
}
