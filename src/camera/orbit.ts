import { FOLLOW_PRESETS, followStep, type FollowParams } from '../features/camera/camera.ts'
import { cellToWorld, simHeadingToChase } from './space.ts'
import type { CameraPose, FieldLayout, Trackable, Vec3 } from './types.ts'

/** Orbit distance the apron camera boots at, in world units. */
export const ORBIT_DEFAULT_DIST = 88

/**
 * Keyboard pan at cameraSpeed 1, in world units per second, at the boot orbit distance.
 * Speed 2 (the settings default) is about 44 m/s there: the starter apron in a few
 * seconds, short of the old 124 m/s overshoot. `panZoomScale` slows that in close
 * and speeds it up when the field is small in frame.
 */
export const PAN_BASE_WU = 10

export function panZoomScale(dist: number): number {
  const ref = ORBIT_DEFAULT_DIST
  const safe = Number.isFinite(dist) && dist > 0 ? dist : ref
  return Math.max(0.35, Math.min(2.6, safe / ref))
}

export interface OrbitLimits {
  minDist: number
  maxDist: number
  minPitch: number
  maxPitch: number
}

export interface OrbitRig {
  yaw: number
  pitch: number
  dist: number
  pivot: Vec3
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

/**
 * Recover the apron's orbit rig from a free look.
 * `placeCam` keeps the camera height absolute and aims at `pivot`, so `aim.y`
 * should be 0 when handing the shot back to the orbit camera.
 */
export function orbitFromLook(position: Vec3, aim: Vec3, limits: OrbitLimits): OrbitRig {
  const dx = position.x - aim.x
  const dy = position.y - aim.y
  const dz = position.z - aim.z
  const raw = Math.hypot(dx, dy, dz)
  const dist = clamp(raw || limits.minDist, limits.minDist, limits.maxDist)
  const pitch = clamp(Math.asin(clamp(raw ? dy / raw : 0, -1, 1)), limits.minPitch, limits.maxPitch)
  const yaw = Math.atan2(dx, dz)
  return { yaw, pitch, dist, pivot: { x: aim.x, y: aim.y, z: aim.z } }
}

function scalePreset(p: FollowParams, scale: number): FollowParams {
  return { ...p, distance: p.distance * scale, height: p.height * scale }
}

/** One damped chase step in world units. `scale` lengthens the preset (scroll wheel). */
export function followPose(
  cam: CameraPose,
  target: Trackable,
  layout: FieldLayout,
  scale: number,
  dt: number,
): CameraPose {
  const preset = scalePreset(FOLLOW_PRESETS[target.kind], scale)
  return followStep(
    cam,
    {
      position: cellToWorld(target.c, target.r, target.altitude, layout),
      heading: simHeadingToChase(target.heading),
    },
    preset,
    dt,
  )
}
