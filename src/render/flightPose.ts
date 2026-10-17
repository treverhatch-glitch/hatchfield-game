import * as THREE from 'three'
import { inBounds } from '../game/path'
import type { Vec } from '../game/types'
import { SIZE } from '../game/types'
import { CELL, getAircraftSpec } from './aircraft/specs'
import { FLIGHT_POSE } from './flightPoseData'

const DEG = Math.PI / 180

const _pitch = new THREE.Quaternion()
const _yaw = new THREE.Quaternion()
const _wing = new THREE.Vector3(0, 0, 1)
const _up = new THREE.Vector3(0, 1, 0)

export interface AirPose {
  x: number
  y: number
  /** World units above the apron. */
  alt: number
  heading: number
  /** Nose-up radians. The fuselage nose is +X, so this is not a rotation.x roll. */
  pitch: number
  gearDown: boolean
  /** Cells traveled from the takeoff origin. */
  s: number
  retire: boolean
}

export interface TakeoffTimeline {
  rollCells: number
  landingRollCells: number
  vr: number
  v0: number
  tRotate: number
  tLiftoff: number
  tGearUp: number
}

export interface ArrivalInput {
  x: number
  y: number
  heading: number
  path: readonly Vec[]
  airframeId: string
  /** Latched sim distance before the threshold on the first approach frame. */
  initialBefore: number | null
  /** Pavement test. Without it, the first on-map path point is the threshold. */
  onRunway?: (p: Vec) => boolean
}

export interface ArrivalPose extends AirPose {
  initialBefore: number
  /**
   * Cells rolled since the mains touched (render dressing only: tyre smoke, oleo squash).
   * Undefined while airborne or once the rollout hands back to the sim path.
   */
  touchdown?: number
}

/**
 * Pitch in model space, then yaw into the world.
 * Positive pitch raises the +X nose. Heading 0 points +X (east / +column).
 */
export function orientAircraft(mesh: THREE.Object3D, heading: number, pitch: number) {
  _pitch.setFromAxisAngle(_wing, pitch)
  _yaw.setFromAxisAngle(_up, -heading)
  mesh.quaternion.copy(_yaw.multiply(_pitch))
}

export function takeoffTimeline(airframeId: string): TakeoffTimeline {
  const icao = getAircraftSpec(airframeId).icao
  const rollFactor = FLIGHT_POSE.rollFactor[icao] ?? 1
  const vrFactor = FLIGHT_POSE.vrFactor[icao] ?? 1
  const rollCells = FLIGHT_POSE.codeCRollCells * rollFactor
  const landingRollCells = FLIGHT_POSE.codeCLandingRollCells * rollFactor
  const vr = FLIGHT_POSE.codeCVrCellsPerSec * vrFactor
  const v0 = FLIGHT_POSE.taxiCellsPerSec
  const tRotate = (2 * rollCells) / Math.max(0.1, v0 + vr)
  const tLiftoff = tRotate + FLIGHT_POSE.rotateSeconds * FLIGHT_POSE.liftoffPitchFrac
  const tGearUp = tLiftoff + FLIGHT_POSE.gearUpDelaySec
  return { rollCells, landingRollCells, vr, v0, tRotate, tLiftoff, tGearUp }
}

function rollDistance(tl: TakeoffTimeline, t: number): number {
  if (t <= 0) return 0
  if (t >= tl.tRotate) return tl.rollCells + tl.vr * (t - tl.tRotate)
  const a = (tl.vr - tl.v0) / Math.max(0.05, tl.tRotate)
  return tl.v0 * t + 0.5 * a * t * t
}

