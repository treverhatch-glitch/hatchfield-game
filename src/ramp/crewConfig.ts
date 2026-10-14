/**
 * Ground-crew step shares and draw limits.
 * Shares are fractions of the sim's existing service window, so the pictures
 * fill that window and the turnaround clock does not move.
 */

export type CrewService = 'fuel' | 'bags' | 'catering'
export type CrewStepId = 'park' | 'exit' | 'walk' | 'connect' | 'work' | 'disconnect' | 'board' | 'drive_off'
export type CrewPose = 'seated' | 'walk' | 'reach' | 'idle'
export type CrewRole = 'driver' | 'helper'

export interface StepShare {
  id: CrewStepId
  share: number
}

export const CREW_SHARES: Record<CrewService, readonly StepShare[]> = {
  fuel: [
    { id: 'park', share: 0.04 },
    { id: 'exit', share: 0.09 },
    { id: 'walk', share: 0.12 },
    { id: 'connect', share: 0.08 },
    { id: 'work', share: 0.46 },
    { id: 'disconnect', share: 0.08 },
    { id: 'board', share: 0.09 },
    { id: 'drive_off', share: 0.04 },
  ],
  bags: [
    { id: 'park', share: 0.04 },
    { id: 'exit', share: 0.08 },
    { id: 'walk', share: 0.12 },
    { id: 'connect', share: 0.08 },
    { id: 'work', share: 0.48 },
    { id: 'disconnect', share: 0.07 },
    { id: 'board', share: 0.09 },
    { id: 'drive_off', share: 0.04 },
  ],
  catering: [
    { id: 'park', share: 0.04 },
    { id: 'exit', share: 0.08 },
    { id: 'walk', share: 0.1 },
    { id: 'connect', share: 0.12 },
    { id: 'work', share: 0.42 },
    { id: 'disconnect', share: 0.12 },
    { id: 'board', share: 0.08 },
    { id: 'drive_off', share: 0.04 },
  ],
}

/** Steps where the crew are inside the cab, so the renderer draws nothing. */
export const CREW_IN_CAB: ReadonlySet<CrewStepId> = new Set(['park', 'drive_off'])

/**
 * Draw distances are world units. Full limbs only beside the camera.
 * At 5× the apron already drops shadows; crew then stay dots.
 */
export const CREW_LOD = {
  fullDistance: 38,
  dotDistance: 110,
  fullCap: 32,
  dotCap: 80,
} as const

/** How many bag shuttles the helper walks during one load. */
export const BAG_TRIPS = 3

/** Catering-module phases that happen at the aircraft, in order. */
export const CATER_STAND_PHASES = [
  'parking',
  'crew_exit',
  'lift_raise',
  'carts_out',
  'carts_in',
  'lift_lower',
  'crew_board',
] as const

export type CaterStandPhase = (typeof CATER_STAND_PHASES)[number]
