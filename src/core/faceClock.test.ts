import { describe, expect, it } from 'vitest'
import { formatSimDate } from '../game/sim'
import { clockLabel, dayIndex } from '../ui/timetable/time'
import { clockForFaceHour, faceHour, formatFaceDate } from './faceClock'

describe('face clock', () => {
  it('is the same sentence on the HUD and the timetable', () => {
    for (const t of [0, 22.5, 90, 135, 180 + 45, 7.5 * 13]) {
      expect(formatSimDate(t)).toBe(formatFaceDate(t))
      expect(formatSimDate(t)).toContain(clockLabel(t))
      expect(formatSimDate(t)).toContain(`Day ${dayIndex(t)}`)
    }
    expect(clockLabel(0)).toBe('00:00')
    expect(clockLabel(22.5)).toBe('03:00')
    expect(faceHour(0)).toBe(0)
    expect(faceHour(clockForFaceHour(2, 3))).toBeCloseTo(3)
  })
})
