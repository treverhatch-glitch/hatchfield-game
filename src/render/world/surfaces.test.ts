import { describe, expect, it } from 'vitest'
import { kerbGeometry } from './surfaces'

describe('surfaces', () => {
  it('kerbGeometry builds geometry with sidewalk', () => {
    const list = [
      { x: 0, z: 0, w: 0.2, d: 20 },
      { x: 1, z: 1, w: 20, d: 0.2, sidewalk: true }
    ]
    const g = kerbGeometry(list)
    expect(g.getAttribute('position').count).toBe(2 * 24)
    expect(g.getAttribute('color').count).toBe(2 * 24)
    expect(g.getIndex()!.count).toBe(2 * 36)
  })
})
