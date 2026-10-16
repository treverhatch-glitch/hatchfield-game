import { describe, expect, it } from 'vitest'
import { FLOOR_TO_FLOOR_M as FLOOR_GAP } from './floors.ts'
import {
  BELT_W_M,
  CHILD_MAX_M,
  CHILD_MIN_M,
  CLEAR_H_GROUND_M,
  CURB_DOOR_H_M,
  DESK_H_M,
  DOOR_H_M,
  FLOOR_TO_FLOOR_M,
  PERSON_M,
  PERSON_MAX_M,
  PERSON_MIN_M,
  ROOF_H_1_M,
  ROOF_H_2_M,
  SEAT_H_M,
  SHOULDER_M,
  roofHeightM,
} from './scale.ts'

describe('terminal scale', () => {
  it('pins the metre scale the hall draws at', () => {
    expect(PERSON_M).toBe(1.75)
    expect(PERSON_MIN_M).toBe(1.55)
    expect(PERSON_MAX_M).toBe(1.95)
    expect(CHILD_MIN_M).toBe(1)
    expect(CHILD_MAX_M).toBe(1.4)
    expect(SHOULDER_M).toBe(0.5)
    expect(DOOR_H_M).toBe(2.2)
    expect(CURB_DOOR_H_M).toBe(2.4)
    expect(DESK_H_M).toBe(1.1)
    expect(BELT_W_M).toBe(0.8)
    expect(SEAT_H_M).toBe(0.45)
    expect(FLOOR_TO_FLOOR_M).toBe(5)
    expect(FLOOR_TO_FLOOR_M).toBe(FLOOR_GAP)
    expect(CLEAR_H_GROUND_M).toBe(4.2)
    expect(roofHeightM(1)).toBe(ROOF_H_1_M)
    expect(roofHeightM(2)).toBe(ROOF_H_2_M)
    expect(ROOF_H_1_M).toBe(6)
    expect(ROOF_H_2_M).toBe(9)
  })
})