/** Accelerate, rotate, lift off, climb. `elapsed` is game seconds from the roll start. */
export function takeoffPose(
  elapsed: number,
  ox: number,
  oy: number,
  heading: number,
  airframeId: string,
): AirPose {
  const tl = takeoffTimeline(airframeId)
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
  const h = Number.isFinite(heading) ? heading : 0
  const s = rollDistance(tl, t)
  const pitchFrac = clamp((t - tl.tRotate) / Math.max(0.05, FLIGHT_POSE.rotateSeconds), 0, 1)
  const pitch = pitchFrac * FLIGHT_POSE.climbPitchDeg * DEG
  let alt = 0
  if (t > tl.tLiftoff) {
    const climbed = Math.max(0, s - rollDistance(tl, tl.tLiftoff))
    alt = climbed * CELL * Math.tan(FLIGHT_POSE.climbFpaDeg * DEG)
  }
  const x = (Number.isFinite(ox) ? ox : 0) + Math.cos(h) * s
  const y = (Number.isFinite(oy) ? oy : 0) + Math.sin(h) * s
  const beyond =
    x < -FLIGHT_POSE.clearBeyondCells ||
    y < -FLIGHT_POSE.clearBeyondCells ||
    x > SIZE + FLIGHT_POSE.clearBeyondCells ||
    y > SIZE + FLIGHT_POSE.clearBeyondCells
  const retire = (alt >= FLIGHT_POSE.clearAltWu && beyond) || t >= FLIGHT_POSE.maxClimbSec
  return {
    x,
    y,
    alt,
    heading: h,
    pitch,
    gearDown: t < tl.tGearUp,
    s,
    retire,
  }
}

export interface StraightFinal {
  remaining: number
  heading: number
}

/** The runway straight still ahead, or null while a turn remains on the path. */
export function finalStraight(
  path: readonly Vec[],
  x: number,
  y: number,
  seg: number,
): StraightFinal | null {
  if (!path || path.length < 2) return null
  const end = path[path.length - 1]
  const prev = path[path.length - 2]
  const heading = segmentHeading(prev, end)
  if (heading == null) return null
  const startIdx = Math.max(0, Math.min(path.length - 2, Math.floor(seg) || 0))
  for (let i = startIdx; i < path.length - 1; i++) {
    const h = segmentHeading(path[i], path[i + 1])
    if (h == null) continue
    if (angleDelta(h, heading) > FLIGHT_POSE.straightToleranceRad) return null
  }
  const total = arcToIndex(path, path.length - 1)
  const progress = projectPath(path, x, y).dist
  return { remaining: Math.max(0, total - progress), heading }
}

/**
 * 3° glideslope, flare, touchdown, then a decelerating rollout that meets the sim at the taxi turn.
 */
export function arrivalPose(input: ArrivalInput): ArrivalPose {
  const path = input.path ?? []
  const simHeading = Number.isFinite(input.heading) ? input.heading : 0
  const fallback = (): ArrivalPose => ({
    x: input.x,
    y: input.y,
    alt: 0,
    heading: simHeading,
    pitch: 0,
    gearDown: true,
    s: 0,
    retire: false,
    initialBefore: input.initialBefore ?? 0,
  })
  if (path.length < 2) return fallback()

  const thrIndex = thresholdIndex(path, input.onRunway)
  const thr = path[thrIndex]
  const runwayHeading = runwayHeadingAt(path, thrIndex)
  if (runwayHeading == null) return fallback()

  const progress = projectPath(path, input.x, input.y).dist
  const before = arcToIndex(path, thrIndex) - progress
  const initial = input.initialBefore == null ? Math.max(0, before) : input.initialBefore
  const extra = initial >= FLIGHT_POSE.approachExtraMinCells ? FLIGHT_POSE.approachExtraCells : 0
  const visualBefore = before > 0 ? (before / Math.max(initial, 0.001)) * (initial + extra) : before

  const hx = Math.cos(runwayHeading)
  const hy = Math.sin(runwayHeading)
  const flare = FLIGHT_POSE.flareCells
  const tl = takeoffTimeline(input.airframeId)

  if (visualBefore > -flare) {
    const { alt, pitch } = slopePose(visualBefore, flare)
    return {
      x: thr.c - hx * visualBefore,
      y: thr.r - hy * visualBefore,
      alt,
      heading: runwayHeading,
      pitch,
      gearDown: true,
      s: 0,
      retire: false,
      initialBefore: initial,
    }
  }

  const ahead = runwayAhead(path, thrIndex, runwayHeading)
  const d = -visualBefore - flare
  const room = ahead - flare
  const R = Math.min(tl.landingRollCells, Math.max(0, room))
  const headingOff = angleDelta(simHeading, runwayHeading) > FLIGHT_POSE.straightToleranceRad
  if (R > 0.4 && d < R && !headingOff) {
    const t = clamp(d / R, 0, 1)
    const k = FLIGHT_POSE.rolloutK
    const dVis = R * (t + k * t * (1 - t))
    const pitch = FLIGHT_POSE.flarePitchDeg * DEG * (1 - t)
    return {
      x: thr.c + hx * (flare + dVis),
      y: thr.r + hy * (flare + dVis),
      alt: 0,
      heading: runwayHeading,
      pitch,
      gearDown: true,
      s: 0,
      retire: false,
      initialBefore: initial,
      touchdown: d,
    }
  }

  return {
    x: input.x,
    y: input.y,
    alt: 0,
    heading: simHeading,
    pitch: 0,
    gearDown: true,
    s: 0,
    retire: false,
    initialBefore: initial,
  }
}

