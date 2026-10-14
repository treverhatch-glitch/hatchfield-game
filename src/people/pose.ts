import { WALK } from './config.ts'
import type { PersonPose } from './types.ts'

/** Joint angles in radians. Positive X rotation swings a limb forward (+z). */
export interface JointPose {
  legL: number
  legR: number
  armL: number
  armR: number
  /** Sideways arm raise (wave, wands). Positive lifts away from the body. */
  armLRaise: number
  armRRaise: number
  /** Whole-body vertical bob, metres. */
  bob: number
  /** Forward lean of the torso, radians. */
  lean: number
  /** Drop of the hips (seated), metres. */
  drop: number
}

export function neutralPose(): JointPose {
  return { legL: 0, legR: 0, armL: 0, armR: 0, armLRaise: 0, armRRaise: 0, bob: 0, lean: 0, drop: 0 }
}

/** Stride cycles per second for a ground speed in m/s. */
export function strideRate(speedMps: number): number {
  if (!(speedMps > 0)) return 0
  return Math.min(WALK.maxRate, Math.max(WALK.minRate, speedMps / WALK.strideLengthM))
}

/**
 * Advance a walk phase (cycles) by dt at a ground speed. Feet advance by
 * strideLengthM per cycle so steps match the distance covered.
 */
export function advancePhase(phase: number, speedMps: number, dt: number): number {
  const next = phase + strideRate(speedMps) * Math.max(0, dt)
  return next - Math.floor(next)
}

/** Cycles per second for poses that are not driven by ground speed. */
const POSE_RATE: Record<Exclude<PersonPose, 'walk' | 'bagPull'>, number> = {
  idle: 0.25,
  queue: 0.45,
  wave: 1.6,
  reach: 0,
  seated: 0,
}

/** Phase advance rate (cycles per second) for a pose at a ground speed. */
export function phaseRate(pose: PersonPose, speedMps: number): number {
  return pose === 'walk' || pose === 'bagPull' ? strideRate(speedMps) : POSE_RATE[pose]
}

const TAU = Math.PI * 2

/**
 * Sample a pose. `phase` is in cycles (0..1 wraps). `speedMps` scales swing
 * amplitude for walks so a shuffle does not windmill. Writes into `out`.
 */
export function samplePose(pose: PersonPose, phase: number, speedMps: number, out: JointPose = neutralPose()): JointPose {
  const s = Math.sin(phase * TAU)
  const c = Math.cos(phase * TAU)
  out.legL = out.legR = out.armL = out.armR = out.armLRaise = out.armRRaise = out.bob = out.lean = out.drop = 0
  switch (pose) {
    case 'walk': {
      const amp = Math.min(1, 0.35 + Math.max(0, speedMps) / 1.4)
      out.legL = s * WALK.legSwing * amp
      out.legR = -out.legL
      out.armL = -s * WALK.armSwing * amp
      out.armR = -out.armL
      out.bob = Math.abs(c) * 0.035 * amp
      out.lean = 0.04 * amp
      break
    }
    case 'idle':
      out.armL = s * 0.03
      out.armR = -s * 0.03
      out.bob = s * 0.004
      break
    case 'queue': {
      // Slow weight shift from foot to foot, small forward shuffle.
      out.legL = s * 0.12
      out.legR = -s * 0.07
      out.armL = 0.05
      out.armR = -0.05
      out.bob = Math.abs(s) * 0.01
      break
    }
    case 'bagPull': {
      // Walking with one arm back-and-down holding a handle.
      const amp = Math.min(1, 0.35 + Math.max(0, speedMps) / 1.4)
      out.legL = s * WALK.legSwing * amp
      out.legR = -out.legL
      out.armL = -s * WALK.armSwing * amp
      out.armR = -0.55
      out.bob = Math.abs(c) * 0.03 * amp
      out.lean = 0.1
      break
    }
    case 'wave':
      out.armL = 0.1
      out.armR = -0.1
      out.armRRaise = 2.4 + s * 0.35
      break
    case 'reach':
      out.armL = out.armR = 1.15
      out.lean = 0.12
      break
    case 'seated':
      out.legL = out.legR = 1.45
      out.armL = out.armR = 0.4
      out.drop = 0.42
      break
  }
  return out
}
