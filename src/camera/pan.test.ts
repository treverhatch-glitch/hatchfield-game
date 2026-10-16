import { describe, expect, it } from 'vitest'
import { ORBIT_DEFAULT_DIST, PAN_BASE_WU, panZoomScale } from './orbit'
import { apronForward, apronRight } from './pan'
import { zoomToCursorShift } from './zoom'

describe('apron camera', () => {
  it('treats W as forward along the look direction', () => {
    expect(apronForward(1, 0)).toBeGreaterThan(0)
    expect(apronForward(0, 1)).toBeLessThan(0)
    expect(apronRight(1, 0)).toBeGreaterThan(0)
    expect(apronRight(0, 1)).toBeLessThan(0)
  })

  it('scales keyboard pan with zoom and keeps the default under a runway-length overshoot', () => {
    expect(panZoomScale(ORBIT_DEFAULT_DIST)).toBe(1)
    expect(panZoomScale(20)).toBeCloseTo(0.35)
    expect(panZoomScale(280)).toBeCloseTo(2.6)
    const wuPerSec = PAN_BASE_WU * 2 * panZoomScale(ORBIT_DEFAULT_DIST)
    const metresPerSec = wuPerSec / 0.45
    expect(metresPerSec).toBeGreaterThan(30)
    expect(metresPerSec).toBeLessThan(70)
  })

  it('shifts the pivot so the point under the cursor stays put', () => {
    const shift = zoomToCursorShift({ x: 10, z: 4 }, { x: 14, z: 1 })
    expect(shift).toEqual({ x: -4, z: 3 })
    expect(zoomToCursorShift(null, { x: 1, z: 1 })).toEqual({ x: 0, z: 0 })
  })
})
