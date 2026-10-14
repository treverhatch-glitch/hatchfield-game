/**
 * Serve-beat pose. The sim decides when a passenger is being served;
 * this only turns that phase and a clock into a lean and a reach.
 * The renderer applies it. No meshes here.
 */
import { SERVICE_POINT_TUNING as T } from './config.ts'

export type ServePhase = 'walk' | 'queue' | 'serve' | 'other'

export interface ServePose {
  /** Radians, forward. 0 when not being served. */
  lean: number
  /** Metres the hand reaches toward the point. */
  reach: number
}

/** `t` is seconds. The handoff loops for as long as the passenger is at the point. */
export function servePose(t: number, phase: ServePhase): ServePose {
  if (phase !== 'serve' || !Number.isFinite(t)) return { lean: 0, reach: 0 }
  const s = Math.sin(t * T.serveCycleHz * Math.PI * 2)
  const k = Math.max(0, s)
  return { lean: T.serveLean * k, reach: T.serveReachM * k }
}
