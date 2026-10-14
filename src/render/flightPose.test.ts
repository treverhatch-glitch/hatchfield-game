import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CELL } from './aircraft/specs'
import { FLIGHT_POSE } from './flightPoseData'
import { arrivalPose, finalStraight, orientAircraft, takeoffPose, takeoffTimeline } from './flightPose'
import type { Vec } from '../game/types'

const DEG = Math.PI / 180

function approachPath(): Vec[] {
  const path: Vec[] = []
  for (let i = 14; i >= 1; i--) path.push({ c: 8 - i, r: 26 })
  for (let c = 8; c <= 28; c++) path.push({ c, r: 26 })
  path.push({ c: 28, r: 24 })
  path.push({ c: 28, r: 18 })
  return path
}

describe('takeoff visual', () => {
  it('pitches the nose up around the wing, which rotation.x does not', () => {
    const mesh = new THREE.Object3D()
    orientAircraft(mesh, 0, 9 * DEG)
    const nose = new THREE.Vector3(10, 0, 0).applyQuaternion(mesh.quaternion)
    expect(nose.y).toBeGreaterThan(1)
    expect(nose.x).toBeGreaterThan(9)

    orientAircraft(mesh, Math.PI / 2, 9 * DEG)
    const east = new THREE.Vector3(10, 0, 0).applyQuaternion(mesh.quaternion)
    expect(east.z).toBeGreaterThan(9)
    expect(east.y).toBeGreaterThan(1)

    const rolled = new THREE.Object3D()
    rolled.rotation.set(-0.12, 0, 0)
    const flat = new THREE.Vector3(10, 0, 0).applyQuaternion(rolled.quaternion)
    expect(Math.abs(flat.y)).toBeLessThan(1e-6)
  })

  it('accelerates, rotates near 8–10°, then climbs and raises the gear', () => {
    const tl = takeoffTimeline('b738')
    const start = takeoffPose(0, 10, 20, 0, 'b738')
    expect(start.s).toBe(0)
    expect(start.alt).toBe(0)
    expect(start.pitch).toBe(0)
    expect(start.gearDown).toBe(true)
    expect(start.retire).toBe(false)

    const mid = takeoffPose(tl.tRotate / 2, 10, 20, 0, 'b738')
    expect(mid.s).toBeGreaterThan(0)
    expect(mid.s).toBeLessThan(tl.rollCells / 2)
    expect(mid.alt).toBe(0)
    expect(mid.pitch).toBe(0)
    expect(mid.gearDown).toBe(true)

    const rotate = takeoffPose(tl.tRotate, 10, 20, 0, 'b738')
    expect(rotate.s).toBeCloseTo(tl.rollCells, 5)
    expect(rotate.pitch).toBe(0)
    expect(rotate.alt).toBe(0)

    const noseUp = takeoffPose(tl.tRotate + FLIGHT_POSE.rotateSeconds, 10, 20, 0, 'b738')
    expect(noseUp.pitch).toBeCloseTo(FLIGHT_POSE.climbPitchDeg * DEG, 5)
    expect(noseUp.pitch * (180 / Math.PI)).toBeGreaterThanOrEqual(8)
    expect(noseUp.pitch * (180 / Math.PI)).toBeLessThanOrEqual(10)
    expect(noseUp.alt).toBeGreaterThan(0)
    expect(noseUp.gearDown).toBe(true)

    const lifted = takeoffPose(tl.tLiftoff, 10, 20, 0, 'b738')
    expect(lifted.alt).toBe(0)
    expect(lifted.gearDown).toBe(true)
    const climbing = takeoffPose(tl.tLiftoff + 1.5, 10, 20, 0, 'b738')
    const later = takeoffPose(tl.tLiftoff + 2.5, 10, 20, 0, 'b738')
    const fpa = Math.atan2(later.alt - climbing.alt, (later.s - climbing.s) * CELL) / DEG
    expect(fpa).toBeCloseTo(FLIGHT_POSE.climbFpaDeg, 1)
    expect(takeoffPose(tl.tGearUp + 0.05, 10, 20, 0, 'b738').gearDown).toBe(false)
  })

  it('gives an A380 a longer roll than a 737', () => {
    const narrow = takeoffTimeline('b738')
    const heavy = takeoffTimeline('a380')
    const light = takeoffTimeline('bn2')
    expect(heavy.rollCells).toBeGreaterThan(narrow.rollCells * 2)
    expect(narrow.rollCells).toBeGreaterThan(light.rollCells)
    expect(heavy.tRotate).toBeGreaterThan(narrow.tRotate)
    expect(heavy.landingRollCells).toBeGreaterThan(narrow.landingRollCells * 2)
    expect(heavy.vr).toBeGreaterThan(narrow.vr)
  })

  it('does not despawn until the climb is above and beyond the field', () => {
    const low = takeoffPose(4, 30, 16, 0, 'b738')
    expect(low.x).toBeGreaterThan(32)
    expect(low.retire).toBe(false)

    const gone = takeoffPose(FLIGHT_POSE.maxClimbSec, 0, 0, 0, 'b738')
    expect(gone.retire).toBe(true)
    expect(gone.alt).toBeGreaterThan(FLIGHT_POSE.clearAltWu)
  })
})

