import { describe, expect, it } from 'vitest'
import { clamp, createRng } from './rng.ts'

describe('rng', () => {
  it('is deterministic and in range', () => {
    const a = createRng(9), b = createRng(9)
    for (let i = 0; i < 100; i++) {
      const x = a.next()
      expect(x).toBe(b.next())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
    const r = createRng(1)
    for (let i = 0; i < 50; i++) expect(r.int(3, 6)).toBeGreaterThanOrEqual(3)
    expect(() => r.pick([])).toThrow()
    expect(clamp(5, 0, 1)).toBe(1)
  })
})
