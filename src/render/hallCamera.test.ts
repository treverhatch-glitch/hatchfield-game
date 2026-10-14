import { describe, expect, it } from 'vitest'
import {
  HALL_CAM_DIST,
  HALL_CAM_MAX_DIST,
  HALL_CAM_MIN_DIST,
  HALL_CAM_PITCH,
  HALL_PAX_SCALE,
  hallPassengerHeightM,
} from './hallCamera'

describe('hall opening view', () => {
  it('starts close enough that a walker reads as a person', () => {
    expect(HALL_CAM_DIST).toBeLessThanOrEqual(18)
    expect(HALL_CAM_DIST).toBeGreaterThan(HALL_CAM_MIN_DIST)
    expect(HALL_CAM_DIST).toBeLessThan(HALL_CAM_MAX_DIST)
    expect(HALL_CAM_PITCH).toBeGreaterThan(0.4)
    expect(HALL_CAM_PITCH).toBeLessThan(0.8)
    expect(HALL_PAX_SCALE).toBeGreaterThan(1)
    const height = hallPassengerHeightM()
    expect(height).toBeGreaterThanOrEqual(1.65)
    expect(height).toBeLessThanOrEqual(1.9)
  })
})