describe('landing visual', () => {
  const path = approachPath()
  const onRunway = (p: Vec) => p.c >= 8 && p.c <= 28 && Math.abs(p.r - 26) < 0.01

  it('flies a 3° glideslope from off the field, then flares', () => {
    const start = path[0]
    const posed = arrivalPose({
      x: start.c,
      y: start.r,
      heading: 0,
      path,
      airframeId: 'b738',
      initialBefore: null,
      onRunway,
    })
    expect(posed.initialBefore).toBeGreaterThan(FLIGHT_POSE.approachExtraMinCells)
    const visualDist = posed.initialBefore + FLIGHT_POSE.approachExtraCells
    expect(posed.alt).toBeCloseTo(visualDist * CELL * Math.tan(FLIGHT_POSE.glideslopeDeg * DEG), 3)
    expect(posed.pitch).toBeCloseTo(FLIGHT_POSE.approachPitchDeg * DEG, 5)
    expect(posed.gearDown).toBe(true)
    expect(posed.x).toBeLessThan(start.c)

    const thr = path.find((p) => p.c === 8 && p.r === 26)!
    const before = 0.45
    const flaring = arrivalPose({
      x: thr.c - before,
      y: thr.r,
      heading: 0,
      path,
      airframeId: 'b738',
      initialBefore: posed.initialBefore,
      onRunway,
    })
    const visual =
      (before / posed.initialBefore) * (posed.initialBefore + FLIGHT_POSE.approachExtraCells)
    expect(visual).toBeLessThan(FLIGHT_POSE.flareCells)
    expect(flaring.pitch).toBeGreaterThan(FLIGHT_POSE.approachPitchDeg * DEG)
    expect(flaring.pitch).toBeLessThan(FLIGHT_POSE.flarePitchDeg * DEG)
    expect(flaring.alt).toBeGreaterThan(0)
    expect(flaring.alt).toBeLessThan(FLIGHT_POSE.flareCells * CELL * Math.tan(FLIGHT_POSE.glideslopeDeg * DEG))
  })

  it('touches down, decelerates, and lets an A380 carry speed longer', () => {
    const thr = path.find((p) => p.c === 8 && p.r === 26)!
    const past = FLIGHT_POSE.flareCells + 2
    const narrow = arrivalPose({
      x: thr.c + past,
      y: thr.r,
      heading: 0,
      path,
      airframeId: 'b738',
      initialBefore: 14,
      onRunway,
    })
    const heavy = arrivalPose({
      x: thr.c + past,
      y: thr.r,
      heading: 0,
      path,
      airframeId: 'a380',
      initialBefore: 14,
      onRunway,
    })
    expect(narrow.alt).toBe(0)
    expect(narrow.gearDown).toBe(true)
    expect(heavy.x).toBeGreaterThan(narrow.x)
    expect(narrow.x).toBeGreaterThan(thr.c + past)

    const taxi = arrivalPose({
      x: 28,
      y: 20,
      heading: Math.PI / 2,
      path,
      airframeId: 'b738',
      initialBefore: 14,
      onRunway,
    })
    expect(taxi.x).toBe(28)
    expect(taxi.y).toBe(20)
    expect(taxi.pitch).toBe(0)
  })

  it('keeps the departure straight only after the last turn', () => {
    const path = [
      { c: 12, r: 21 },
      { c: 12, r: 26 },
      { c: 20, r: 26 },
    ]
    expect(finalStraight(path, 12, 21, 0)).toBeNull()
    const straight = finalStraight(path, 14, 26, 1)
    expect(straight).not.toBeNull()
    expect(straight!.heading).toBeCloseTo(0, 5)
    expect(straight!.remaining).toBeCloseTo(6, 5)
  })
})
