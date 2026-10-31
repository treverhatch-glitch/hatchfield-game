/** Mulberry32. Same seed, same stream. State is a plain uint32 so saves replay. */
import { detCos, detLog } from '../game/detMath'
export interface Rng {
  next(): number
  /** Inclusive min, exclusive max. */
  float(min: number, max: number): number
  state(): number
  load(state: number): void
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0 || 0x9e3779b9
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    float: (min, max) => min + next() * (max - min),
    state: () => s,
    load(state: number) {
      s = state >>> 0 || 0x9e3779b9
    },
  }
}

/** Box–Muller. Two uniforms become one standard normal, scaled to mean and sd. */
export function normal(rng: Rng, mean: number, sd: number): number {
  const u1 = Math.max(rng.next(), 1e-12)
  const u2 = rng.next()
  const z = Math.sqrt(-2 * detLog(u1)) * detCos(2 * Math.PI * u2)
  return mean + z * sd
}

export function hashSeed(seed: number, text: string): number {
  let h = (seed >>> 0) || 1
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0 || 1
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
