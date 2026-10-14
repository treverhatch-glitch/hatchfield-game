import { describe, expect, it } from 'vitest'
import { HALL_CAMERA, hallRoomEdge } from './hallFrame'

describe('Hall default framing', () => {
  it('keeps the room AABB inside a playtest frame and fills it', () => {
    for (const aspect of [16 / 9, 4 / 3, 1440 / 900]) {
      const edge = hallRoomEdge(aspect)
      expect(edge, `aspect ${aspect.toFixed(3)}`).toBeLessThanOrEqual(0.96)
      // A far camera leaves the shell as a small shape in fog. This one uses the frame.
      expect(edge, `aspect ${aspect.toFixed(3)}`).toBeGreaterThan(0.75)
    }
    expect(HALL_CAMERA.dist).toBeLessThan(52)
  })
})
