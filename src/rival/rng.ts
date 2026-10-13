/** Mulberry32. `state()` is a valid seed for the next draw. */
export interface RivalRng {
  next(): number
  state(): number
}

export function createRivalRng(seed: number): RivalRng {
  let s = seed >>> 0
  if (s === 0) s = 1
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0
      let t = Math.imul(s ^ (s >>> 15), s | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    state: () => s,
  }
}
