import { describe, expect, it } from 'vitest'
import { createRng, simRandom, usingSimRng } from './rng.ts'

describe('sim rng', () => {
  it('repeats a mulberry32 stream from the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seq = () => Array.from({ length: 8 }, () => a.next())
    const first = seq()
    expect(Array.from({ length: 8 }, () => b.next())).toEqual(first)
    expect(createRng(99).next()).not.toBe(first[0])
  })

  it('round-trips the stream through JSON', () => {
    const rng = createRng(7)
    rng.next()
    rng.next()
    const saved = JSON.parse(JSON.stringify(rng.snapshot()))
    const next = rng.next()
    const restored = createRng(1)
    restored.load(saved)
    expect(restored.next()).toBe(next)
    expect(restored.snapshot()).toEqual(rng.snapshot())
  })

  it('unseeded rolls still call Math.random', () => {
    const orig = Math.random
    const seen: number[] = []
    Math.random = () => {
      seen.push(1)
      return 0.25
    }
    try {
      const rng = createRng()
      usingSimRng(rng, () => {
        expect(simRandom()).toBe(0.25)
        expect(rng.int(0, 4)).toBe(1)
      })
      expect(seen.length).toBe(2)
      expect(rng.snapshot()).toEqual({ kind: 'math', state: 0 })
    } finally {
      Math.random = orig
    }
  })
})
