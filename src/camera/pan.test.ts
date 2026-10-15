import { describe, expect, it } from 'vitest'
import { apronForward, apronRight } from './pan'
import { zoomToCursorShift } from './zoom'

describe('apron camera', () => {
  it('treats W as forward along the look direction', () => {
    expect(apronForward(1, 0)).toBeGreaterThan(0)
    expect(apronForward(0, 1)).toBeLessThan(0)
    expect(apronRight(1, 0)).toBeGreaterThan(0)
    expect(apronRight(0, 1)).toBeLessThan(0)
  })

  it('shifts the pivot so the point under the cursor stays put', () => {
    const shift = zoomToCursorShift({ x: 10, z: 4 }, { x: 14, z: 1 })
    expect(shift).toEqual({ x: -4, z: 3 })
    expect(zoomToCursorShift(null, { x: 1, z: 1 })).toEqual({ x: 0, z: 0 })
  })
})
