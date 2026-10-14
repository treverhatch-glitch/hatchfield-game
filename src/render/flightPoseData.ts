import type { IcaoCode } from './aircraft/realworld'

/**
 * Visual-only takeoff and landing. The sim keeps its own phase clock.
 * Distances are apron cells. Pitch and slope are degrees.
 * Code C is the 737 baseline. Code F (A380) rolls longer.
 */
export const FLIGHT_POSE = {
  /** Nose-up attitude the rotate settles on. About 8–10°. */
  climbPitchDeg: 10,
  /** Flight-path angle after liftoff. */
  climbFpaDeg: 8,
  /** Approach slope. */
  glideslopeDeg: 3,
  /** Nose-up attitude on the slope, before the flare. */
  approachPitchDeg: 3,
  /** Nose-up attitude at touchdown. */
  flarePitchDeg: 6.5,
  /**
   * Flare begins this many cells before the threshold and levels
   * the same distance past it, so the 3° slope is captured rather than flown into the pavement.
   */
  flareCells: 2.6,
  /** Extra cells drawn behind the sim's off-map start so the slope is in frame. */
  approachExtraCells: 16,
  /** Skip that extension when the jet is already on short final. */
  approachExtraMinCells: 8,
  /** Matches the sim taxi speed so the roll doesn't lurch when it takes over. */
  taxiCellsPerSec: 1.2,
  codeCRollCells: 7,
  codeCVrCellsPerSec: 3.4,
  codeCLandingRollCells: 5.5,
  /** Seconds to pitch from level to climbPitchDeg after Vr. */
  rotateSeconds: 0.9,
  /** Fraction of the rotate at which the wheels leave the pavement. */
  liftoffPitchFrac: 0.6,
  /** Gear stays down through liftoff, then comes up. */
  gearUpDelaySec: 0.75,
  /** World-unit height that counts as well above the field. */
  clearAltWu: 32,
  /** Cells past the map edge before a climb may despawn. */
  clearBeyondCells: 5,
  /** Safety cap so a climb ghost cannot linger. */
  maxClimbSec: 42,
  /** How much the landing roll starts fast and finishes slow. 0 is constant speed. */
  rolloutK: 0.48,
  /** Remaining taxi segments within this of the runway heading count as the straight. */
  straightToleranceRad: 0.45,
  rollFactor: {
    A: 0.52,
    B: 0.74,
    C: 1,
    D: 1.32,
    E: 1.62,
    F: 2.2,
    H: 1,
  } as Record<IcaoCode, number>,
  vrFactor: {
    A: 0.74,
    B: 0.86,
    C: 1,
    D: 1.06,
    E: 1.12,
    F: 1.18,
    H: 1,
  } as Record<IcaoCode, number>,
}
