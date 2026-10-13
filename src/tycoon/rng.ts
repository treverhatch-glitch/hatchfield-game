/** Small deterministic generator so bids stay stable in tests and saves. */
export function createRng(seed: number) {
  let a = seed >>> 0 || 1
  return {
    next(): number {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    getState(): number {
      return a >>> 0
    },
    setState(n: number) {
      a = n >>> 0 || 1
    },
  }
}

export type Rng = ReturnType<typeof createRng>