function slopePose(visualBefore: number, flare: number): { alt: number; pitch: number } {
  const approach = FLIGHT_POSE.approachPitchDeg * DEG
  const flared = FLIGHT_POSE.flarePitchDeg * DEG
  if (visualBefore > flare) {
    return { alt: glideAlt(visualBefore), pitch: approach }
  }
  const D = flare * 2
  const xFlare = flare - visualBefore
  const u = clamp(xFlare / D, 0, 1)
  const H = glideAlt(flare)
  return {
    alt: H * (1 - u) * (1 - u),
    pitch: approach + (flared - approach) * u,
  }
}

function glideAlt(cells: number): number {
  return Math.max(0, cells) * CELL * Math.tan(FLIGHT_POSE.glideslopeDeg * DEG)
}

function thresholdIndex(path: readonly Vec[], onRunway?: (p: Vec) => boolean): number {
  if (onRunway) {
    const paved = path.findIndex((p) => onRunway(p))
    if (paved >= 0) return paved
  }
  const i = path.findIndex((p) => inBounds(Math.round(p.c), Math.round(p.r)))
  return i >= 0 ? i : 0
}

function runwayHeadingAt(path: readonly Vec[], index: number): number | null {
  for (let i = index; i < path.length - 1; i++) {
    const h = segmentHeading(path[i], path[i + 1])
    if (h != null) return h
  }
  for (let i = index; i > 0; i--) {
    const h = segmentHeading(path[i - 1], path[i])
    if (h != null) return h
  }
  return null
}

function runwayAhead(path: readonly Vec[], index: number, heading: number): number {
  let dist = 0
  let prev = path[index]
  for (let i = index + 1; i < path.length; i++) {
    const h = segmentHeading(prev, path[i])
    if (h == null) {
      prev = path[i]
      continue
    }
    if (angleDelta(h, heading) > FLIGHT_POSE.straightToleranceRad) break
    dist += Math.hypot(path[i].c - prev.c, path[i].r - prev.r)
    prev = path[i]
  }
  return dist
}

function projectPath(path: readonly Vec[], x: number, y: number): { dist: number } {
  let best = Infinity
  let bestDist = 0
  let walked = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const dc = b.c - a.c
    const dr = b.r - a.r
    const len2 = dc * dc + dr * dr
    const len = Math.sqrt(len2)
    let along = 0
    let px = a.c
    let py = a.r
    if (len > 1e-8) {
      const t = clamp(((x - a.c) * dc + (y - a.r) * dr) / len2, 0, 1)
      along = t * len
      px = a.c + dc * t
      py = a.r + dr * t
    }
    const d2 = (x - px) ** 2 + (y - py) ** 2
    if (d2 < best) {
      best = d2
      bestDist = walked + along
    }
    walked += len
  }
  return { dist: bestDist }
}

function arcToIndex(path: readonly Vec[], index: number): number {
  let dist = 0
  const last = Math.min(index, path.length - 1)
  for (let i = 1; i <= last; i++) {
    dist += Math.hypot(path[i].c - path[i - 1].c, path[i].r - path[i - 1].r)
  }
  return dist
}

function segmentHeading(a: Vec, b: Vec): number | null {
  const dc = b.c - a.c
  const dr = b.r - a.r
  if (dc * dc + dr * dr < 1e-8) return null
  return Math.atan2(dr, dc)
}

function angleDelta(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}
