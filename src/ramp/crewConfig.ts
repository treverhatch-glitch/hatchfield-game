/**
 * Ground-crew step shares and draw limits.
 * Shares are fractions of the sim's existing service window, so the pictures
 * fill that window and the turnaround clock does not move.
 */

export type CrewService = 'fuel' | 'bags' | 'catering' | 'gpu' | 'pushback' | 'cleaning' | 'pax' | 'stand'
export type CrewStepId = 'park' | 'exit' | 'walk' | 'connect' | 'work' | 'disconnect' | 'board' | 'drive_off'
export type CrewPose = 'seated' | 'walk' | 'reach' | 'idle' | 'kneel' | 'lift' | 'carry' | 'push' | 'signal'
export type CrewRole = 'driver' | 'helper' | 'walker' | 'pax'

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
  gpu: [
    { id: 'park', share: 0.05 },
    { id: 'exit', share: 0.08 },
    { id: 'walk', share: 0.12 },
    { id: 'connect', share: 0.12 },
    { id: 'work', share: 0.42 },
    { id: 'disconnect', share: 0.1 },
    { id: 'board', share: 0.07 },
    { id: 'drive_off', share: 0.04 },
  ],
  pushback: [
    { id: 'park', share: 0.06 },
    { id: 'exit', share: 0.1 },
    { id: 'walk', share: 0.16 },
    { id: 'connect', share: 0.1 },
    { id: 'work', share: 0.34 },
    { id: 'disconnect', share: 0.1 },
    { id: 'board', share: 0.08 },
    { id: 'drive_off', share: 0.06 },
  ],
  cleaning: [
    { id: 'park', share: 0.04 },
    { id: 'exit', share: 0.08 },
    { id: 'walk', share: 0.12 },
    { id: 'connect', share: 0.08 },
    { id: 'work', share: 0.48 },
    { id: 'disconnect', share: 0.08 },
    { id: 'board', share: 0.08 },
    { id: 'drive_off', share: 0.04 },
  ],
  /** Marshaller, chocks and cones follow STAND_TIMELINE, not this step list. */
  stand: [
    { id: 'park', share: 0.04 },
    { id: 'exit', share: 0.08 },
    { id: 'walk', share: 0.12 },
    { id: 'connect', share: 0.08 },
    { id: 'work', share: 0.46 },
    { id: 'disconnect', share: 0.08 },
    { id: 'board', share: 0.1 },
    { id: 'drive_off', share: 0.04 },
  ],
  /** Passengers are sampled by the boarding flow, not this step list. */
  pax: [
    { id: 'park', share: 0.04 },
    { id: 'exit', share: 0.08 },
    { id: 'walk', share: 0.12 },
    { id: 'connect', share: 0.08 },
    { id: 'work', share: 0.46 },
    { id: 'disconnect', share: 0.08 },
    { id: 'board', share: 0.1 },
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

/** How many bags ride the belt, one at a time, during one load. */
export const BAG_TRIPS = 3

/**
 * Service points in vehicle metres (+X forward, +Z left). Heights are where
 * the hands work: the underwing fuel coupling, the nose ground-power socket,
 * the tug cab.
 */
export const SERVICE_POINTS = {
  /** Fuel truck control panel beside the hose reel, where the second operator stands. */
  fuelPanel: { x: -1.25, z: 1.55 },
  /** Hose reel outlet on the truck and the coupling height under the wing. */
  hoseReel: { x: -1.65, y: 1.05, z: 1.05 },
  wingCouplingY: 2.05,
  /** GPU socket on the cart and the receptacle height on the nose. */
  gpuSocket: { x: -0.9, y: 0.75, z: 0.85 },
  gpuPlugY: 1.75,
  /** Towbarless tug cab (feet of a seated driver), matching the tug model's left-hand cab. */
  tugSeat: { x: 2.5, y: 0.52, z: -0.9 },
  /** Wing walker stands this far outside the wingtip. */
  wingWalkOut: 1.5,
} as const

/**
 * Arrival on stand, in sim seconds since the final taxi-in began: the
 * marshaller guides, then signals stop; the chocks pair walks in and kneels
 * at the nose gear; the cone walker sets nose, wingtip and tail cones.
 */
export const STAND_TIMELINE = {
  /** Cells from the stand where the marshaller starts guiding. */
  guideCells: 3,
  taxi: 6,
  marshalOff: 9,
  chocksWalk: 6.6,
  chocksOn: 9.5,
  conesStart: 8,
  /** Long enough for a walk around a drawn 737 (nose or tail) at under 1.2 m per 0.05 s. */
  conePer: 4.8,
  /** Seconds after which everything is placed and the crew stand clear. */
  settled: 30,
} as const

/** Hose and cable drawing: segments per run and sag at mid-span (metres). */
export const LINE_LOOK = {
  segments: 7,
  hoseSag: 0.45,
  /** Ground-power cable lies on the apron for most of its run. */
  cableSag: 1.2,
  hoseWidth: 0.11,
  cableWidth: 0.06,
} as const

/** Passengers drawn for one bridge, stair, or bus transfer. */
export const PAX_STREAM = 4

/**
 * Sim seconds for a bought jet bridge to pull back off the door once boarding
 * is closed. Pushback waits for it. 7.5 sim seconds is one game hour.
 */
export const BRIDGE_RETRACT_SEC = 0.8

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
