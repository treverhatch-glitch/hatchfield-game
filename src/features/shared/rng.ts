/** Deterministic seeded PRNG (mulberry32). Same seed => same sequence. */
export interface Rng {
  next(): number
  int(minInclusive: number, maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  state(): number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a)),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty list')
      return items[Math.floor(next() * items.length)]
    },
    state: () => s,
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
