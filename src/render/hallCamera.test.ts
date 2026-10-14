import { describe, expect, it } from 'vitest'
import { HALL_D, HALL_W } from '../game/terminal'
import {
  HALL_CAM_DIST,
  HALL_CAM_LOOK_X,
  HALL_CAM_LOOK_Z,
  HALL_CAM_MAX_DIST,
  HALL_CAM_MIN_DIST,
  HALL_CAM_NEAR,
  HALL_CAM_PITCH,
  HALL_OCCLUDE_M,
  hallCameraEye,
  hallPassengerHeightM,
} from './hallCamera'

describe('hall opening view', () => {
  it('sits 8–12 m back on an elevated view down the curb-to-gate walk', () => {
    expect(HALL_CAM_DIST).toBeGreaterThanOrEqual(8)
    expect(HALL_CAM_DIST).toBeLessThanOrEqual(12)
    expect(HALL_CAM_DIST).toBeGreaterThanOrEqual(HALL_CAM_MIN_DIST)
    expect(HALL_CAM_DIST).toBeLessThan(HALL_CAM_MAX_DIST)
    expect(HALL_CAM_PITCH).toBeGreaterThan(0.45)
    expect(HALL_CAM_PITCH).toBeLessThan(0.9)
    expect(HALL_CAM_NEAR).toBeGreaterThanOrEqual(0.5)
    expect(HALL_OCCLUDE_M).toBeGreaterThan(3)

    const eye = hallCameraEye()
    expect(eye.y).toBeGreaterThan(5)
    expect(eye.x).toBeLessThan(HALL_CAM_LOOK_X)
    expect(Math.abs(eye.x)).toBeLessThan(HALL_W / 2 - 3)
    expect(Math.abs(eye.z)).toBeLessThan(HALL_D / 2 - 3)
    const back = Math.hypot(eye.x - HALL_CAM_LOOK_X, eye.z - HALL_CAM_LOOK_Z)
    expect(back).toBeGreaterThanOrEqual(8)
    expect(back).toBeLessThanOrEqual(12)

    const height = hallPassengerHeightM()
    expect(height).toBeGreaterThanOrEqual(1.65)
    expect(height).toBeLessThanOrEqual(1.9)
  })
})
