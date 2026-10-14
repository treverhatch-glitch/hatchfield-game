import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { HALL_D, HALL_W } from '../game/terminal'
import {
  HALL_CAM_DIST,
  HALL_CAM_FAR,
  HALL_CAM_FOV,
  HALL_CAM_LOOK_X,
  HALL_CAM_LOOK_Z,
  HALL_CAM_MAX_DIST,
  HALL_CAM_MIN_DIST,
  HALL_CAM_NEAR,
  HALL_CAM_PITCH,
  HALL_CAM_YAW,
  HALL_OCCLUDE_M,
  hallCameraEye,
  hallPassengerHeightM,
} from './hallCamera'

/** NDC height of a 1.78 m figure at the look point, including the downward look. */
function figureSpan(dist: number, aspect: number): number {
  const cam = new THREE.PerspectiveCamera(HALL_CAM_FOV, aspect, HALL_CAM_NEAR, HALL_CAM_FAR)
  const x = Math.sin(HALL_CAM_YAW) * Math.cos(HALL_CAM_PITCH) * dist
  const y = Math.sin(HALL_CAM_PITCH) * dist
  const z = Math.cos(HALL_CAM_YAW) * Math.cos(HALL_CAM_PITCH) * dist
  cam.position.set(HALL_CAM_LOOK_X + x, y, HALL_CAM_LOOK_Z + z)
  cam.lookAt(HALL_CAM_LOOK_X, 0, HALL_CAM_LOOK_Z)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  const feet = new THREE.Vector3(HALL_CAM_LOOK_X, 0, HALL_CAM_LOOK_Z).project(cam)
  const head = new THREE.Vector3(HALL_CAM_LOOK_X, hallPassengerHeightM(), HALL_CAM_LOOK_Z).project(cam)
  return Math.abs(head.y - feet.y)
}

/** How far the hall shell (floor and wall tops) reaches in NDC at this aspect. */
function shellReach(dist: number, aspect: number): { maxX: number; maxY: number } {
  const cam = new THREE.PerspectiveCamera(HALL_CAM_FOV, aspect, HALL_CAM_NEAR, HALL_CAM_FAR)
  const x = Math.sin(HALL_CAM_YAW) * Math.cos(HALL_CAM_PITCH) * dist
  const y = Math.sin(HALL_CAM_PITCH) * dist
  const z = Math.cos(HALL_CAM_YAW) * Math.cos(HALL_CAM_PITCH) * dist
  cam.position.set(HALL_CAM_LOOK_X + x, y, HALL_CAM_LOOK_Z + z)
  cam.lookAt(HALL_CAM_LOOK_X, 0, HALL_CAM_LOOK_Z)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  let maxX = 0
  let maxY = 0
  for (const cx of [-HALL_W / 2, HALL_W / 2]) {
    for (const cz of [-HALL_D / 2, HALL_D / 2]) {
      for (const cy of [0, 3.15]) {
        const v = new THREE.Vector3(cx, cy, cz).project(cam)
        maxX = Math.max(maxX, Math.abs(v.x))
        maxY = Math.max(maxY, Math.abs(v.y))
      }
    }
  }
  return { maxX, maxY }
}

describe('hall opening view', () => {
  it('frames the whole hall from a medium-close angle, with room to zoom in and out', () => {
    expect(HALL_CAM_DIST).toBeGreaterThan(HALL_CAM_MIN_DIST)
    expect(HALL_CAM_DIST).toBeLessThan(HALL_CAM_MAX_DIST)
    expect(HALL_CAM_MIN_DIST).toBeGreaterThanOrEqual(6)
    expect(HALL_CAM_MIN_DIST).toBeLessThan(18)
    expect(HALL_CAM_MAX_DIST).toBeGreaterThanOrEqual(HALL_CAM_DIST + 30)
    expect(HALL_CAM_PITCH).toBeGreaterThan(0.4)
    expect(HALL_CAM_PITCH).toBeLessThan(0.75)
    expect(HALL_CAM_NEAR).toBeGreaterThanOrEqual(0.5)
    expect(HALL_CAM_FAR).toBeGreaterThan(HALL_CAM_MAX_DIST + HALL_W)
    expect(HALL_OCCLUDE_M).toBeGreaterThan(3)

    const eye = hallCameraEye()
    expect(eye.y).toBeGreaterThan(20)
    const outside =
      Math.abs(eye.x - HALL_CAM_LOOK_X) > HALL_W / 2 || Math.abs(eye.z - HALL_CAM_LOOK_Z) > HALL_D / 2
    expect(outside).toBe(true)

    const height = hallPassengerHeightM()
    expect(height).toBeGreaterThanOrEqual(1.65)
    expect(height).toBeLessThanOrEqual(1.9)

    // Default: the shell fits on a 3:2 screen. A standing figure is a person in the crowd,
    // not the whole picture. Foreshortening is included by projecting head and feet.
    const framed = shellReach(HALL_CAM_DIST, 1.5)
    expect(framed.maxX).toBeLessThan(0.92)
    expect(framed.maxY).toBeLessThan(0.85)
    const standing = figureSpan(HALL_CAM_DIST, 1.6)
    expect(standing).toBeGreaterThan(0.04)
    expect(standing).toBeLessThan(0.1)

    // Closest zoom reads one passenger. A figure fills more of the frame than a group shot.
    const close = figureSpan(HALL_CAM_MIN_DIST, 1.6)
    expect(close).toBeGreaterThan(0.25)
    expect(close).toBeLessThan(0.9)
  })
})
